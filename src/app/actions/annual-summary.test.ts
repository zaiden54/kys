/**
 * Integration suite for src/app/actions/annual-summary.ts, run against the
 * real database named by DATABASE_URL (same strategy as
 * src/app/actions/forecast.test.ts — no separate test DB / Neon branch
 * infrastructure for this project).
 *
 * Isolation: each test gets two throwaway `user` rows with random ids,
 * created in `beforeEach` and deleted (cascade) in `afterEach`.
 *
 * No frozen clock anywhere in this file: computeAnnualSummary takes
 * `taxYear` as an explicit parameter and never calls
 * nowInMoscow()/todayIsoInMoscow(), unlike forecastNextPayment.
 */

import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { addDays, format } from "date-fns";
import { db } from "@/lib/db";
import { user } from "@/lib/db/auth-schema";
import {
  getCumulativeIncomeBeforeDate,
  replaceSalaryAt,
  upsertSchedule,
  upsertYtdBaseline,
} from "@/lib/db/salary-repository";
import { generatePaymentEvents, type PaymentKind } from "@/domain/schedule/resolve-payment-date";
import { halfSplitGross } from "@/domain/pay/payment-accrual";
import {
  calculateVacationPayGross,
  resolveVacationPaymentDate,
} from "@/domain/vacation/calculate-average-daily-earnings";
import { calculateNdfl } from "@/domain/tax/calculate-ndfl";
import { createBonus } from "@/lib/db/bonus-repository";
import { createVacation } from "@/lib/db/vacation-repository";
import { computeAnnualSummary } from "@/app/actions/annual-summary";

async function createThrowawayUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(user).values({
    id,
    name: "Test User",
    email: `annual-summary-test-${id}@example.invalid`,
  });
  return id;
}

const TAX_YEAR = 2026;

