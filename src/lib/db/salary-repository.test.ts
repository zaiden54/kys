/**
 * Integration suite for src/lib/db/salary-repository.ts, run against the
 * real database named by DATABASE_URL (per 01-04-PLAN.md's "Test-database
 * strategy" — no separate test DB / Neon branch infrastructure for Phase 1).
 *
 * Isolation: each test creates its own throwaway `user` row with a random
 * id in `beforeEach` and deletes it in `afterEach`. Cascade deletes (all
 * three app tables reference `user.id` with `onDelete: "cascade"`) clean up
 * every dependent salary_history / payment_schedule / ytd_baseline row, and
 * this cascade behavior is itself exercised implicitly by every test run.
 */

import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/db/auth-schema";
import { createBonus, updateBonus } from "@/lib/db/bonus-repository";
import {
  findSalaryAt,
  getActiveSalaryAt,
  getCumulativeIncomeBeforeDate,
  getSchedule,
  getYtdBaseline,
  insertSalaryIfAbsent,
  listSalaryHistory,
  replaceSalaryAt,
  replaceSalaryIfUnchanged,
  upsertSchedule,
  upsertYtdBaseline,
} from "@/lib/db/salary-repository";

async function createThrowawayUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(user).values({
    id,
    name: "Test User",
    email: `salary-repo-test-${id}@example.invalid`,
  });
  return id;
}

