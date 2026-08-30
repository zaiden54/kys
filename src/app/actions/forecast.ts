// server-only guard equivalent: the `server-only` npm package isn't
// installed (new package installs require a human-verify checkpoint per
// executor deviation rules), so this throws immediately if the module is
// ever evaluated in a browser context, preventing it from reaching a client
// bundle. Matches the pattern established in src/lib/session.ts and
// src/lib/db/salary-repository.ts. Unlike src/app/actions/salary.ts, this
// module is never invoked as a Next.js Server Action from a client
// `<form action>` — it is called directly during a server component's
// render (see src/app/(app)/page.tsx) — so it carries no `"use server"`
// directive.
if (typeof window !== "undefined") {
  throw new Error(
    "src/app/actions/forecast.ts is server-only and must never be imported into a client component.",
  );
}

/**
 * Server-side next-payment forecast orchestration (HOME-01, TAX-01, TAX-02).
 *
 * Folds the phase's two pure domain engines (progressive НДФЛ, payment-date
 * resolution) over a single user's own salary/schedule/YTD-baseline rows,
 * implementing the exact ordering from 01-RESEARCH.md's "System Architecture
 * Diagram — Phase 1 request flow":
 *
 *   1. read schedule
 *   2. resolve the next payment event (D-02/D-03/D-04 already applied)
 *   3. read the salary effective ON THAT PAYMENT'S OWN DATE (D-15)
 *   4. derive the payment's gross from the monthly oklad (Task 1: half-split)
 *   5. read the cumulative-before figure and the estimated-baseline flag
 *   6. tax the payment against its own tax year (the payment date's year)
 *   7. return the configured result
 *
 * This module contains no logging calls, so no salary or tax amount can
 * reach a log line (T-01-04). `UnsupportedTaxYearError` is allowed to
 * propagate uncaught (T-01-10) — a forecast for a year whose bracket scale
 * nobody has verified must fail visibly, never fall back to a plausible-
 * looking number.
 */

import { format } from "date-fns";
import type { Kopecks } from "@/domain/money";
import { calculateNdfl } from "@/domain/tax/calculate-ndfl";
import { nextPaymentOnOrAfter, type PaymentKind } from "@/domain/schedule/resolve-payment-date";
import { halfSplitGross } from "@/domain/pay/payment-accrual";
import { nowInMoscow, todayIsoInMoscow } from "@/domain/time";
import { listBonuses } from "@/lib/db/bonus-repository";
import {
  getActiveSalaryAt,
  getCumulativeIncomeBeforeDate,
  getSchedule,
  getYtdBaseline,
} from "@/lib/db/salary-repository";

/** The next payment's date, kind, and fully-computed take-home figures. */
export interface NextPaymentForecast {
  /** `yyyy-MM-dd`, local calendar date — matches salary_history's date column format. */
  date: string;
  kind: PaymentKind | "bonus";
  grossKopecks: Kopecks;
  taxKopecks: Kopecks;
  netKopecks: Kopecks;
  /** True while the YTD baseline is a synthesized zero (D-11) rather than a user-entered figure. */
  baselineIsEstimated: boolean;
  breakdown?: { salaryOrAvansKopecks: Kopecks; bonusKopecks: Kopecks };
}

/**
 * Either a fully computed forecast, or a report of exactly what is missing.
 * There is no zero/placeholder forecast for a not-configured user — SAL-03's
 * empty-input contract is "compute nothing," not "compute against zero."
 */
export type ForecastResult =
  | { configured: true; forecast: NextPaymentForecast }
  | { configured: false; missing: "salary" | "schedule" };

export function selectNextPaymentEvent(
  scheduleEvent: { dateIso: string; kind: PaymentKind } | null,
  futureBonusDatesAscending: readonly string[],
): { dateIso: string; kind: PaymentKind | "bonus" } | null {
  const bonusDate = futureBonusDatesAscending[0];
  if (!scheduleEvent) return bonusDate ? { dateIso: bonusDate, kind: "bonus" } : null;
  if (!bonusDate || scheduleEvent.dateIso <= bonusDate) return scheduleEvent;
  return { dateIso: bonusDate, kind: "bonus" };
}

