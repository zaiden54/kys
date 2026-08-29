if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/db/bonus-repository.ts is server-only and must never be imported into a client component.",
  );
}

/** Ownership-scoped bonus persistence. This module deliberately logs no money data. */
import { desc, eq } from "drizzle-orm";
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
