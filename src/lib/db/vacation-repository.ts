if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/db/vacation-repository.ts is server-only and must never be imported into a client component.",
  );
}

/**
 * Ownership-scoped vacation persistence. This module deliberately logs no
 * money/date data beyond thrown error text describing the failing
 * operation.
 *
 * Every query and mutation carries `eq(vacations.userId, userId)`; `userId`
 * is always the caller's responsibility to source from `requireUserId()`
 * (matches T-01-01/T-02-01), never accepted as a client-supplied parameter
 * by this repository layer (T-03-06 mitigation).
 *
 * `checkOverlapVacations` is the single enforcement point every caller must
 * invoke before `createVacation`/`updateVacation` (T-03-07) — no unique DB
 * constraint exists to catch a bypass at the storage layer.
 */
import { and, desc, eq, gte, lte, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { vacations } from "@/lib/db/schema";
import { todayIsoInMoscow } from "@/domain/time";
import { resolveVacationPaymentDate } from "@/domain/vacation/calculate-average-daily-earnings";

export type VacationRow = typeof vacations.$inferSelect;

export async function createVacation(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<VacationRow> {
  const inserted = await db.insert(vacations).values({ userId, startDate, endDate }).returning();
  const row = inserted[0];
  if (!row) throw new Error("createVacation: insert into vacations returned no row");
  return row;
}

export async function listVacations(userId: string): Promise<VacationRow[]> {
  return db.select().from(vacations).where(eq(vacations.userId, userId)).orderBy(desc(vacations.startDate));
}

export async function updateVacation(
  userId: string,
  vacationId: string,
  startDate: string,
  endDate: string,
): Promise<VacationRow | null> {
  const updated = await db
    .update(vacations)
    .set({ startDate, endDate, updatedAt: new Date() })
    .where(and(eq(vacations.id, vacationId), eq(vacations.userId, userId)))
    .returning();
  return updated[0] ?? null;
}

/**
 * Returns `true` when any OTHER vacation for `userId` overlaps
 * `[startDate, endDate]` using inclusive-boundary semantics (D-V11, this
 * plan's "Design decisions"): `existing.startDate <= endDate AND
 * existing.endDate >= startDate`. A range that only touches an existing
 * range's boundary day counts as an overlap; a genuinely adjacent,
 * non-touching range does not.
 */
export async function checkOverlapVacations(
  userId: string,
  startDate: string,
  endDate: string,
  excludeVacationId?: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: vacations.id })
    .from(vacations)
    .where(
      and(
        eq(vacations.userId, userId),
        lte(vacations.startDate, endDate),
        gte(vacations.endDate, startDate),
        excludeVacationId ? ne(vacations.id, excludeVacationId) : undefined,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Deletes a vacation only while its computed payment date
 * (`resolveVacationPaymentDate(row.startDate)`, never the stored
 * `startDate` itself) is still strictly in the future (D-V10). Necessarily
 * read-then-write (not a single atomic SQL statement) because the
 * eligibility date is a pure-function transform of `startDate`, not a
 * column SQL can filter on directly — see this plan's "Design decisions"
 * for the accepted, narrow race window this implies (T-03-08).
 */
export async function deleteVacationIfFuture(
  userId: string,
  vacationId: string,
): Promise<{ status: "deleted" } | { status: "blocked" } | { status: "not-found" }> {
  const existing = await db
    .select({ id: vacations.id, startDate: vacations.startDate })
    .from(vacations)
    .where(and(eq(vacations.id, vacationId), eq(vacations.userId, userId)))
    .limit(1);
  const row = existing[0];
  if (!row) return { status: "not-found" };

  const paymentDateIso = resolveVacationPaymentDate(row.startDate);
  if (paymentDateIso > todayIsoInMoscow()) {
    await db
      .delete(vacations)
      .where(and(eq(vacations.id, vacationId), eq(vacations.userId, userId)))
      .returning();
    return { status: "deleted" };
  }
  return { status: "blocked" };
}
