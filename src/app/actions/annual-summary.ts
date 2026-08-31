// server-only guard equivalent: the `server-only` npm package isn't
// installed (new package installs require a human-verify checkpoint per
// executor deviation rules), so this throws immediately if the module is
// ever evaluated in a browser context, preventing it from reaching a client
// bundle. Matches the pattern established in src/lib/session.ts,
// src/lib/db/salary-repository.ts, and src/app/actions/forecast.ts. Like
// forecast.ts, this module is never invoked as a Next.js Server Action from
// a client `<form action>` — it is called directly during a server
// component's render (see src/app/(app)/page.tsx) — so it carries no
// `"use server"` directive.
if (typeof window !== "undefined") {
  throw new Error(
    "src/app/actions/annual-summary.ts is server-only and must never be imported into a client component.",
  );
}

/**
 * Server-side full-calendar-year gross/tax/net aggregation (HOME-02).
 *
 * Generalizes `src/app/actions/forecast.ts`'s single-next-event pattern into
 * a whole-year chronological walk: every avans/salary occurrence from the
 * schedule, every bonus row, and every vacation payment date that falls
 * within `taxYear` is taxed cumulatively via `calculateNdfl`, seeded from the
 * applicable YTD baseline (`resolveBaselineWindow`, shared with
 * `computeCumulativeIncome` so the two can never independently drift apart —
 * see 04-01-PLAN.md's "key_links").
 *
 * This module contains no logging calls, so no salary or tax amount can
 * reach a log line (mirrors T-01-04). `UnsupportedTaxYearError` is
 * intentionally NOT caught here; it must propagate as a visible failure
 * (mirrors forecast.ts's T-01-10 discipline).
 */

import { format } from "date-fns";
import type { Kopecks } from "@/domain/money";
import { calculateNdfl } from "@/domain/tax/calculate-ndfl";
import { generatePaymentEvents, type PaymentKind } from "@/domain/schedule/resolve-payment-date";
import { halfSplitGross, selectEffectiveEntry, type SalaryHistoryEntry } from "@/domain/pay/payment-accrual";
import {
  calculateVacationPayGross,
  resolveVacationPaymentDate,
  toPremiumBonusEntries,
} from "@/domain/vacation/calculate-average-daily-earnings";
import { listBonuses } from "@/lib/db/bonus-repository";
import { listVacations } from "@/lib/db/vacation-repository";
import {
  getSchedule,
  getYtdBaseline,
  listSalaryHistory,
  resolveBaselineWindow,
} from "@/lib/db/salary-repository";

/** A calendar year's fully-aggregated gross/tax/net breakdown. */
export interface AnnualSummary {
  grossKopecks: Kopecks;
  taxKopecks: Kopecks;
  netKopecks: Kopecks;
  /** True while the applicable YTD baseline is a synthesized/unconfirmed figure — mirrors NextPaymentForecast's own field. */
  baselineIsEstimated: boolean;
}

/**
 * Either a fully computed annual summary, or a report of exactly what is
 * missing. Mirrors `ForecastResult`'s "compute nothing, not against zero"
 * contract — there is no zero/placeholder summary for a not-configured user.
 */
export type AnnualSummaryResult =
  | { configured: true; summary: AnnualSummary }
  | { configured: false; missing: "salary" | "schedule" };

/** One flat, dated, taxable event in the year's chronological walk. */
interface AnnualEvent {
  dateIso: string;
  grossKopecks: Kopecks;
}

/**
 * Computes `userId`'s full-year gross/tax/net breakdown for `taxYear`, or
 * reports what is not yet configured. See the module doc comment for the
 * exact aggregation this implements.
 */
