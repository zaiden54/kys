# Phase 3: Vacation Pay - Pattern Map

**Mapped:** 2026-08-30
**Files analyzed:** 13 new/modified files
**Analogs found:** 12 / 13 (one new pattern per domain)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/domain/vacation/calculate-average-daily-earnings.ts` | utility (pure function) | transform | `src/domain/tax/calculate-ndfl.ts` | exact |
| `src/domain/vacation/vacation-types.ts` | utility (types) | N/A | scattered type files | N/A |
| `src/lib/validation/vacation.ts` | utility (validation schema) | request-response | `src/lib/validation/bonus.ts` | exact |
| `src/lib/db/schema.ts` (amended) | config (database schema) | N/A | existing schema | N/A |
| `src/lib/db/vacation-repository.ts` | service (data access) | CRUD | `src/lib/db/bonus-repository.ts` | exact |
| `src/app/actions/vacation.ts` | controller (Server Action) | request-response | `src/app/actions/bonus.ts` | exact |
| `src/app/(app)/vacations/page.tsx` | component (list page) | request-response | `src/app/(app)/bonuses/page.tsx` | exact |
| `src/app/(app)/vacations/vacation-row.tsx` | component (form/row) | request-response | `src/app/(app)/bonuses/bonus-row.tsx` | exact |
| `src/app/actions/forecast.ts` (amended) | controller (Server Action) | request-response | existing | N/A |
| `src/app/(app)/page.tsx` (amended) | component (home) | request-response | existing | N/A |
| `src/domain/vacation/calculate-average-daily-earnings.test.ts` | test (unit) | N/A | `src/domain/tax/calculate-ndfl.test.ts` | exact |
| `src/lib/validation/vacation.test.ts` | test (unit) | N/A | `src/lib/validation/bonus.test.ts` | exact |
| `src/lib/db/vacation-repository.test.ts` | test (integration) | N/A | `src/lib/db/bonus-repository.test.ts` | exact |

## Pattern Assignments

### `src/lib/validation/vacation.ts` (utility, validation schema)

**Analog:** `src/lib/validation/bonus.ts` (lines 1-32)

**Imports pattern** (lines 1-3):
```typescript
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { bonuses } from "@/lib/db/schema";
```

**Date validation helper pattern** (lines 8-14):
```typescript
const ISO_DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;
const isoDateString = z.string()
  .regex(ISO_DATE_SHAPE, "Дата должна быть в формате ГГГГ-ММ-ДД")
  .refine((value) => {
    if (!ISO_DATE_SHAPE.test(value)) return true;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, { message: "Указана несуществующая дата" });
```

**Input schema pattern** (lines 16-30):
```typescript
export const bonusInputSchema = z.object({
  id: z.string().uuid("Некорректный идентификатор бонуса").optional(),
  amountRubles: z.coerce.number({ error: "Бонус должен быть числом" })
    .gt(0, "Бонус должен быть больше нуля")
    .max(MAX_RUBLES, "Бонус превышает допустимый максимум")
    .refine((value) => Math.round(value * 100) > 0, {
      message: "Бонус должен быть не меньше одной копейки",
    })
    .refine((value) => Number.isInteger(Math.round(value * 100_000_000) / 1_000_000), {
      message: "Укажите сумму с точностью не более двух знаков после запятой",
    }),
  date: isoDateString,
  note: z.string().max(500, "Заметка слишком длинная (максимум 500 символов)")
    .optional().default(""),
});
```

**Export pattern** (line 32):
```typescript
export type BonusInput = z.infer<typeof bonusInputSchema>;
```

**For vacation, adapt:**
- Replace `amountRubles` with `startDate` and `endDate` (both `isoDateString`)
- Add `.refine()` predicate to ensure `endDate >= startDate`
- Add optional `note` field
- Change the type export to `VacationInput`
- No `type: 'premium' | 'compensation'` field in the input schema — that's set in the repository layer per D-V03

---

### `src/lib/db/vacation-repository.ts` (service, CRUD)

**Analog:** `src/lib/db/bonus-repository.ts` (lines 1-68)

**Server-only guard and module doc** (lines 1-5):
```typescript
if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/db/vacation-repository.ts is server-only and must never be imported into a client component.",
  );
}

