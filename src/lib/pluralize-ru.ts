/**
 * Russian pluralization for count-based UI copy, per the standard
 * last-digit / last-two-digit rule (closes WR-04, 03-REVIEW.md — hardcoded
 * "дней" reads as a typo/bug on very common counts like 1 or 3).
 *
 * `forms` is `[singular, few, many]` in that fixed order, e.g.
 * `["день", "дня", "дней"]` for "1 день" / "3 дня" / "5 дней".
 */
export function pluralizeRu(count: number, forms: readonly [string, string, string]): string {
  const absCount = Math.abs(Math.trunc(count));
  const lastTwoDigits = absCount % 100;
  const lastDigit = absCount % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return forms[2];
  if (lastDigit === 1) return forms[0];
  if (lastDigit >= 2 && lastDigit <= 4) return forms[1];
  return forms[2];
}
