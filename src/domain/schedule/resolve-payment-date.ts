/**
 * Pure payment-date resolver.
 *
 * Turns day-of-month schedule numbers (D-01) into real calendar dates:
 * clamped to the target month's last valid day when the day doesn't exist
 * (D-03), then shifted earlier off weekends and RU public holidays,
 * chaining through consecutive non-working days (D-02).
 *
 * v1 limitation (documented, not solved, per
 * .planning/phases/01-core-payroll-loop/01-RESEARCH.md § "Common
 * Pitfalls"): `date-holidays`' bundled RU rule data reliably covers fixed
 * federal holidays (New Year block, Feb 23, Mar 8, May 1, May 9, Jun 12,
 * Nov 4), but the Russian government's annual ad-hoc weekend-transfer
 * (перенос) decree is only current through 2022 in the library's static
 * data — a one-off decreed non-working day in a later year may not shift
 * as expected. Accepted for v1; revisit if a maintained/live source is
 * ever adopted.
 *
 * Permitted imports: `date-fns`, `date-holidays`, and sibling domain
 * modules only. Nothing from `@/lib`, `next`, or React.
 */

import { isWeekend, lastDayOfMonth, startOfDay } from "date-fns";
import Holidays from "date-holidays";

const ruHolidays = new Holidays("RU");

/** Whether a payment event is the mid-month advance or the end-of-period salary. */
export type PaymentKind = "avans" | "salary";

/** A user's configured day-of-month schedule for the two monthly payment tranches. */
export interface PaymentSchedule {
  avansDay: number;
  salaryDay: number;
}

/** A single resolved, calendar-real payment occurrence. */
export interface PaymentEvent {
  date: Date;
  kind: PaymentKind;
}

/** Same-date tie-break rank: avans always sorts before salary. */
const KIND_RANK: Record<PaymentKind, number> = { avans: 0, salary: 1 };

function isRuPublicHoliday(date: Date): boolean {
  const result = ruHolidays.isHoliday(date);
  if (!result) return false;
  return result.some((entry) => entry.type === "public");
}

/**
 * Resolves a day-of-month schedule number for a given year/month to a real,
 * local-midnight calendar `Date`: clamps the day to the month's last valid
 * day (D-03), then walks one day earlier at a time while the date falls on
 * a weekend or an RU public holiday (D-02), chaining through consecutive
 * non-working days.
 */
export function resolvePaymentDate(year: number, monthIndex: number, dayOfMonth: number): Date {
  const monthLastDay = lastDayOfMonth(new Date(year, monthIndex, 1)).getDate();
  const clampedDay = Math.min(dayOfMonth, monthLastDay);

  let date = new Date(year, monthIndex, clampedDay);
  while (isWeekend(date) || isRuPublicHoliday(date)) {
    date = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
  }

  return date;
}

/**
 * Generates one avans event and one salary event for each of `monthCount`
 * consecutive months starting at `fromDate`'s month, resolved through
 * `resolvePaymentDate`, sorted ascending by date. When an avans event and a
 * salary event resolve to the same calendar date, avans sorts first,
 * deterministically and stably — it represents the earlier portion of the
 * same pay period and therefore sits at the lower cumulative-income point.
 */
export function generatePaymentEvents(
  schedule: PaymentSchedule,
  fromDate: Date,
  monthCount: number,
): PaymentEvent[] {
  const events: PaymentEvent[] = [];
  const startYear = fromDate.getFullYear();
  const startMonth = fromDate.getMonth();

  for (let offset = 0; offset < monthCount; offset++) {
    const absoluteMonth = startMonth + offset;
    const year = startYear + Math.floor(absoluteMonth / 12);
    const monthIndex = ((absoluteMonth % 12) + 12) % 12;

    events.push({ date: resolvePaymentDate(year, monthIndex, schedule.avansDay), kind: "avans" });
    events.push({ date: resolvePaymentDate(year, monthIndex, schedule.salaryDay), kind: "salary" });
  }

  return events.sort((a, b) => {
    const timeDiff = a.date.getTime() - b.date.getTime();
    if (timeDiff !== 0) return timeDiff;
    return KIND_RANK[a.kind] - KIND_RANK[b.kind];
  });
}

/**
 * Returns the earliest payment event on or after `today` (eligibility is
 * on-or-after, not strictly after — if `today` is itself a resolved
 * payment date, that event is returned). Looks ahead three calendar
 * months, starting one month before `today`'s month so a clamped-and-
 * shifted date belonging to the prior month is not missed. Returns `null`
 * only when the lookahead window genuinely contains no eligible event.
 */
export function nextPaymentOnOrAfter(schedule: PaymentSchedule, today: Date): PaymentEvent | null {
  const lookaheadStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const events = generatePaymentEvents(schedule, lookaheadStart, 3);
  const todayStart = startOfDay(today).getTime();

  const eligible = events.filter((event) => event.date.getTime() >= todayStart);
  return eligible[0] ?? null;
}