/** Ownership-scoped vacation persistence. This module deliberately logs no money data. */
```

**Imports pattern** (lines 8-11):
```typescript
import { and, desc, eq, gt } from "drizzle-orm";
import { todayIsoInMoscow } from "@/domain/time";
import { db } from "@/lib/db";
import { bonuses } from "@/lib/db/schema";
```

**Type export pattern** (line 13):
```typescript
export type BonusRow = typeof bonuses.$inferSelect;
```

**Create function pattern** (lines 15-25):
```typescript
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
```

**List function pattern** (lines 27-29):
```typescript
export async function listBonuses(userId: string): Promise<BonusRow[]> {
  return db.select().from(bonuses).where(eq(bonuses.userId, userId)).orderBy(desc(bonuses.date));
}
```

**Update function pattern with ownership scoping** (lines 31-44):
```typescript
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
```

**Delete-if-future pattern (business logic gate)** (lines 46-67):
```typescript
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
```

**For vacation repository, adapt:**
- Replace `amountKopecks` parameters with `startDate`, `endDate` (both ISO strings)
- Add an `checkOverlapVacations(userId, startDate, endDate, idToExclude?)` function for D-V11 overlap validation
- The `deleteBonusIfFuture` pattern becomes `deleteVacationIfFuture` — blocks deletion if computed payment date (startDate − 3 days) has passed per D-V10
- All other CRUD functions (create, list, update) follow the same pattern — no amount conversion needed

---

### `src/app/actions/vacation.ts` (controller, request-response)

**Analog:** `src/app/actions/bonus.ts` (lines 1-77)

**Server-only directive and module doc** (lines 1-3):
```typescript
"use server";

/** Ownership-scoped vacation mutation actions. No submitted values are logged. */
```

**Imports pattern** (lines 4-9):
```typescript
import { revalidatePath } from "next/cache";
import { rublesToKopecks } from "@/domain/money";
import { createBonus, deleteBonusIfFuture, updateBonus } from "@/lib/db/bonus-repository";
import { requireUserId } from "@/lib/session";
import { bonusInputSchema } from "@/lib/validation/bonus";
import { z } from "zod";
```

**Action result type pattern** (lines 11-13):
```typescript
export type BonusActionResult =
  | { success: true }
  | { success: false; fieldErrors: Record<string, string[]> };
```

**Path revalidation pattern** (lines 15-18):
```typescript
function revalidateBonusPaths() {
  revalidatePath("/");
  revalidatePath("/bonuses");
}
```

**Save action pattern with Zod validation** (lines 20-49):
```typescript
export async function saveBonusAction(formData: FormData): Promise<BonusActionResult> {
  const userId = await requireUserId();
  const parsed = bonusInputSchema.safeParse({
    id: formData.get("id") || undefined,
    amountRubles: formData.get("amountRubles"),
    date: formData.get("date"),
    note: formData.get("note"),
  });
  if (!parsed.success) return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    const amountKopecks = rublesToKopecks(parsed.data.amountRubles);
    if (parsed.data.id) {
      const updated = await updateBonus(
        userId, parsed.data.id, amountKopecks, parsed.data.date, parsed.data.note,
      );
      if (!updated) {
        return { success: false, fieldErrors: { amountRubles: ["Бонус не найден"] } };
      }
    } else {
      await createBonus(userId, amountKopecks, parsed.data.date, parsed.data.note);
    }
  } catch {
    return {
      success: false,
      fieldErrors: { amountRubles: ["Не удалось сохранить бонус. Попробуйте ещё раз."] },
    };
  }
  revalidateBonusPaths();
  return { success: true };
}
```

**Delete action pattern** (lines 51-76):
```typescript
export async function deleteBonusAction(bonusId: string): Promise<BonusActionResult> {
  const userId = await requireUserId();
  const parsed = z.string().uuid().safeParse(bonusId);
  if (!parsed.success) {
    return { success: false, fieldErrors: { date: ["Бонус не найден"] } };
  }
  try {
    const result = await deleteBonusIfFuture(userId, parsed.data);
    if (result.status === "blocked") {
      return {
        success: false,
        fieldErrors: { date: ["Нельзя удалять бонусы из прошлого. Вы можете изменить сумму."] },
      };
    }
    if (result.status === "not-found") {
      return { success: false, fieldErrors: { date: ["Бонус не найден"] } };
    }
  } catch {
    return {
      success: false,
      fieldErrors: { date: ["Не удалось удалить бонус. Попробуйте ещё раз."] },
    };
  }
  revalidateBonusPaths();
  return { success: true };
}
```

**For vacation actions, adapt:**
- Parse `startDate` and `endDate` from FormData (not `amountRubles`)
- Call `checkOverlapVacations` before save to enforce D-V11
- Revalidate paths: `"/"` and `"/vacations"`
- Error messages in Russian, following the project convention
- No money conversion needed (dates, not amounts)

---

### `src/app/(app)/bonuses/page.tsx` (component, list page)

**Analog:** `src/app/(app)/bonuses/page.tsx` (lines 1-32)

**Server-side data fetch and page structure** (lines 1-32):
```typescript
import { BonusForm } from "./bonus-form";
import { BonusRow } from "./bonus-row";
import { listBonuses } from "@/lib/db/bonus-repository";
import { requireUserId } from "@/lib/session";

