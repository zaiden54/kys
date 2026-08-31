// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/app/actions/vacation", () => ({
  saveVacationAction: vi.fn().mockResolvedValue({ success: true }),
  deleteVacationAction: vi.fn().mockResolvedValue({ success: true }),
}));

import { VacationRow } from "./vacation-row";
import { saveVacationAction } from "@/app/actions/vacation";
import type { VacationRow as VacationRowData } from "@/lib/db/vacation-repository";
import type { Kopecks } from "@/domain/money";

afterEach(cleanup);

function makeVacation(overrides: Partial<VacationRowData> = {}): VacationRowData {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    userId: "user-01",
    startDate: "2026-09-10",
    endDate: "2026-09-16",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const grossKopecks = 1000000 as Kopecks;

function getStartDateInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[name="startDate"]');
  if (!input) throw new Error("startDate input not found");
  return input as HTMLInputElement;
}

function getEndDateInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[name="endDate"]');
  if (!input) throw new Error("endDate input not found");
  return input as HTMLInputElement;
}

describe("VacationRow edit-form resync (mirrors bonus-row.render.test.tsx, closes 03-REVIEW.md WR-01)", () => {
  it("discards an unsaved edit when the user cancels and reopens edit mode", () => {
    const vacationFixture = makeVacation();
    const { container } = render(<VacationRow vacation={vacationFixture} grossKopecks={grossKopecks} />);

    fireEvent.click(screen.getByRole("button", { name: "Изменить отпуск" }));
    const startDateInput = getStartDateInput(container);
    expect(startDateInput.value).toBe("2026-09-10");

    fireEvent.change(startDateInput, { target: { value: "2026-09-11" } });
    expect(startDateInput.value).toBe("2026-09-11");

    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
    fireEvent.click(screen.getByRole("button", { name: "Изменить отпуск" }));

    const reopenedInput = getStartDateInput(container);
    expect(reopenedInput.value).toBe("2026-09-10");
  });

  it("resyncs the form to a vacation prop update delivered while the row is still mounted", () => {
    const vacationV1 = makeVacation({ endDate: "2026-09-16" });
    const vacationV2 = makeVacation({ endDate: "2026-09-20" });
    const { container, rerender } = render(
      <VacationRow vacation={vacationV1} grossKopecks={grossKopecks} />,
    );

    rerender(<VacationRow vacation={vacationV2} grossKopecks={grossKopecks} />);

    fireEvent.click(screen.getByRole("button", { name: "Изменить отпуск" }));
    const endDateInput = getEndDateInput(container);
    expect(endDateInput.value).toBe("2026-09-20");
  });

  it("WR-01: preserves an in-progress (dirty) edit when a concurrent prop update lands mid-edit", () => {
    const vacationV1 = makeVacation({ startDate: "2026-09-10", endDate: "2026-09-16" });
    const vacationV2 = makeVacation({ startDate: "2026-09-10", endDate: "2026-09-25" });
    const { container, rerender } = render(
      <VacationRow vacation={vacationV1} grossKopecks={grossKopecks} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Изменить отпуск" }));
    const startDateInput = getStartDateInput(container);
    fireEvent.change(startDateInput, { target: { value: "2026-09-12" } });
    expect(startDateInput.value).toBe("2026-09-12");

    // A concurrent edit from another device/tab revalidates this row's props
    // while the user still has unsaved (dirty) input in the start-date field.
    rerender(<VacationRow vacation={vacationV2} grossKopecks={grossKopecks} />);

    // The user's untouched dirty field is not silently clobbered...
    expect(startDateInput.value).toBe("2026-09-12");
    // ...while a field the user never touched adopts the fresh server value.
    const endDateInput = getEndDateInput(container);
    expect(endDateInput.value).toBe("2026-09-25");
  });

  it("WR-02: a superseded (cancelled) in-flight save does not clobber a newer edit session", async () => {
    const vacationFixture = makeVacation();
    let resolveFirstSave!: (value: { success: true }) => void;
    const firstSave = new Promise<{ success: true }>((resolve) => {
      resolveFirstSave = resolve;
    });
    vi.mocked(saveVacationAction).mockReturnValueOnce(firstSave);

    const { container } = render(<VacationRow vacation={vacationFixture} grossKopecks={grossKopecks} />);

    // First edit session: change the start date and submit (save left in flight).
    fireEvent.click(screen.getByRole("button", { name: "Изменить отпуск" }));
    fireEvent.change(getStartDateInput(container), { target: { value: "2026-09-11" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    // handleSubmit's resolver validation is async, so the actual save call
    // (and this component's session-token capture) lands a tick later — wait
    // for it to actually fire before cancelling, to model a genuinely
    // in-flight network request rather than a same-tick validation race.
    await waitFor(() => expect(vi.mocked(saveVacationAction)).toHaveBeenCalledTimes(1));

    // Cancel before the first save resolves — row flips back to display.
    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(screen.queryByRole("button", { name: "Изменить отпуск" })).not.toBeNull();

    // Reopen and start a second, different edit session.
    fireEvent.click(screen.getByRole("button", { name: "Изменить отпуск" }));
    fireEvent.change(getStartDateInput(container), { target: { value: "2026-09-13" } });

    // The first (now-superseded) save resolves late.
    await act(async () => {
      resolveFirstSave({ success: true });
      await firstSave;
    });

    // The second edit session must survive untouched — still in edit mode,
    // still showing the second session's typed value.
    expect(screen.queryByRole("button", { name: "Сохранить" })).not.toBeNull();
    const startDateInput = getStartDateInput(container);
    expect(startDateInput.value).toBe("2026-09-13");
  });
});
