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

// Task 2: calendar hardening -- raises inside the window, backdated
// corrections, the New Year reset boundary, colliding/clamped paydays, and
// a full twelve-month reconciliation. Schedule avansDay=15/salaryDay=28
// resolves cleanly within its own nominal month for all of 2026 (no
// year/month-boundary shifting), confirmed via the same throwaway Node
// check referenced above -- used here whenever a test does not specifically
// target boundary-crossing behavior.
describe("accruedGrossBetween — calendar hardening (Task 2)", () => {
  const cleanSchedule = { avansDay: 15, salaryDay: 28 };

  it("a mid-window raise: events before the effective date use the old oklad, on/after use the new one", () => {
    const history: SalaryHistoryEntry[] = [
      { effectiveFrom: "2025-06-01", grossAmountKopecks: 500_000_00 },
      { effectiveFrom: "2026-04-01", grossAmountKopecks: 700_000_00 },
    ];

    const total = accruedGrossBetween(cleanSchedule, history, "2026-01-01", {
      dateIso: "2026-07-15",
      kind: "avans",
    });

    // Jan/Feb/Mar (6 events) at the old oklad + Apr/May/Jun (6 events) at
    // the new oklad -- a hand-summed mixture, not either oklad times the
    // full six-month event count.
    const expected = 3 * 500_000_00 + 3 * 700_000_00;
    expect(total).toBe(expected);
    expect(total).not.toBe(6 * 500_000_00);
    expect(total).not.toBe(6 * 700_000_00);
  });

  it("a backdated correction entry is applied per-event by its own effective date, regardless of array insertion order", () => {
    // Deliberately unsorted: the raise, the original, then a later-inserted
    // backdated correction for February.
    const history: SalaryHistoryEntry[] = [
      { effectiveFrom: "2026-04-01", grossAmountKopecks: 700_000_00 },
      { effectiveFrom: "2025-06-01", grossAmountKopecks: 500_000_00 },
      { effectiveFrom: "2026-02-01", grossAmountKopecks: 550_000_00 },
    ];
    const target = { dateIso: "2026-07-15", kind: "avans" as const };

    const total = accruedGrossBetween(cleanSchedule, history, "2026-01-01", target);

    // Jan at 500k, Feb+Mar at the 550k correction, Apr/May/Jun at the 700k raise.
    const expected = 1 * 500_000_00 + 2 * 550_000_00 + 3 * 700_000_00;
    expect(total).toBe(expected);

    // Reordering the same entries must not change the result.
    const reordered = [history[2], history[0], history[1]] as SalaryHistoryEntry[];
    expect(accruedGrossBetween(cleanSchedule, reordered, "2026-01-01", target)).toBe(total);
  });

  it("a New Year payday shifting backwards across 1 January is attributed to the calendar date it actually resolves to", () => {
    // Schedule avans=20/salary=5: 2026's nominal January salary(5) resolves
    // to 2025-12-31 (the New Year holiday block shifts it back across the
    // year boundary), confirmed via the throwaway Node check.
    const schedule = { avansDay: 20, salaryDay: 5 };
    const history: SalaryHistoryEntry[] = [
      { effectiveFrom: "2025-01-01", grossAmountKopecks: 600_000_00 },
    ];

    const total = accruedGrossBetween(schedule, history, "2025-12-30", {
      dateIso: "2026-01-20",
      kind: "avans",
    });

    // Only the New-Year-shifted 2025-12-31 event falls strictly after the
    // 2025-12-30 bound and strictly before the 2026-01-20 target (2026's own
    // avans is the target itself). Every other nominal December/January
    // event resolves on or before the 20th/5th of its own month, well
    // outside this narrow window.
    expect(total).toBe(halfSplitGross(600_000_00, "salary"));
  });

  it("a schedule whose two day-of-month numbers resolve to the same calendar date is asserted in both orderings", () => {
    // November 2026: avansDay=6 and salaryDay=7 both resolve to 2026-11-06
    // (confirmed via the throwaway Node check) -- a clamping/shift-produced
    // collision distinct from Task 1's March example.
    const collisionSchedule = { avansDay: 6, salaryDay: 7 };
    const history: SalaryHistoryEntry[] = [
      { effectiveFrom: "2025-01-01", grossAmountKopecks: 450_000_00 },
    ];

    const intoSalaryTarget = accruedGrossBetween(collisionSchedule, history, "2026-10-15", {
      dateIso: "2026-11-06",
      kind: "salary",
    });
    expect(intoSalaryTarget).toBe(halfSplitGross(450_000_00, "avans"));

    const intoAvansTarget = accruedGrossBetween(collisionSchedule, history, "2026-10-15", {
      dateIso: "2026-11-06",
      kind: "avans",
    });
    expect(intoAvansTarget).toBe(0);
  });

  it("a day-of-month exceeding the month length (D-03 clamp) inside the window still accrues", () => {
    // avansDay=31 clamps in February 2026 (28 days) to the 28th, which then
    // shifts earlier to 2026-02-27 (a Saturday); salaryDay=20 needs no
    // clamp. Both confirmed via the throwaway Node check.
    const clampingSchedule = { avansDay: 31, salaryDay: 20 };
    const history: SalaryHistoryEntry[] = [
      { effectiveFrom: "2025-01-01", grossAmountKopecks: 400_000_00 },
    ];

    const total = accruedGrossBetween(clampingSchedule, history, "2026-01-31", {
      dateIso: "2026-03-01",
      kind: "avans",
    });

    // Only February's clamped avans (2026-02-27) and salary (2026-02-20)
    // fall in the window -- January's own day-31 avans resolves to
    // 2026-01-30, on or before the 2026-01-31 bound.
    expect(total).toBe(400_000_00);
  });

  it("a full twelve-month window totals exactly twelve whole monthly oklads for a single unchanging salary entry", () => {
    const history: SalaryHistoryEntry[] = [
      { effectiveFrom: "2025-01-01", grossAmountKopecks: 600_000_00 },
    ];

    const total = accruedGrossBetween(cleanSchedule, history, "2025-12-31", {
      dateIso: "2027-01-01",
      kind: "avans",
    });

    expect(total).toBe(12 * 600_000_00);
  });

  it("monotonicity: widening the window by moving the bound earlier never decreases the accrued total", () => {
    const history: SalaryHistoryEntry[] = [
      { effectiveFrom: "2025-01-01", grossAmountKopecks: 600_000_00 },
    ];
    const target = { dateIso: "2026-07-15", kind: "avans" as const };

    const narrow = accruedGrossBetween(cleanSchedule, history, "2026-06-20", target);
    const wider = accruedGrossBetween(cleanSchedule, history, "2026-05-01", target);
    const widest = accruedGrossBetween(cleanSchedule, history, "2026-01-01", target);

    expect(wider).toBeGreaterThanOrEqual(narrow);
    expect(widest).toBeGreaterThanOrEqual(wider);
    // Exact hand-derived values, since this schedule/history combination is
    // fully known: 1 event, 4 events, 12 events respectively.
    expect(narrow).toBe(300_000_00);
    expect(wider).toBe(1_200_000_00);
    expect(widest).toBe(3_600_000_00);
  });
});
