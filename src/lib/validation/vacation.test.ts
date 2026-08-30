import { describe, expect, it } from "vitest";
import { vacationInputSchema } from "@/lib/validation/vacation";

describe("vacationInputSchema", () => {
  it("accepts a valid date range", () => {
    const result = vacationInputSchema.safeParse({ startDate: "2026-08-01", endDate: "2026-08-10" });
    expect(result.success).toBe(true);
  });

  it("rejects endDate before startDate with the exact message", () => {
    const result = vacationInputSchema.safeParse({ startDate: "2026-08-10", endDate: "2026-08-01" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Дата начала должна быть раньше даты окончания");
      expect(result.error.issues[0]?.path).toEqual(["endDate"]);
    }
  });

  it("rejects an impossible calendar date", () => {
    const result = vacationInputSchema.safeParse({ startDate: "2026-02-30", endDate: "2026-03-01" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message === "Указана несуществующая дата")).toBe(true);
    }
  });

  it("accepts a past date range (D-V10)", () => {
    const result = vacationInputSchema.safeParse({ startDate: "2020-01-01", endDate: "2020-01-10" });
    expect(result.success).toBe(true);
  });
});
