/**
 * Pure отпускные (vacation pay) calculation per ст.139 ТК РФ.
 *
 * Average daily earnings is re-derived month-by-month from `salary_history`
 * over the 12 calendar months STRICTLY PRECEDING the vacation's own start
 * month (the vacation's own month is never one of the 12 — see
 * `.planning/phases/03-vacation-pay/03-01-PLAN.md` "Design decisions" for
 * why this corrects an off-by-one in 03-RESEARCH.md's illustrative
 * pseudocode). Each candidate month's earnings are computed from whichever
 * `salary_history` entry was effective during it, with day-level proration
 * (weighted by real calendar days within that month) when a salary change
 * lands mid-month — so a fully-worked month always contributes its actual
 * monthly total, and only a genuinely split month is weighted between the
 * old and new rate. Premium-typed bonuses (already filtered by the caller)
 * are added to whichever month they fall in. A month counts toward
 * `monthCount` only when it has a nonzero total, so a user with under 12
 * months of history divides by the smaller month count instead of a
 * hardcoded 12 (D-V05). Rounding happens exactly once, at the final
 * `averageDailyKopecks` division — no per-month or per-segment intermediate
 * value is rounded, matching `../tax/calculate-ndfl.ts`'s "round once, at
 * the end" discipline.
 *
 * `resolveVacationPaymentDate` implements ст.136 ТК РФ's "paid 3 calendar
 * days before the vacation starts" rule (D-V06), reusing
 * `shiftOffWeekendsAndHolidays` from `../schedule/resolve-payment-date` for
 * the weekend/holiday shift (D-V07) rather than duplicating that logic.
 *
 * Permitted imports: `date-fns`, `../money`, `../schedule/resolve-payment-date`,
 * `../pay/payment-accrual` — nothing from `@/lib`, `next`, or React.
 */

import { addDays, differenceInCalendarDays, format, lastDayOfMonth, subDays } from "date-fns";
import type { Kopecks } from "../money";
import type { SalaryHistoryEntry } from "../pay/payment-accrual";
import { shiftOffWeekendsAndHolidays } from "../schedule/resolve-payment-date";

/** ст.139 ТК РФ's fixed average-days-per-month divisor. */
const AVERAGE_DAYS_PER_MONTH = 29.3;

/** The number of calendar months preceding the vacation's own start month. */
const LOOKBACK_MONTHS = 12;

/** One premium-typed bonus contributing to the vacation-pay earnings base (D-V01). Caller-filtered — this module performs no type filtering itself. */
export interface PremiumBonusEntry {
  /** `yyyy-MM-dd`. */
  date: string;
  amountKopecks: Kopecks;
}

/** Result of the month-by-month average-daily-earnings calculation. */
export interface AverageDailyEarningsResult {
  averageDailyKopecks: Kopecks;
  monthCount: number;
}

/** Combined day-count + average-earnings vacation-pay result. */
export interface VacationPayResult extends AverageDailyEarningsResult {
  grossKopecks: Kopecks;
  days: number;
}

/**
 * Parses a `yyyy-MM-dd` string into a local-midnight `Date` using the
 * three-argument constructor form — never the single-argument UTC-parsing
 * form (matches `payment-accrual.ts`'s `parseIsoToLocalMidnight` precedent).
 */
