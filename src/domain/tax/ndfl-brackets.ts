/**
 * Versioned progressive НДФЛ (personal income tax) bracket scales.
 *
 * Legal basis for the 2025 scale: 5-bracket progressive scale effective
 * 01.01.2025 per Federal Law 176-ФЗ (12.07.2024), amending НК РФ ст. 224.
 * The 2025 scale was verified against the secondary sources named in
 * .planning/phases/01-core-payroll-loop/01-RESEARCH.md
 * § "НДФЛ 2025 Bracket Correctness" (garant.ru, nalog-nalog.ru, an official
 * ФНС regional page). Confirmation against the primary НК РФ ст.224 statute
 * text itself remains an OPEN item — no execution or verification sandbox
 * used on this project has had live web access to perform that check — and
 * is tracked in .planning/phases/01-core-payroll-loop/01-VERIFICATION.md's
 * `human_verification` block. Do not mark that item closed in this file
 * until it has actually been performed against the primary statute text.
 *
 * A tax year outside the registered/verified range must fail loudly rather
 * than silently return a confidently wrong number — see
 * `UnsupportedTaxYearError` and `bracketsForYear` below.
 */

import type { Kopecks } from "../money";

/** One marginal bracket of a progressive НДФЛ scale, all amounts in kopecks. */
export interface NdflBracket {
  /** Cumulative-income floor (inclusive) at which this bracket's rate begins to apply. */
  fromKopecks: Kopecks;
  /** Marginal rate for income above `fromKopecks`, expressed in basis points (100 = 1%). */
  rateBasisPoints: number;
  /** Fixed cumulative tax already owed at exactly `fromKopecks` (the "base" in the fixed-base-plus-marginal-excess formula). */
  baseTaxKopecks: Kopecks;
}

/**
 * The 2025 five-bracket scale (176-ФЗ), thresholds and fixed bases converted
 * from rubles to kopecks (x100).
 *
 * | Cumulative annual income (₽) | Rate | Fixed base   |
 * |-------------------------------|------|--------------|
 * | 0 – 2,400,000                 | 13%  | 0            |
 * | 2,400,000 – 5,000,000         | 15%  | 312,000      |
 * | 5,000,000 – 20,000,000        | 18%  | 702,000      |
 * | 20,000,000 – 50,000,000       | 20%  | 3,402,000    |
 * | over 50,000,000               | 22%  | 9,402,000    |
 */
const NDFL_SCALE_2025: readonly NdflBracket[] = [
  { fromKopecks: 0, rateBasisPoints: 1300, baseTaxKopecks: 0 },
  { fromKopecks: 2_400_000_00, rateBasisPoints: 1500, baseTaxKopecks: 312_000_00 }, // 2400000 rub threshold, 312000 rub fixed base
  { fromKopecks: 5_000_000_00, rateBasisPoints: 1800, baseTaxKopecks: 702_000_00 }, // 5000000 rub threshold, 702000 rub fixed base
  { fromKopecks: 20_000_000_00, rateBasisPoints: 2000, baseTaxKopecks: 3_402_000_00 }, // 20000000 rub threshold, 3402000 rub fixed base
  { fromKopecks: 50_000_000_00, rateBasisPoints: 2200, baseTaxKopecks: 9_402_000_00 }, // 50000000 rub threshold, 9402000 rub fixed base
];

/**
 * Registry of scales keyed by the calendar year they became effective.
 * `bracketsForYear` selects the entry with the greatest effective year not
 * exceeding the requested year — a new law would add a new keyed entry here,
 * never mutate an existing one.
 */
export const NDFL_SCALES: Readonly<Record<number, readonly NdflBracket[]>> = {
  2025: NDFL_SCALE_2025,
};

/**
 * The last tax year this bracket table has been human-verified for. Raising
 * this is the deliberate annual review checkpoint — do not bump without
 * re-confirming the scale is unchanged (or adding a new `NDFL_SCALES` entry
 * if it changed). This value rests on the secondary-source verification
 * described in the module header comment; the primary-statute confirmation
 * is still an open item and does not block this value, since lowering it
 * would turn every current-year forecast into a live outage over a
 * comment-accuracy concern, not a functional regression.
 */
export const MAX_VERIFIED_TAX_YEAR = 2026;

/** Thrown when a tax year falls outside the registered/verified range. */
export class UnsupportedTaxYearError extends Error {
  constructor(year: number) {
    super(`No verified НДФЛ bracket scale is registered for tax year ${year}`);
    this.name = "UnsupportedTaxYearError";
  }
}

/**
 * Guards `taxOnCumulative`'s bracket-selection loop (`calculate-ndfl.ts`),
 * which walks a scale and stops at the first threshold above the cumulative
 * income — correct only for a strictly ascending scale. Without this guard,
 * a mis-ordered future scale (a mistyped or transposed `fromKopecks` in a
 * new `NDFL_SCALES` entry) would silently select a lower bracket and
 * under-tax every user, rather than fail — precisely the failure mode
 * `UnsupportedTaxYearError` exists to prevent elsewhere in this module.
 * Throws an `Error` naming the offending index the first time an element's
 * `fromKopecks` is not strictly greater than its predecessor's.
 */
export function assertStrictlyAscending(brackets: readonly NdflBracket[]): void {
  for (let i = 1; i < brackets.length; i++) {
    if (brackets[i].fromKopecks <= brackets[i - 1].fromKopecks) {
      throw new Error(`NDFL bracket scale is not strictly ascending at index ${i}`);
    }
  }
}

/**
 * Selects the bracket scale in force for `year`: the registered scale with
 * the greatest effective year not exceeding `year`. Throws
 * `UnsupportedTaxYearError` if `year` is below the earliest registered scale
 * or above `MAX_VERIFIED_TAX_YEAR`. The selected scale is swept by
 * `assertStrictlyAscending` immediately before returning, so every consumer
 * is covered at this single chokepoint.
 */
export function bracketsForYear(year: number): readonly NdflBracket[] {
  if (year > MAX_VERIFIED_TAX_YEAR) {
    throw new UnsupportedTaxYearError(year);
  }

  const effectiveYears = Object.keys(NDFL_SCALES)
    .map(Number)
    .filter((effectiveYear) => effectiveYear <= year)
    .sort((a, b) => b - a);

  const selectedYear = effectiveYears[0];
  if (selectedYear === undefined) {
    throw new UnsupportedTaxYearError(year);
  }

  const brackets = NDFL_SCALES[selectedYear];
  assertStrictlyAscending(brackets);
  return brackets;
}
