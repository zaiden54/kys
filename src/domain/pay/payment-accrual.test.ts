/**
 * Pure, database-free table for `accruedGrossBetween` and the relocated
 * `halfSplitGross` (moved here from src/app/actions/forecast.ts).
 *
 * Real payment dates asserted below were confirmed against the installed
 * `date-holidays@3.36.0` RU calendar data via a throwaway Node check before
 * being written into this file (see 01-10-SUMMARY.md), matching the project
 * convention established in plan 01-06 (see STATE.md).
 */

import { describe, expect, it } from "vitest";
import { accruedGrossBetween, halfSplitGross, type SalaryHistoryEntry } from "./payment-accrual";

describe("halfSplitGross", () => {
  it.each([1, 2, 3, 99_999_99, 10_000_001, 10_000_002, 100_000_00])(
    "reconciles exactly for %i kopecks: avans + salary === gross",
    (gross) => {
      expect(halfSplitGross(gross, "avans") + halfSplitGross(gross, "salary")).toBe(gross);
    },
  );

  it("the review's exact case: the odd remainder kopeck lands on salary, never on both", () => {
    expect(halfSplitGross(10_000_001, "avans")).toBe(5_000_000);
    expect(halfSplitGross(10_000_001, "salary")).toBe(5_000_001);
  });

  it("splits an even-kopeck gross evenly between the two kinds", () => {
    expect(halfSplitGross(100_000_00, "avans")).toBe(5_000_000);
    expect(halfSplitGross(100_000_00, "salary")).toBe(5_000_000);
  });

  it("is deterministic: identical arguments always return identical values", () => {
    expect(halfSplitGross(10_000_001, "avans")).toBe(halfSplitGross(10_000_001, "avans"));
    expect(halfSplitGross(10_000_001, "salary")).toBe(halfSplitGross(10_000_001, "salary"));
  });
});

describe("accruedGrossBetween", () => {
  const schedule2005 = { avansDay: 20, salaryDay: 5 };

  it("returns zero when the target date equals the window bound", () => {
    const history: SalaryHistoryEntry[] = [
      { effectiveFrom: "2025-01-01", grossAmountKopecks: 600_000_00 },
    ];
    expect(
      accruedGrossBetween(schedule2005, history, "2026-06-30", {
        dateIso: "2026-06-30",
        kind: "salary",
      }),
    ).toBe(0);
  });

  it("returns zero when the target date is before the window bound", () => {
    const history: SalaryHistoryEntry[] = [
      { effectiveFrom: "2025-01-01", grossAmountKopecks: 600_000_00 },
    ];
    expect(
      accruedGrossBetween(schedule2005, history, "2026-06-30", {
        dateIso: "2026-01-01",
        kind: "avans",
      }),
    ).toBe(0);
  });

  it("accrues exactly July and August's four events (two whole monthly oklads) for a September salary target", () => {
    const history: SalaryHistoryEntry[] = [
      { effectiveFrom: "2025-01-01", grossAmountKopecks: 600_000_00 },
    ];
    const total = accruedGrossBetween(schedule2005, history, "2026-06-30", {
      dateIso: "2026-09-04",
      kind: "salary",
    });
    expect(total).toBe(1_200_000_00);
  });

  it("is deterministic and does not mutate or reorder the caller's salary-history array", () => {
    const history: SalaryHistoryEntry[] = [
      { effectiveFrom: "2025-01-01", grossAmountKopecks: 600_000_00 },
    ];
    const historySnapshot = JSON.stringify(history);
    const target = { dateIso: "2026-09-04", kind: "salary" as const };

    const first = accruedGrossBetween(schedule2005, history, "2026-06-30", target);
    const second = accruedGrossBetween(schedule2005, history, "2026-06-30", target);

    expect(second).toBe(first);
    expect(JSON.stringify(history)).toBe(historySnapshot);
  });

  it("same-resolved-date ordering: an avans event accrues into a same-date salary target", () => {
    // March 2026: avansDay=6 and salaryDay=7 both resolve to 2026-03-06
    // (confirmed via throwaway Node check against date-holidays@3.36.0).
    const collisionSchedule = { avansDay: 6, salaryDay: 7 };
    const history: SalaryHistoryEntry[] = [
      { effectiveFrom: "2025-01-01", grossAmountKopecks: 400_000_00 },
    ];

    const total = accruedGrossBetween(collisionSchedule, history, "2026-03-01", {
      dateIso: "2026-03-06",
      kind: "salary",
    });

    expect(total).toBe(halfSplitGross(400_000_00, "avans"));
  });

  it("same-resolved-date ordering: a salary event does NOT accrue into a same-date avans target", () => {
    const collisionSchedule = { avansDay: 6, salaryDay: 7 };
    const history: SalaryHistoryEntry[] = [
      { effectiveFrom: "2025-01-01", grossAmountKopecks: 400_000_00 },
    ];

    const total = accruedGrossBetween(collisionSchedule, history, "2026-03-01", {
      dateIso: "2026-03-06",
      kind: "avans",
    });

    expect(total).toBe(0);
  });

  it("an event dated before the earliest salary-history entry contributes zero rather than borrowing a later entry's amount", () => {
    const cleanSchedule = { avansDay: 15, salaryDay: 28 };
    // History starts in February; January's two events (2026-01-15,
    // 2026-01-28) predate it entirely.
    const history: SalaryHistoryEntry[] = [
      { effectiveFrom: "2026-02-01", grossAmountKopecks: 500_000_00 },
    ];

    const total = accruedGrossBetween(cleanSchedule, history, "2026-01-01", {
      dateIso: "2026-02-13",
      kind: "avans",
    });

    expect(total).toBe(0);
  });
});
