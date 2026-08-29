"use server";

/**
 * Server Actions for salary, schedule, and year-to-date baseline entry
 * (SAL-01, SAL-02, SAL-03). Every action begins by calling
 * `requireUserId()` and never reads a user id from its arguments or form
 * payload (T-01-01). Each action parses its FormData through the matching
 * Zod schema in src/lib/validation/salary.ts before anything reaches the
 * database, converts rubles to kopecks via `rublesToKopecks`, calls the
 * repository, then revalidates the paths that render the write.
 *
 * This module contains no logging calls, so no salary, baseline, or tax
 * amount can reach a log line (T-01-04). Returned error strings name the
 * field and the rule only.
 */

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/session";
import { rublesToKopecks, kopecksToRubles } from "@/domain/money";
import { todayIsoInMoscow } from "@/domain/time";
import { env } from "@/env";
import { exceedsMaxPayGap } from "@/domain/schedule/pay-gap";
import {
  salaryInputSchema,
  scheduleInputSchema,
  ytdBaselineInputSchema,
} from "@/lib/validation/salary";
import {
  insertSalaryIfAbsent,
  replaceSalaryIfUnchanged,
  upsertSchedule,
  upsertYtdBaseline,
  type SalaryHistoryRow,
} from "@/lib/db/salary-repository";
import {
  signSalaryReplacementToken,
  verifySalaryReplacementToken,
  type SalaryReplacementClaim,
} from "@/lib/salary-confirmation-token";

const PAY_SETUP_PATHS = ["/", "/onboarding", "/settings/salary"] as const;

function revalidatePaySetupPaths() {
  for (const path of PAY_SETUP_PATHS) {
    revalidatePath(path);
  }
}

export type SalaryActionResult =
  | { success: true }
  | {
      success: false;
      needsConfirmation: true;
      existingAmountRubles: number;
      submittedAmountRubles: number;
      effectiveFrom: string;
      confirmationClaim: string;
    }
  | { success: false; needsConfirmation?: false; fieldErrors: Record<string, string[]> };

/**
 * Validates and writes a gross salary entry. D-13 permits a past
 * `effectiveFrom`. D-14 keeps no audit trail for an exact-date collision, so
 * when a row already exists for the submitted date, the action returns a
 * signed claim bound to that exact stored amount. A resubmission can replace
 * only while the stored amount still matches the verified claim; otherwise
 * the caller receives a fresh prompt. Both insert and replacement atomicity
 * live in single conflict-handling repository statements (CR-02 / SAL-02).
 */
export async function saveSalaryAction(formData: FormData): Promise<SalaryActionResult> {
  const userId = await requireUserId();

  const parsed = salaryInputSchema.safeParse({
    grossRubles: formData.get("grossRubles"),
    effectiveFrom: formData.get("effectiveFrom"),
  });

  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { grossRubles, effectiveFrom } = parsed.data;
  const grossAmountKopecks = rublesToKopecks(grossRubles);
  const rawClaim = formData.get("confirmationClaim");
  const claim =
    typeof rawClaim === "string"
      ? verifySalaryReplacementToken(rawClaim, env.BETTER_AUTH_SECRET, Date.now())
      : null;

  function confirmation(current: SalaryHistoryRow): SalaryActionResult {
    const nextClaim: SalaryReplacementClaim = {
      userId,
      effectiveFrom,
      rowId: current.id,
      existingGrossAmountKopecks: current.grossAmountKopecks,
      issuedAtMs: Date.now(),
    };
    return {
      success: false,
      needsConfirmation: true,
      existingAmountRubles: kopecksToRubles(current.grossAmountKopecks),
      submittedAmountRubles: grossRubles,
      effectiveFrom,
      confirmationClaim: signSalaryReplacementToken(nextClaim, env.BETTER_AUTH_SECRET),
    };
  }

  try {
    if (claim && claim.userId === userId && claim.effectiveFrom === effectiveFrom) {
      const replacement = await replaceSalaryIfUnchanged(
        userId,
        grossAmountKopecks,
        effectiveFrom,
        claim.rowId,
        claim.existingGrossAmountKopecks,
      );
      if (replacement.status === "conflict" && replacement.current) {
        return confirmation(replacement.current);
      }
      if (replacement.status === "conflict") {
        const retry = await insertSalaryIfAbsent(userId, grossAmountKopecks, effectiveFrom);
        if (retry.status === "conflict" && retry.current) return confirmation(retry.current);
        if (retry.status === "conflict") throw new Error("salary write conflict without current row");
      }
    } else {
      const insertion = await insertSalaryIfAbsent(userId, grossAmountKopecks, effectiveFrom);
      if (insertion.status === "conflict" && insertion.current) {
        return confirmation(insertion.current);
      }
      if (insertion.status === "conflict") {
        const retry = await insertSalaryIfAbsent(userId, grossAmountKopecks, effectiveFrom);
        if (retry.status === "conflict" && retry.current) return confirmation(retry.current);
        if (retry.status === "conflict") throw new Error("salary write conflict without current row");
      }
    }
  } catch {
    return {
      success: false,
      fieldErrors: { grossRubles: ["Не удалось сохранить оклад. Попробуйте ещё раз."] },
    };
  }
  revalidatePaySetupPaths();
  return { success: true };
}

export type ScheduleActionResult =
  | { success: true; warning: string | null }
  | { success: false; fieldErrors: Record<string, string[]> };

/**
 * Validates and writes the avans/salary payment schedule. D-04: the save
 * always proceeds even when the 15-day ТК РФ gap is exceeded — this is a
 * non-blocking informational signal, never a rejection.
 */
export async function saveScheduleAction(formData: FormData): Promise<ScheduleActionResult> {
  const userId = await requireUserId();

  const parsed = scheduleInputSchema.safeParse({
    avansDay: formData.get("avansDay"),
    salaryDay: formData.get("salaryDay"),
  });

  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { avansDay, salaryDay } = parsed.data;
  await upsertSchedule(userId, avansDay, salaryDay);
  revalidatePaySetupPaths();

  const warning = exceedsMaxPayGap(avansDay, salaryDay)
    ? "Промежуток между авансом и зарплатой превышает 15 дней — это стоит проверить, но график всё равно сохранён."
    : null;

  return { success: true, warning };
}

export type YtdBaselineActionResult =
  | { success: true }
  | { success: false; fieldErrors: Record<string, string[]> };

/** Validates and writes the year-to-date baseline (SAL-03, D-10) as a confirmed, non-estimated figure. */
export async function saveYtdBaselineAction(formData: FormData): Promise<YtdBaselineActionResult> {
  const userId = await requireUserId();

  const parsed = ytdBaselineInputSchema.safeParse({
    amountRubles: formData.get("amountRubles"),
    asOfDate: formData.get("asOfDate"),
  });

  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { amountRubles, asOfDate } = parsed.data;
  await upsertYtdBaseline(userId, rublesToKopecks(amountRubles), asOfDate, false);
  revalidatePaySetupPaths();
  return { success: true };
}

/**
 * Records that the user skipped YTD entry: a zero baseline dated 1 January
 * of the current year, flagged `isEstimated = true` — the state D-11's
 * persistent home-screen banner reads.
 */
export async function skipYtdBaselineAction(): Promise<{ success: true }> {
  const userId = await requireUserId();
  const januaryFirstOfCurrentYear = `${todayIsoInMoscow().slice(0, 4)}-01-01`;
  await upsertYtdBaseline(userId, 0, januaryFirstOfCurrentYear, true);
  revalidatePaySetupPaths();
  return { success: true };
}