describe("salary-repository", () => {
  let userAId: string;
  let userBId: string;

  beforeEach(async () => {
    userAId = await createThrowawayUser();
    userBId = await createThrowawayUser();
  });

  afterEach(async () => {
    // Cascade delete removes dependent salary_history / payment_schedule /
    // ytd_baseline rows for both throwaway users.
    await db.delete(user).where(eq(user.id, userAId));
    await db.delete(user).where(eq(user.id, userBId));
  });

  it("D-14: a backdated write onto an existing exact effective date leaves exactly one row for that date, carrying the new amount", async () => {
    await replaceSalaryAt(userAId, 10_000_00, "2026-03-01");
    await replaceSalaryAt(userAId, 12_000_00, "2026-03-01");

    const history = await listSalaryHistory(userAId);
    const matching = history.filter((row) => row.effectiveFrom === "2026-03-01");

    expect(matching).toHaveLength(1);
    expect(matching[0]?.grossAmountKopecks).toBe(12_000_00);
  });

  it("D-13: a backdated write on a different date adds a row and leaves the earlier one intact", async () => {
    await replaceSalaryAt(userAId, 10_000_00, "2026-03-01");
    await replaceSalaryAt(userAId, 9_000_00, "2026-01-15");

    const history = await listSalaryHistory(userAId);
    expect(history).toHaveLength(2);

    const march = history.find((row) => row.effectiveFrom === "2026-03-01");
    const january = history.find((row) => row.effectiveFrom === "2026-01-15");
    expect(march?.grossAmountKopecks).toBe(10_000_00);
    expect(january?.grossAmountKopecks).toBe(9_000_00);
  });

  it("CR-02: two concurrent replaceSalaryAt calls for the same (userId, effectiveFrom) both resolve, leaving exactly one row", async () => {
    // Cross-user isolation seed: userB already has a row for the same date;
    // the race below must never disturb it (the conflict arbiter must never
    // reach across users).
    await replaceSalaryAt(userBId, 99_000_00, "2026-04-01");

    await Promise.all([
      replaceSalaryAt(userAId, 10_000_00, "2026-04-01"),
      replaceSalaryAt(userAId, 12_000_00, "2026-04-01"),
    ]);

    const historyA = await listSalaryHistory(userAId);
    const matchingA = historyA.filter((row) => row.effectiveFrom === "2026-04-01");
    expect(matchingA).toHaveLength(1);
    expect([10_000_00, 12_000_00]).toContain(matchingA[0]?.grossAmountKopecks);

    const historyB = await listSalaryHistory(userBId);
    const matchingB = historyB.filter((row) => row.effectiveFrom === "2026-04-01");
    expect(matchingB).toHaveLength(1);
    expect(matchingB[0]?.grossAmountKopecks).toBe(99_000_00);
  });

  it("conditionally replaces only while the expected amount is current", async () => {
    await replaceSalaryAt(userAId, 10_000_00, "2026-04-01");
    const written = await replaceSalaryIfUnchanged(
      userAId,
      12_000_00,
      "2026-04-01",
      (await findSalaryAt(userAId, "2026-04-01"))!.id,
      10_000_00,
    );
    expect(written.status).toBe("written");

    const stale = await replaceSalaryIfUnchanged(
      userAId,
      14_000_00,
      "2026-04-01",
      (await findSalaryAt(userAId, "2026-04-01"))!.id,
      10_000_00,
    );
    expect(stale.status).toBe("conflict");
    if (stale.status === "conflict") {
      expect(stale.current?.grossAmountKopecks).toBe(12_000_00);
    }
    expect((await findSalaryAt(userAId, "2026-04-01"))?.grossAmountKopecks).toBe(12_000_00);
  });

  it("a stale cross-request expectation cannot overwrite a newer write", async () => {
    const observed = await replaceSalaryAt(userAId, 10_000_00, "2026-04-01");
    await replaceSalaryAt(userAId, 11_000_00, "2026-04-01");
    const stale = await replaceSalaryIfUnchanged(
      userAId,
      12_000_00,
      "2026-04-01",
      observed.id,
      observed.grossAmountKopecks,
    );
    expect(stale.status).toBe("conflict");
    expect((await findSalaryAt(userAId, "2026-04-01"))?.grossAmountKopecks).toBe(11_000_00);
  });

  it("conditional insert reports the raced row and preserves one exact-date row", async () => {
    const first = await insertSalaryIfAbsent(userAId, 10_000_00, "2026-04-01");
    expect(first.status).toBe("written");
    const second = await insertSalaryIfAbsent(userAId, 12_000_00, "2026-04-01");
    expect(second.status).toBe("conflict");
    if (second.status === "conflict") {
      expect(second.current?.grossAmountKopecks).toBe(10_000_00);
    }
    expect((await listSalaryHistory(userAId)).filter((row) => row.effectiveFrom === "2026-04-01"))
      .toHaveLength(1);
  });

  it("two concurrent conditional inserts leave one winner and one disclosed conflict", async () => {
    const outcomes = await Promise.all([
      insertSalaryIfAbsent(userAId, 10_000_00, "2026-04-01"),
      insertSalaryIfAbsent(userAId, 12_000_00, "2026-04-01"),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "written")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "conflict")).toHaveLength(1);
    expect((await listSalaryHistory(userAId)).filter((row) => row.effectiveFrom === "2026-04-01"))
      .toHaveLength(1);
  });

  it("getActiveSalaryAt returns the row effective on the queried date, not the newest row overall", async () => {
    await replaceSalaryAt(userAId, 10_000_00, "2026-01-01");
    await replaceSalaryAt(userAId, 15_000_00, "2026-06-01");

    const activeInMarch = await getActiveSalaryAt(userAId, "2026-03-15");
    expect(activeInMarch?.grossAmountKopecks).toBe(10_000_00);

    const activeInJuly = await getActiveSalaryAt(userAId, "2026-07-01");
    expect(activeInJuly?.grossAmountKopecks).toBe(15_000_00);

    const activeBeforeAnyRow = await getActiveSalaryAt(userAId, "2025-12-31");
    expect(activeBeforeAnyRow).toBeNull();
  });

  it("findSalaryAt returns the exact-date row used to disclose a pending overwrite, or null", async () => {
    await replaceSalaryAt(userAId, 10_000_00, "2026-03-01");

    const exact = await findSalaryAt(userAId, "2026-03-01");
    expect(exact?.grossAmountKopecks).toBe(10_000_00);

    const noMatch = await findSalaryAt(userAId, "2026-03-02");
    expect(noMatch).toBeNull();
  });

  it("a second throwaway user's rows are invisible to the first user's reads (ownership isolation)", async () => {
    await replaceSalaryAt(userAId, 10_000_00, "2026-03-01");
    await replaceSalaryAt(userBId, 99_000_00, "2026-03-01");
    await upsertSchedule(userBId, 20, 5);
    await upsertYtdBaseline(userBId, 500_000_00, "2026-01-01", false);

    const userAHistory = await listSalaryHistory(userAId);
    expect(userAHistory).toHaveLength(1);
    expect(userAHistory.every((row) => row.userId === userAId)).toBe(true);

    const userASchedule = await getSchedule(userAId);
    expect(userASchedule).toBeNull();

    const userABaseline = await getYtdBaseline(userAId);
    expect(userABaseline.amountKopecks).toBe(0);
    expect(userABaseline.isEstimated).toBe(true);
  });

  it("WR-01: two concurrent upsertSchedule calls for the same user both resolve, leaving one internally-consistent pair", async () => {
    await Promise.all([upsertSchedule(userAId, 10, 25), upsertSchedule(userAId, 20, 5)]);

    const schedule = await getSchedule(userAId);
    expect(schedule).not.toBeNull();
    const pair = [schedule?.avansDay, schedule?.salaryDay];
    const isFirstPair = pair[0] === 10 && pair[1] === 25;
    const isSecondPair = pair[0] === 20 && pair[1] === 5;
    expect(isFirstPair || isSecondPair).toBe(true);
  });

  it("WR-01: two concurrent upsertYtdBaseline calls for the same user both resolve, leaving one consistent value", async () => {
    await Promise.all([
      upsertYtdBaseline(userAId, 100_000_00, "2026-01-01", false),
      upsertYtdBaseline(userAId, 200_000_00, "2026-01-01", false),
    ]);

    const baseline = await getYtdBaseline(userAId);
    expect(baseline.isEstimated).toBe(false);
    expect([100_000_00, 200_000_00]).toContain(baseline.amountKopecks);
  });

  it("upsertSchedule sequential update preservation: a second call updates the row and refreshes updatedAt", async () => {
    await upsertSchedule(userAId, 10, 25);
    const updated = await upsertSchedule(userAId, 20, 5);

    const schedule = await getSchedule(userAId);
    expect(schedule?.avansDay).toBe(20);
    expect(schedule?.salaryDay).toBe(5);
    expect(updated.updatedAt).not.toBeNull();
  });

  it("getYtdBaseline returns a zero, estimated baseline for a user who never saved one", async () => {
    const baseline = await getYtdBaseline(userAId);
    expect(baseline.amountKopecks).toBe(0);
    expect(baseline.isEstimated).toBe(true);
  });

  it("getCumulativeIncomeBeforeDate equals the stored baseline amount for a user with a baseline, and zero for one without", async () => {
    await upsertYtdBaseline(userAId, 1_200_000_00, "2026-01-01", false);

    const withBaseline = await getCumulativeIncomeBeforeDate(userAId, "2026-06-01", "avans");
    expect(withBaseline).toBe(1_200_000_00);

    const withoutBaseline = await getCumulativeIncomeBeforeDate(userBId, "2026-06-01", "avans");
    expect(withoutBaseline).toBe(0);
  });

  // Task 3 (01-10): getCumulativeIncomeBeforeDate composed with the real
  // accrual engine, database-backed. Schedule avansDay=15/salaryDay=28
  // resolves cleanly within its own nominal month throughout 2026 and early
  // 2027 (no weekend/holiday boundary shifting), confirmed via a throwaway
  // Node check against date-holidays@3.36.0 (see 01-10-SUMMARY.md).

  it("a mid-year confirmed baseline plus accrued events exceeds the baseline for a later date, and equals it exactly at the baseline's own as-of date", async () => {
    await replaceSalaryAt(userAId, 600_000_00, "2025-01-01");
    await upsertSchedule(userAId, 15, 28);
    await upsertYtdBaseline(userAId, 1_000_000_00, "2026-06-30", false);

    const atBaselineDate = await getCumulativeIncomeBeforeDate(userAId, "2026-06-30", "avans");
    expect(atBaselineDate).toBe(1_000_000_00);

    const later = await getCumulativeIncomeBeforeDate(userAId, "2026-09-04", "salary");
    expect(later).toBeGreaterThan(1_000_000_00);
  });

  it("a target date in the following calendar year excludes the baseline entirely and accrues only that year's events", async () => {
    await replaceSalaryAt(userAId, 600_000_00, "2025-01-01");
    await upsertSchedule(userAId, 15, 28);
    await upsertYtdBaseline(userAId, 1_000_000_00, "2026-06-30", false);

    // 2026's baseline no longer applies once the target is in 2027: the
    // window opens at 2026-12-31 instead, and only 2027's own January
    // avans+salary events (one full month) accrue before 2027-02-13.
    const nextYear = await getCumulativeIncomeBeforeDate(userAId, "2027-02-13", "avans");
    expect(nextYear).toBe(600_000_00);
  });

  it("a baseline with no payment schedule still returns exactly the baseline amount (deliberate regression coverage)", async () => {
    await upsertYtdBaseline(userAId, 750_000_00, "2026-03-01", false);

    const result = await getCumulativeIncomeBeforeDate(userAId, "2026-09-01", "salary");
    expect(result).toBe(750_000_00);
  });

  it("includes bonuses strictly before the target but excludes same-date bonuses", async () => {
    await createBonus(userAId, 10_000_00, "2026-08-31", "До выплаты");
    await createBonus(userAId, 99_000_00, "2026-09-01", "В день выплаты");
    expect(await getCumulativeIncomeBeforeDate(userAId, "2026-09-01", "salary"))
      .toBe(10_000_00);
  });

  it("excludes bonuses on or before the applicable baseline boundary", async () => {
    await upsertYtdBaseline(userAId, 750_000_00, "2026-06-30", false);
    await createBonus(userAId, 10_000_00, "2026-06-29", "Уже в базе");
    await createBonus(userAId, 20_000_00, "2026-06-30", "Граница базы");
    await createBonus(userAId, 30_000_00, "2026-07-01", "После базы");
    expect(await getCumulativeIncomeBeforeDate(userAId, "2026-09-01", "salary"))
      .toBe(780_000_00);
  });

  it("adds bonuses to the baseline even when no payment schedule exists", async () => {
    await upsertYtdBaseline(userAId, 750_000_00, "2026-03-01", false);
    await createBonus(userAId, 25_000_00, "2026-04-01", "Без графика");
    expect(await getCumulativeIncomeBeforeDate(userAId, "2026-09-01", "salary"))
      .toBe(775_000_00);
  });

  it("recomputes later cumulative income by the exact edited bonus delta", async () => {
    const bonus = await createBonus(userAId, 25_000_00, "2026-04-01", "До правки");
    const before = await getCumulativeIncomeBeforeDate(userAId, "2026-09-01", "salary");
    await updateBonus(userAId, bonus.id, 40_000_00, bonus.date, "После правки");
    const after = await getCumulativeIncomeBeforeDate(userAId, "2026-09-01", "salary");
    expect(after - before).toBe(15_000_00);
  });

  it("a second user's schedule, salary rows and baseline never change the first user's cumulative figure", async () => {
    await replaceSalaryAt(userAId, 600_000_00, "2025-01-01");
    await upsertSchedule(userAId, 15, 28);
    await upsertYtdBaseline(userAId, 1_000_000_00, "2026-06-30", false);

    const before = await getCumulativeIncomeBeforeDate(userAId, "2026-09-04", "salary");

    await replaceSalaryAt(userBId, 5_000_000_00, "2025-01-01");
    await upsertSchedule(userBId, 1, 16);
    await upsertYtdBaseline(userBId, 9_000_000_00, "2026-01-01", false);

    const after = await getCumulativeIncomeBeforeDate(userAId, "2026-09-04", "salary");
    expect(after).toBe(before);
  });
});
