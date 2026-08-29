/**
 * Integration suite for src/app/actions/forecast.ts, run against the real
 * database named by DATABASE_URL (same strategy as
 * src/lib/db/salary-repository.test.ts — no separate test DB / Neon branch
 * infrastructure for Phase 1).
 *
 * Isolation: each test gets two throwaway `user` rows with random ids,
 * created in `beforeEach` and deleted (cascade) in `afterEach`.
 */

import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { format } from "date-fns";
import { db } from "@/lib/db";
import { user } from "@/lib/db/auth-schema";
import {
  replaceSalaryAt,
  upsertSchedule,
  upsertYtdBaseline,
} from "@/lib/db/salary-repository";
import { nextPaymentOnOrAfter } from "@/domain/schedule/resolve-payment-date";
import { calculateNdfl } from "@/domain/tax/calculate-ndfl";
import { nowInMoscow } from "@/domain/time";
import { forecastNextPayment } from "@/app/actions/forecast";

async function createThrowawayUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(user).values({
    id,
    name: "Test User",
    email: `forecast-test-${id}@example.invalid`,
  });
  return id;
}

describe("forecastNextPayment", () => {
  let userAId: string;
  let userBId: string;

  beforeEach(async () => {
    userAId = await createThrowawayUser();
    userBId = await createThrowawayUser();
  });

  afterEach(async () => {
    await db.delete(user).where(eq(user.id, userAId));
    await db.delete(user).where(eq(user.id, userBId));
  });

  it("(1) a configured user gets a forecast whose date matches nextPaymentOnOrAfter and whose net equals gross minus calculateNdfl's tax for the same inputs", async () => {
    await replaceSalaryAt(userAId, 100_000_00, "2026-01-01");
    await upsertSchedule(userAId, 10, 25);
    await upsertYtdBaseline(userAId, 0, "2026-01-01", false);

    const result = await forecastNextPayment(userAId);
    expect(result.configured).toBe(true);
    if (!result.configured) throw new Error("expected a configured result");

    const expectedEvent = nextPaymentOnOrAfter({ avansDay: 10, salaryDay: 25 }, nowInMoscow());
    expect(expectedEvent).not.toBeNull();
    const expectedDateIso = format(expectedEvent!.date, "yyyy-MM-dd");
    expect(result.forecast.date).toBe(expectedDateIso);
    expect(result.forecast.kind).toBe(expectedEvent!.kind);

    const expectedGrossKopecks = Math.round(100_000_00 / 2);
    const expectedTax = calculateNdfl(0, expectedGrossKopecks, expectedEvent!.date.getFullYear()).taxKopecks;

    expect(result.forecast.grossKopecks).toBe(expectedGrossKopecks);
    expect(result.forecast.taxKopecks).toBe(expectedTax);
    expect(result.forecast.netKopecks).toBe(expectedGrossKopecks - expectedTax);
  });

  it("(2) a user with a schedule but no salary gets the not-configured result naming salary", async () => {
    await upsertSchedule(userAId, 10, 25);

    const result = await forecastNextPayment(userAId);
    expect(result.configured).toBe(false);
    if (result.configured) throw new Error("expected a not-configured result");
    expect(result.missing).toBe("salary");
  });

  it("(3) a user with a salary but no schedule gets the not-configured result naming schedule", async () => {
    await replaceSalaryAt(userAId, 100_000_00, "2026-01-01");

    const result = await forecastNextPayment(userAId);
    expect(result.configured).toBe(false);
    if (result.configured) throw new Error("expected a not-configured result");
    expect(result.missing).toBe("schedule");
  });

  it("(4) a user who skipped the year-to-date question gets a forecast with baselineIsEstimated true and a cumulative-before of zero", async () => {
    await replaceSalaryAt(userAId, 100_000_00, "2026-01-01");
    await upsertSchedule(userAId, 10, 25);
    // No ytd_baseline row saved: getYtdBaseline synthesizes a zero,
    // estimated default (D-11) rather than null.

    const result = await forecastNextPayment(userAId);
    expect(result.configured).toBe(true);
    if (!result.configured) throw new Error("expected a configured result");
    expect(result.forecast.baselineIsEstimated).toBe(true);

    const expectedEvent = nextPaymentOnOrAfter({ avansDay: 10, salaryDay: 25 }, nowInMoscow());
    const expectedGrossKopecks = Math.round(100_000_00 / 2);
    const expectedTax = calculateNdfl(0, expectedGrossKopecks, expectedEvent!.date.getFullYear()).taxKopecks;
    expect(result.forecast.taxKopecks).toBe(expectedTax);
  });

  it("(5) a user with a non-zero baseline receives strictly more tax on identical gross than a zero-baseline user", async () => {
    // Same monthly gross for both users -> identical per-payment gross
    // (2,000,000 rub / 2 = 1,000,000 rub per payment). User A's baseline is
    // zero (payment stays entirely inside the first 0-2.4M rub bracket).
    // User B's baseline (2,000,000 rub) is close enough to the 2.4M rub
    // threshold that this same payment straddles into the second bracket,
    // producing strictly more tax on the identical gross.
    const monthlyGrossKopecks = 2_000_000_00;

    await replaceSalaryAt(userAId, monthlyGrossKopecks, "2026-01-01");
    await upsertSchedule(userAId, 10, 25);
    await upsertYtdBaseline(userAId, 0, "2026-01-01", false);

    await replaceSalaryAt(userBId, monthlyGrossKopecks, "2026-01-01");
    await upsertSchedule(userBId, 10, 25);
    await upsertYtdBaseline(userBId, 2_000_000_00, "2026-01-01", false);

    const resultA = await forecastNextPayment(userAId);
    const resultB = await forecastNextPayment(userBId);
    expect(resultA.configured).toBe(true);
    expect(resultB.configured).toBe(true);
    if (!resultA.configured || !resultB.configured) {
      throw new Error("expected both results to be configured");
    }

    expect(resultB.forecast.grossKopecks).toBe(resultA.forecast.grossKopecks);
    expect(resultB.forecast.taxKopecks).toBeGreaterThan(resultA.forecast.taxKopecks);
  });

  it("(6) a future-dated salary change has no effect on a payment dated before its effective date (D-15)", async () => {
    await upsertSchedule(userAId, 10, 25);
    await replaceSalaryAt(userAId, 80_000_00, "2020-01-01");

    const farFutureEffectiveFrom = format(
      new Date(nowInMoscow().getFullYear() + 5, 0, 1),
      "yyyy-MM-dd",
    );
    await replaceSalaryAt(userAId, 999_000_00, farFutureEffectiveFrom);

    const result = await forecastNextPayment(userAId);
    expect(result.configured).toBe(true);
    if (!result.configured) throw new Error("expected a configured result");

    expect(result.forecast.grossKopecks).toBe(Math.round(80_000_00 / 2));
  });

  it("(7) with the clock frozen inside the 21:00-24:00 UTC gap window, the forecast resolves against the Moscow calendar day, not an unanchored one (closes 01-VERIFICATION.md gap 2 / CR-01)", async () => {
    // 2026-06-15T22:00:00Z is 2026-06-16 01:00 in Moscow (UTC+3): Moscow has
    // already turned the calendar page while an unanchored UTC-host read
    // would still say "today is the 15th."
    const frozenInstant = new Date("2026-06-15T22:00:00Z");
    const schedule = { avansDay: 15, salaryDay: 16 };
    const originalTz = process.env.TZ;

    vi.useFakeTimers();
    vi.setSystemTime(frozenInstant);
    try {
      await replaceSalaryAt(userAId, 100_000_00, "2020-01-01");
      await upsertSchedule(userAId, schedule.avansDay, schedule.salaryDay);
      await upsertYtdBaseline(userAId, 0, "2026-01-01", false);

      const result = await forecastNextPayment(userAId);
      expect(result.configured).toBe(true);
      if (!result.configured) throw new Error("expected a configured result");

      // Moscow-anchored answer: today is already the 16th in Moscow, so the
      // 15th's avans is in the past and the earliest eligible event is the
      // 16th's salary — matches nextPaymentOnOrAfter(schedule, nowInMoscow()).
      const moscowExpected = nextPaymentOnOrAfter(schedule, nowInMoscow());
      expect(moscowExpected).not.toBeNull();
      expect(result.forecast.date).toBe(format(moscowExpected!.date, "yyyy-MM-dd"));
      expect(result.forecast.date).toBe("2026-06-16");
      expect(result.forecast.kind).toBe("salary");

      // Prove this genuinely differs from what the previously unanchored
      // current-time source would have produced on a UTC-configured host:
      // under TZ=UTC, the frozen instant's local fields still read the 15th,
      // so the 15th's avans would still be eligible.
      process.env.TZ = "UTC";
      const unanchoredEvent = nextPaymentOnOrAfter(schedule, frozenInstant);
      expect(unanchoredEvent).not.toBeNull();
      const unanchoredDateIso = format(unanchoredEvent!.date, "yyyy-MM-dd");
      expect(unanchoredDateIso).toBe("2026-06-15");
      expect(unanchoredEvent!.kind).toBe("avans");
      expect(result.forecast.date).not.toBe(unanchoredDateIso);
    } finally {
      process.env.TZ = originalTz;
      vi.useRealTimers();
    }
  });
});