export default async function BonusesPage() {
  const userId = await requireUserId();
  const rows = await listBonuses(userId);
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-12">
      <h1 className="text-2xl font-semibold">Бонусы и разовые выплаты</h1>
      <div id="bonus-form"><BonusForm /></div>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">История бонусов</h2>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 p-6 text-center">
            <h3 className="font-semibold">Нет бонусов</h3>
            <p className="text-sm text-zinc-600">Добавьте разовый бонус или компенсацию, привязав его к дате выплаты. Сумма будет включена в расчёт налога.</p>
            <a href="#bonus-form" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white">Добавить бонус</a>
          </div>
        ) : (
          <div>
            <div className="hidden grid-cols-[6rem_7rem_minmax(0,1fr)_auto] gap-3 border-b border-zinc-200 pb-2 text-xs font-medium text-zinc-500 sm:grid">
              <span>Дата</span><span>Сумма</span><span>Заметка</span><span>Действия</span>
            </div>
            <ul>{rows.map((row) => <BonusRow key={row.id} bonus={row} />)}</ul>
          </div>
        )}
      </section>
    </div>
  );
}
```

**For vacation page, adapt:**
- Import `VacationForm` and `VacationRow` instead of bonus equivalents
- Import `listVacations` from `vacation-repository`
- Change page title to "Отпуска" (Vacations)
- Change form section id to `vacation-form`
- Change empty state text to vacation-appropriate message
- Update table headers to: "Начало отпуска", "Конец отпуска", "Дней", "Действия" (or similar)
- The overall structure and styling remain identical

---

### `src/app/(app)/bonuses/bonus-row.tsx` (component, form/row)

**Analog:** `src/app/(app)/bonuses/bonus-row.tsx` (lines 1-115)

**Client component directive and imports** (lines 1-9):
```typescript
"use client";

