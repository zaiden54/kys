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
  kind: PaymentKind;
  grossKopecks: Kopecks;
  taxKopecks: Kopecks;
  netKopecks: Kopecks;
  /** True while the YTD baseline is a synthesized zero (D-11) rather than a user-entered figure. */
  baselineIsEstimated: boolean;
}

/**
 * Either a fully computed forecast, or a report of exactly what is missing.
 * There is no zero/placeholder forecast for a not-configured user — SAL-03's
 * empty-input contract is "compute nothing," not "compute against zero."
 */
export type ForecastResult =
  | { configured: true; forecast: NextPaymentForecast }
  | { configured: false; missing: "salary" | "schedule" };

/**
 * Splits the monthly gross oklad evenly across the avans and salary
 * payments (Task 1 decision: half-split, resolved by the human). Each
 * payment carries exactly half the monthly gross; the annual total across
 * twelve months is always `oklad * 12`. Kept as a single named helper — not
 * inlined — so this is the one place the rule lives and it stays easy to
 * swap for a configurable-percent model later without touching the
 * orchestration around it.
 */
function halfSplitGross(monthlyGrossKopecks: Kopecks): Kopecks {
  return Math.round(monthlyGrossKopecks / 2);
}

/**
 * Computes the user's next payment forecast, or reports what is not yet
 * configured. See the module doc comment for the exact ordering this
 * implements.
 */
export async function forecastNextPayment(userId: string): Promise<ForecastResult> {
  const schedule = await getSchedule(userId);
  if (!schedule) {
    return { configured: false, missing: "schedule" };
  }

  const paymentEvent = nextPaymentOnOrAfter(
    { avansDay: schedule.avansDay, salaryDay: schedule.salaryDay },
    new Date(),
  );
  if (!paymentEvent) {
    return { configured: false, missing: "schedule" };
  }

  const paymentDateIso = format(paymentEvent.date, "yyyy-MM-dd");

  // The salary effective ON the payment's own date — never the newest row
  // overall and never today's date. This is D-15: a future-dated salary
  // change simply has no effect until a payment actually falls on/after it.
  const activeSalary = await getActiveSalaryAt(userId, paymentDateIso);
  if (!activeSalary) {
    return { configured: false, missing: "salary" };
  }

  const paymentGrossKopecks = halfSplitGross(activeSalary.grossAmountKopecks);

  const [cumulativeBeforeKopecks, ytdBaseline] = await Promise.all([
    getCumulativeIncomeBeforeDate(userId, paymentDateIso),
    getYtdBaseline(userId),
  ]);

  // The tax year belongs to the payment date, not to today — a
  // December-resolved payment and a January one belong to different
  // cumulative bases. UnsupportedTaxYearError is intentionally NOT caught
  // here; it must propagate as a visible failure (T-01-10).
  const taxYear = paymentEvent.date.getFullYear();
  const { taxKopecks, netKopecks } = calculateNdfl(cumulativeBeforeKopecks, paymentGrossKopecks, taxYear);

  return {
    configured: true,
    forecast: {
      date: paymentDateIso,
      kind: paymentEvent.kind,
      grossKopecks: paymentGrossKopecks,
      taxKopecks,
      netKopecks,
      baselineIsEstimated: ytdBaseline.isEstimated,
    },
  };
}
