import { describe, expect, it } from "vitest";
import { generatePaymentEvents, nextPaymentOnOrAfter, resolvePaymentDate } from "./resolve-payment-date";

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("resolvePaymentDate", () => {
  it("clamps day 31 in a 30-day month (April) to the 30th (D-03)", () => {
    expect(isoDate(resolvePaymentDate(2026, 3, 31))).toBe("2026-04-30");
  });

  it("clamps day 31 in February of a non-leap year to the 28th, then applies D-02 since 2026-02-28 is a Saturday", () => {
    // D-03 clamps 31 -> 28 first; 2026-02-28 is itself a Saturday, so D-02's
    // weekend shift then walks it back one further day to Friday the 27th —
    // the composite function correctly chains both rules, not clamping alone.
    expect(isoDate(resolvePaymentDate(2026, 1, 31))).toBe("2026-02-27");
  });

  it("clamps day 31 in February of a leap year to the 29th", () => {
    expect(isoDate(resolvePaymentDate(2028, 1, 31))).toBe("2028-02-29");
  });

  it("chains backward through the New Year public-holiday block into the prior year (D-02)", () => {
    // 2026-01-03 (Sat, holiday) -> 01-02 (Fri, holiday) -> 01-01 (Thu, holiday) -> 2025-12-31 (Wed, working)
    expect(isoDate(resolvePaymentDate(2026, 0, 3))).toBe("2025-12-31");
  });

  it("shifts a plain Saturday back to the preceding Friday", () => {
    // 2026-06-20 is a Saturday with no adjacent holiday
    expect(isoDate(resolvePaymentDate(2026, 5, 20))).toBe("2026-06-19");
  });

  it("shifts a plain Sunday back to the preceding Friday", () => {
    // 2026-06-21 is a Sunday with no adjacent holiday
    expect(isoDate(resolvePaymentDate(2026, 5, 21))).toBe("2026-06-19");
  });

  it("shifts 2026-05-01 (Праздник Весны и Труда) to the preceding working day", () => {
    expect(isoDate(resolvePaymentDate(2026, 4, 1))).toBe("2026-04-30");
  });

  it("returns a working weekday unchanged", () => {
    // 2026-06-19 is a plain Friday, not a holiday
    expect(isoDate(resolvePaymentDate(2026, 5, 19))).toBe("2026-06-19");
  });
});

describe("generatePaymentEvents", () => {
  it("produces four alternating events over 2 months, sorted ascending", () => {
    const schedule = { avansDay: 20, salaryDay: 5 };
    const events = generatePaymentEvents(schedule, new Date(2026, 8, 1), 2);

    expect(events.map((e) => `${isoDate(e.date)}:${e.kind}`)).toEqual([
      "2026-09-04:salary",
      "2026-09-18:avans",
      "2026-10-05:salary",
      "2026-10-20:avans",
    ]);
  });

  it("sorts a same-date avans/salary collision with avans first, deterministically", () => {
    // Both avansDay=31 and salaryDay=28 clamp/shift to 2026-02-27 in February 2026.
    const schedule = { avansDay: 31, salaryDay: 28 };

    for (let run = 0; run < 5; run++) {
      const events = generatePaymentEvents(schedule, new Date(2026, 1, 1), 1);
      expect(events).toHaveLength(2);
      expect(isoDate(events[0].date)).toBe("2026-02-27");
      expect(isoDate(events[1].date)).toBe("2026-02-27");
      expect(events[0].kind).toBe("avans");
      expect(events[1].kind).toBe("salary");
    }
  });
});

describe("nextPaymentOnOrAfter", () => {
  const schedule = { avansDay: 20, salaryDay: 5 };

  it("returns today's own event when today is itself a resolved payment date (on-or-after, not strictly after)", () => {
    const today = new Date(2026, 8, 18); // 2026-09-18, the resolved avans date
    const result = nextPaymentOnOrAfter(schedule, today);

    expect(result).not.toBeNull();
    expect(isoDate(result!.date)).toBe("2026-09-18");
    expect(result!.kind).toBe("avans");
  });

  it("returns the earliest event strictly later than today when today is not a payment date", () => {
    const today = new Date(2026, 8, 10); // 2026-09-10, between salary(9-04) and avans(9-18)
    const result = nextPaymentOnOrAfter(schedule, today);

    expect(result).not.toBeNull();
    expect(isoDate(result!.date)).toBe("2026-09-18");
    expect(result!.kind).toBe("avans");
  });

  it("looks ahead into the next month when today is past this month's last payment", () => {
    const today = new Date(2026, 9, 25); // 2026-10-25, after both October events
    const result = nextPaymentOnOrAfter(schedule, today);

    expect(result).not.toBeNull();
    expect(isoDate(result!.date)).toBe("2026-11-05");
    expect(result!.kind).toBe("salary");
  });
});
