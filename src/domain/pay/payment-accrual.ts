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
 * 5. Each counted event contributes
 *    `halfSplitGross(entry.grossAmountKopecks, event.kind)`, where `entry`
 *    is the salary-history row with the greatest `effectiveFrom` not
 *    exceeding the EVENT's own resolved date (never the target's date,
 *    never the array's insertion order) — a mid-window raise or backdated
 *    correction is therefore applied per-event, not per-window. An event
 *    with no applicable entry (dated before the earliest salary-history
 *    row) contributes zero rather than borrowing a later entry's amount.
 * 6. The function reads no clock and performs no I/O; identical inputs
 *    always return identical output, and the caller's `salaryHistory` array
 *    is neither mutated nor reordered.
 *
 * Permitted imports: `date-fns` and sibling domain modules only, matching
 * the discipline documented at the top of
 * `../schedule/resolve-payment-date.ts`.
 */

import { format } from "date-fns";
import type { Kopecks } from "../money";
import {
  generatePaymentEvents,
  PAYMENT_KIND_RANK,
  type PaymentKind,
  type PaymentSchedule,
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

/**
 * Splits a monthly gross oklad across the avans and salary payments (Task 1
 * decision: half-split, resolved by the human). The avans share is the
 * floor of the half and the salary share is the remainder, so the two
 * always reconcile to exactly the monthly gross regardless of parity — the
 * annual total across twelve months is therefore exactly `oklad * 12`.
 * Rounding each half independently let an odd-kopeck gross produce two
 * halves summing to one kopeck MORE than the gross (WR-02) — the same
 * anti-drift discipline `../tax/calculate-ndfl.ts` applies to tax rounding,
 * applied here to gross. Relocated unchanged from
 * `src/app/actions/forecast.ts`.
 */
export function halfSplitGross(monthlyGrossKopecks: Kopecks, kind: PaymentKind): Kopecks {
  const avansShareKopecks = Math.floor(monthlyGrossKopecks / 2);
  return kind === "avans" ? avansShareKopecks : monthlyGrossKopecks - avansShareKopecks;
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
 */
function selectEffectiveEntry(
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

    const eventDateIso = format(event.date, "yyyy-MM-dd");
    const entry = selectEffectiveEntry(salaryHistory, eventDateIso);
    if (!entry) continue;

    totalKopecks += halfSplitGross(entry.grossAmountKopecks, event.kind);
  }

  return totalKopecks;
}