import { useRef, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { deleteBonusAction, saveBonusAction } from "@/app/actions/bonus";
import { formatKopecks, kopecksToRubles } from "@/domain/money";
import type { BonusRow as BonusRowData } from "@/lib/db/bonus-repository";
import { bonusInputSchema, type BonusInput } from "@/lib/validation/bonus";
```

**Conversion helper functions** (lines 11-26):
```typescript
function toDefaults(bonus: BonusRowData): BonusInput {
  return {
    id: bonus.id, amountRubles: kopecksToRubles(bonus.amountKopecks),
    date: bonus.date, note: bonus.note ?? "",
  };
}

function formatPaymentDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
```

**React Hook Form setup with `values` + `reset()` pattern (D-V10 from PROJECT.md Key Decisions)** (lines 28-42):
```typescript
export function BonusRow({ bonus }: { bonus: BonusRowData }) {
  const [mode, setMode] = useState<"display" | "editing">("display");
  const [pending, setPending] = useState(false);
  const [error, setErrorMessage] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } =
    useForm<BonusInput>({
      resolver: zodResolver(bonusInputSchema) as Resolver<BonusInput>,
      values: toDefaults(bonus),  // <-- CRITICAL: values + reset pattern to prevent stale-data bugs (CR-01)
      resetOptions: { keepDirtyValues: true },
    });
  // Guards onEdit's async continuation against a superseded edit session:
  // bumped on every submit and on Cancel, so a stale in-flight save that
  // resolves after the user has moved on (cancelled + reopened, or
  // resubmitted) no-ops instead of clobbering the newer session.
  const editSessionRef = useRef(0);
```

**Edit submission handler with session guard** (lines 44-67):
```typescript
  async function onEdit(values: BonusInput) {
    const session = ++editSessionRef.current;
    setErrorMessage(null);
    try {
      const data = new FormData();
      data.set("id", bonus.id); data.set("amountRubles", String(values.amountRubles));
      data.set("date", values.date); data.set("note", values.note);
      const result = await saveBonusAction(data);
      if (editSessionRef.current !== session) return; // superseded — do nothing
      if (result.success) {
        setMode("display");
        reset(values, { keepDirtyValues: false });
        return;
      }
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        if ((field === "amountRubles" || field === "date" || field === "note") && messages?.[0]) {
          setError(field, { message: messages.join(" ") });
        }
      }
    } catch {
      if (editSessionRef.current !== session) return; // superseded — do nothing
      setErrorMessage("Не удалось сохранить бонус. Попробуйте ещё раз.");
    }
  }
```

**Delete handler with confirmation** (lines 69-78):
```typescript
  async function onDelete() {
    if (!window.confirm(`Удалить бонус на сумму ${formatKopecks(bonus.amountKopecks)} от ${formatPaymentDate(bonus.date)}?`)) return;
    setPending(true); setErrorMessage(null);
    try {
      const result = await deleteBonusAction(bonus.id);
      if (!result.success) setErrorMessage(Object.values(result.fieldErrors).flat().join(" "));
    } catch {
      setErrorMessage("Не удалось удалить бонус. Попробуйте ещё раз.");
    } finally { setPending(false); }
  }
```

**Form UI and display modes** (lines 80-115): [truncated — follows standard React Hook Form + Tailwind pattern, no special logic specific to bonuses]

**For vacation row, adapt:**
- `toDefaults` converts `startDate` and `endDate` (no amount conversion needed)
- Form fields: `startDate` (date input) and `endDate` (date input) instead of `amountRubles` and `date`
- Delete confirmation message: `Удалить отпуск с ${formatDateRange(startDate, endDate)}?`
- Error field names in the error-field-name filter: `startDate`, `endDate`
- Grid layout and labels adjusted for the two-date structure
- The edit-session guard and `values`/`reset()` pattern stay identical

---

### `src/domain/vacation/calculate-average-daily-earnings.ts` (utility, pure function)

**Analog:** `src/domain/tax/calculate-ndfl.ts` (lines 1-92)

**Module docstring and import structure** (lines 1-23):
```typescript
/**
 * Pure cumulative marginal НДФЛ (personal income tax) calculation.
 *
 * [... detailed documentation ...]
 *
 * This module must import nothing from `@/lib`, `next`, or any I/O
 * surface. Its only permitted imports are `./ndfl-brackets` and `../money`.
 */

import type { Kopecks } from "../money";
import { bracketsForYear } from "./ndfl-brackets";
```

**Helper function structure** (lines 32-62):
```typescript
export function roundToRuble(kopecks: Kopecks): Kopecks {
  return Math.floor((kopecks + 50) / 100) * 100;
}