function parseIsoToLocalMidnight(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Counts an inclusive calendar range as N days — `("2026-08-01",
 * "2026-08-10")` is 10 days, never 9 (Pitfall 3).
 */
export function calculateVacationDays(startDateIso: string, endDateIso: string): number {
  const start = parseIsoToLocalMidnight(startDateIso);
  const end = parseIsoToLocalMidnight(endDateIso);
  return differenceInCalendarDays(end, start) + 1;
}

/**
 * Selects the salary-history entry effective on or before `onOrBeforeIso`:
 * the entry with the greatest `effectiveFrom` not exceeding it. Scans the
 * whole array so the result never depends on insertion order.
 */
function selectEffectiveSalaryEntry(
  salaryRows: readonly SalaryHistoryEntry[],
  onOrBeforeIso: string,
): SalaryHistoryEntry | undefined {
  let selected: SalaryHistoryEntry | undefined;
  for (const entry of salaryRows) {
    if (entry.effectiveFrom <= onOrBeforeIso) {
      if (!selected || entry.effectiveFrom > selected.effectiveFrom) {
        selected = entry;
      }
    }
  }
  return selected;
}

/**
 * Computes one candidate month's prorated salary contribution: finds every
 * `salaryRows` entry whose `effectiveFrom` falls strictly after the month's
 * first day and on/before its last day (a genuine mid-month change point),
 * splits the month into date segments at each such point, and weights each
 * segment's applicable monthly rate by its real share of the month's actual
 * calendar days — so an unsplit (fully-worked) month contributes exactly
 * its one applicable monthly rate, and only a split month is a weighted
 * average of the old and new rates (D-V04, Pitfall 4/5). A segment with no
 * applicable entry (before the earliest salary_history row) contributes
 * zero.
 */
function calculateMonthSalaryTotal(
  monthStart: Date,
  monthEnd: Date,
  salaryRows: readonly SalaryHistoryEntry[],
): number {
  const daysInMonth = differenceInCalendarDays(monthEnd, monthStart) + 1;

  const changePointIsos = Array.from(
    new Set(
      salaryRows
        .map((entry) => entry.effectiveFrom)
        .filter((iso) => {
          const changeDate = parseIsoToLocalMidnight(iso);
          return changeDate.getTime() > monthStart.getTime() && changeDate.getTime() <= monthEnd.getTime();
        }),
    ),
  ).sort();

  const boundaries = [
    monthStart,
    ...changePointIsos.map(parseIsoToLocalMidnight),
    addDays(monthEnd, 1),
  ];

  let monthTotal = 0;
  for (let i = 0; i < boundaries.length - 1; i++) {
    const segmentStart = boundaries[i];
    const segmentEndExclusive = boundaries[i + 1];
    const segmentDays = differenceInCalendarDays(segmentEndExclusive, segmentStart);
    if (segmentDays <= 0) continue;

    const segmentStartIso = format(segmentStart, "yyyy-MM-dd");
    const entry = selectEffectiveSalaryEntry(salaryRows, segmentStartIso);
    if (!entry) continue;

    monthTotal += (segmentDays / daysInMonth) * entry.grossAmountKopecks;
  }

  return monthTotal;
}

/** Sums every `premiumBonusRows` entry whose `date` falls within `[monthStart, monthEnd]` inclusive. */
function calculateMonthBonusTotal(
  monthStart: Date,
  monthEnd: Date,
  premiumBonusRows: readonly PremiumBonusEntry[],
): number {
  let monthTotal = 0;
  for (const bonus of premiumBonusRows) {
    const bonusDate = parseIsoToLocalMidnight(bonus.date);
    if (bonusDate.getTime() >= monthStart.getTime() && bonusDate.getTime() <= monthEnd.getTime()) {
      monthTotal += bonus.amountKopecks;
    }
  }
  return monthTotal;
}

/**
 * Computes average daily earnings over the 12 calendar months strictly
 * preceding `vacationStartDateIso`'s own month (the vacation's own month is
 * never included). A month counts toward `monthCount` only when its
 * combined salary+bonus total is greater than zero, so under-12-months
 * tenure divides by the smaller actual month count (D-V05) instead of a
 * hardcoded 12. Returns `{ averageDailyKopecks: 0, monthCount: 0 }` — never
 * `NaN`, never a thrown division-by-zero — when no lookback month has any
 * earnings.
 */
export function calculateAverageDailyEarnings(
  vacationStartDateIso: string,
  salaryRows: readonly SalaryHistoryEntry[],
  premiumBonusRows: readonly PremiumBonusEntry[],
): AverageDailyEarningsResult {
  const vacationStart = parseIsoToLocalMidnight(vacationStartDateIso);
  const vacationAbsoluteMonth = vacationStart.getFullYear() * 12 + vacationStart.getMonth();

  let totalEarningsKopecks = 0;
  let monthCount = 0;

  for (let offset = LOOKBACK_MONTHS; offset >= 1; offset--) {
    const candidateAbsoluteMonth = vacationAbsoluteMonth - offset;
    const year = Math.floor(candidateAbsoluteMonth / 12);
    const monthIndex = ((candidateAbsoluteMonth % 12) + 12) % 12;

    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = lastDayOfMonth(monthStart);

    const salaryTotal = calculateMonthSalaryTotal(monthStart, monthEnd, salaryRows);
    const bonusTotal = calculateMonthBonusTotal(monthStart, monthEnd, premiumBonusRows);
    const monthTotal = salaryTotal + bonusTotal;

    if (monthTotal > 0) {
      monthCount += 1;
      totalEarningsKopecks += monthTotal;
    }
  }

  if (monthCount === 0) {
    return { averageDailyKopecks: 0, monthCount: 0 };
  }

  return {
    averageDailyKopecks: Math.round(totalEarningsKopecks / monthCount / AVERAGE_DAYS_PER_MONTH),
    monthCount,
  };
}

/**
 * Combines `calculateVacationDays` and `calculateAverageDailyEarnings` into
 * the total gross отпускные payout for a vacation date range.
 */
export function calculateVacationPayGross(
  startDateIso: string,
  endDateIso: string,
  salaryRows: readonly SalaryHistoryEntry[],
  premiumBonusRows: readonly PremiumBonusEntry[],
): VacationPayResult {
  const days = calculateVacationDays(startDateIso, endDateIso);
  const { averageDailyKopecks, monthCount } = calculateAverageDailyEarnings(
    startDateIso,
    salaryRows,
    premiumBonusRows,
  );

  return { grossKopecks: averageDailyKopecks * days, averageDailyKopecks, days, monthCount };
}

/**
 * Resolves vacation pay's payment/tax date (D-V06): vacation start minus 3
 * CALENDAR days (never business-day subtraction), shifted earlier through
 * `shiftOffWeekendsAndHolidays` when that date falls on a weekend or RU
 * public holiday (D-V07) — the exact same chain-walking logic already
 * proven for avans/salary dates, reused rather than reimplemented.
 */
export function resolveVacationPaymentDate(vacationStartDateIso: string): string {
  const vacationStart = parseIsoToLocalMidnight(vacationStartDateIso);
  const minusThreeDays = subDays(vacationStart, 3);
  const shifted = shiftOffWeekendsAndHolidays(minusThreeDays);
  return format(shifted, "yyyy-MM-dd");
}
