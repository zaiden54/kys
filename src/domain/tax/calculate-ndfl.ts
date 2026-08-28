/**
 * Pure cumulative marginal НДФЛ (personal income tax) calculation.
 *
 * НДФЛ in Russia (2025+, per 176-ФЗ) is computed on income accumulated
 * nарастающим итогом ("cumulative total") since the start of the calendar
 * year — never as a flat rate on a single payment. The tax owed AT a given
 * payment is the delta between the ruble-rounded cumulative tax after the
 * payment and the ruble-rounded cumulative tax before it (ст.52 НК РФ:
 * round the cumulative tax, then take the difference — never round each
 * payment's tax independently, which would compound rounding drift across
 * the year; see research/PITFALLS.md Pitfall 7).
 *
 * Since 263-ФЗ (effective 01.01.2023), every payment tranche — avans
 * included — is an independent taxable event on its actual payment date.
 * `calculateNdfl` is the single code path both avans and salary payments
 * flow through; there is no separate "avans" tax logic.
 *
 * This module must import nothing from `@/lib`, `next`, or any I/O
 * surface. Its only permitted imports are `./ndfl-brackets` and `../money`.
 */

import type { Kopecks } from "../money";
import { bracketsForYear } from "./ndfl-brackets";

/**
 * Rounds a kopeck amount to the nearest whole ruble per ст.52 НК РФ:
 * fractional kopecks under 50 are dropped, 50 and above round up to the
 * next ruble. Implemented with integer arithmetic only (add 50, integer
 * divide by 100, multiply by 100) so there is no floating-point
 * tie-break ambiguity.
 */
export function roundToRuble(kopecks: Kopecks): Kopecks {
  return Math.floor((kopecks + 50) / 100) * 100;
}

/**
 * Computes the total НДФЛ owed on `cumulativeKopecks` of income accumulated
 * since the start of `taxYear`, using the fixed-base-plus-marginal-excess
 * formula: `baseTaxKopecks + (cumulative - fromKopecks) * rateBasisPoints / 10000`,
 * selecting the highest bracket whose `fromKopecks` does not exceed
 * `cumulativeKopecks`. The result is ruble-rounded — this is the ONLY
 * place rounding happens; per-payment tax deltas (see `calculateNdfl`)
 * must never be rounded independently.
 */
export function taxOnCumulative(cumulativeKopecks: Kopecks, taxYear: number): Kopecks {
  const brackets = bracketsForYear(taxYear);

  let bracket = brackets[0];
  for (const candidate of brackets) {
    if (cumulativeKopecks >= candidate.fromKopecks) {
      bracket = candidate;
    } else {
      break;
    }
  }

  const marginalKopecks = cumulativeKopecks - bracket.fromKopecks;
  const marginalTaxKopecks = Math.round((marginalKopecks * bracket.rateBasisPoints) / 10000);
  const rawTaxKopecks = bracket.baseTaxKopecks + marginalTaxKopecks;

  return roundToRuble(rawTaxKopecks);
}

/** Result of taxing a single payment against its preceding cumulative income. */
export interface NdflResult {
  /** Tax withheld on this payment: `taxOnCumulative(after) - taxOnCumulative(before)`. */
  taxKopecks: Kopecks;
  /** Take-home amount for this payment: `paymentGrossKopecks - taxKopecks`. */
  netKopecks: Kopecks;
  /** Cumulative income after this payment: `cumulativeBeforeKopecks + paymentGrossKopecks`. */
  cumulativeAfterKopecks: Kopecks;
}

/**
 * Taxes a single payment (avans or salary — identical code path for both)
 * against the cumulative income that preceded it. Tax is the difference of
 * two ruble-rounded cumulative tax values, so a payment straddling a
 * bracket threshold is split marginally rather than taxed at one flat rate.
 */
export function calculateNdfl(
  cumulativeBeforeKopecks: Kopecks,
  paymentGrossKopecks: Kopecks,
  taxYear: number,
): NdflResult {
  const cumulativeAfterKopecks = cumulativeBeforeKopecks + paymentGrossKopecks;
  const taxKopecks =
    taxOnCumulative(cumulativeAfterKopecks, taxYear) - taxOnCumulative(cumulativeBeforeKopecks, taxYear);
  const netKopecks = paymentGrossKopecks - taxKopecks;

  return { taxKopecks, netKopecks, cumulativeAfterKopecks };
}
