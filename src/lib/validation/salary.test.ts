import { describe, expect, it } from "vitest";
import { salaryInputSchema, ytdBaselineInputSchema } from "@/lib/validation/salary";

const validDate = "2026-08-29";
const oneKopeckMessage = "Оклад должен быть не меньше одной копейки";
const impossibleDateMessage = "Указана несуществующая дата";
const dateFormatMessage = "Дата должна быть в формате ГГГГ-ММ-ДД";

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

// ---------------------------------------------------------------------------
// Calendar round-trip validity, shared by effectiveFrom and asOfDate.
// (SAL-01, SAL-02, SAL-03 — 01-VERIFICATION.md gaps[2], 01-REVIEW.md CR-03)
// ---------------------------------------------------------------------------

/** Shapes that parse under JavaScript's lenient Date but name no real calendar day. */
const impossibleDates = [
  "2026-02-29", // 29 Feb in a non-leap year normalizes forward to 1 Mar
  "2026-02-31", // 31 Feb normalizes forward to 3 Mar
  "2026-04-31", // April has 30 days
  "2026-06-31", // June has 30 days
  "2026-09-31", // September has 30 days
  "2026-11-31", // November has 30 days
  "2026-00-15", // month 00 is out of range
  "2026-13-15", // month 13 is out of range
  "2026-05-00", // day 00 is out of range
  "2026-05-32", // day 32 is out of range
];

/** Real calendar days, including leap-day, month boundaries, and D-13/D-15 extremes. */
const validCalendarDates = [
  "2024-02-29", // leap year — 29 Feb is real
  "2026-02-28", // non-leap year — last real day of February
  "2026-05-01", // first day of a month
  "2026-05-31", // last day of a 31-day month
  "1990-01-01", // far past (D-13 backdating)
  "2099-12-31", // far future (D-15)
];

type CalendarSchemaCase = {
  name: string;
  field: "effectiveFrom" | "asOfDate";
  parse: (date: string) => ReturnType<typeof salaryInputSchema.safeParse | typeof ytdBaselineInputSchema.safeParse>;
};

const calendarSchemaCases: CalendarSchemaCase[] = [
  {
    name: "salaryInputSchema.effectiveFrom",
    field: "effectiveFrom",
    parse: (date) => salaryInputSchema.safeParse({ grossRubles: 250_000, effectiveFrom: date }),
  },
  {
    name: "ytdBaselineInputSchema.asOfDate",
    field: "asOfDate",
    parse: (date) => ytdBaselineInputSchema.safeParse({ amountRubles: 100_000, asOfDate: date }),
  },
];

describe.each(calendarSchemaCases)("$name calendar round trip", ({ parse, field }) => {
  it.each(impossibleDates)("rejects the impossible date %s", (date) => {
    const result = parse(date);

    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors as Record<string, string[] | undefined>;
      expect(fieldErrors[field]).toContain(impossibleDateMessage);
    }
  });

  it.each(validCalendarDates)("accepts the real calendar date %s", (date) => {
    expect(parse(date).success).toBe(true);
  });

  it("still fails shape-invalid strings with the format message, not the impossible-date message", () => {
    const result = parse("2026-2-5");

    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors as Record<string, string[] | undefined>;
      expect(fieldErrors[field]).toContain(dateFormatMessage);
      expect(fieldErrors[field]).not.toContain(impossibleDateMessage);
    }
  });
});
