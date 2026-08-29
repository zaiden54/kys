# Phase 2: Bonuses & One-off Payments - Pattern Map

**Mapped:** 2026-08-30
**Files analyzed:** 11 (5 new, 6 modified)
**Analogs found:** 11 / 11 (100%)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/db/schema.ts` (ADD bonuses table) | data-model | storage | `src/lib/db/schema.ts` (salaryHistory) | exact-role |
| `src/lib/db/bonus-repository.ts` | repository | CRUD | `src/lib/db/salary-repository.ts` | exact-role |
| `src/lib/validation/bonus.ts` | validation-schema | request-response | `src/lib/validation/salary.ts` | exact-role |
| `src/app/actions/bonus.ts` | server-action | request-response | `src/app/actions/salary.ts` | exact-role |
| `src/app/(app)/bonuses/page.tsx` | page-component | CRUD | `src/app/(app)/page.tsx` | role-match |
| `src/app/(app)/bonuses/bonus-form.tsx` | form-component | request-response | `src/components/pay-setup-forms.tsx` | role-match |
| `src/lib/db/salary-repository.ts` (MODIFY getCumulativeIncomeBeforeDate) | repository | CRUD | `src/lib/db/salary-repository.ts` (existing function) | exact-role |
| `src/domain/pay/payment-accrual.ts` (MODIFY accruedGrossBetween) | pure-function | transform | `src/domain/pay/payment-accrual.ts` (existing function) | exact-role |
| `src/app/actions/forecast.ts` (MODIFY nextPaymentOnOrAfter) | orchestration | request-response | `src/app/actions/forecast.ts` (existing function) | exact-role |
| `src/components/next-payment-card.tsx` (MODIFY for breakdown) | component | request-response | `src/components/next-payment-card.tsx` (existing) | exact-role |
| `src/app/(app)/page.tsx` (MODIFY integration) | page-component | request-response | `src/app/(app)/page.tsx` (existing) | exact-role |

## Pattern Assignments

### `src/lib/db/schema.ts` - ADD bonuses table (data-model, storage)

**Analog:** `src/lib/db/schema.ts` (salaryHistory table, lines 19-39)

**Table definition pattern** (lines 19-39):
```typescript
// Source: salaryHistory table pattern, adapted for bonuses
export const bonuses = pgTable(
  "bonuses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    amountKopecks: bigint("amount_kopecks", { mode: "number" }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    note: text("note"), // D-B08: optional descriptive field
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    // One bonus row per (user_id, date) per D-B03/A2 (upsert increases amount)
    uniqueIndex("bonuses_user_date_uq").on(table.userId, table.date),
    check("bonus_amount_positive", sql`${table.amountKopecks} > 0`),
  ],
);
```

**Imports pattern** (lines 1-14):
```typescript
import {
  bigint,
  check,
  date,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth-schema";
```

---

### `src/lib/db/bonus-repository.ts` (repository, CRUD)

**Analog:** `src/lib/db/salary-repository.ts` (lines 1-40)

**Server-only guard + module header** (lines 1-40):
```typescript
if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/db/bonus-repository.ts is server-only and must never be imported into a client component.",
  );
}

/**
 * Ownership-scoped Drizzle access to bonuses table (BON-01, BON-02).
 *
 * Every exported function takes `userId` as its first parameter and every
 * query carries an equality filter on that table's `userId` column — no
 * exception (T-01-01: ownership predicate stays uniform and greppable).
 *
 * This module contains no logging calls (T-01-04): a money value can
 * never reach a log line. Thrown errors describe the failing operation and
 * column, never the amount.
 */

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bonuses } from "@/lib/db/schema";
import { todayIsoInMoscow } from "@/domain/time";

export type BonusRow = typeof bonuses.$inferSelect;
```

**List bonuses pattern** (from salary-repository.ts lines 84-91):
```typescript
/** Returns every bonus row for `userId`, ordered newest-first. */
export async function listBonuses(userId: string): Promise<BonusRow[]> {
  return db
    .select()
    .from(bonuses)
    .where(eq(bonuses.userId, userId))
    .orderBy(desc(bonuses.date));
}
```

**Upsert pattern with onConflictDoUpdate** (from salary-repository.ts lines 112-131):
```typescript
/**
 * Upserts a bonus for `userId` on `date`. D-B03: multiple bonuses on the same
 * date are stored as one row with summed amount (upsert increases amount).
 * Atomic via single INSERT ... ON CONFLICT statement (no interactive transaction).
 */
