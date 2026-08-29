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
import { accruedGrossBetween, type SalaryHistoryEntry } from "@/domain/pay/payment-accrual";
import type { PaymentKind } from "@/domain/schedule/resolve-payment-date";

export type SalaryHistoryRow = typeof salaryHistory.$inferSelect;
export type SalaryWriteOutcome =
  | { status: "written"; row: SalaryHistoryRow }
  | { status: "conflict"; current: SalaryHistoryRow | null };
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

export async function insertSalaryIfAbsent(
  userId: string,
  grossAmountKopecks: number,
  effectiveFrom: string,
): Promise<SalaryWriteOutcome> {
  const inserted = await db
    .insert(salaryHistory)
    .values({ userId, grossAmountKopecks, effectiveFrom })
    .onConflictDoNothing({ target: [salaryHistory.userId, salaryHistory.effectiveFrom] })
    .returning();
  const row = inserted[0];
  return row
    ? { status: "written", row }
    : { status: "conflict", current: await findSalaryAt(userId, effectiveFrom) };
}

export async function replaceSalaryIfUnchanged(
  userId: string,
  grossAmountKopecks: number,
  effectiveFrom: string,
  expectedRowId: string,
  expectedGrossAmountKopecks: number,
): Promise<SalaryWriteOutcome> {
  const replaced = await db
    .insert(salaryHistory)
    .values({ userId, grossAmountKopecks, effectiveFrom })
    .onConflictDoUpdate({
      target: [salaryHistory.userId, salaryHistory.effectiveFrom],
      set: { grossAmountKopecks, createdAt: new Date() },
      setWhere: and(
        eq(salaryHistory.id, expectedRowId),
        eq(salaryHistory.grossAmountKopecks, expectedGrossAmountKopecks),
      ),
    })
    .returning();
  const row = replaced[0];
  return row
    ? { status: "written", row }
    : { status: "conflict", current: await findSalaryAt(userId, effectiveFrom) };
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
 * Cumulative gross income (in kopecks) earned strictly before `isoDate` for
 * a payment of the given `kind` — the `cumulativeBefore` input to
 * `taxOnCumulative`/`calculateNdfl` (TAX-01, TAX-02). `kind` defaults to
 * `"avans"`, the lowest `PAYMENT_KIND_RANK` — a caller that omits it
 * (matching the pre-01-10 two-argument signature) still means "everything
 * strictly before this date," since no event can rank lower than avans to
 * sneak in via the same-date tie-break.
 *
 * Baseline applicability (the calendar-year reset TAX-01 requires): the
 * stored YTD baseline contributes its amount and opens the accrual window
 * at its own `asOfDate` only when that date's year matches `isoDate`'s year
 * AND is not after `isoDate`. Otherwise the baseline contributes nothing
 * and the window opens at 31 December of the year preceding `isoDate` — a
 * baseline entered in a prior calendar year must not silently carry forward
 * into the next year's cumulative base.
 *
 * The real accrual is derived by the pure `accruedGrossBetween` engine over
 * the user's own schedule and salary history, read through the existing
 * ownership-scoped `getSchedule`/`listSalaryHistory` functions so a second
 * user's rows can never contribute to this figure. A user with a baseline
 * but no payment schedule gets the baseline amount alone — there is nothing
 * to enumerate without a schedule.
 */
export async function getCumulativeIncomeBeforeDate(
  userId: string,
  isoDate: string,
  kind: PaymentKind = "avans",
): Promise<number> {
  const [baseline, schedule, history] = await Promise.all([
    getYtdBaseline(userId),
    getSchedule(userId),
    listSalaryHistory(userId),
  ]);

  const paymentYear = isoDate.slice(0, 4);
  const baselineApplies =
    baseline.asOfDate.slice(0, 4) === paymentYear && baseline.asOfDate <= isoDate;
  const baselineAmountKopecks = baselineApplies ? baseline.amountKopecks : 0;
  const windowBoundIso = baselineApplies
    ? baseline.asOfDate
    : `${Number(paymentYear) - 1}-12-31`;

  if (!schedule) {
    return baselineAmountKopecks;
  }

  const salaryHistoryEntries: SalaryHistoryEntry[] = history.map((row) => ({
    effectiveFrom: row.effectiveFrom,
    grossAmountKopecks: row.grossAmountKopecks,
  }));

  const accruedKopecks = accruedGrossBetween(
    { avansDay: schedule.avansDay, salaryDay: schedule.salaryDay },
    salaryHistoryEntries,
    windowBoundIso,
    { dateIso: isoDate, kind },
  );

  return baselineAmountKopecks + accruedKopecks;
}