describe("computeAnnualSummary", () => {
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

  it("(1) a user with a schedule but no salary gets the not-configured result naming salary", async () => {
    await upsertSchedule(userAId, 10, 25);

    const result = await computeAnnualSummary(userAId, TAX_YEAR);
    expect(result.configured).toBe(false);
    if (result.configured) throw new Error("expected a not-configured result");
    expect(result.missing).toBe("salary");
  });

  it("(2) a user with a salary but no schedule gets the not-configured result naming schedule", async () => {
    await replaceSalaryAt(userAId, 100_000_00, `${TAX_YEAR}-01-01`);

    const result = await computeAnnualSummary(userAId, TAX_YEAR);
    expect(result.configured).toBe(false);
    if (result.configured) throw new Error("expected a not-configured result");
    expect(result.missing).toBe("schedule");
  });

  it("(3) reconciles exactly with an independent per-event getCumulativeIncomeBeforeDate + calculateNdfl oracle, mixing a salary+schedule pair, a same-date-as-schedule bonus, a different-date bonus, and a vacation", async () => {
    // Every figure below is deliberately kept well under the first НДФЛ
    // bracket's 2,400,000 rub ceiling (ndfl-brackets.ts) — within a single
    // bracket, taxOnCumulative is linear in the marginal amount, so the
    // per-event oracle's sum is exact regardless of which same-date event
    // (the schedule occurrence or the same-date bonus) the real
    // computeAnnualSummary walk happens to process first.
    const monthlyGrossKopecks = 50_000_00;
    await replaceSalaryAt(userAId, monthlyGrossKopecks, `${TAX_YEAR}-01-01`);
    await upsertSchedule(userAId, 10, 25);
    await upsertYtdBaseline(userAId, 100_000_00, `${TAX_YEAR}-01-01`, false);

    const scheduleEventsInYear = generatePaymentEvents(
      { avansDay: 10, salaryDay: 25 },
      new Date(TAX_YEAR - 1, 11, 1),
      14,
    ).filter((event) => format(event.date, "yyyy-MM-dd").slice(0, 4) === String(TAX_YEAR));
    expect(scheduleEventsInYear.length).toBeGreaterThan(0);

    const sameDateEvent = scheduleEventsInYear[Math.floor(scheduleEventsInYear.length / 2)];
    const sameDateIso = format(sameDateEvent.date, "yyyy-MM-dd");
    await createBonus(userAId, 20_000_00, sameDateIso, "Совпадение", "premium");

    const differentDateIso = format(addDays(sameDateEvent.date, 3), "yyyy-MM-dd");
    await createBonus(userAId, 15_000_00, differentDateIso, "Отдельно", "premium");

    const vacationStart = `${TAX_YEAR}-11-10`;
    const vacationEnd = `${TAX_YEAR}-11-14`;
    await createVacation(userAId, vacationStart, vacationEnd);

    const result = await computeAnnualSummary(userAId, TAX_YEAR);
    expect(result.configured).toBe(true);
    if (!result.configured) throw new Error("expected a configured result");

    // Independent oracle: enumerate every event this test itself created,
    // deriving each one's own (dateIso, oracle-kind, grossKopecks) from the
    // same pure domain primitives forecast.ts already uses (never by calling
    // computeAnnualSummary itself), then sum each event's own
    // getCumulativeIncomeBeforeDate + calculateNdfl delta — kind="avans" for
    // the bonus/vacation events (matching forecastNextPayment's own existing
    // convention), kind=event.kind for the schedule events.
    const salaryHistoryForOracle = [
      { effectiveFrom: `${TAX_YEAR}-01-01`, grossAmountKopecks: monthlyGrossKopecks },
    ];
    const premiumBonusEntriesForOracle = [
      { date: sameDateIso, amountKopecks: 20_000_00 },
      { date: differentDateIso, amountKopecks: 15_000_00 },
    ];
    const vacationPaymentDateIso = resolveVacationPaymentDate(vacationStart);
    const vacationGrossKopecks = calculateVacationPayGross(
      vacationStart,
      vacationEnd,
      salaryHistoryForOracle,
      premiumBonusEntriesForOracle,
    ).grossKopecks;

    const oracleEvents: { dateIso: string; kind: PaymentKind; grossKopecks: number }[] = [
      ...scheduleEventsInYear.map((event) => ({
        dateIso: format(event.date, "yyyy-MM-dd"),
        kind: event.kind,
        grossKopecks: halfSplitGross(monthlyGrossKopecks, event.kind),
      })),
      { dateIso: sameDateIso, kind: "avans" as PaymentKind, grossKopecks: 20_000_00 },
      { dateIso: differentDateIso, kind: "avans" as PaymentKind, grossKopecks: 15_000_00 },
      { dateIso: vacationPaymentDateIso, kind: "avans" as PaymentKind, grossKopecks: vacationGrossKopecks },
    ];

    // Fetched in parallel (each getCumulativeIncomeBeforeDate call is an
    // independent read-only query against the real database) so this test
    // stays comfortably inside the default per-test timeout.
    const cumulativeBefores = await Promise.all(
      oracleEvents.map((event) => getCumulativeIncomeBeforeDate(userAId, event.dateIso, event.kind)),
    );
    let oracleGrossKopecks = 100_000_00; // baseline, dateless, counted exactly once
    let oracleTaxKopecks = 0;
    oracleEvents.forEach((event, index) => {
      const { taxKopecks } = calculateNdfl(cumulativeBefores[index], event.grossKopecks, TAX_YEAR);
      oracleGrossKopecks += event.grossKopecks;
      oracleTaxKopecks += taxKopecks;
    });

    expect(result.summary.grossKopecks).toBe(oracleGrossKopecks);
    expect(result.summary.taxKopecks).toBe(oracleTaxKopecks);
    expect(result.summary.netKopecks).toBe(oracleGrossKopecks - oracleTaxKopecks);
    expect(result.summary.baselineIsEstimated).toBe(false);
  });

  it("(4) an applicable confirmed baseline crossing into a higher bracket is added into grossKopecks exactly once, as a dateless opening amount, never itself taxed as an event", async () => {
    // Only schedule events here (no bonus/vacation), each on a distinct
    // day-of-month (10 and 25 never collide), so there are NO same-date
    // ties at all — the per-event oracle below is therefore exact
    // regardless of the deliberate bracket crossing this scenario induces
    // (baseline 2,300,000 rub + ~1,200,000 rub/year of schedule accrual
    // crosses the 2,400,000 rub bracket-1 ceiling partway through the year).
    const monthlyGrossKopecks = 100_000_00;
    await replaceSalaryAt(userAId, monthlyGrossKopecks, `${TAX_YEAR}-01-01`);
    await upsertSchedule(userAId, 10, 25);
    await upsertYtdBaseline(userAId, 2_300_000_00, `${TAX_YEAR}-01-01`, false);

    const result = await computeAnnualSummary(userAId, TAX_YEAR);
    expect(result.configured).toBe(true);
    if (!result.configured) throw new Error("expected a configured result");
    expect(result.summary.baselineIsEstimated).toBe(false);

    const scheduleEventsInYear = generatePaymentEvents(
      { avansDay: 10, salaryDay: 25 },
      new Date(TAX_YEAR - 1, 11, 1),
      14,
    ).filter((event) => format(event.date, "yyyy-MM-dd").slice(0, 4) === String(TAX_YEAR));
    expect(scheduleEventsInYear.length).toBeGreaterThan(0);

    const eventDetails = scheduleEventsInYear.map((event) => ({
      dateIso: format(event.date, "yyyy-MM-dd"),
      kind: event.kind,
      grossKopecks: halfSplitGross(monthlyGrossKopecks, event.kind),
    }));
    const cumulativeBefores = await Promise.all(
      eventDetails.map((event) => getCumulativeIncomeBeforeDate(userAId, event.dateIso, event.kind)),
    );
    let oracleGrossKopecks = 2_300_000_00; // baseline, counted exactly once
    let oracleTaxKopecks = 0;
    eventDetails.forEach((event, index) => {
      const { taxKopecks } = calculateNdfl(cumulativeBefores[index], event.grossKopecks, TAX_YEAR);
      oracleGrossKopecks += event.grossKopecks;
      oracleTaxKopecks += taxKopecks;
    });

    // Sanity: this scenario genuinely crosses the first bracket's ceiling —
    // otherwise this test would not actually exercise the "baseline seeds a
    // higher starting bracket" property it targets.
    expect(oracleGrossKopecks).toBeGreaterThan(2_400_000_00);

    expect(result.summary.grossKopecks).toBe(oracleGrossKopecks);
    expect(result.summary.taxKopecks).toBe(oracleTaxKopecks);
    expect(result.summary.netKopecks).toBe(oracleGrossKopecks - oracleTaxKopecks);
  });

  it("(5) baselineIsEstimated is true when the baseline's own year doesn't match taxYear or the baseline is unconfirmed, and false only for an applicable confirmed baseline", async () => {
    await replaceSalaryAt(userAId, 100_000_00, `${TAX_YEAR}-01-01`);
    await upsertSchedule(userAId, 10, 25);

    // Confirmed, but dated in a prior calendar year -> does not apply.
    await upsertYtdBaseline(userAId, 500_000_00, `${TAX_YEAR - 1}-06-30`, false);
    const wrongYearResult = await computeAnnualSummary(userAId, TAX_YEAR);
    expect(wrongYearResult.configured).toBe(true);
    if (!wrongYearResult.configured) throw new Error("expected a configured result");
    expect(wrongYearResult.summary.baselineIsEstimated).toBe(true);

    // Applicable (same year, on/before Dec 31) but not confirmed.
    await upsertYtdBaseline(userAId, 500_000_00, `${TAX_YEAR}-01-01`, true);
    const estimatedResult = await computeAnnualSummary(userAId, TAX_YEAR);
    expect(estimatedResult.configured).toBe(true);
    if (!estimatedResult.configured) throw new Error("expected a configured result");
    expect(estimatedResult.summary.baselineIsEstimated).toBe(true);

    // Applicable and confirmed.
    await upsertYtdBaseline(userAId, 500_000_00, `${TAX_YEAR}-01-01`, false);
    const confirmedResult = await computeAnnualSummary(userAId, TAX_YEAR);
    expect(confirmedResult.configured).toBe(true);
    if (!confirmedResult.configured) throw new Error("expected a configured result");
    expect(confirmedResult.summary.baselineIsEstimated).toBe(false);
  });

  it("(6) two throwaway users with disjoint salary/bonus/vacation data never see each other's rows reflected in their own summary totals", async () => {
    await replaceSalaryAt(userAId, 100_000_00, `${TAX_YEAR}-01-01`);
    await upsertSchedule(userAId, 10, 25);
    await upsertYtdBaseline(userAId, 0, `${TAX_YEAR}-01-01`, false);

    const beforeResult = await computeAnnualSummary(userAId, TAX_YEAR);
    expect(beforeResult.configured).toBe(true);
    if (!beforeResult.configured) throw new Error("expected a configured result");

    // userB gets substantial, entirely separate data: a large salary,
    // schedule, bonus, and vacation.
    await replaceSalaryAt(userBId, 900_000_00, `${TAX_YEAR}-01-01`);
    await upsertSchedule(userBId, 5, 20);
    await upsertYtdBaseline(userBId, 1_500_000_00, `${TAX_YEAR}-01-01`, false);
    await createBonus(userBId, 300_000_00, `${TAX_YEAR}-06-15`, "Чужой бонус", "premium");
    await createVacation(userBId, `${TAX_YEAR}-07-10`, `${TAX_YEAR}-07-15`);

    const afterResult = await computeAnnualSummary(userAId, TAX_YEAR);
    expect(afterResult.configured).toBe(true);
    if (!afterResult.configured) throw new Error("expected a configured result");

    // userA's totals are unaffected by userB's data existing.
    expect(afterResult.summary.grossKopecks).toBe(beforeResult.summary.grossKopecks);
    expect(afterResult.summary.taxKopecks).toBe(beforeResult.summary.taxKopecks);
    expect(afterResult.summary.netKopecks).toBe(beforeResult.summary.netKopecks);

    // userB's summary reflects its own data, strictly more gross than userA's.
    const userBResult = await computeAnnualSummary(userBId, TAX_YEAR);
    expect(userBResult.configured).toBe(true);
    if (!userBResult.configured) throw new Error("expected a configured result");
    expect(userBResult.summary.grossKopecks).toBeGreaterThan(afterResult.summary.grossKopecks);
  });

  it("(7) a YTD baseline dated exactly Dec 31 of taxYear excludes every dated event from the year's walk, so grossKopecks equals exactly the baseline and taxKopecks is exactly 0", async () => {
    // windowBoundIso becomes the baseline's own asOfDate (Dec 31): no event
    // date within taxYear can be strictly greater than Dec 31 of that same
    // year, so every avans/salary occurrence (schedule is configured, so
    // events do exist) is filtered out by the ">" comparison.
    await replaceSalaryAt(userAId, 100_000_00, `${TAX_YEAR}-01-01`);
    await upsertSchedule(userAId, 10, 25);
    await upsertYtdBaseline(userAId, 500_000_00, `${TAX_YEAR}-12-31`, false);

    const result = await computeAnnualSummary(userAId, TAX_YEAR);
    expect(result.configured).toBe(true);
    if (!result.configured) throw new Error("expected a configured result");
    expect(result.summary.grossKopecks).toBe(500_000_00);
    expect(result.summary.taxKopecks).toBe(0);
    expect(result.summary.netKopecks).toBe(500_000_00);
    expect(result.summary.baselineIsEstimated).toBe(false);
  });

  it("(8) userA's bonus/vacation amounts never appear in userB's own summary total, even when both users share the same configured salary/schedule shape", async () => {
    for (const id of [userAId, userBId]) {
      await replaceSalaryAt(id, 200_000_00, `${TAX_YEAR}-01-01`);
      await upsertSchedule(id, 10, 25);
      await upsertYtdBaseline(id, 0, `${TAX_YEAR}-01-01`, false);
    }

    const userBBaseline = await computeAnnualSummary(userBId, TAX_YEAR);
    expect(userBBaseline.configured).toBe(true);
    if (!userBBaseline.configured) throw new Error("expected a configured result");

    // Only userA gets a large, distinctive bonus and vacation.
    await createBonus(userAId, 400_000_00, `${TAX_YEAR}-05-10`, "Только у А", "premium");
    await createVacation(userAId, `${TAX_YEAR}-08-01`, `${TAX_YEAR}-08-05`);

    const userBAfter = await computeAnnualSummary(userBId, TAX_YEAR);
    expect(userBAfter.configured).toBe(true);
    if (!userBAfter.configured) throw new Error("expected a configured result");

    // userB's totals are byte-identical before and after userA's data was
    // inserted — userA's bonus/vacation never leaked into userB's own walk.
    expect(userBAfter.summary.grossKopecks).toBe(userBBaseline.summary.grossKopecks);
    expect(userBAfter.summary.taxKopecks).toBe(userBBaseline.summary.taxKopecks);
    expect(userBAfter.summary.netKopecks).toBe(userBBaseline.summary.netKopecks);
  });
});
