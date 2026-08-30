// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/app/actions/bonus", () => ({
  saveBonusAction: vi.fn().mockResolvedValue({ success: true }),
  deleteBonusAction: vi.fn().mockResolvedValue({ success: true }),
}));

import { BonusRow } from "./bonus-row";
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
});
