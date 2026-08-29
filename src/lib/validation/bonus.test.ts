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
});
