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
 * Deletes the colliding row (if any) then inserts the new one. Note: the
 * installed Neon HTTP driver (drizzle-orm/neon-http) does not support
 * interactive transactions, so these are two sequential statements rather
 * than an atomic transaction — an acceptable risk for a single-writer,
 * single-user-scoped row pair with no concurrent-write scenario in this
 * app's usage pattern.
 */
export async function replaceSalaryAt(
  userId: string,
  grossAmountKopecks: number,
  effectiveFrom: string,
): Promise<SalaryHistoryRow> {
  await db
    .delete(salaryHistory)
    .where(and(eq(salaryHistory.userId, userId), eq(salaryHistory.effectiveFrom, effectiveFrom)));

  const inserted = await db
    .insert(salaryHistory)
    .values({ userId, grossAmountKopecks, effectiveFrom })
    .returning();

  const row = inserted[0];
  if (!row) {
    throw new Error("replaceSalaryAt: insert into salary_history returned no row");
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
 */
export async function upsertSchedule(
  userId: string,
  avansDay: number,
  salaryDay: number,
): Promise<PaymentScheduleRow> {
  const existing = await db
    .select()
    .from(paymentSchedule)
    .where(eq(paymentSchedule.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    const updated = await db
      .update(paymentSchedule)
      .set({ avansDay, salaryDay, updatedAt: new Date() })
      .where(eq(paymentSchedule.userId, userId))
      .returning();

    const row = updated[0];
    if (!row) {
      throw new Error("upsertSchedule: update to payment_schedule returned no row");
    }
    return row;
  }

  const inserted = await db.insert(paymentSchedule).values({ userId, avansDay, salaryDay }).returning();

  const row = inserted[0];
  if (!row) {
    throw new Error("upsertSchedule: insert into payment_schedule returned no row");
  }
  return row;
}

// ---------------------------------------------------------------------------
// ytd_baseline
// ---------------------------------------------------------------------------

/** Default synthesized when a user has no ytd_baseline row yet (D-11). */
function defaultYtdBaseline(userId: string): YtdBaselineRow {
  const januaryFirstOfCurrentYear = `${new Date().getFullYear()}-01-01`;
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
 */
export async function upsertYtdBaseline(
  userId: string,
  amountKopecks: number,
  asOfDate: string,
  isEstimated: boolean,
): Promise<YtdBaselineRow> {
  const existing = await db
    .select()
    .from(ytdBaseline)
    .where(eq(ytdBaseline.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    const updated = await db
      .update(ytdBaseline)
      .set({ amountKopecks, asOfDate, isEstimated, updatedAt: new Date() })
      .where(eq(ytdBaseline.userId, userId))
      .returning();

    const row = updated[0];
    if (!row) {
      throw new Error("upsertYtdBaseline: update to ytd_baseline returned no row");
    }
    return row;
  }

  const inserted = await db
    .insert(ytdBaseline)
    .values({ userId, amountKopecks, asOfDate, isEstimated })
    .returning();

  const row = inserted[0];
  if (!row) {
    throw new Error("upsertYtdBaseline: insert into ytd_baseline returned no row");
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
