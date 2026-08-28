/**
 * Kopeck-based money primitives.
 *
 * All monetary amounts in this application are stored and computed as
 * integer kopecks (1 ruble = 100 kopecks) to avoid floating-point rounding
 * drift in cumulative tax calculations (see research/PITFALLS.md Pitfall 7).
 *
 * This module has no imports beyond TypeScript's own types — it must remain
 * importable from any context (server, client, tests) without pulling in
 * Next.js, React, or any I/O surface.
 */

/** An integer amount of kopecks (1/100 of a ruble). */
export type Kopecks = number;

/**
 * Converts a whole/fractional ruble amount to integer kopecks.
 * Rounds to the nearest kopeck to guard against floating-point noise
 * (e.g. 19.99 * 100 === 1998.9999999999998 in IEEE 754).
 */
export function rublesToKopecks(rubles: number): Kopecks {
  return Math.round(rubles * 100);
}

/** Converts integer kopecks to a ruble amount (may be fractional). */
export function kopecksToRubles(kopecks: Kopecks): number {
  return kopecks / 100;
}

/**
 * Formats a kopeck amount as a ru-RU currency string in whole rubles
 * (kopecks are not shown — the app's money values are always ruble-rounded
 * before display per ст.52 НК РФ rounding at the tax layer).
 */
export function formatKopecks(kopecks: Kopecks): string {
  const rubles = kopecksToRubles(kopecks);
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(rubles);
}