export function taxOnCumulative(cumulativeKopecks: Kopecks, taxYear: number): Kopecks {
  const brackets = bracketsForYear(taxYear);
  let bracket = brackets[0];
  for (const candidate of brackets) {
    if (cumulativeKopecks >= candidate.fromKopecks) {
      bracket = candidate;
    } else {
      break;
    }
  }
  // ... calculation ...
  return roundToRuble(rawTaxKopecks);
}
```

**Core public function with result interface** (lines 64-91):
```typescript
/** Result of taxing a single payment against its preceding cumulative income. */
export interface NdflResult {
  /** Tax withheld on this payment: `taxOnCumulative(after) - taxOnCumulative(before)`. */
  taxKopecks: Kopecks;
  /** Take-home amount for this payment: `paymentGrossKopecks - taxKopecks`. */
  netKopecks: Kopecks;
  /** Cumulative income after this payment: `cumulativeBeforeKopecks + paymentGrossKopecks`. */
  cumulativeAfterKopecks: Kopecks;
}

export function calculateNdfl(
  cumulativeBeforeKopecks: Kopecks,
  paymentGrossKopecks: Kopecks,
  taxYear: number,
): NdflResult {
  const cumulativeAfterKopecks = cumulativeBeforeKopecks + paymentGrossKopecks;
  const taxKopecks =
    taxOnCumulative(cumulativeAfterKopecks, taxYear) - taxOnCumulative(cumulativeBeforeKopecks, taxYear);
  const netKopecks = paymentGrossKopecks - taxKopecks;

  return { taxKopecks, netKopecks, cumulativeAfterKopecks };
}
```

**For vacation function, follow this pattern:**
- Module docstring with detailed explanation of ст.139 ТК РФ formula, including salary-change proration
- Pure function, no I/O, no database access — import only `date-fns` helpers and type definitions
- Helper functions: `calculateSalaryInMonth(monthStart, monthEnd, salaryRows)`, etc.
- Result type: `export interface AverageDailyEarningsResult { averageDailyKopecks: Kopecks; monthCount: number; }`
- Main export: `export function calculateAverageDailyEarnings(...): Kopecks`
- All internal calculations in kopecks (integer, never floating-point)
- Heavy unit testing with salary-change scenarios, under-12-months tenure, bonus filtering

---

### `src/domain/vacation/calculate-average-daily-earnings.test.ts` (test, unit)

**Analog:** `src/domain/tax/calculate-ndfl.test.ts` (lines 1-80)

**Test framework setup and imports** (lines 1-5):
```typescript
import { describe, expect, it } from "vitest";
import { roundToRuble, taxOnCumulative, calculateNdfl } from "./calculate-ndfl";
import { bracketsForYear, UnsupportedTaxYearError } from "./ndfl-brackets";

