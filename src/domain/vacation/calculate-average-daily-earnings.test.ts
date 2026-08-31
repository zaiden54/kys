import { describe, expect, it } from "vitest";
import {
  calculateAverageDailyEarnings,
  calculateVacationDays,
  calculateVacationPayGross,
  resolveVacationPaymentDate,
  type PremiumBonusEntry,
} from "./calculate-average-daily-earnings";
import type { SalaryHistoryEntry } from "../pay/payment-accrual";

describe("calculateVacationDays", () => {
  it("counts a single-day range as 1 day", () => {
    expect(calculateVacationDays("2026-08-01", "2026-08-01")).toBe(1);
  });

  it("counts an inclusive 10-day calendar range as 10, never 9 (Pitfall 3)", () => {
    expect(calculateVacationDays("2026-08-01", "2026-08-10")).toBe(10);
  });
});

describe("shiftOffWeekendsAndHolidays reuse via resolveVacationPaymentDate", () => {
  it("returns the -3-day date unshifted when it lands on a working day", () => {
    // 2026-08-14 (Fri) minus 3 calendar days = 2026-08-11 (Tue, working day)
    expect(resolveVacationPaymentDate("2026-08-14")).toBe("2026-08-11");
  });

  it("shifts the -3-day date earlier through the New Year holiday chain, matching resolvePaymentDate(2026, 0, 3)", () => {
    // 2026-01-06 minus 3 calendar days = 2026-01-03 (Sat, inside the New Year
    // public-holiday block) -> shifts back to 2025-12-31, the exact same
    // chain resolvePaymentDate(2026, 0, 3) already proves.
    expect(resolveVacationPaymentDate("2026-01-06")).toBe("2025-12-31");
  });
});

describe("calculateAverageDailyEarnings", () => {
  const CONSTANT_SALARY: SalaryHistoryEntry[] = [
    { effectiveFrom: "2020-01-01", grossAmountKopecks: 100_000_00 },
  ];

  it("computes the standard 12-full-month constant-salary average (341,297 kop/day)", () => {
    const result = calculateAverageDailyEarnings("2026-08-01", CONSTANT_SALARY, []);
    expect(result).toEqual({ averageDailyKopecks: 341_297, monthCount: 12 });
  });

  it("re-derives month-by-month for a mid-year raise aligned to a month boundary (375,427 kop/day)", () => {
    const salaryRows: SalaryHistoryEntry[] = [
      { effectiveFrom: "2020-01-01", grossAmountKopecks: 100_000_00 },
      { effectiveFrom: "2026-02-01", grossAmountKopecks: 120_000_00 },
    ];
    const result = calculateAverageDailyEarnings("2026-08-01", salaryRows, []);
    expect(result).toEqual({ averageDailyKopecks: 375_427, monthCount: 12 });
  });

  it("prorates a mid-month raise day-by-day, strictly between the old-rate-only and new-rate-only bounds (D-V04, Pitfall 4)", () => {
    // April 2026 (one of the 12 lookback months for an August vacation start)
    // gets a mid-month raise on the 16th: 15 days old rate, 15 days new rate.
    const oldRateKopecks = 100_000_00;
    const newRateKopecks = 150_000_00;
    const midMonthRows: SalaryHistoryEntry[] = [
      { effectiveFrom: "2020-01-01", grossAmountKopecks: oldRateKopecks },
      { effectiveFrom: "2026-04-16", grossAmountKopecks: newRateKopecks },
    ];
    const oldOnlyRows: SalaryHistoryEntry[] = [
      { effectiveFrom: "2020-01-01", grossAmountKopecks: oldRateKopecks },
    ];
    const newOnlyRows: SalaryHistoryEntry[] = [
      { effectiveFrom: "2020-01-01", grossAmountKopecks: newRateKopecks },
    ];

    const midMonth = calculateAverageDailyEarnings("2026-08-01", midMonthRows, []);
    const oldOnly = calculateAverageDailyEarnings("2026-08-01", oldOnlyRows, []);
    const newOnly = calculateAverageDailyEarnings("2026-08-01", newOnlyRows, []);

    expect(midMonth.averageDailyKopecks).toBeGreaterThan(oldOnly.averageDailyKopecks);
    expect(midMonth.averageDailyKopecks).toBeLessThan(newOnly.averageDailyKopecks);
  });

  it("divides by the actual number of earning months when tenure is under 12 months (D-V05)", () => {
    const salaryRows: SalaryHistoryEntry[] = [
      { effectiveFrom: "2026-05-01", grossAmountKopecks: 150_000_00 },
    ];
    const result = calculateAverageDailyEarnings("2026-08-01", salaryRows, []);
    expect(result).toEqual({ averageDailyKopecks: 511_945, monthCount: 3 });
  });

  it("returns zero, never NaN, for a user with no salary or bonus history", () => {
    const result = calculateAverageDailyEarnings("2026-08-01", [], []);
    expect(result).toEqual({ averageDailyKopecks: 0, monthCount: 0 });
  });

  it("counts the earliest lookback month in full when effectiveFrom lands exactly on its first day (hire-date-anniversary boundary)", () => {
    const salaryRows: SalaryHistoryEntry[] = [
      { effectiveFrom: "2025-08-01", grossAmountKopecks: 100_000_00 },
    ];
    const result = calculateAverageDailyEarnings("2026-08-01", salaryRows, []);
    expect(result).toEqual({ averageDailyKopecks: 341_297, monthCount: 12 });
  });

  it("includes premium-typed bonuses in the earnings base without filtering (caller's responsibility)", () => {
    const premiumBonusRows: PremiumBonusEntry[] = [
      { date: "2026-03-15", amountKopecks: 50_000_00 },
    ];
    const result = calculateAverageDailyEarnings("2026-08-01", CONSTANT_SALARY, premiumBonusRows);
    expect(result).toEqual({ averageDailyKopecks: 355_518, monthCount: 12 });
  });
});

describe("calculateVacationPayGross", () => {
  it("combines day count and average daily earnings into a gross total", () => {
    const salaryRows: SalaryHistoryEntry[] = [
      { effectiveFrom: "2020-01-01", grossAmountKopecks: 100_000_00 },
    ];
    const result = calculateVacationPayGross("2026-08-01", "2026-08-10", salaryRows, []);
    expect(result).toEqual({
      grossKopecks: 3_412_970,
      averageDailyKopecks: 341_297,
      days: 10,
      monthCount: 12,
    });
  });
});
