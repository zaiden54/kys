import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/db/auth-schema";
import { createBonus, deleteBonusIfFuture, listBonuses, updateBonus } from "@/lib/db/bonus-repository";
import { todayIsoInMoscow } from "@/domain/time";

async function createThrowawayUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(user).values({
    id,
    name: "Bonus Test User",
    email: `bonus-repo-test-${id}@example.invalid`,
  });
  return id;
}

describe("bonus-repository", () => {
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

  it("stores same-date bonuses as distinct rows and preserves their sum", async () => {
    const first = await createBonus(userAId, 10_000_00, "2026-09-15", "Первый");
    const second = await createBonus(userAId, 5_000_00, "2026-09-15", "Второй");
    const rows = await listBonuses(userAId);
    expect(first.id).not.toBe(second.id);
    expect(rows).toHaveLength(2);
    expect(rows.reduce((sum, row) => sum + row.amountKopecks, 0)).toBe(15_000_00);
  });

  it("returns newest dates first and never exposes another user's rows", async () => {
    await createBonus(userAId, 1_000_00, "2026-01-01", "Старый");
    await createBonus(userAId, 2_000_00, "2026-12-01", "Новый");
    await createBonus(userBId, 99_000_00, "2026-12-31", "Чужой");
    const rows = await listBonuses(userAId);
    expect(rows.map((row) => row.date)).toEqual(["2026-12-01", "2026-01-01"]);
    expect(rows.every((row) => row.userId === userAId)).toBe(true);
  });

  it("updates amount, date and note only for the owning user", async () => {
    const row = await createBonus(userAId, 1_000_00, "2026-01-01", "До");
    const updated = await updateBonus(userAId, row.id, 2_000_00, "2026-02-01", "После");
    expect(updated).toMatchObject({ amountKopecks: 2_000_00, date: "2026-02-01", note: "После" });
    expect(await updateBonus(userBId, row.id, 9_000_00, "2026-03-01", "Чужой")).toBeNull();
    expect((await listBonuses(userAId))[0]).toMatchObject({ amountKopecks: 2_000_00, note: "После" });
  });

  it("deletes only future bonuses and distinguishes blocked from not-found", async () => {
    const today = todayIsoInMoscow();
    const tomorrowDate = new Date(`${today}T00:00:00.000Z`);
    tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
    const tomorrow = tomorrowDate.toISOString().slice(0, 10);
    const future = await createBonus(userAId, 1_000_00, tomorrow, "Будущий");
    expect(await deleteBonusIfFuture(userBId, future.id)).toEqual({ status: "not-found" });
    expect(await deleteBonusIfFuture(userAId, future.id)).toEqual({ status: "deleted" });
    expect(await deleteBonusIfFuture(userAId, future.id)).toEqual({ status: "not-found" });

    const current = await createBonus(userAId, 1_000_00, today, "Сегодня");
    expect(await deleteBonusIfFuture(userAId, current.id)).toEqual({ status: "blocked" });
    expect((await listBonuses(userAId)).some((row) => row.id === current.id)).toBe(true);
  });
});
