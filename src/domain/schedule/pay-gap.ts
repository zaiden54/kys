/**
 * ТК РФ 15-day avans/salary gap signal (D-04).
 *
 * Russian labor law expects no more than half a month between wage
 * payments. This module only reports whether a configured avans/salary
 * schedule exceeds that gap — it never blocks saving the schedule; the
 * warning is advisory only.
 *
 * The gap is computed on a deliberate 30-day reference cycle (not each
 * calendar month's actual length) — a day-of-month schedule has no fixed
 * month, so a fixed 30-day cycle is the simplest, most predictable
 * approximation for a non-blocking compliance signal. This module is pure.
 */

/** ТК РФ maximum recommended gap, in days, between avans and salary payments. */
export const MAX_PAY_GAP_DAYS = 15;

/**
 * Returns the longest interval (in days, on a 30-day reference cycle) an
 * employee waits between an avans-day and a salary-day payment, in either
 * direction. This is the larger of the two circular distances between the
 * two days — the interval the employee actually experiences as "the gap".
 */
export function payGapDays(avansDay: number, salaryDay: number): number {
  const forwardGap = ((salaryDay - avansDay) % 30 + 30) % 30;
  const backwardGap = 30 - forwardGap;
  return Math.max(forwardGap, backwardGap);
}

/** Returns true when `payGapDays` strictly exceeds `MAX_PAY_GAP_DAYS`. */
export function exceedsMaxPayGap(avansDay: number, salaryDay: number): boolean {
  return payGapDays(avansDay, salaryDay) > MAX_PAY_GAP_DAYS;
}
