/**
 * Pure accrual engine: derives the total gross income (in kopecks) an
 * avans/salary payment schedule would have distributed strictly between two
 * calendar boundaries, given a user's dated salary history. Feeds
 * `src/lib/db/salary-repository.ts`'s `getCumulativeIncomeBeforeDate`
 * (TAX-01, TAX-02) — closes 01-VERIFICATION.md `gaps[0]`.
 *
 * Rules implemented by `accruedGrossBetween` (audit this list against
 * `payment-accrual.test.ts`; do not let it drift):
 *
 * 1. Returns zero immediately when the target date is not strictly after the
 *    window bound (`afterIso`) — there is no window to accrue over.
 * 2. Candidate events are enumerated with `generatePaymentEvents` so
 *    weekend/holiday shifting (D-02) and month-length clamping (D-03) apply
 *    identically to historical and forecast events — this module never
 *    re-derives calendar rules of its own.
 * 3. The enumeration span starts one calendar month before the window
 *    bound's month and runs through one calendar month after the target's
 *    month — a symmetric safety margin, because an event nominally in one
 *    month can resolve into the previous month (D-02's backwards walk),
 *    including across a calendar-year boundary (a January-nominal salary
 *    payment can resolve into the preceding December). The span only
 *    guarantees candidates are generated; the filter below, not the span,
 *    defines inclusion.
 * 4. An event is counted when its resolved date is strictly after
 *    `afterIso` AND either strictly before the target date, or exactly on
 *    the target date with a strictly lower `PAYMENT_KIND_RANK` than the
 *    target's kind — so a same-day avans sits inside a same-day salary
 *    payment's base, never the reverse.
 * 5. Each counted event contributes `periodGross(event.period, …)`: the
 *    pay for the working days of the period it pays for (avans: days 1–15
 *    of its month; salary: day 16 to month end of the previous month),
 *    pro rata against the month's working days, skipping leave days. The
 *    oklad is resolved per working day (greatest `effectiveFrom` not after
 *    that day), so a mid-period raise splits the period; days before the
 *    first salary entry earn nothing.
 * 6. The function reads no clock and performs no I/O; identical inputs
 *    always return identical output, and the caller's `salaryHistory` array
 *    is neither mutated nor reordered.
 *
 * Permitted imports: `date-fns` and sibling domain modules only, matching
 * the discipline documented at the top of
 * `../schedule/resolve-payment-date.ts`.
 */

import type { Kopecks } from "../money";
import {
  generatePaymentEvents,
  isWorkingDay,
  PAYMENT_KIND_RANK,
  type PaymentKind,
  type PaymentSchedule,
  type PayPeriod,
} from "../schedule/resolve-payment-date";

/** One dated salary_history row, as accrual needs it — not the full DB row shape. */
export interface SalaryHistoryEntry {
  /** `yyyy-MM-dd`. */
  effectiveFrom: string;
  grossAmountKopecks: Kopecks;
}

/** The boundary accrual counts strictly before (per rule 4 above). */
export interface AccrualTarget {
  /** `yyyy-MM-dd`. */
  dateIso: string;
  kind: PaymentKind;
}

/** A leave (paid vacation or unpaid leave), inclusive `yyyy-MM-dd` bounds. */
export interface LeaveRange {
  startIso: string;
  endIso: string;
}

/** Every vacation, paid or unpaid, takes its days out of the worked days. */
export function leavesFrom(rows: readonly { startDate: string; endDate: string }[]): LeaveRange[] {
  return rows.map((row) => ({ startIso: row.startDate, endIso: row.endDate }));
}

const workingDayFlagsCache = new Map<string, boolean[]>();

/** Per-day working flags for a month (index 0 = day 1), memoized: holiday lookups are not free. */
function workingDayFlags(year: number, monthIndex: number): boolean[] {
  const key = `${year}-${monthIndex}`;
  let flags = workingDayFlagsCache.get(key);
  if (!flags) {
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    flags = Array.from({ length: lastDay }, (_, i) => isWorkingDay(new Date(year, monthIndex, i + 1)));
    workingDayFlagsCache.set(key, flags);
  }
  return flags;
}

/**
 * Sum of the monthly oklad effective on each working, non-leave day from
 * day 1 through `throughDay` of the month. Dividing it by the month's
 * working-day count gives the pay earned so far that month.
 */
