import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/db/auth-schema";
import { createBonus, listBonuses } from "@/lib/db/bonus-repository";

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
});
