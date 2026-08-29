/**
 * Validation schemas for the salary / schedule / YTD input surface (SAL-01,
 * SAL-02, SAL-03). Two layers, per 01-RESEARCH.md's "don't hand-roll"
 * guidance:
 *
 * - Persistence layer: derived via `createInsertSchema` from the Drizzle
 *   table definitions in `src/lib/db/schema.ts`. These stay in step with the
 *   DB automatically — a column rename/type change surfaces as a type
 *   error here, not as silent drift.
 * - Input layer: hand-authored on purpose. Forms submit rubles; the tables
 *   store kopecks, so a derived schema cannot describe what the browser
 *   actually sends. Each input schema is converted to the persistence shape
 *   before that shape is validated by the matching derived schema.
 *
 * Error messages name the field and the rule only — never the submitted
 * value (T-01-04: no money value may reach a log line or error string).
 */

import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";
import { salaryHistory, paymentSchedule, ytdBaseline } from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Persistence layer — derived from the Drizzle schema.
// ---------------------------------------------------------------------------

export const salaryHistoryInsertSchema = createInsertSchema(salaryHistory);
export const paymentScheduleInsertSchema = createInsertSchema(paymentSchedule);
export const ytdBaselineInsertSchema = createInsertSchema(ytdBaseline);

// ---------------------------------------------------------------------------
// Input layer — hand-authored form-submission schemas.
// ---------------------------------------------------------------------------

/** Upper ceiling shared by every ruble-denominated input (T-01-15: DoS via unbounded amounts). */
const MAX_RUBLES = 100_000_000;

/** `yyyy-MM-dd` calendar-date string, validated to be a real date (not just regex-shaped). */
const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Дата должна быть в формате ГГГГ-ММ-ДД")
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: "Указана несуществующая дата",
  });

/**
 * Gross salary entry. `effectiveFrom` may be in the past — D-13 explicitly
 * permits backdating.
 */
export const salaryInputSchema = z.object({
  grossRubles: z.coerce
    .number({ error: "Оклад должен быть числом" })
    .gt(0, "Оклад должен быть больше нуля")
    .max(MAX_RUBLES, "Оклад превышает допустимый максимум")
    .refine((value) => Math.round(value * 100) > 0, {
      message: "Оклад должен быть не меньше одной копейки",
    }),
  effectiveFrom: isoDateString,
});

/**
 * Avans/salary payment-schedule entry (day-of-month numbers, D-01). The two
 * days must differ — a single-day schedule is not a valid avans/salary split.
 */
export const scheduleInputSchema = z
  .object({
    avansDay: z.coerce
      .number({ error: "День аванса должен быть числом" })
      .int("День аванса должен быть целым числом")
      .min(1, "День аванса должен быть от 1 до 31")
      .max(31, "День аванса должен быть от 1 до 31"),
    salaryDay: z.coerce
      .number({ error: "День зарплаты должен быть числом" })
      .int("День зарплаты должен быть целым числом")
      .min(1, "День зарплаты должен быть от 1 до 31")
      .max(31, "День зарплаты должен быть от 1 до 31"),
  })
  .refine((value) => value.avansDay !== value.salaryDay, {
    message: "День аванса и день зарплаты должны различаться",
    path: ["salaryDay"],
  });

/**
 * Year-to-date baseline entry (SAL-03, D-09/D-10). Zero is a valid amount —
 * it is what `skipYtdBaselineAction` stores when the user skips entry.
 */
export const ytdBaselineInputSchema = z.object({
  amountRubles: z.coerce
    .number({ error: "Сумма должна быть числом" })
    .min(0, "Сумма не может быть отрицательной")
    .max(MAX_RUBLES, "Сумма превышает допустимый максимум"),
  asOfDate: isoDateString,
});

export type SalaryInput = z.infer<typeof salaryInputSchema>;
export type ScheduleInput = z.infer<typeof scheduleInputSchema>;
export type YtdBaselineInput = z.infer<typeof ytdBaselineInputSchema>;