const YEAR = 2025;
```

**Describe block with it.each and edge cases** (lines 7-23):
```typescript
describe("roundToRuble", () => {
  it("drops fractional kopecks under 50", () => {
    expect(roundToRuble(12_345)).toBe(12_300);
  });

  it("rounds up on exactly 50 kopecks", () => {
    expect(roundToRuble(12_350)).toBe(12_400);
  });

  it("rounds up when fractional kopecks exceed 50", () => {
    expect(roundToRuble(12_399)).toBe(12_400);
  });

  it("returns 0 for 0", () => {
    expect(roundToRuble(0)).toBe(0);
  });
});
```

**Complex scenario testing with worked examples** (lines 59-81):
```typescript
describe("calculateNdfl", () => {
  it("splits a payment straddling the 2,400,000 threshold marginally (13%/15%), not at a single flat rate", () => {
    const result = calculateNdfl(2_350_000_00, 100_000_00, YEAR);
    expect(result.taxKopecks).toBe(14_000_00);
    expect(result.netKopecks).toBe(86_000_00);
    // A flat-13% implementation would (incorrectly) compute 13_000_00 — must not match.
    expect(result.taxKopecks).not.toBe(13_000_00);
  });

  it("matches the plan's acceptance-criteria worked example exactly", () => {
    const result = calculateNdfl(235_000_000, 10_000_000, YEAR);
    expect(result.taxKopecks).toBe(1_400_000);
  });
```

**For vacation test, follow this pattern:**
- `describe("calculateAverageDailyEarnings", () => { ... })`
- Test scenarios per RESEARCH.md "Wave 0 Gaps" section:
  - Constant salary over 12 months
  - Salary increase mid-period with proration
  - Salary decrease mid-period
  - Under-12-months tenure (new user)
  - Premium vs. compensation bonus distinction
  - Edge case: vacation on exact anniversary of hire date
- Use `it.each([...])` for parametric tests with multiple input combinations
- Assert both the average daily rate and the month count
- Include a comment block with expected worked example if there's a standard case to verify

---

### `src/lib/validation/vacation.test.ts` (test, unit)

**Analog:** `src/lib/validation/bonus.test.ts` (lines 1-45)

**Test framework and schema import** (lines 1-3):
```typescript
import { describe, expect, it } from "vitest";
import { bonusInputSchema } from "@/lib/validation/bonus";

describe("bonusInputSchema", () => {
```

**Parametric date validation test** (lines 5-17):
```typescript
  it.each([0, -1])("rejects a non-positive amount: %s", (amountRubles) => {
    expect(bonusInputSchema.safeParse({ amountRubles, date: "2026-01-01" }).success).toBe(false);
  });

  it("rejects an impossible calendar date", () => {
    const result = bonusInputSchema.safeParse({ amountRubles: 1, date: "2026-02-30" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe("Указана несуществующая дата");
  });
```

**Default value test** (lines 19-22):
```typescript
  it("accepts a past date and defaults the note to an empty string", () => {
    const result = bonusInputSchema.parse({ amountRubles: 1, date: "2020-01-01" });
    expect(result.note).toBe("");
  });
```

**For vacation test, follow this pattern:**
- Test the date range: `endDate >= startDate` passes, `endDate < startDate` fails
- Test invalid date formats: `"2026-13-01"` (month 13), `"2026-02-30"` (Feb 30), `"invalid"` all fail
- Test that past dates are accepted (per D-V10, editing is always allowed)
- Test optional `note` field defaults to empty string
- Use `safeParse` for error assertions, `parse` for happy-path assertions
- No overlapping validation here — that happens in the Server Action + repository layer per the research

---

### `src/app/actions/forecast.ts` (controller, request-response amendment)

**Existing function to extend** (lines 76-84):
```typescript
export function selectNextPaymentEvent(
  scheduleEvent: { dateIso: string; kind: PaymentKind } | null,
  futureBonusDatesAscending: readonly string[],
): { dateIso: string; kind: PaymentKind | "bonus" } | null {
  const bonusDate = futureBonusDatesAscending[0];
  if (!scheduleEvent) return bonusDate ? { dateIso: bonusDate, kind: "bonus" } : null;
  if (!bonusDate || scheduleEvent.dateIso <= bonusDate) return scheduleEvent;
  return { dateIso: bonusDate, kind: "bonus" };
}
```

**Amendment pattern (new signature):**
```typescript
export function selectNextPaymentEvent(
  scheduleEvent: { dateIso: string; kind: PaymentKind } | null,
  futureBonusDatesAscending: readonly string[],
  futureVacationPaymentDatesAscending: readonly { dateIso: string; vacationId: string }[] = [],  // NEW parameter
): { dateIso: string; kind: PaymentKind | "bonus" | "vacation"; vacationId?: string } | null {
  const candidates: Array<{ dateIso: string; kind: PaymentKind | "bonus" | "vacation"; vacationId?: string }> = [];
  
  if (scheduleEvent) candidates.push({ dateIso: scheduleEvent.dateIso, kind: scheduleEvent.kind });
  if (futureBonusDatesAscending[0]) candidates.push({ dateIso: futureBonusDatesAscending[0], kind: "bonus" });
  if (futureVacationPaymentDatesAscending[0]) {
    candidates.push({
      dateIso: futureVacationPaymentDatesAscending[0].dateIso,
      kind: "vacation",
      vacationId: futureVacationPaymentDatesAscending[0].vacationId,
    });
  }

  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => a.dateIso.localeCompare(b.dateIso))[0];
}
```

**In `forecastNextPayment`, add vacation loading and resolution:**
- Load vacations: `listVacations(userId)` → `Promise.all([...existing..., listVacations(...)])`
- Compute vacation payment dates: for each future vacation, `paymentDate = startDate − 3 days`, apply `resolvePaymentDate` shift
- Pass to `selectNextPaymentEvent` as the new third argument
- Extend the result type and return value to include `vacationId` if `kind === "vacation"`

---

## Shared Patterns

### Authentication & Ownership Scoping
**Source:** `src/lib/db/bonus-repository.ts` (lines 1-5, 31-44)
**Apply to:** All repository functions, Server Actions
```typescript
// In repository functions:
// ALWAYS include ownership predicate in every query
.where(and(eq(bonuses.id, bonusId), eq(bonuses.userId, userId)))

// In Server Actions:
const userId = await requireUserId();  // First line
// then pass userId to all repository calls
```

### Zod Schema Revalidation at Server Action Boundary
**Source:** `src/app/actions/bonus.ts` (lines 20-28)
**Apply to:** All Server Actions
```typescript
const parsed = bonusInputSchema.safeParse({
  id: formData.get("id") || undefined,
  amountRubles: formData.get("amountRubles"),
  // ... all fields ...
});
if (!parsed.success) return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
```

### React Hook Form `values` + `reset()` Pattern (CR-01 prevention)
**Source:** `src/app/(app)/bonuses/bonus-row.tsx` (lines 32-37)
**Apply to:** All client edit forms
```typescript
const { register, handleSubmit, reset, ... } = useForm({
  resolver: zodResolver(schema),
  values: toDefaults(existingRow),  // <-- CRITICAL: pass prop values here
  resetOptions: { keepDirtyValues: true },
});

// On successful submit:
reset(values, { keepDirtyValues: false });

// On cancel:
reset(toDefaults(bonus), { keepDirtyValues: false });
```

### Pure Domain Functions
**Source:** `src/domain/tax/calculate-ndfl.ts` (line 19)
**Apply to:** All new domain logic (vacation calculations)
```typescript
// NEVER import from @/lib, next, or React
// ONLY import from date-fns, ../money, and sibling domain modules
// No I/O, no logging, no side effects
// All amounts in kopecks (integers), never rubles (floating-point)
```

### ISO Date Strings (YYYY-MM-DD)
**Source:** `src/lib/validation/bonus.ts` (lines 8-14), `src/lib/db/salary-repository.ts` (line 30)
**Apply to:** All date parameters and database columns
```typescript
// Always use ISO string format "YYYY-MM-DD" for dates
// Never use Date objects in database columns or form transmission
// Validate format with regex: /^\d{4}-\d{2}-\d{2}$/
// Parse with: new Date(`${value}T00:00:00.000Z`) for validation only
```

### Error Handling at Repository Layer
**Source:** `src/lib/db/bonus-repository.ts` (lines 20-24)
**Apply to:** All repository functions
```typescript
const inserted = await db.insert(bonuses).values({ ... }).returning();
const row = inserted[0];
if (!row) throw new Error("createBonus: insert into bonuses returned no row");
return row;
```

### Server-Only Modules
**Source:** `src/lib/db/bonus-repository.ts` (lines 1-5)
**Apply to:** All repository, Server Action, and domain modules that touch data
```typescript
if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/db/vacation-repository.ts is server-only and must never be imported into a client component.",
  );
}
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/domain/vacation/vacation-types.ts` | utility (types) | N/A | New type definitions file — analogous files scattered (e.g., resolve-payment-date.ts defines `PaymentKind`, `PaymentSchedule` inline). Can follow the same inline pattern or extract to a separate file per project preference. |

## Metadata

**Analog search scope:** `/home/zaiden/code/kys/src/` — all source files
**Files scanned:** ~50 TypeScript files (domain, lib, app)
**Pattern extraction method:** Direct read of analog files + concrete line-number excerpts
**Pattern extraction date:** 2026-08-30

---

**Ready for Planning Phase 3**

All new files have identified analogs and concrete code patterns to copy from. Planner can now reference specific line numbers and code excerpts when drafting the implementation tasks.

Key pattern dependencies to note in the plan:
1. **Vacation repository must come before Server Actions** — actions import repository functions
2. **Validation schema must come before Server Actions** — actions import and use the schema
3. **Domain function must come before forecast amendments** — forecast will call vacation calculation
4. **Database schema amendment must come first** — all repository/schema-dependent files depend on it
