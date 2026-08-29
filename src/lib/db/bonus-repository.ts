if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/db/bonus-repository.ts is server-only and must never be imported into a client component.",
  );
}

/** Ownership-scoped bonus persistence. This module deliberately logs no money data. */
import { and, desc, eq, gt } from "drizzle-orm";
import { todayIsoInMoscow } from "@/domain/time";
import { db } from "@/lib/db";
import { bonuses } from "@/lib/db/schema";

export type BonusRow = typeof bonuses.$inferSelect;

export async function createBonus(
  userId: string,
  amountKopecks: number,
  date: string,
  note: string,
): Promise<BonusRow> {
  const inserted = await db.insert(bonuses).values({ userId, amountKopecks, date, note }).returning();
  const row = inserted[0];
  if (!row) throw new Error("createBonus: insert into bonuses returned no row");
  return row;
}

export async function listBonuses(userId: string): Promise<BonusRow[]> {
  return db.select().from(bonuses).where(eq(bonuses.userId, userId)).orderBy(desc(bonuses.date));
}

export async function updateBonus(
  userId: string,
  bonusId: string,
  amountKopecks: number,
  date: string,
  note: string,
): Promise<BonusRow | null> {
  const updated = await db
    .update(bonuses)
    .set({ amountKopecks, date, note, updatedAt: new Date() })
    .where(and(eq(bonuses.id, bonusId), eq(bonuses.userId, userId)))
    .returning();
  return updated[0] ?? null;
}

export async function deleteBonusIfFuture(
  userId: string,
  bonusId: string,
): Promise<{ status: "deleted" } | { status: "blocked" } | { status: "not-found" }> {
  const deleted = await db
    .delete(bonuses)
    .where(
      and(
        eq(bonuses.id, bonusId),
        eq(bonuses.userId, userId),
        gt(bonuses.date, todayIsoInMoscow()),
      ),
    )
    .returning();
  if (deleted[0]) return { status: "deleted" };
  const existing = await db
    .select({ id: bonuses.id })
    .from(bonuses)
    .where(and(eq(bonuses.id, bonusId), eq(bonuses.userId, userId)))
    .limit(1);
  return existing[0] ? { status: "blocked" } : { status: "not-found" };
}