export async function computeAnnualSummary(
  userId: string,
  taxYear: number,
): Promise<AnnualSummaryResult> {
  const [schedule, salaryHistoryRows, bonusRows, vacationRows, ytdBaseline] = await Promise.all([
    getSchedule(userId),
    listSalaryHistory(userId),
    listBonuses(userId),
    listVacations(userId),
    getYtdBaseline(userId),
  ]);

  // Not-configured gate identical to forecastNextPayment's own.
  if (!schedule) return { configured: false, missing: "schedule" };
  if (salaryHistoryRows.length === 0) return { configured: false, missing: "salary" };

  // Dec-31-of-taxYear as the isoDate stand-in: any in-year date is
  // automatically `<=` Dec 31 of that year, while the year-match check in
  // resolveBaselineWindow still restricts applicability correctly — so this
  // single call answers "does this baseline apply anywhere in taxYear."
  const { baselineApplies, baselineAmountKopecks, windowBoundIso } = resolveBaselineWindow(
    ytdBaseline,
    `${taxYear}-12-31`,
  );

  const salaryHistoryEntries: SalaryHistoryEntry[] = salaryHistoryRows.map((row) => ({
    effectiveFrom: row.effectiveFrom,
    grossAmountKopecks: row.grossAmountKopecks,
  }));

  const events: AnnualEvent[] = [];

  // (a) avans/salary schedule events — 14-month span with a full year's
  // safety margin on both sides, mirroring accruedGrossBetween's own
  // symmetric-margin discipline, so a January-nominal event that D-02
  // shifts backward into December is never missed.
  const scheduleEvents = generatePaymentEvents(
    { avansDay: schedule.avansDay, salaryDay: schedule.salaryDay },
    new Date(taxYear - 1, 11, 1),
    14,
  );
  for (const event of scheduleEvents) {
    const dateIso = format(event.date, "yyyy-MM-dd");
    if (!(dateIso > windowBoundIso && dateIso.slice(0, 4) === String(taxYear))) continue;
    const entry = selectEffectiveEntry(salaryHistoryEntries, dateIso);
    if (!entry) continue;
    events.push({ dateIso, grossKopecks: halfSplitGross(entry.grossAmountKopecks, event.kind as PaymentKind) });
  }

  // (b) each bonus row individually — per-row events sum to the same total
  // as any other chronological grouping (marginal tax over a chronological
  // sequence between two cumulative endpoints telescopes to the same sum
  // regardless of same-date grouping), so this is simpler and equally
  // correct for an aggregate total.
  for (const bonus of bonusRows) {
    if (!(bonus.date > windowBoundIso && bonus.date.slice(0, 4) === String(taxYear))) continue;
    events.push({ dateIso: bonus.date, grossKopecks: bonus.amountKopecks });
  }

  // (c) each vacation row — premium-bonus entries passed to the vacation-pay
  // average MUST be the full unfiltered bonusRows (its own 12-month lookback
  // window can reach into the prior year), never year-filtered.
  const premiumBonusEntries = toPremiumBonusEntries(bonusRows);
  for (const vacation of vacationRows) {
    const paymentDateIso = resolveVacationPaymentDate(vacation.startDate);
    if (!(paymentDateIso > windowBoundIso && paymentDateIso.slice(0, 4) === String(taxYear))) continue;
    const grossKopecks = calculateVacationPayGross(
      vacation.startDate,
      vacation.endDate,
      salaryHistoryEntries,
      premiumBonusEntries,
    ).grossKopecks;
    events.push({ dateIso: paymentDateIso, grossKopecks });
  }

  // Sort ascending by dateIso — any stable tie-break is correct per the
  // telescoping argument above.
  events.sort((a, b) => a.dateIso.localeCompare(b.dateIso));

  let cumulativeYtdKopecks = baselineAmountKopecks;
  let totalGrossKopecks = baselineAmountKopecks;
  let totalTaxKopecks = 0;
  for (const event of events) {
    const { taxKopecks } = calculateNdfl(cumulativeYtdKopecks, event.grossKopecks, taxYear);
    totalGrossKopecks += event.grossKopecks;
    totalTaxKopecks += taxKopecks;
    cumulativeYtdKopecks += event.grossKopecks;
  }

  return {
    configured: true,
    summary: {
      grossKopecks: totalGrossKopecks,
      taxKopecks: totalTaxKopecks,
      netKopecks: totalGrossKopecks - totalTaxKopecks,
      baselineIsEstimated: !baselineApplies || ytdBaseline.isEstimated,
    },
  };
}