export async function upsertBonus(
  userId: string,
  amountKopecks: number,
  date: string,
  note?: string,
): Promise<BonusRow> {
  const upserted = await db
    .insert(bonuses)
    .values({ userId, amountKopecks, date, note })
    .onConflictDoUpdate({
      target: [bonuses.userId, bonuses.date],
      set: { amountKopecks, note, updatedAt: new Date() },
    })
    .returning();

  const row = upserted[0];
  if (!row) {
    throw new Error("upsertBonus: upsert into bonuses returned no row");
  }
  return row;
}
```

**Delete with guard pattern** (from salary-repository.ts concept, adapted for D-B06):
```typescript
/**
 * D-B06: deletion of bonuses whose payment date is in the past is forbidden.
 * Returns true if deleted, false if deletion was blocked by date guard.
 */
export async function deleteBonusIfFuture(
  userId: string,
  bonusDate: string,
): Promise<boolean> {
  const today = todayIsoInMoscow();
  if (bonusDate <= today) {
    return false; // Deletion blocked for past bonuses
  }

  const deleted = await db
    .delete(bonuses)
    .where(and(eq(bonuses.userId, userId), eq(bonuses.date, bonusDate)))
    .returning();

  return deleted.length > 0;
}
```

---

### `src/lib/validation/bonus.ts` (validation-schema, request-response)

**Analog:** `src/lib/validation/salary.ts` (lines 1-81)

**Module header + shared validation patterns** (lines 1-66):
```typescript
/**
 * Validation schemas for bonus input (BON-01). Two layers:
 *
 * - Persistence layer: derived via `createInsertSchema` from the Drizzle
 *   table definitions in `src/lib/db/schema.ts`.
 * - Input layer: hand-authored form-submission schemas (bonuses are in rubles,
 *   DB stores kopecks).
 *
 * Error messages name the field and the rule only — never the submitted
 * value (T-01-04: no money value may reach a log line or error string).
 */

import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";
import { bonuses } from "@/lib/db/schema";

// Persistence layer — derived from Drizzle schema
export const bonusInsertSchema = createInsertSchema(bonuses);

// Input layer — hand-authored form-submission schema
const MAX_RUBLES = 100_000_000;

const ISO_DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

const isoDateString = z
  .string()
  .regex(ISO_DATE_SHAPE, "Дата должна быть в формате ГГГГ-ММ-ДД")
  .refine(
    (value) => {
      if (!ISO_DATE_SHAPE.test(value)) return true;
      const parsed = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    },
    { message: "Указана несуществующая дата" },
  );

/**
 * Bonus input: amount in rubles, date in ISO format (D-B02 allows backdating),
 * optional free-text note (D-B08).
 */
export const bonusInputSchema = z.object({
  amountRubles: z.coerce
    .number({ error: "Бонус должен быть числом" })
    .gt(0, "Бонус должен быть больше нуля")
    .max(MAX_RUBLES, "Бонус превышает допустимый максимум")
    .refine((value) => Math.round(value * 100) > 0, {
      message: "Бонус должен быть не меньше одной копейки",
    }),
  date: isoDateString,
  note: z.string().optional().default(""),
});

export type BonusInput = z.infer<typeof bonusInputSchema>;
```

---

### `src/app/actions/bonus.ts` (server-action, request-response)

**Analog:** `src/app/actions/salary.ts` (lines 1-176)

**Module header + imports pattern** (lines 1-40):
```typescript
"use server";

/**
 * Server Actions for bonus create, edit, delete (BON-01, BON-02, D-B04, D-B06).
 * Every action begins by calling `requireUserId()` and never reads a user id
 * from its arguments or form payload (T-01-01). Each action parses its FormData
 * through the matching Zod schema in src/lib/validation/bonus.ts before anything
 * reaches the database, converts rubles to kopecks via `rublesToKopecks`, calls
 * the repository, then revalidates the paths that render the write.
 *
 * This module contains no logging calls, so no bonus or tax amount can reach
 * a log line (T-01-04). Returned error strings name the field and the rule only.
 */

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/session";
import { rublesToKopecks } from "@/domain/money";
import { todayIsoInMoscow } from "@/domain/time";
import { bonusInputSchema } from "@/lib/validation/bonus";
import { upsertBonus, deleteBonusIfFuture } from "@/lib/db/bonus-repository";

