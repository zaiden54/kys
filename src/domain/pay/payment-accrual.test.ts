/**
 * Pure, database-free table for `periodGross` (pro-rata pay for one pay
 * period) and `accruedGrossBetween` (the sum over scheduled payments).
 *
 * Working-day counts are taken from the installed `date-holidays` RU data:
 * October 2026 has 22 working days (11 of them on days 1–15), November 2026
 * has 20 (4 November is a holiday; 9 on days 1–15), January 2027 has 15.
 */

import { describe, expect, it } from "vitest";
import { format } from "date-fns";
import { generatePaymentEvents } from "../schedule/resolve-payment-date";
import { accruedGrossBetween, leavesFrom, periodGross, type SalaryHistoryEntry } from "./payment-accrual";

const OKLAD = 100_000_00;
const flat: SalaryHistoryEntry[] = [{ effectiveFrom: "2025-01-01", grossAmountKopecks: OKLAD }];
const NOV_FIRST_HALF = { year: 2026, monthIndex: 10, fromDay: 1, toDay: 15 };
const NOV_SECOND_HALF = { year: 2026, monthIndex: 10, fromDay: 16, toDay: 30 };

describe("periodGross", () => {
  it("pays each half-month by its share of the month's working days", () => {
    expect(periodGross(NOV_FIRST_HALF, flat)).toBe(45_000_00); // 9 / 20
    expect(periodGross(NOV_SECOND_HALF, flat)).toBe(55_000_00); // 11 / 20
    expect(periodGross({ year: 2026, monthIndex: 9, fromDay: 1, toDay: 15 }, flat)).toBe(50_000_00); // 11 / 22
  });

  it.each([1, 3, 99_999_99, 333_333_33, 10_000_001])(
    "a full month with no leave pays exactly the oklad across both halves (%i kopecks)",
    (gross) => {
      const history = [{ effectiveFrom: "2025-01-01", grossAmountKopecks: gross }];
      for (const monthIndex of [0, 1, 4, 9, 10, 11]) {
        const lastDay = new Date(2026, monthIndex + 1, 0).getDate();
        const first = periodGross({ year: 2026, monthIndex, fromDay: 1, toDay: 15 }, history);
        const second = periodGross({ year: 2026, monthIndex, fromDay: 16, toDay: lastDay }, history);
        expect(first + second).toBe(gross);
      }
    },
  );

  it("leave days (paid or unpaid) are not worked days", () => {
    // 16–20 November are five working days out of the second half's eleven.
    const leaves = leavesFrom([{ startDate: "2026-11-16", endDate: "2026-11-20" }]);
    expect(periodGross(NOV_SECOND_HALF, flat, leaves)).toBe(30_000_00); // 6 / 20
    expect(periodGross(NOV_FIRST_HALF, flat, leaves)).toBe(45_000_00); // untouched
  });

  it("a leave covering a whole half pays nothing for it", () => {
    const leaves = leavesFrom([{ startDate: "2026-11-01", endDate: "2026-11-15" }]);
    expect(periodGross(NOV_FIRST_HALF, flat, leaves)).toBe(0);
  });

  it("a raise inside a period applies from its effective day", () => {
    const history: SalaryHistoryEntry[] = [
      { effectiveFrom: "2025-01-01", grossAmountKopecks: 100_000_00 },
      { effectiveFrom: "2026-11-09", grossAmountKopecks: 200_000_00 },
    ];
    // Working days 1–15 Nov: 2, 3, 5, 6 at the old oklad, 9–13 at the new one.
    expect(periodGross(NOV_FIRST_HALF, history)).toBe(Math.round((4 * 100_000_00 + 5 * 200_000_00) / 20));
  });

  it("days before the first salary entry earn nothing (a mid-month start is pro rata)", () => {
    const history: SalaryHistoryEntry[] = [{ effectiveFrom: "2026-11-09", grossAmountKopecks: OKLAD }];
    expect(periodGross(NOV_FIRST_HALF, history)).toBe(25_000_00); // 5 / 20
    expect(periodGross({ year: 2026, monthIndex: 9, fromDay: 16, toDay: 31 }, history)).toBe(0);
  });
});

