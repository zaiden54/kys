// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/app/actions/bonus", () => ({
  saveBonusAction: vi.fn().mockResolvedValue({ success: true }),
  deleteBonusAction: vi.fn().mockResolvedValue({ success: true }),
}));

import { BonusRow } from "./bonus-row";
import { saveBonusAction } from "@/app/actions/bonus";
import type { BonusRow as BonusRowData } from "@/lib/db/bonus-repository";

afterEach(cleanup);

function makeBonus(overrides: Partial<BonusRowData> = {}): BonusRowData {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    userId: "user-01",
    amountKopecks: 500000,
    date: "2026-09-15",
    note: "Тест",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("BonusRow edit-form resync (closes 02-VERIFICATION.md CR-01, truth 11)", () => {
  it("discards an unsaved edit when the user cancels and reopens edit mode", () => {
    const bonusFixture = makeBonus();
    render(<BonusRow bonus={bonusFixture} />);

    fireEvent.click(screen.getByRole("button", { name: "Изменить бонус" }));
    const amountInput = screen.getByRole("spinbutton") as HTMLInputElement;
    expect(amountInput.value).toBe("5000");

    fireEvent.change(amountInput, { target: { value: "999" } });
    expect(amountInput.value).toBe("999");

    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
    fireEvent.click(screen.getByRole("button", { name: "Изменить бонус" }));

    const reopenedInput = screen.getByRole("spinbutton") as HTMLInputElement;
    expect(reopenedInput.value).toBe("5000");
  });

  it("resyncs the form to a bonus prop update delivered while the row is still mounted", () => {
    const bonusV1 = makeBonus({ amountKopecks: 500000 });
    const bonusV2 = makeBonus({ amountKopecks: 750000 });
    const { rerender } = render(<BonusRow bonus={bonusV1} />);

    rerender(<BonusRow bonus={bonusV2} />);

    fireEvent.click(screen.getByRole("button", { name: "Изменить бонус" }));
    const amountInput = screen.getByRole("spinbutton") as HTMLInputElement;
    expect(amountInput.value).toBe("7500");
  });

  it("WR-01: preserves an in-progress (dirty) edit when a concurrent prop update lands mid-edit", () => {
    const bonusV1 = makeBonus({ amountKopecks: 500000, note: "Тест" });
    const bonusV2 = makeBonus({ amountKopecks: 900000, note: "Изменено на другом устройстве" });
    const { rerender } = render(<BonusRow bonus={bonusV1} />);

    fireEvent.click(screen.getByRole("button", { name: "Изменить бонус" }));
    const amountInput = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: "123" } });
    expect(amountInput.value).toBe("123");

    // A concurrent edit from another device/tab revalidates this row's props
    // while the user still has unsaved (dirty) input in the amount field.
    rerender(<BonusRow bonus={bonusV2} />);

    // The user's untouched dirty field is not silently clobbered...
    expect(amountInput.value).toBe("123");
    // ...while a field the user never touched adopts the fresh server value.
    const noteInput = screen.getByRole("textbox") as HTMLInputElement;
    expect(noteInput.value).toBe("Изменено на другом устройстве");
  });

  it("WR-02: a superseded (cancelled) in-flight save does not clobber a newer edit session", async () => {
    const bonusFixture = makeBonus();
    let resolveFirstSave!: (value: { success: true }) => void;
    const firstSave = new Promise<{ success: true }>((resolve) => {
      resolveFirstSave = resolve;
    });
    vi.mocked(saveBonusAction).mockReturnValueOnce(firstSave);

    render(<BonusRow bonus={bonusFixture} />);

    // First edit session: change the amount and submit (save left in flight).
    fireEvent.click(screen.getByRole("button", { name: "Изменить бонус" }));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "111" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    // handleSubmit's resolver validation is async, so the actual save call
    // (and this component's session-token capture) lands a tick later — wait
    // for it to actually fire before cancelling, to model a genuinely
    // in-flight network request rather than a same-tick validation race.
    await waitFor(() => expect(vi.mocked(saveBonusAction)).toHaveBeenCalledTimes(1));

    // Cancel before the first save resolves — row flips back to display.
    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(screen.queryByRole("button", { name: "Изменить бонус" })).not.toBeNull();

    // Reopen and start a second, different edit session.
    fireEvent.click(screen.getByRole("button", { name: "Изменить бонус" }));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "222" } });

    // The first (now-superseded) save resolves late.
    await act(async () => {
      resolveFirstSave({ success: true });
      await firstSave;
    });

    // The second edit session must survive untouched — still in edit mode,
    // still showing the second session's typed value.
    expect(screen.queryByRole("button", { name: "Сохранить" })).not.toBeNull();
    const amountInput = screen.getByRole("spinbutton") as HTMLInputElement;
    expect(amountInput.value).toBe("222");
  });
});
