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
import { exceedsMaxPayGap } from "@/domain/schedule/pay-gap";
import {
  salaryInputSchema,
  scheduleInputSchema,
  ytdBaselineInputSchema,
} from "@/lib/validation/salary";
import {
  findSalaryAt,
  replaceSalaryAt,
  upsertSchedule,
  upsertYtdBaseline,
} from "@/lib/db/salary-repository";

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
      effectiveFrom: string;
    }
  | { success: false; needsConfirmation?: false; fieldErrors: Record<string, string[]> };

/**
 * Validates and writes a gross salary entry. D-13 permits a past
 * `effectiveFrom`. D-14 keeps no audit trail for an exact-date collision, so
 * when a row already exists for the submitted date and the form did not
 * carry a `confirm` flag, this returns a confirmation request (including the
 * existing amount) instead of writing — the caller must resubmit with
 * `confirm=true` to proceed.
 *
 * The `findSalaryAt` read below is advisory only: it exists purely to drive
 * the D-14 confirmation prompt's UX (showing the user the existing amount
 * before they confirm an overwrite) and can never itself be made race-free —
 * two near-simultaneous submissions can both observe "no existing row." That
 * is fine, because durability no longer depends on this read: `replaceSalaryAt`
 * persists through a single conflict-handling statement, so whichever write
 * reaches the database last is the one that survives and exactly one row
 * exists afterward. No app-level lock, resubmission loop, or transaction
 * wrapper is needed or added here — the atomicity guarantee lives entirely
 * in the repository layer (CR-02 / SAL-02).
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
  const confirmed = formData.get("confirm") === "true";

  const existing = await findSalaryAt(userId, effectiveFrom);
  if (existing && !confirmed) {
    return {
      success: false,
      needsConfirmation: true,
      existingAmountRubles: kopecksToRubles(existing.grossAmountKopecks),
      effectiveFrom,
    };
  }

  try {
    await replaceSalaryAt(userId, rublesToKopecks(grossRubles), effectiveFrom);
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
