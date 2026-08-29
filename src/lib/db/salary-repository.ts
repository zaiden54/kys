// server-only guard equivalent: the `server-only` npm package isn't
// installed (new package installs require a human-verify checkpoint per
// executor deviation rules), so this throws immediately if the module is
// ever evaluated in a browser context, preventing it from reaching a client
// bundle. Matches the pattern established in src/lib/session.ts.
if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/db/salary-repository.ts is server-only and must never be imported into a client component.",
  );
}

/**
 * Ownership-scoped Drizzle access to salary_history, payment_schedule, and
 * ytd_baseline (SAL-01, SAL-02, SAL-03).
 *
 * Every exported function takes `userId` as its first parameter and every
 * query carries an equality filter on that table's `userId` column — no
 * exception, including single-row primary-key lookups (T-01-01 mitigation:
 * the ownership predicate stays uniform and greppable). No function may
 * accept a userId that did not come from `requireUserId()` — that is the
 * caller's responsibility (see src/app/actions/salary.ts).
 *
 * This module contains no logging calls at all (T-01-04): a money value can
 * never reach a log line. Thrown errors describe the failing operation and
 * column, never the amount.
 */

import { and, desc, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { salaryHistory, paymentSchedule, ytdBaseline } from "@/lib/db/schema";
import { todayIsoInMoscow } from "@/domain/time";

export type SalaryHistoryRow = typeof salaryHistory.$inferSelect;
export type PaymentScheduleRow = typeof paymentSchedule.$inferSelect;
export type YtdBaselineRow = typeof ytdBaseline.$inferSelect;

// ---------------------------------------------------------------------------
// salary_history
// ---------------------------------------------------------------------------

/**
 * Returns the salary_history row effective on `isoDate` — the most recent
 * row whose `effectiveFrom` is on or before `isoDate` — or null when the
 * user has never entered a salary. This is what payment forecasting reads:
 * "which gross amount applies to a payment dated `isoDate`."
 */
export async function getActiveSalaryAt(
  userId: string,
  isoDate: string,
): Promise<SalaryHistoryRow | null> {
  const rows = await db
    .select()
    .from(salaryHistory)
    .where(and(eq(salaryHistory.userId, userId), lte(salaryHistory.effectiveFrom, isoDate)))
    .orderBy(desc(salaryHistory.effectiveFrom))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Returns the salary_history row whose `effectiveFrom` exactly matches
 * `isoDate`, or null. This is what the UI reads to disclose a pending
 * overwrite (D-14) before it happens.
 */
export async function findSalaryAt(
  userId: string,
  isoDate: string,
): Promise<SalaryHistoryRow | null> {
  const rows = await db
    .select()
    .from(salaryHistory)
    .where(and(eq(salaryHistory.userId, userId), eq(salaryHistory.effectiveFrom, isoDate)))
    .limit(1);

  return rows[0] ?? null;
}

/** Returns every salary_history row for `userId`, ordered newest-first. */
export async function listSalaryHistory(userId: string): Promise<SalaryHistoryRow[]> {
  return db
    .select()
    .from(salaryHistory)
    .where(eq(salaryHistory.userId, userId))
    .orderBy(desc(salaryHistory.effectiveFrom));
}

/**
 * Implements D-14 (exact-effective-date collision/overwrite, per Task 1's
 * resolved decision): a new salary entry whose `effectiveFrom` exactly
 * matches an existing row replaces that row — exactly one row per
 * (user, effective date), no duplicate and no archived copy. A row dated
 * differently simply adds a second history row (D-13 backdating).
 *
 * Persists via a single `INSERT ... ON CONFLICT (user_id, effective_from) DO
 * UPDATE` statement, so the write is atomic without a transaction wrapper —
 * this matters because the installed Neon HTTP driver
 * (drizzle-orm/neon-http) has no interactive transactions, so there is no
 * other way to make a multi-statement write atomic. Because the whole
 * operation is one round trip, two concurrent calls for the same
 * (user, effective date) both resolve without error and Postgres itself
 * serialises them on `salary_history_user_effective_from_uq`: exactly one
 * row survives, carrying whichever write the database ordered last. No
 * update is silently lost and no unique-constraint violation escapes to the
 * caller.
 */
export async function replaceSalaryAt(
  userId: string,
  grossAmountKopecks: number,
  effectiveFrom: string,
): Promise<SalaryHistoryRow> {
  const upserted = await db
    .insert(salaryHistory)
    .values({ userId, grossAmountKopecks, effectiveFrom })
    .onConflictDoUpdate({
      target: [salaryHistory.userId, salaryHistory.effectiveFrom],
      set: { grossAmountKopecks, createdAt: new Date() },
    })
    .returning();

  const row = upserted[0];
  if (!row) {
    throw new Error("replaceSalaryAt: upsert into salary_history returned no row");
  }
  return row;
}

// ---------------------------------------------------------------------------
// payment_schedule
// ---------------------------------------------------------------------------

/** Returns the user's current avans/salary payment schedule, or null. */
export async function getSchedule(userId: string): Promise<PaymentScheduleRow | null> {
  const rows = await db
    .select()
    .from(paymentSchedule)
    .where(eq(paymentSchedule.userId, userId))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Writes the single current payment_schedule row for `userId` (D-01: no
 * schedule history is retained, unlike salary_history).
 *
 * Persists via a single `INSERT ... ON CONFLICT (user_id) DO UPDATE`
 * statement targeting the table's own primary key, so the write is atomic
 * without a transaction wrapper. Concurrent submissions from two devices
 * resolve as upserts rather than one caller observing "no existing row" and
 * colliding with the other's insert as an opaque primary-key violation
 * (WR-01).
 */
export async function upsertSchedule(
  userId: string,
  avansDay: number,
  salaryDay: number,
): Promise<PaymentScheduleRow> {
  const upserted = await db
    .insert(paymentSchedule)
    .values({ userId, avansDay, salaryDay })
    .onConflictDoUpdate({
      target: paymentSchedule.userId,
      set: { avansDay, salaryDay, updatedAt: new Date() },
    })
    .returning();

  const row = upserted[0];
  if (!row) {
    throw new Error("upsertSchedule: upsert into payment_schedule returned no row");
  }
  return row;
}

// ---------------------------------------------------------------------------
// ytd_baseline
// ---------------------------------------------------------------------------

/** Default synthesized when a user has no ytd_baseline row yet (D-11). */
function defaultYtdBaseline(userId: string): YtdBaselineRow {
  const januaryFirstOfCurrentYear = `${todayIsoInMoscow().slice(0, 4)}-01-01`;
  return {
    userId,
    amountKopecks: 0,
    asOfDate: januaryFirstOfCurrentYear,
    isEstimated: true,
    updatedAt: null,
  };
}

/**
 * Returns the user's year-to-date baseline (SAL-03). A user who never saved
 * one gets a synthesized zero, estimated baseline (D-11) rather than null —
 * there is always a well-defined cumulative-income starting point to fold
 * the tax engine forward from.
 */
export async function getYtdBaseline(userId: string): Promise<YtdBaselineRow> {
  const rows = await db
    .select()
    .from(ytdBaseline)
    .where(eq(ytdBaseline.userId, userId))
    .limit(1);

  return rows[0] ?? defaultYtdBaseline(userId);
}

/**
 * Writes the single mutable ytd_baseline row for `userId`. D-10: editing
 * this and re-reading the forecast reflects the new value immediately,
 * since nothing else caches a derived cumulative-income figure.
 *
 * Persists via a single `INSERT ... ON CONFLICT (user_id) DO UPDATE`
 * statement targeting the table's own primary key, so the write is atomic
 * without a transaction wrapper. Concurrent submissions from two devices
 * resolve as upserts rather than one caller observing "no existing row" and
 * colliding with the other's insert as an opaque primary-key violation
 * (WR-01).
 */
export async function upsertYtdBaseline(
  userId: string,
  amountKopecks: number,
  asOfDate: string,
  isEstimated: boolean,
): Promise<YtdBaselineRow> {
  const upserted = await db
    .insert(ytdBaseline)
    .values({ userId, amountKopecks, asOfDate, isEstimated })
    .onConflictDoUpdate({
      target: ytdBaseline.userId,
      set: { amountKopecks, asOfDate, isEstimated, updatedAt: new Date() },
    })
    .returning();

  const row = upserted[0];
  if (!row) {
    throw new Error("upsertYtdBaseline: upsert into ytd_baseline returned no row");
  }
  return row;
}

// ---------------------------------------------------------------------------
// Cumulative income (feeds the НДФЛ engine)
// ---------------------------------------------------------------------------

/**
 * No bonus/vacation-pay event tables exist yet in Phase 1 (they ship in
 * Phase 2 and Phase 3 respectively), so the additional-income sum is always
 * zero here. Kept as an explicit function — not an inlined `0` — so
 * `getCumulativeIncomeBeforeDate`'s "baseline + sum" shape survives
 * contract-unchanged when Phase 2/3 extend it into a real UNION query
 * (01-RESEARCH.md's documented anti-pattern to avoid).
 */
function sumAdditionalIncomeEventsBetween(afterIsoDate: string, beforeIsoDate: string): number {
  void afterIsoDate;
  void beforeIsoDate;
  return 0;
}

/**
 * Cumulative gross income (in kopecks) earned strictly before `isoDate` —
 * the `cumulativeBefore` input to `taxOnCumulative`/`calculateNdfl`.
 *
 * Written as "baseline plus the sum of dated income events after
 * baseline.asOfDate and before isoDate" from day one, even though that
 * event set is empty in Phase 1.
 */
export async function getCumulativeIncomeBeforeDate(
  userId: string,
  isoDate: string,
): Promise<number> {
  const baseline = await getYtdBaseline(userId);
  const additionalIncomeKopecks = sumAdditionalIncomeEventsBetween(baseline.asOfDate, isoDate);
  return baseline.amountKopecks + additionalIncomeKopecks;
}
