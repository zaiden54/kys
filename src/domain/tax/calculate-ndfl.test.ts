import { describe, expect, it } from "vitest";
import { roundToRuble, taxOnCumulative, calculateNdfl } from "./calculate-ndfl";
import { bracketsForYear, UnsupportedTaxYearError } from "./ndfl-brackets";

const YEAR = 2025;

describe("roundToRuble", () => {
  it("drops fractional kopecks under 50", () => {
    expect(roundToRuble(12_345)).toBe(12_300);
  });

  it("rounds up on exactly 50 kopecks", () => {
    expect(roundToRuble(12_350)).toBe(12_400);
  });

  it("rounds up when fractional kopecks exceed 50", () => {
    expect(roundToRuble(12_399)).toBe(12_400);
  });

  it("returns 0 for 0", () => {
    expect(roundToRuble(0)).toBe(0);
  });
});

describe("taxOnCumulative", () => {
  it("returns 0 for 0 cumulative income", () => {
    expect(taxOnCumulative(0, YEAR)).toBe(0);
  });

  it("taxes 100,000 rub at the 13% bracket", () => {
    expect(taxOnCumulative(100_000_00, YEAR)).toBe(13_000_00);
  });

  it("taxes exactly at the first threshold (2,400,000 rub) using the 15% bracket's fixed base", () => {
    expect(taxOnCumulative(2_400_000_00, YEAR)).toBe(312_000_00);
  });

  it("taxes one ruble over the first threshold, dropping the fractional 15 kopecks", () => {
    expect(taxOnCumulative(2_400_001_00, YEAR)).toBe(312_000_00);
  });

  it("taxes exactly at the second threshold (5,000,000 rub)", () => {
    expect(taxOnCumulative(5_000_000_00, YEAR)).toBe(702_000_00);
  });

  it("taxes exactly at the third threshold (20,000,000 rub)", () => {
    expect(taxOnCumulative(20_000_000_00, YEAR)).toBe(3_402_000_00);
  });

  it("taxes exactly at the fourth threshold (50,000,000 rub)", () => {
    expect(taxOnCumulative(50_000_000_00, YEAR)).toBe(9_402_000_00);
  });

  it("taxes above the top threshold at the 22% marginal rate", () => {
    expect(taxOnCumulative(60_000_000_00, YEAR)).toBe(9_402_000_00 + 10_000_000_00 * 0.22);
  });
});

describe("calculateNdfl", () => {
  it("splits a payment straddling the 2,400,000 threshold marginally (13%/15%), not at a single flat rate", () => {
    const result = calculateNdfl(2_350_000_00, 100_000_00, YEAR);
    expect(result.taxKopecks).toBe(14_000_00);
    expect(result.netKopecks).toBe(86_000_00);
    // A flat-13% implementation would (incorrectly) compute 13_000_00 — must not match.
    expect(result.taxKopecks).not.toBe(13_000_00);
  });

  it("matches the plan's acceptance-criteria worked example exactly", () => {
    const result = calculateNdfl(235_000_000, 10_000_000, YEAR);
    expect(result.taxKopecks).toBe(1_400_000);
  });

  it("taxes avans and salary identically: two sequential 100,000 rub payments equal one 200,000 rub payment", () => {
    const first = calculateNdfl(0, 100_000_00, YEAR);
    const second = calculateNdfl(first.cumulativeAfterKopecks, 100_000_00, YEAR);
    const totalTax = first.taxKopecks + second.taxKopecks;

    const single = calculateNdfl(0, 200_000_00, YEAR);

    expect(totalTax).toBe(single.taxKopecks);
  });

  it("returns zero tax and zero net for a zero-gross payment, cumulative unchanged", () => {
    const result = calculateNdfl(500_000_00, 0, YEAR);
    expect(result.taxKopecks).toBe(0);
    expect(result.netKopecks).toBe(0);
    expect(result.cumulativeAfterKopecks).toBe(500_000_00);
  });

  it("sums per-payment tax across a 24-payment sequence straddling brackets to exactly the delta of cumulative tax (no rounding drift)", () => {
    // Deterministic pseudo-random-looking amounts, summing well past the 2,400,000 rub threshold.
    const amountsRub = [
      95_123, 210_456, 340_789, 88_231, 150_000, 275_555, 199_999, 310_222, 62_487, 128_900, 245_611, 179_333,
      301_450, 92_876, 158_204, 267_991, 143_657, 219_038, 87_512, 305_299, 172_845, 249_631, 116_078, 233_492,
    ];

    let cumulative = 0;
    let totalTax = 0;
    for (const rub of amountsRub) {
      const grossKopecks = rub * 100;
      const result = calculateNdfl(cumulative, grossKopecks, YEAR);
      totalTax += result.taxKopecks;
      cumulative = result.cumulativeAfterKopecks;
    }

    const totalIncomeRub = amountsRub.reduce((sum, rub) => sum + rub, 0);
    expect(totalIncomeRub).toBeGreaterThan(2_400_000);

    const expectedTotalTax = taxOnCumulative(cumulative, YEAR) - taxOnCumulative(0, YEAR);
    expect(totalTax).toBe(expectedTotalTax);
  });
});

describe("bracketsForYear", () => {
  it("returns the five-bracket scale for 2025", () => {
    expect(bracketsForYear(2025)).toHaveLength(5);
  });

  it("returns the five-bracket scale for 2026 (falls back to the last registered scale)", () => {
    expect(bracketsForYear(2026)).toHaveLength(5);
  });

  it("throws UnsupportedTaxYearError for 2024 (before any registered scale)", () => {
    expect(() => bracketsForYear(2024)).toThrow(UnsupportedTaxYearError);
  });

  it("throws UnsupportedTaxYearError for 2027 (beyond MAX_VERIFIED_TAX_YEAR)", () => {
    expect(() => bracketsForYear(2027)).toThrow(UnsupportedTaxYearError);
  });

  it("names the unsupported year in the thrown error message", () => {
    expect(() => bracketsForYear(2027)).toThrow(/2027/);
  });
});
