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

  it("accepts a range exactly at the 366-day cap (closes 03-REVIEW.md WR-03)", () => {
    // 2026-01-01 to 2026-12-31 inclusive is 365 days (2026 is not a leap
    // year); extend one more day to land exactly on the 366-day ceiling.
    const result = vacationInputSchema.safeParse({ startDate: "2026-01-01", endDate: "2027-01-01" });
    expect(result.success).toBe(true);
  });

  it("rejects a range one day past the cap with the exact message", () => {
    const result = vacationInputSchema.safeParse({ startDate: "2026-01-01", endDate: "2027-01-02" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Отпуск не может длиться дольше 366 дней");
      expect(result.error.issues[0]?.path).toEqual(["endDate"]);
    }
  });

  it("rejects a decade-long typo'd date range (bypassing the client form)", () => {
    const result = vacationInputSchema.safeParse({ startDate: "2026-01-01", endDate: "2036-01-01" });
    expect(result.success).toBe(false);
  });
});
