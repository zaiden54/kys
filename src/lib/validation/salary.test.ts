import { describe, expect, it } from "vitest";
import { salaryInputSchema } from "@/lib/validation/salary";

const validDate = "2026-08-29";
const oneKopeckMessage = "Оклад должен быть не меньше одной копейки";

describe("salaryInputSchema persisted-precision boundary", () => {
  it.each([0.001, "0.001", 0.0049, "0.0049"])(
    "rejects %j because it rounds to zero kopecks",
    (grossRubles) => {
      const result = salaryInputSchema.safeParse({ grossRubles, effectiveFrom: validDate });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.grossRubles).toContain(oneKopeckMessage);
      }
    },
  );

  it.each([0.005, "0.005", 0.01, "0.01", 250_000])(
    "accepts %j because it persists as at least one kopeck",
    (grossRubles) => {
      expect(
        salaryInputSchema.safeParse({ grossRubles, effectiveFrom: validDate }).success,
      ).toBe(true);
    },
  );

  it.each([
    [0, "Оклад должен быть больше нуля"],
    [-1, "Оклад должен быть больше нуля"],
    ["не число", "Оклад должен быть числом"],
    [100_000_001, "Оклад превышает допустимый максимум"],
  ])("keeps the existing guard for %j", (grossRubles, expectedMessage) => {
    const result = salaryInputSchema.safeParse({ grossRubles, effectiveFrom: validDate });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.grossRubles).toContain(expectedMessage);
    }
  });
});