function earnedNumerator(
  year: number,
  monthIndex: number,
  throughDay: number,
  salaryHistory: readonly SalaryHistoryEntry[],
  leaves: readonly LeaveRange[],
): number {
  const flags = workingDayFlags(year, monthIndex);
  const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, "0")}-`;
  let numerator = 0;
  for (let day = 1; day <= Math.min(throughDay, flags.length); day++) {
    if (!flags[day - 1]) continue;
    const dayIso = `${monthPrefix}${String(day).padStart(2, "0")}`;
    if (leaves.some((leave) => leave.startIso <= dayIso && dayIso <= leave.endIso)) continue;
    numerator += selectEffectiveEntry(salaryHistory, dayIso)?.grossAmountKopecks ?? 0;
  }
  return numerator;
}

/**
 * Gross pay for a pay period, pro rata by working days: for each working
 * day in the period that is not a leave day, the oklad effective that day
 * divided by the month's working-day count. A day before the first salary
 * entry earns nothing.
 *
 * Rounding happens on the month-to-date total, and the period is the
 * difference of two such totals — so a full month with no leave pays exactly
 * the oklad across its avans and salary halves, never a kopeck more or less.
 */
export function periodGross(
  period: PayPeriod,
  salaryHistory: readonly SalaryHistoryEntry[],
  leaves: readonly LeaveRange[] = [],
): Kopecks {
  const totalWorkingDays = workingDayFlags(period.year, period.monthIndex).filter(Boolean).length;
  if (totalWorkingDays === 0) return 0;
  const through = (day: number) =>
    Math.round(earnedNumerator(period.year, period.monthIndex, day, salaryHistory, leaves) / totalWorkingDays);
  return through(period.toDay) - through(period.fromDay - 1);
}

/**
 * Parses a `yyyy-MM-dd` string into a local-midnight `Date` using the
 * three-argument constructor form — never by handing the string to the
 * single-argument constructor, which parses as UTC and would drift against
 * the local-midnight values `resolvePaymentDate` returns.
 */
function parseIsoToLocalMidnight(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Selects the salary-history entry effective on `eventDateIso`: the entry
 * with the greatest `effectiveFrom` not exceeding it. Scans the whole array
 * so the result never depends on insertion order; returns `undefined` when
 * no entry applies yet.
 *
 * Exported (04-01-PLAN.md Task 1) so `src/app/actions/annual-summary.ts` can
 * reuse this exact per-event resolution instead of re-deriving it — no
 * behavior change, visibility only.
 */
export function selectEffectiveEntry(
  salaryHistory: readonly SalaryHistoryEntry[],
  eventDateIso: string,
): SalaryHistoryEntry | undefined {
  let selected: SalaryHistoryEntry | undefined;
  for (const entry of salaryHistory) {
    if (entry.effectiveFrom <= eventDateIso) {
      if (!selected || entry.effectiveFrom > selected.effectiveFrom) {
        selected = entry;
      }
    }
  }
  return selected;
}

/**
 * Sums the gross of every scheduled avans/salary event strictly after
 * `afterIso` and before `target` (per rule 4), applying whichever
 * `salaryHistory` entry is effective on each event's own resolved date. See
 * the module header for the full rule list.
 */
export function accruedGrossBetween(
  schedule: PaymentSchedule,
  salaryHistory: readonly SalaryHistoryEntry[],
  afterIso: string,
  target: AccrualTarget,
  leaves: readonly LeaveRange[] = [],
): Kopecks {
  const afterDate = parseIsoToLocalMidnight(afterIso);
  const targetDate = parseIsoToLocalMidnight(target.dateIso);

  if (targetDate.getTime() <= afterDate.getTime()) {
    return 0;
  }

  // Symmetric safety margin (rule 3): one month before afterIso's month,
  // one month after target's month. The filter below, not this span,
  // defines inclusion.
  const spanStart = new Date(afterDate.getFullYear(), afterDate.getMonth() - 1, 1);
  const monthsSpan =
    (targetDate.getFullYear() - spanStart.getFullYear()) * 12 +
    (targetDate.getMonth() - spanStart.getMonth()) +
    2;

  const events = generatePaymentEvents(schedule, spanStart, monthsSpan);

  let totalKopecks = 0;
  for (const event of events) {
    const eventTime = event.date.getTime();
    if (eventTime <= afterDate.getTime()) continue;

    const strictlyBeforeTarget = eventTime < targetDate.getTime();
    const sameDateEarlierRank =
      eventTime === targetDate.getTime() &&
      PAYMENT_KIND_RANK[event.kind] < PAYMENT_KIND_RANK[target.kind];
    if (!strictlyBeforeTarget && !sameDateEarlierRank) continue;

    totalKopecks += periodGross(event.period, salaryHistory, leaves);
  }

  return totalKopecks;
}