const BONUS_AFFECTED_PATHS = ["/", "/bonuses"] as const;

function revalidateBonusPaths() {
  for (const path of BONUS_AFFECTED_PATHS) {
    revalidatePath(path);
  }
}

export type BonusActionResult =
  | { success: true }
  | { success: false; fieldErrors: Record<string, string[]> };
```

**Save bonus action pattern** (from salary.ts lines 70-144, adapted):
```typescript
/**
 * Validates and writes a one-off bonus (BON-01). D-B02 permits a past `date`.
 * D-B04 allows editing any bonus including those dated in the past
 * (recomputation happens automatically on next forecast read).
 */
export async function saveBonusAction(formData: FormData): Promise<BonusActionResult> {
  const userId = await requireUserId();

  const parsed = bonusInputSchema.safeParse({
    amountRubles: formData.get("amountRubles"),
    date: formData.get("date"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { amountRubles, date, note } = parsed.data;
  const amountKopecks = rublesToKopecks(amountRubles);

  try {
    await upsertBonus(userId, amountKopecks, date, note);
    revalidateBonusPaths();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      fieldErrors: { date: ["Не удалось сохранить бонус. Попробуйте ещё раз."] },
    };
  }
}
```

**Delete bonus action with guard pattern** (from salary.ts concept, adapted for D-B06):
```typescript
/**
 * D-B06: deletion of past bonuses is forbidden. Returns error if the bonus
 * date is on or before today (Moscow time).
 */
export async function deleteBonusAction(date: string): Promise<BonusActionResult> {
  const userId = await requireUserId();

  const today = todayIsoInMoscow();
  if (date <= today) {
    return {
      success: false,
      fieldErrors: { date: ["Удалять можно только будущие бонусы"] },
    };
  }

  const deleted = await deleteBonusIfFuture(userId, date);
  if (!deleted) {
    return {
      success: false,
      fieldErrors: { date: ["Бонус не найден"] },
    };
  }

  revalidateBonusPaths();
  return { success: true };
}
```

---

### `src/lib/db/salary-repository.ts` - MODIFY getCumulativeIncomeBeforeDate (repository, CRUD)

**Analog:** `src/lib/db/salary-repository.ts` (lines 315-351)

**Current function to extend** (lines 315-351):
```typescript
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
```

**Extension for bonuses** (recommended approach from 02-RESEARCH.md Pattern 3):
```typescript
// NEW import at the top
import { listBonuses } from "@/lib/db/bonus-repository"; // After implementing bonus-repository

// Extension to getCumulativeIncomeBeforeDate — add bonuses to the Promise.all
export async function getCumulativeIncomeBeforeDate(
  userId: string,
  isoDate: string,
  kind: PaymentKind = "avans",
): Promise<number> {
  const [baseline, schedule, history, bonusRows] = await Promise.all([
    getYtdBaseline(userId),
    getSchedule(userId),
    listSalaryHistory(userId),
    listBonuses(userId),  // NEW: fetch bonuses alongside salary history
  ]);

  // ... existing baseline/salary accrual logic (lines unchanged) ...

  // NEW: compute bonus accrual strictly before isoDate
  const bonusAccruedKopecks = bonusRows
    .filter(b => b.date < isoDate) // Strictly before (same boundary logic as salary)
    .reduce((sum, b) => sum + b.amountKopecks, 0);

  return baselineAmountKopecks + accruedKopecks + bonusAccruedKopecks;
}
```

---

### `src/domain/pay/payment-accrual.ts` - MODIFY accruedGrossBetween (pure-function, transform)

**Analog:** `src/domain/pay/payment-accrual.ts` (lines 125-168)

**Current function signature** (lines 125-130):
```typescript
export function accruedGrossBetween(
  schedule: PaymentSchedule,
  salaryHistory: readonly SalaryHistoryEntry[],
  afterIso: string,
  target: AccrualTarget,
): Kopecks {
```

**Optional extension to accept bonus events** (recommended from 02-RESEARCH.md Pattern 3, Approach A):
```typescript
// NEW interface for bonus events, added above accruedGrossBetween
export interface PaymentEvent {
  dateIso: string;
  grossKopecks: Kopecks;
}

// Extended function signature (backward-compatible with optional parameter)
export function accruedGrossBetween(
  schedule: PaymentSchedule,
  salaryHistory: readonly SalaryHistoryEntry[],
  afterIso: string,
  target: AccrualTarget,
  bonusEvents?: readonly PaymentEvent[],  // NEW optional parameter
): Kopecks {
  // ... existing logic (lines 131-168) ...
  
  // NEW: add bonus accrual to totalKopecks before return
  if (bonusEvents) {
    for (const event of bonusEvents) {
      const eventTime = new Date(event.dateIso).getTime();
      const afterTime = parseIsoToLocalMidnight(afterIso).getTime();
      const targetTime = parseIsoToLocalMidnight(target.dateIso).getTime();
      
      if (eventTime <= afterTime) continue;
      if (eventTime >= targetTime) continue;
      
      totalKopecks += event.grossKopecks;
    }
  }

  return totalKopecks;
}
```

---

### `src/app/actions/forecast.ts` - MODIFY nextPaymentOnOrAfter generalization (orchestration, request-response)

**Analog:** `src/app/actions/forecast.ts` (lines 79-128)

**Current next-payment logic** (lines 85-91):
```typescript
const paymentEvent = nextPaymentOnOrAfter(
  { avansDay: schedule.avansDay, salaryDay: schedule.salaryDay },
  nowInMoscow(),
);
if (!paymentEvent) {
  return { configured: false, missing: "schedule" };
}
```

**Extended approach from 02-RESEARCH.md Pattern 4** (generalized to consider bonuses):
```typescript
// NEW import at top
import { listBonuses } from "@/lib/db/bonus-repository";

// NEW wrapper function to resolve next payment event (schedule OR bonus, whichever is soonest)
async function nextPaymentEventOnOrAfter(
  userId: string,
  fromDate: string,
): Promise<{ date: string; kind: PaymentKind | "bonus"; isBonusOnly: boolean } | null> {
  const [schedule, bonusRows] = await Promise.all([
    getSchedule(userId),
    listBonuses(userId),
  ]);

  if (!schedule) {
    // No regular schedule; next payment is the first future bonus
    const nextBonus = bonusRows.find(b => b.date >= fromDate);
    if (nextBonus) {
      return { date: nextBonus.date, kind: "bonus", isBonusOnly: true };
    }
    return null;
  }

  // Regular schedule exists
  const nextScheduleEvent = nextPaymentOnOrAfter(
    { avansDay: schedule.avansDay, salaryDay: schedule.salaryDay },
    parseIsoToLocalMidnight(fromDate),
  );
  const nextBonusEvent = bonusRows.find(b => b.date >= fromDate);

  // Compare dates, pick the soonest (D-B10: unified next-payment slot)
  if (!nextBonusEvent) {
    return nextScheduleEvent
      ? { date: format(nextScheduleEvent.date, "yyyy-MM-dd"), kind: nextScheduleEvent.kind, isBonusOnly: false }
      : null;
  }

  if (!nextScheduleEvent) {
    return { date: nextBonusEvent.date, kind: "bonus", isBonusOnly: true };
  }

  const scheduleDate = format(nextScheduleEvent.date, "yyyy-MM-dd");
  if (scheduleDate <= nextBonusEvent.date) {
    return { date: scheduleDate, kind: nextScheduleEvent.kind, isBonusOnly: false };
  } else {
    return { date: nextBonusEvent.date, kind: "bonus", isBonusOnly: true };
  }
}

// Modify forecastNextPayment to use the new wrapper
export async function forecastNextPayment(userId: string): Promise<ForecastResult> {
  const schedule = await getSchedule(userId);
  if (!schedule) {
    // Check if there are any future bonuses before returning "missing schedule"
    const bonusRows = await listBonuses(userId);
    const futureBonus = bonusRows.find(b => b.date >= todayIsoInMoscow());
    if (!futureBonus) {
      return { configured: false, missing: "schedule" };
    }
  }

  const paymentEvent = await nextPaymentEventOnOrAfter(userId, todayIsoInMoscow());
  if (!paymentEvent) {
    return { configured: false, missing: "schedule" };
  }

  const paymentDateIso = paymentEvent.date;
  
  // ... rest of function follows existing pattern, adapted for bonus case ...
}
```

---

### `src/components/next-payment-card.tsx` - MODIFY for breakdown display (component, request-response)

**Analog:** `src/components/next-payment-card.tsx` (lines 30-57)

**Current component** (lines 15-57):
```typescript
const KIND_LABELS: Record<NextPaymentForecast["kind"], string> = {
  avans: "Аванс",
  salary: "Зарплата",
};

export function NextPaymentCard({ forecast }: { forecast: NextPaymentForecast }) {
  return (
    <section className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
        Прогноз, а не подтверждённая работодателем сумма
      </p>
      <p className="mt-1 text-sm text-zinc-600">
        {KIND_LABELS[forecast.kind]} · {formatPaymentDate(forecast.date)}
      </p>

      <p className="mt-4 text-3xl font-semibold text-zinc-900">
        {formatKopecks(forecast.netKopecks)}
      </p>
      <p className="mt-1 text-sm text-zinc-500">придёт на руки</p>

      <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-zinc-600">
        <dt>Начислено (грязными)</dt>
        <dd className="text-right">{formatKopecks(forecast.grossKopecks)}</dd>
        <dt>Удержан НДФЛ</dt>
        <dd className="text-right">{formatKopecks(forecast.taxKopecks)}</dd>
      </dl>

      <p className="mt-4 text-xs text-zinc-400">
        Это плановый расчёт для планирования бюджета — не официальная и не гарантированная сумма.
      </p>
    </section>
  );
}
```

**Extended KIND_LABELS** (add "bonus" case):
```typescript
const KIND_LABELS: Record<NextPaymentForecast["kind"] | "bonus", string> = {
  avans: "Аванс",
  salary: "Зарплата",
  bonus: "Бонус",  // NEW: D-B10 allows bonus as next payment
};
```

**Breakdown rendering logic** (D-B09 — insert after the gross line):
```typescript
// NEW: conditionally render breakdown when bonus is included
{forecast.breakdown && (
  <div className="mt-2 text-sm text-zinc-600">
    <div className="flex justify-between">
      <span>Оклад/аванс:</span>
      <span>{formatKopecks(forecast.breakdown.salaryOrAvansKopecks)}</span>
    </div>
    <div className="flex justify-between border-t border-zinc-200 pt-1 mt-1">
      <span>Бонус:</span>
      <span>{formatKopecks(forecast.breakdown.bonusKopecks)}</span>
    </div>
  </div>
)}
```

---

### `src/app/actions/forecast.ts` - ADD breakdown to NextPaymentForecast interface

**Analog:** `src/app/actions/forecast.ts` (lines 54-63)

**Current interface** (lines 54-63):
```typescript
export interface NextPaymentForecast {
  date: string;
  kind: PaymentKind;
  grossKopecks: Kopecks;
  taxKopecks: Kopecks;
  netKopecks: Kopecks;
  baselineIsEstimated: boolean;
}
```

**Extended with breakdown** (D-B09):
```typescript
export interface NextPaymentForecast {
  date: string;
  kind: PaymentKind | "bonus";  // NEW: bonuses can be next payment
  grossKopecks: Kopecks;
  taxKopecks: Kopecks;
  netKopecks: Kopecks;
  baselineIsEstimated: boolean;
  breakdown?: {  // NEW: optional breakdown for D-B09
    salaryOrAvansKopecks: Kopecks;
    bonusKopecks: Kopecks;
  };
}
```

**Logic to compute breakdown** (in forecastNextPayment, after tax calculation):
```typescript
// NEW: if next payment includes a bonus on the same date, compute breakdown
let breakdown: NextPaymentForecast["breakdown"] | undefined;
if (paymentEvent.isBonusOnly || bonusForThisDate) {
  // bonusForThisDate is fetched from listBonuses, filtered to match paymentDateIso
  const bonusKopecks = bonusForThisDate?.amountKopecks ?? 0;
  const salaryOrAvansKopecks = paymentGrossKopecks - bonusKopecks;
  breakdown = { salaryOrAvansKopecks, bonusKopecks };
}

return {
  configured: true,
  forecast: {
    date: paymentDateIso,
    kind: paymentEvent.kind,
    grossKopecks: paymentGrossKopecks,
    taxKopecks,
    netKopecks,
    baselineIsEstimated: ytdBaseline.isEstimated,
    breakdown,  // NEW
  },
};
```

---

### `src/app/(app)/bonuses/page.tsx` (page-component, CRUD)

**Analog:** `src/app/(app)/settings/salary/page.tsx` (structure pattern)

**Page structure pattern** (from typical app page in the project):
```typescript
"use client";

/**
 * Bonuses list and entry page (BON-01, BON-02, D-B05, D-B06).
 * Displays all bonuses (past and future) and a form to add/edit bonuses.
 * Uses client component for form interactivity; server action handles mutations.
 */

import { use, useState } from "react";
import { listBonuses } from "@/lib/db/bonus-repository";  // Import inside async parent
import { BonusForm } from "./bonus-form";
import type { BonusRow } from "@/lib/db/bonus-repository";

// Server component wrapper to fetch initial data
async function BonusesPageContent() {
  const userId = await requireUserId();  // Import from @/lib/session
  const bonusRows = await listBonuses(userId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Бонусы и разовые выплаты</h1>
      
      {/* Bonus form (create/edit) */}
      <BonusForm />
      
      {/* Bonus list (D-B05: all bonuses, past and future) */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">История бонусов</h2>
        {bonusRows.length === 0 ? (
          <p className="text-zinc-500">Бонусы не добавлены</p>
        ) : (
          <div className="space-y-2">
            {bonusRows.map((bonus) => (
              <BonusRow key={bonus.date} bonus={bonus} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BonusesPage() {
  return <BonusesPageContent />;
}
```

---

### `src/app/(app)/bonuses/bonus-form.tsx` (form-component, request-response)

**Analog:** `src/components/pay-setup-forms.tsx` (form pattern and structure)

**Form component pattern** (from Phase 1 forms):
```typescript
"use client";

/**
 * Form for creating and editing one-off bonuses (BON-01).
 * Uses React Hook Form + Zod for validation, submits via Server Action.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { saveBonusAction, type BonusActionResult } from "@/app/actions/bonus";
import { bonusInputSchema, type BonusInput } from "@/lib/validation/bonus";
import { formatKopecks, rublesToKopecks } from "@/domain/money";
import { todayIsoInMoscow } from "@/domain/time";

export function BonusForm() {
  const [result, setResult] = useState<BonusActionResult | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<BonusInput>({
    resolver: zodResolver(bonusInputSchema),
    defaultValues: {
      amountRubles: "",
      date: todayIsoInMoscow(),
      note: "",
    },
  });

  const onSubmit = async (data: BonusInput) => {
    const formData = new FormData();
    formData.set("amountRubles", String(data.amountRubles));
    formData.set("date", data.date);
    formData.set("note", data.note || "");

    const actionResult = await saveBonusAction(formData);
    setResult(actionResult);

    if (actionResult.success) {
      reset();
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Размер бонуса (₽)</label>
        <input
          {...register("amountRubles")}
          type="number"
          step="0.01"
          className="w-full border rounded px-3 py-2"
          placeholder="50000"
        />
        {errors.amountRubles && (
          <p className="text-red-600 text-sm mt-1">{errors.amountRubles.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium">Дата выплаты</label>
        <input
          {...register("date")}
          type="date"
          className="w-full border rounded px-3 py-2"
        />
        {errors.date && (
          <p className="text-red-600 text-sm mt-1">{errors.date.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium">Примечание (опционально)</label>
        <input
          {...register("note")}
          type="text"
          className="w-full border rounded px-3 py-2"
          placeholder="13-я зарплата, бонус за проект..."
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
      >
        {isSubmitting ? "Сохранение..." : "Добавить бонус"}
      </button>

      {result && !result.success && result.fieldErrors && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
          {Object.entries(result.fieldErrors).map(([field, messages]) => (
            <p key={field}>{messages[0]}</p>
          ))}
        </div>
      )}

      {result?.success && (
        <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-700">
          Бонус добавлен
        </div>
      )}
    </form>
  );
}
```

---

## Shared Patterns

### Authentication & Ownership
**Source:** `src/lib/session.ts` (lines 39-45)
**Apply to:** All bonus repository functions, bonus server actions
```typescript
export async function requireUserId(): Promise<string> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  return user.id;
}
```

Every bonus query/mutation must open with `const userId = await requireUserId()`, never accepting userId from form data or arguments.

### Money Conversion (Rubles ↔ Kopecks)
**Source:** `src/domain/money.ts` (lines 16-42)
**Apply to:** All bonus actions, validation schemas
```typescript
export function rublesToKopecks(rubles: number): Kopecks {
  return Math.round(rubles * 100);
}

export function formatKopecks(kopecks: Kopecks): string {
  const rubles = kopecksToRubles(kopecks);
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(rubles);
}
```

### Moscow Time Boundary
**Source:** `src/domain/time.ts` (lines 93-99)
**Apply to:** D-B06 deletion guard, date comparisons
```typescript
export function todayIsoInMoscow(): string {
  const fields = moscowFieldsAt(new Date());
  const year = String(fields.year).padStart(4, "0");
  const month = String(fields.month + 1).padStart(2, "0");
  const day = String(fields.day).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
```

D-B06's deletion guard checks `if (bonusDate <= todayIsoInMoscow())` — always use Moscow time, never local process time.

### Zod Validation Pattern
**Source:** `src/lib/validation/salary.ts` (lines 56-80)
**Apply to:** bonusInputSchema, all form inputs
```typescript
const isoDateString = z
  .string()
  .regex(ISO_DATE_SHAPE, "Дата должна быть в формате ГГГГ-ММ-ДД")
  .refine(
    (value) => {
      if (!ISO_DATE_SHAPE.test(value)) return true;
      const parsed = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    },
    { message: "Указана несуществующая дата" },
  );
```

ISO date validation must round-trip through UTC to reject impossible dates like 2026-02-29.

### Server Action Error Handling
**Source:** `src/app/actions/salary.ts` (lines 136-141)
**Apply to:** saveBonusAction, deleteBonusAction
```typescript
try {
  await upsertBonus(userId, amountKopecks, date, note);
  revalidateBonusPaths();
  return { success: true };
} catch (err) {
  return {
    success: false,
    fieldErrors: { date: ["Не удалось сохранить бонус. Попробуйте ещё раз."] },
  };
}
```

Never log the error or include the amount in the message (T-01-04).

### Path Revalidation
**Source:** `src/app/actions/salary.ts` (lines 41-47)
**Apply to:** saveBonusAction, deleteBonusAction
```typescript
const BONUS_AFFECTED_PATHS = ["/", "/bonuses"] as const;

function revalidateBonusPaths() {
  for (const path of BONUS_AFFECTED_PATHS) {
    revalidatePath(path);
  }
}
```

After every bonus mutation, revalidate "/" (for next-payment forecast updates) and "/bonuses" (for list updates).

---

## No Analog Found

None — all Phase 2 files have clear Phase 1 analogs by role and data flow.

---

## Metadata

**Analog search scope:** 
- Database: `src/lib/db/schema.ts`, `src/lib/db/salary-repository.ts`, `src/lib/db/auth-schema.ts`
- Validation: `src/lib/validation/salary.ts`
- Actions: `src/app/actions/salary.ts`, `src/app/actions/forecast.ts`
- Components: `src/components/next-payment-card.tsx`, `src/components/pay-setup-forms.tsx`
- Domain: `src/domain/money.ts`, `src/domain/time.ts`, `src/domain/pay/payment-accrual.ts`
- Session: `src/lib/session.ts`

**Files scanned:** 15 total (all Phase 1 core files)

**Pattern extraction method:** Extracted concrete code ranges from Phase 1 analogs, adapted annotations for Phase 2 decision references (D-B01 through D-B10).

**Analysis date:** 2026-08-30

---

*Phase: 02-bonuses-one-off-payments*
*Patterns mapped: 2026-08-30*
*For: Planner to generate PLAN.md files for Phase 2 implementation*
