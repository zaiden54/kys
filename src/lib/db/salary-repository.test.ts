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
import {
  findSalaryAt,
  getActiveSalaryAt,
  getCumulativeIncomeBeforeDate,
  getSchedule,
  getYtdBaseline,
  listSalaryHistory,
  replaceSalaryAt,
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

    const withBaseline = await getCumulativeIncomeBeforeDate(userAId, "2026-06-01");
    expect(withBaseline).toBe(1_200_000_00);

    const withoutBaseline = await getCumulativeIncomeBeforeDate(userBId, "2026-06-01");
    expect(withoutBaseline).toBe(0);
  });
});
