import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/db/auth-schema";
import {
  checkOverlapVacations,
  createVacation,
  deleteVacationIfFuture,
  listVacations,
  updateVacation,
} from "@/lib/db/vacation-repository";
import { resolveVacationPaymentDate } from "@/domain/vacation/calculate-average-daily-earnings";
import { todayIsoInMoscow } from "@/domain/time";

async function createThrowawayUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(user).values({
    id,
    name: "Vacation Test User",
    email: `vacation-repo-test-${id}@example.invalid`,
  });
  return id;
}

/** Shifts an ISO date by a number of calendar days (UTC-anchored, matches the bonus test pattern). */
function shiftIsoDate(iso: string, days: number): string {
  const shifted = new Date(`${iso}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

describe("vacation-repository", () => {
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

  it("creates and lists vacations, ordered by startDate descending, and never exposes another user's rows", async () => {
    await createVacation(userAId, "2026-01-01", "2026-01-10");
    await createVacation(userAId, "2026-06-01", "2026-06-10");
    await createVacation(userBId, "2026-12-01", "2026-12-10");

    const rows = await listVacations(userAId);
    expect(rows.map((row) => row.startDate)).toEqual(["2026-06-01", "2026-01-01"]);
    expect(rows.every((row) => row.userId === userAId)).toBe(true);
  });

  it("updates a vacation for the owner and returns null for a different user's id", async () => {
    const row = await createVacation(userAId, "2026-01-01", "2026-01-10");
    const updated = await updateVacation(userAId, row.id, "2026-02-01", "2026-02-15");
    expect(updated).toMatchObject({ startDate: "2026-02-01", endDate: "2026-02-15" });

    expect(await updateVacation(userBId, row.id, "2026-03-01", "2026-03-10")).toBeNull();
    expect((await listVacations(userAId))[0]).toMatchObject({ startDate: "2026-02-01", endDate: "2026-02-15" });
  });

  it("checkOverlapVacations detects identical, boundary-touching, and containing ranges, and excludes adjacent or self-excluded ranges", async () => {
    const existing = await createVacation(userAId, "2026-08-01", "2026-08-10");

    expect(await checkOverlapVacations(userAId, "2026-08-01", "2026-08-10")).toBe(true);
    expect(await checkOverlapVacations(userAId, "2026-08-10", "2026-08-20")).toBe(true);
    expect(await checkOverlapVacations(userAId, "2026-07-01", "2026-09-01")).toBe(true);
    expect(await checkOverlapVacations(userAId, "2026-08-11", "2026-08-20")).toBe(false);
    expect(await checkOverlapVacations(userAId, "2026-08-01", "2026-08-10", existing.id)).toBe(false);
    // Different user's identical range never overlaps.
    expect(await checkOverlapVacations(userBId, "2026-08-01", "2026-08-10")).toBe(false);
  });

  it("deleteVacationIfFuture returns deleted for a future payment date, blocked for today-or-earlier, and not-found for a missing or cross-user id", async () => {
    // A vacation starting far enough in the future that resolveVacationPaymentDate is also future.
    const futureStart = shiftIsoDate(todayIsoInMoscow(), 30);
    const futureEnd = shiftIsoDate(futureStart, 5);
    const futureVacation = await createVacation(userAId, futureStart, futureEnd);

    expect(await deleteVacationIfFuture(userBId, futureVacation.id)).toEqual({ status: "not-found" });
    expect(await deleteVacationIfFuture(userAId, futureVacation.id)).toEqual({ status: "deleted" });
    expect(await deleteVacationIfFuture(userAId, futureVacation.id)).toEqual({ status: "not-found" });

    // A vacation whose start date is today: its computed payment date
    // (start minus 3 days, holiday-shifted) is necessarily on or before
    // today, so the delete must be blocked.
    const today = todayIsoInMoscow();
    const currentVacation = await createVacation(userAId, today, shiftIsoDate(today, 3));
    const paymentDate = resolveVacationPaymentDate(currentVacation.startDate);
    expect(paymentDate <= today).toBe(true);
    expect(await deleteVacationIfFuture(userAId, currentVacation.id)).toEqual({ status: "blocked" });
    expect((await listVacations(userAId)).some((row) => row.id === currentVacation.id)).toBe(true);
  });
});
