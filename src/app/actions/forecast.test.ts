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
import { forecastNextPayment, selectNextPaymentEvent } from "@/app/actions/forecast";
import { createBonus } from "@/lib/db/bonus-repository";
import { saveBonusAction } from "@/app/actions/bonus";
import { createVacation } from "@/lib/db/vacation-repository";
import { saveVacationAction } from "@/app/actions/vacation";
import {
  calculateVacationPayGross,
  resolveVacationPaymentDate,
} from "@/domain/vacation/calculate-average-daily-earnings";
import { requireUserId } from "@/lib/session";

vi.mock("@/lib/session", () => ({ requireUserId: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

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
    // Frozen at 2026-01-01 (Moscow) with the baseline's own asOfDate also
    // 2026-01-01: the earliest eligible payment on/after "today" is by
    // construction the earliest event strictly after the baseline's window
    // bound too, so zero prior events accrue and the oracle cumulativeBefore
    // is exactly the baseline (0) — deriving this from first principles
    // rather than a hand-picked resolved date keeps the assertion robust to
    // any RU calendar shift.
    const frozenInstant = new Date("2026-01-01T09:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(frozenInstant);
    try {
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
      const expectedTax = calculateNdfl(0, expectedGrossKopecks, expectedEvent!.date.getFullYear())
        .taxKopecks;

      expect(result.forecast.grossKopecks).toBe(expectedGrossKopecks);
      expect(result.forecast.taxKopecks).toBe(expectedTax);
      expect(result.forecast.netKopecks).toBe(expectedGrossKopecks - expectedTax);
    } finally {
      vi.useRealTimers();
    }
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

  it("(4) a user who skipped the year-to-date question gets a forecast with baselineIsEstimated true, and net still equals gross minus tax", async () => {
    // Narrowed (01-10): the exact taxKopecks value now depends on however
    // many scheduled events fall between the synthesized zero baseline's
    // 1-January asOfDate and whatever "today" resolves to when this test
    // actually runs — that oracle belongs in the frozen-clock scenarios (1),
    // (5) and the bracket-crossing test below, not here. This test stays
    // focused on the two properties that must hold regardless of when it
    // runs: the estimated flag, and the tax/net identity.
    await replaceSalaryAt(userAId, 100_000_00, "2026-01-01");
    await upsertSchedule(userAId, 10, 25);
    // No ytd_baseline row saved: getYtdBaseline synthesizes a zero,
    // estimated default (D-11) rather than null.

    const result = await forecastNextPayment(userAId);
    expect(result.configured).toBe(true);
    if (!result.configured) throw new Error("expected a configured result");
    expect(result.forecast.baselineIsEstimated).toBe(true);
    expect(result.forecast.netKopecks).toBe(result.forecast.grossKopecks - result.forecast.taxKopecks);
  });

  it("(5) a user with a non-zero baseline receives strictly more tax on identical gross than a zero-baseline user", async () => {
    // Frozen at 2026-01-01, both baselines' own asOfDate also 2026-01-01:
    // by the same construction as test (1), zero prior events accrue for
    // EITHER user, so the only difference between A and B is the baseline
    // amount itself — isolating exactly the comparison this test targets.
    // Same monthly gross for both users -> identical per-payment gross
    // (2,000,000 rub / 2 = 1,000,000 rub per payment). User A's baseline is
    // zero (payment stays entirely inside the first 0-2.4M rub bracket).
    // User B's baseline (2,000,000 rub) is close enough to the 2.4M rub
    // threshold that this same payment straddles into the second bracket,
    // producing strictly more tax on the identical gross.
    const frozenInstant = new Date("2026-01-01T09:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(frozenInstant);
    try {
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
      expect(resultA.forecast.taxKopecks).toBe(
        calculateNdfl(0, resultA.forecast.grossKopecks, Number(resultA.forecast.date.slice(0, 4)))
          .taxKopecks,
      );
      expect(resultB.forecast.taxKopecks).toBeGreaterThan(resultA.forecast.taxKopecks);
    } finally {
      vi.useRealTimers();
    }
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

  it("(8) prior scheduled payments accrue into the cumulative base and cross a bracket, producing strictly more tax than the stale baseline alone (closes 01-VERIFICATION.md gaps[0] / TAX-01, TAX-02, HOME-01)", async () => {
    // Baseline: 1,000,000 rub as of 2026-06-30, confirmed (not estimated).
    // Salary: 600,000 rub/month effective 2026-01-01, avans on the 20th,
    // salary on the 5th. Clock frozen to 2026-09-01 (Moscow): the earliest
    // eligible payment on/after "today" is 2026-09-04's salary (confirmed
    // via throwaway Node check against date-holidays@3.36.0 — see
    // 01-10-SUMMARY.md). July and August are therefore fully "interior"
    // months between the baseline's window bound and the target payment:
    // both months' avans+salary events are counted in full, and
    // halfSplitGross's floor+remainder reconciliation guarantees their sum
    // is exactly two whole monthly oklads regardless of which day within
    // each month the events actually land on — so this hand-derived
    // cumulative base is robust to RU calendar specifics, not dependent on
    // them:
    //   cumulativeBefore = 1,000,000_00 (baseline)
    //                     + 600_000_00 * 2 (July + August, fully accrued)
    //                     = 2,200,000_00
    // and the payment's own gross (300,000 rub) pushes cumulative income
    // from 2,200,000 to 2,500,000 rub, crossing the 2,400,000 rub bracket
    // threshold (ndfl-brackets.ts).
    const frozenInstant = new Date("2026-09-01T09:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(frozenInstant);
    try {
      await replaceSalaryAt(userAId, 600_000_00, "2026-01-01");
      await upsertSchedule(userAId, 20, 5);
      await upsertYtdBaseline(userAId, 1_000_000_00, "2026-06-30", false);

      const result = await forecastNextPayment(userAId);
      expect(result.configured).toBe(true);
      if (!result.configured) throw new Error("expected a configured result");

      expect(result.forecast.date).toBe("2026-09-04");
      expect(result.forecast.kind).toBe("salary");
      expect(result.forecast.grossKopecks).toBe(300_000_00);

      const cumulativeBeforeKopecks = 2_200_000_00;
      const expected = calculateNdfl(cumulativeBeforeKopecks, 300_000_00, 2026);
      expect(result.forecast.taxKopecks).toBe(expected.taxKopecks);
      expect(result.forecast.netKopecks).toBe(expected.netKopecks);

      // The assertion that actually fails against the pre-fix implementation
      // (which taxed only against the stale 1,000,000 rub baseline): the
      // real, accrual-aware tax is strictly higher than the baseline-only
      // answer would have been.
      const baselineOnlyTax = calculateNdfl(1_000_000_00, 300_000_00, 2026).taxKopecks;
      expect(result.forecast.taxKopecks).toBeGreaterThan(baselineOnlyTax);
    } finally {
      vi.useRealTimers();
    }
  });

  it("(9) forecasts a standalone future bonus without salary or schedule", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T09:00:00Z"));
    try {
      await createBonus(userAId, 100_000_00, "2026-09-02", "Проект", "premium");
      const result = await forecastNextPayment(userAId);
      expect(result.configured).toBe(true);
      if (!result.configured) throw new Error("expected configured bonus forecast");
      const expected = calculateNdfl(0, 100_000_00, 2026);
      expect(result.forecast).toMatchObject({
        date: "2026-09-02", kind: "bonus", grossKopecks: 100_000_00,
        taxKopecks: expected.taxKopecks, netKopecks: expected.netKopecks,
      });
      expect(result.forecast.breakdown).toBeUndefined();
    } finally { vi.useRealTimers(); }
  });

  it("(10) combines every same-date bonus with the scheduled payment", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T09:00:00Z"));
    try {
      await replaceSalaryAt(userAId, 600_000_00, "2026-01-01");
      await upsertSchedule(userAId, 20, 5);
      await createBonus(userAId, 40_000_00, "2026-09-04", "Первый", "premium");
      await createBonus(userAId, 10_000_00, "2026-09-04", "Второй", "premium");
      const result = await forecastNextPayment(userAId);
      expect(result.configured).toBe(true);
      if (!result.configured) throw new Error("expected configured combined forecast");
      expect(result.forecast.breakdown).toEqual({
        salaryOrAvansKopecks: 300_000_00, bonusKopecks: 50_000_00,
      });
      expect(result.forecast.grossKopecks).toBe(350_000_00);
    } finally { vi.useRealTimers(); }
  });

  it("(11) a past bonus increases tax on the next scheduled payment", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T09:00:00Z"));
    try {
      for (const id of [userAId, userBId]) {
        await replaceSalaryAt(id, 600_000_00, "2026-01-01");
        await upsertSchedule(id, 20, 5);
        await upsertYtdBaseline(id, 1_700_000_00, "2026-08-01", false);
      }
      await createBonus(userBId, 100_000_00, "2026-08-15", "Прошлый", "premium");
      const withoutBonus = await forecastNextPayment(userAId);
      const withBonus = await forecastNextPayment(userBId);
      if (!withoutBonus.configured || !withBonus.configured) throw new Error("expected forecasts");
      expect(withBonus.forecast.taxKopecks).toBeGreaterThan(withoutBonus.forecast.taxKopecks);
    } finally { vi.useRealTimers(); }
  });

  it("(13) a confirmed baseline dated in a year other than the resolved payment's year is never reported as baselineIsEstimated: false (closes 02-REVIEW.md WR-01)", async () => {
    // Frozen at 2026-01-01 (Moscow): the earliest eligible payment on/after
    // "today" lands in 2026 (the highest year with a verified НДФЛ bracket
    // scale — MAX_VERIFIED_TAX_YEAR), but the confirmed baseline is dated
    // 2025-06-30 — a prior calendar year. getCumulativeIncomeBeforeDate's
    // own year-boundary check silently ignores this baseline (it
    // contributes zero), so the confidence flag returned alongside it must
    // say so too: a baseline the tax calculation never actually used must
    // never be reported to the UI as confirmed.
    const frozenInstant = new Date("2026-01-01T09:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(frozenInstant);
    try {
      await replaceSalaryAt(userAId, 100_000_00, "2026-01-01");
      await upsertSchedule(userAId, 10, 25);
      await upsertYtdBaseline(userAId, 500_000_00, "2025-06-30", false);

      const result = await forecastNextPayment(userAId);
      expect(result.configured).toBe(true);
      if (!result.configured) throw new Error("expected a configured result");
      expect(result.forecast.date.slice(0, 4)).toBe("2026");
      expect(result.forecast.baselineIsEstimated).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("(14) a confirmed baseline that applies (same year, on/before the payment date) still reports its own isEstimated value untouched", async () => {
    // Same construction as test (1)/(5): frozen clock, baseline's own
    // asOfDate also 2026-01-01, so the baseline demonstrably applies —
    // this is the control case proving the WR-01 fix does not regress the
    // in-boundary path.
    const frozenInstant = new Date("2026-01-01T09:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(frozenInstant);
    try {
      await replaceSalaryAt(userAId, 100_000_00, "2026-01-01");
      await upsertSchedule(userAId, 10, 25);
      await upsertYtdBaseline(userAId, 500_000_00, "2026-01-01", false);

      const result = await forecastNextPayment(userAId);
      expect(result.configured).toBe(true);
      if (!result.configured) throw new Error("expected a configured result");
      expect(result.forecast.baselineIsEstimated).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("(12) a bonus saved through the server action appears in the forecast", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T09:00:00Z"));
    try {
      vi.mocked(requireUserId).mockResolvedValue(userAId);
      const formData = new FormData();
      formData.set("amountRubles", "25000");
      formData.set("date", "2026-09-02");
      formData.set("note", "Трассер");
      expect(await saveBonusAction(formData)).toEqual({ success: true });
      const result = await forecastNextPayment(userAId);
      expect(result.configured).toBe(true);
      if (!result.configured) throw new Error("expected configured forecast");
      expect(result.forecast).toMatchObject({ kind: "bonus", grossKopecks: 25_000_00 });
    } finally { vi.useRealTimers(); }
  });

  it("(15) a user with no payment_schedule row and one future vacation gets a configured vacation forecast taxed through calculateNdfl", async () => {
    const frozenInstant = new Date("2026-09-01T09:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(frozenInstant);
    try {
      await replaceSalaryAt(userAId, 300_000_00, "2020-01-01");
      await createVacation(userAId, "2026-09-15", "2026-09-20");

      const result = await forecastNextPayment(userAId);
      expect(result.configured).toBe(true);
      if (!result.configured) throw new Error("expected a configured result");
      expect(result.forecast.kind).toBe("vacation");
      expect(result.forecast.breakdown).toBeUndefined();

      // Oracle: the same pure calculateVacationPayGross call, fed the exact
      // salary/bonus rows this test inserted (no bonuses here).
      const oracleGross = calculateVacationPayGross(
        "2026-09-15",
        "2026-09-20",
        [{ effectiveFrom: "2020-01-01", grossAmountKopecks: 300_000_00 }],
        [],
      ).grossKopecks;
      expect(result.forecast.grossKopecks).toBe(oracleGross);

      // No schedule, no prior bonus/vacation events strictly before the
      // resolved payment date: cumulativeBefore is exactly 0.
      const expectedTax = calculateNdfl(0, oracleGross, 2026);
      expect(result.forecast.taxKopecks).toBe(expectedTax.taxKopecks);
      expect(result.forecast.netKopecks).toBe(expectedTax.netKopecks);
    } finally {
      vi.useRealTimers();
    }
  });

  it("(15b) a user with a future vacation but no salary history at all gets the not-configured result naming salary, never a fabricated ₽0 forecast (closes 03-REVIEW.md CR-01)", async () => {
    const frozenInstant = new Date("2026-09-01T09:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(frozenInstant);
    try {
      // Deliberately no replaceSalaryAt call — mirrors test (15) except for
      // this omission, reproducing the "vacation before ever entering a
      // salary" sequence the review flagged.
      await createVacation(userAId, "2026-09-15", "2026-09-20");

      const result = await forecastNextPayment(userAId);
      expect(result.configured).toBe(false);
      if (result.configured) throw new Error("expected a not-configured result");
      expect(result.missing).toBe("salary");
    } finally {
      vi.useRealTimers();
    }
  });

  it("(16) a vacation whose computed payment date is earlier than both the next scheduled event and the next bonus date wins the next-payment slot", async () => {
    // September 2026 has no RU public holidays (verified against
    // date-holidays@3.36.0 directly), so this window is free of the
    // New Year holiday-chain edge case that would otherwise shift a
    // computed payment date backward past "today" and out of contention.
    const frozenInstant = new Date("2026-09-01T09:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(frozenInstant);
    try {
      await replaceSalaryAt(userAId, 100_000_00, "2020-01-01");
      await upsertSchedule(userAId, 25, 28);
      await createBonus(userAId, 50_000_00, "2026-09-20", "Бонус", "premium");

      const vacationStart = "2026-09-10";
      await createVacation(userAId, vacationStart, "2026-09-15");
      const vacationPaymentDate = resolveVacationPaymentDate(vacationStart);
      expect(vacationPaymentDate).toBe("2026-09-07");
      expect(vacationPaymentDate < "2026-09-20").toBe(true);

      const result = await forecastNextPayment(userAId);
      expect(result.configured).toBe(true);
      if (!result.configured) throw new Error("expected a configured result");
      expect(result.forecast.kind).toBe("vacation");
      expect(result.forecast.date).toBe(vacationPaymentDate);
    } finally {
      vi.useRealTimers();
    }
  });

  it("(17) an exact-date tie between a bonus and a vacation resolves to the bonus (tie-break order)", async () => {
    const frozenInstant = new Date("2026-01-01T09:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(frozenInstant);
    try {
      const vacationStart = "2026-01-20";
      const tieDateIso = resolveVacationPaymentDate(vacationStart);
      await createBonus(userAId, 50_000_00, tieDateIso, "Совпадение", "premium");
      await createVacation(userAId, vacationStart, "2026-01-25");

      const result = await forecastNextPayment(userAId);
      expect(result.configured).toBe(true);
      if (!result.configured) throw new Error("expected a configured result");
      expect(result.forecast.date).toBe(tieDateIso);
      expect(result.forecast.kind).toBe("bonus");
    } finally {
      vi.useRealTimers();
    }
  });

  it("(18) a vacation saved through the server action appears in the forecast (tracer's end-to-end proof)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-01T09:00:00Z"));
    try {
      vi.mocked(requireUserId).mockResolvedValue(userAId);
      await replaceSalaryAt(userAId, 300_000_00, "2020-01-01");

      const formData = new FormData();
      formData.set("startDate", "2026-09-15");
      formData.set("endDate", "2026-09-20");
      expect(await saveVacationAction(formData)).toEqual({ success: true });

      const result = await forecastNextPayment(userAId);
      expect(result.configured).toBe(true);
      if (!result.configured) throw new Error("expected configured forecast");
      expect(result.forecast.kind).toBe("vacation");
      expect(result.forecast.grossKopecks).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("selectNextPaymentEvent", () => {
  it("with scheduleEvent null, no bonuses, and one future vacation event, returns that vacation's candidate", () => {
    const vacationEvent = { dateIso: "2026-05-01", vacationId: "vac-1" };
    expect(selectNextPaymentEvent(null, [], [vacationEvent])).toEqual({
      dateIso: "2026-05-01",
      kind: "vacation",
      vacationId: "vac-1",
    });
  });

  it("with all three candidate sources present and differing dates, returns whichever dateIso sorts earliest", () => {
    const result = selectNextPaymentEvent(
      { dateIso: "2026-05-10", kind: "salary" },
      ["2026-05-05"],
      [{ dateIso: "2026-05-01", vacationId: "vac-1" }],
    );
    expect(result).toEqual({ dateIso: "2026-05-01", kind: "vacation", vacationId: "vac-1" });
  });

  it("on an exact three-way date tie, schedule wins over bonus and vacation", () => {
    const result = selectNextPaymentEvent(
      { dateIso: "2026-05-01", kind: "avans" },
      ["2026-05-01"],
      [{ dateIso: "2026-05-01", vacationId: "vac-1" }],
    );
    expect(result).toEqual({ dateIso: "2026-05-01", kind: "avans" });
  });

  it("on an exact tie between bonus and vacation (no schedule), bonus wins", () => {
    const result = selectNextPaymentEvent(
      null,
      ["2026-05-01"],
      [{ dateIso: "2026-05-01", vacationId: "vac-1" }],
    );
    expect(result).toEqual({ dateIso: "2026-05-01", kind: "bonus" });
  });

  it("with all three empty/null, returns null", () => {
    expect(selectNextPaymentEvent(null, [], [])).toBeNull();
  });
});