/**
 * Computes the user's next payment forecast, or reports what is not yet
 * configured. See the module doc comment for the exact ordering this
 * implements.
 */
export async function forecastNextPayment(userId: string): Promise<ForecastResult> {
  const [schedule, bonusRows] = await Promise.all([getSchedule(userId), listBonuses(userId)]);
  const paymentEvent = schedule
    ? nextPaymentOnOrAfter(
        { avansDay: schedule.avansDay, salaryDay: schedule.salaryDay },
        nowInMoscow(),
      )
    : null;
  const scheduleEvent = paymentEvent
    ? { dateIso: format(paymentEvent.date, "yyyy-MM-dd"), kind: paymentEvent.kind }
    : null;
  const futureBonusDatesAscending = bonusRows
    .map((bonus) => bonus.date)
    .filter((date) => date >= todayIsoInMoscow())
    .sort();
  const resolvedEvent = selectNextPaymentEvent(scheduleEvent, futureBonusDatesAscending);
  if (!resolvedEvent) {
    return { configured: false, missing: "schedule" };
  }
  const paymentDateIso = resolvedEvent.dateIso;
  const bonusKopecksOnDate = bonusRows
    .filter((bonus) => bonus.date === paymentDateIso)
    .reduce((sum, bonus) => sum + bonus.amountKopecks, 0);

  // The salary effective ON the payment's own date — never the newest row
  // overall and never today's date. This is D-15: a future-dated salary
  // change simply has no effect until a payment actually falls on/after it.
  const activeSalary = resolvedEvent.kind === "bonus"
    ? null
    : await getActiveSalaryAt(userId, paymentDateIso);
  if (resolvedEvent.kind !== "bonus" && !activeSalary) return { configured: false, missing: "salary" };
  const baseGrossKopecks = resolvedEvent.kind === "bonus"
    ? 0
    : halfSplitGross(activeSalary!.grossAmountKopecks, resolvedEvent.kind);
  const paymentGrossKopecks = baseGrossKopecks + bonusKopecksOnDate;

  const [cumulativeBeforeKopecks, ytdBaseline] = await Promise.all([
    getCumulativeIncomeBeforeDate(
      userId,
      paymentDateIso,
      resolvedEvent.kind === "bonus" ? "avans" : resolvedEvent.kind,
    ),
    getYtdBaseline(userId),
  ]);

  // The tax year belongs to the payment date, not to today — a
  // December-resolved payment and a January one belong to different
  // cumulative bases. UnsupportedTaxYearError is intentionally NOT caught
  // here; it must propagate as a visible failure (T-01-10).
  const taxYear = Number(paymentDateIso.slice(0, 4));
  const { taxKopecks, netKopecks } = calculateNdfl(cumulativeBeforeKopecks, paymentGrossKopecks, taxYear);

  // Mirrors the exact boundary getCumulativeIncomeBeforeDate already applies
  // (src/lib/db/salary-repository.ts) to decide whether the stored baseline
  // contributes to the cumulative figure: same calendar year, and not after
  // the payment date. A baseline the cumulative-income query silently
  // ignored (wrong year, or dated after the payment) must never be reported
  // to the UI as confirmed (closes WR-01, 02-REVIEW.md).
  const baselineApplies =
    ytdBaseline.asOfDate.slice(0, 4) === paymentDateIso.slice(0, 4) &&
    ytdBaseline.asOfDate <= paymentDateIso;

  return {
    configured: true,
    forecast: {
      date: paymentDateIso,
      kind: resolvedEvent.kind,
      grossKopecks: paymentGrossKopecks,
      taxKopecks,
      netKopecks,
      baselineIsEstimated: !baselineApplies || ytdBaseline.isEstimated,
      breakdown: resolvedEvent.kind !== "bonus" && bonusKopecksOnDate > 0
        ? { salaryOrAvansKopecks: baseGrossKopecks, bonusKopecks: bonusKopecksOnDate }
        : undefined,
    },
  };
}
