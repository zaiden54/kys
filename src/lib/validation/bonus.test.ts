import { describe, expect, it } from "vitest";
import { bonusInputSchema } from "@/lib/validation/bonus";

describe("bonusInputSchema", () => {
  it.each([0, -1])("rejects a non-positive amount: %s", (amountRubles) => {
    expect(bonusInputSchema.safeParse({ amountRubles, date: "2026-01-01" }).success).toBe(false);
  });

  it("rejects an amount that rounds below one kopeck", () => {
    expect(bonusInputSchema.safeParse({ amountRubles: 0.004, date: "2026-01-01" }).success).toBe(false);
  });

  it("rejects an impossible calendar date", () => {
    const result = bonusInputSchema.safeParse({ amountRubles: 1, date: "2026-02-30" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe("Указана несуществующая дата");
  });

  it("accepts a past date and defaults the note to an empty string", () => {
    const result = bonusInputSchema.parse({ amountRubles: 1, date: "2020-01-01" });
    expect(result.note).toBe("");
  });

  it("rejects notes longer than 500 characters", () => {
    expect(
      bonusInputSchema.safeParse({ amountRubles: 1, date: "2026-01-01", note: "x".repeat(501) })
        .success,
    ).toBe(false);
  });

  it.each([1.001, 1.005])(
    "rejects an amount carrying more than two decimal places of ruble precision: %s (closes 02-REVIEW.md WR-03)",
    (amountRubles) => {
      const result = bonusInputSchema.safeParse({ amountRubles, date: "2026-01-01" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.message === "Укажите сумму с точностью не более двух знаков после запятой")).toBe(true);
      }
    },
  );

  it("accepts an amount with exactly two decimal places", () => {
    expect(bonusInputSchema.safeParse({ amountRubles: 1.01, date: "2026-01-01" }).success).toBe(true);
  });

  it("defaults type to 'premium' when omitted", () => {
    const result = bonusInputSchema.parse({ amountRubles: 1, date: "2026-01-01" });
    expect(result.type).toBe("premium");
  });

  it("accepts an explicit 'compensation' type", () => {
    const result = bonusInputSchema.parse({ amountRubles: 1, date: "2026-01-01", type: "compensation" });
    expect(result.type).toBe("compensation");
  });

  it("rejects an invalid type value", () => {
    expect(
      bonusInputSchema.safeParse({ amountRubles: 1, date: "2026-01-01", type: "bonus" }).success,
    ).toBe(false);
  });
});