describe("pay periods of scheduled payments", () => {
  it("payments on the 1st and 15th: the 15th pays this month's 1–15, the 1st pays last month's 16–end", () => {
    const events = generatePaymentEvents({ avansDay: 15, salaryDay: 1 }, new Date(2026, 10, 1), 2);
    const summary = events.map((event) => [
      format(event.date, "yyyy-MM-dd"),
      event.kind,
      `${event.period.monthIndex + 1}: ${event.period.fromDay}–${event.period.toDay}`,
    ]);
    expect(summary).toEqual([
      ["2026-10-30", "salary", "10: 16–31"], // 1 Nov is a Sunday -> last working day before it
      ["2026-11-13", "avans", "11: 1–15"], // 15 Nov is a Sunday
      ["2026-12-01", "salary", "11: 16–30"],
      ["2026-12-15", "avans", "12: 1–15"],
    ]);
  });

  it("payments on the 6th and 21st: the 21st pays 1–15, the 6th pays last month's 16–end", () => {
    const events = generatePaymentEvents({ avansDay: 21, salaryDay: 6 }, new Date(2026, 10, 1), 1);
    expect(events.map((event) => [event.kind, event.period.monthIndex + 1, event.period.fromDay, event.period.toDay])).toEqual([
      ["salary", 10, 16, 31],
      ["avans", 11, 1, 15],
    ]);
  });

  it("an avans scheduled before the 15th still pays days 1–15", () => {
    const events = generatePaymentEvents({ avansDay: 10, salaryDay: 25 }, new Date(2026, 10, 1), 1);
    const avans = events.find((event) => event.kind === "avans")!;
    expect([avans.period.monthIndex + 1, avans.period.fromDay, avans.period.toDay]).toEqual([11, 1, 15]);
  });
});

describe("accruedGrossBetween", () => {
  const schedule = { avansDay: 20, salaryDay: 5 };

  it("returns zero when the target is on or before the window bound", () => {
    expect(accruedGrossBetween(schedule, flat, "2026-06-30", { dateIso: "2026-06-30", kind: "salary" })).toBe(0);
    expect(accruedGrossBetween(schedule, flat, "2026-06-30", { dateIso: "2026-01-01", kind: "avans" })).toBe(0);
  });

  it("sums the pay periods of every payment strictly inside the window", () => {
    // After 30 Jun, before the 4 Sep salary: 3 Jul (Jun 16–30), 20 Jul (Jul 1–15),
    // 5 Aug (Jul 16–31), 20 Aug (Aug 1–15).
    const total = accruedGrossBetween(schedule, flat, "2026-06-30", { dateIso: "2026-09-04", kind: "salary" });
    const expected =
      periodGross({ year: 2026, monthIndex: 5, fromDay: 16, toDay: 30 }, flat) +
      OKLAD + // all of July
      periodGross({ year: 2026, monthIndex: 7, fromDay: 1, toDay: 15 }, flat);
    expect(total).toBe(expected);
  });

  it("leave reduces the accrued total by exactly the leave's working days", () => {
    const leaves = leavesFrom([{ startDate: "2026-11-16", endDate: "2026-11-20" }]);
    const target = { dateIso: "2027-01-01", kind: "avans" as const };
    const without = accruedGrossBetween(schedule, flat, "2026-10-31", target);
    const withLeave = accruedGrossBetween(schedule, flat, "2026-10-31", target, leaves);
    expect(without - withLeave).toBe(25_000_00); // 5 of November's 20 working days
  });

  it("same-resolved-date ordering: a same-day avans accrues into a salary target, never the reverse", () => {
    // March 2026: avansDay=6 and salaryDay=7 both resolve to 2026-03-06.
    const collision = { avansDay: 6, salaryDay: 7 };
    const marchFirstHalf = periodGross({ year: 2026, monthIndex: 2, fromDay: 1, toDay: 15 }, flat);
    expect(accruedGrossBetween(collision, flat, "2026-03-01", { dateIso: "2026-03-06", kind: "salary" })).toBe(marchFirstHalf);
    expect(accruedGrossBetween(collision, flat, "2026-03-01", { dateIso: "2026-03-06", kind: "avans" })).toBe(0);
  });

  it("a full year of payments totals exactly twelve oklads", () => {
    // Window opens after the Dec 2025 avans and closes before the Jan 2027
    // avans: salary payments for Dec 2025 16–31 through Dec 2026 16–31 plus
    // twelve avans halves = Dec 2025 second half + all twelve 2026 months.
    const total = accruedGrossBetween(schedule, flat, "2025-12-20", { dateIso: "2027-01-20", kind: "avans" });
    const dec2025SecondHalf = periodGross({ year: 2025, monthIndex: 11, fromDay: 16, toDay: 31 }, flat);
    expect(total).toBe(dec2025SecondHalf + 12 * OKLAD);
  });

  it("is deterministic and does not mutate the caller's salary history", () => {
    const history = [...flat];
    const snapshot = JSON.stringify(history);
    const target = { dateIso: "2026-09-04", kind: "salary" as const };
    expect(accruedGrossBetween(schedule, history, "2026-06-30", target)).toBe(
      accruedGrossBetween(schedule, history, "2026-06-30", target),
    );
    expect(JSON.stringify(history)).toBe(snapshot);
  });
});
