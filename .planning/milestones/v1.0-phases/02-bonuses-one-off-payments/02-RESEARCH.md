# Phase 2: Bonuses & One-off Payments - Research

**Researched:** 2026-08-30
**Domain:** Bonus/one-off payment data modeling and tax engine integration
**Confidence:** HIGH

## Summary

Phase 2 extends the cumulative НДФЛ engine from Phase 1 to handle one-off bonuses and compensations attached to arbitrary dates. The tax calculation path is unchanged — bonuses integrate as additional dated income events into the same cumulative chain. The major architectural change is unifying the "next payment" resolution logic to consider both scheduled (avans/salary) and bonus-only payment dates, then displaying a breakdown when a bonus affects the next payment.

**Primary recommendation:** Store bonuses in a new `bonuses` table with a (user_id, date) unique index. Extend `getCumulativeIncomeBeforeDate` to fold bonus income alongside schedule-derived income. Modify `forecast.ts`'s next-payment resolution to consider bonus dates, selecting whichever event comes soonest. No changes to `calculateNdfl` itself — bonuses tax identically to regular salary.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-B01**: Bonuses can be attached to ANY date, not restricted to existing avans/salary schedule dates. If the date doesn't match the regular schedule, the bonus creates a standalone payment event.
- **D-B02**: Backdating is allowed — bonuses can be entered with effective dates in the past.
- **D-B03**: Multiple bonuses on the same date are summed and taxed together as a single increment to cumulative YTD income.
- **D-B04**: Bonuses can be fully edited at any time, including those whose payment date is in the past — editing recomputes cumulative income and re-taxes every later payment forward.
- **D-B05**: A full list/history of all bonuses (past and future) is shown to the user, not just those affecting the next payment.
- **D-B06**: Deletion of a bonus whose payment date is already in the past is forbidden — only current/future bonuses can be deleted. Editing a past bonus is allowed (a correction), but deletion erases a historical event.
- **D-B07**: No category/type selection — one universal "one-off payment" type. All types are taxed identically.
- **D-B08**: An optional free-text note field is included (e.g., "13-я зарплата", "бонус за проект") for user reference only — not used in tax calculation.
- **D-B09**: When a bonus lands on the next payment, the home screen shows a breakdown (base salary + bonus shown separately) so the user isn't surprised by an unexpectedly large number.
- **D-B10**: The "next payment" concept is unified: whichever payment event (regular avans/salary OR a standalone bonus-only date) is soonest becomes "the next payment" shown on the home screen. There is no separate "next bonus" block.

### Claude's Discretion
None — all decisions are locked.

### Deferred Ideas (OUT OF SCOPE)
- Bonus type/category with possible tax-exempt categories — v1 uses universal taxed-uniformly type.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bonus CRUD (create, read, edit, delete) | API / Backend | Database | Server Actions + repository pattern; all tax-impacting mutations must be server-only |
| Bonus display list | Browser / Client | Frontend Server (SSR) | Read-only list can be rendered as client component or server component; SSR for initial page load, client hydration for subsequent interactions |
| Bonus input form | Browser / Client | Frontend Server (SSR) | Form submission via Server Action; client-side validation for UX, server-side Zod re-validation for security |
| Cumulative income recalculation | API / Backend | Database | Pure function (accruedGrossBetween extension) + database queries; must stay server-only, no client-side income calculation |
| Next-payment date resolution | API / Backend | Database | Pure function (nextPaymentOnOrAfter generalization) + database queries; server-only to ensure consistent state across devices |
| НДФЛ calculation | API / Backend | — | Unchanged from Phase 1; bonuses flow through the same `calculateNdfl` function, no new tax logic path |
| Breakdown display (next payment showing base + bonus) | Browser / Client | Frontend Server (SSR) | Conditional rendering based on forecast data; server computes, client displays |

## Standard Stack

### Core (inherited from Phase 1)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.3.3 (App Router) | Full-stack framework for Server Actions and Route Handlers | [VERIFIED: npm registry] Phase 1 established; no new packages needed for bonus CRUD |
| TypeScript | 6.0.3 | Type-safe schema and validation | [VERIFIED: npm registry] Pinned per Phase 1 constraints; typescript-eslint incompatible with 7.0.x until 7.1 ships |
| Drizzle ORM + drizzle-kit | 0.45.2 / 0.31.10 | Type-safe SQL + migrations | [VERIFIED: npm registry] Phase 1 established; ORM handles new `bonuses` table naturally |
| PostgreSQL (Neon) | 17-class serverless | Primary database | [VERIFIED: .planning/CLAUDE.md] Schema extension for `bonuses` table |
| Better Auth | 1.7.2 | Authentication + session isolation | [VERIFIED: npm registry] Phase 1 established; no changes needed |
| Zod | 4.4.3 | Runtime validation for bonus input | [VERIFIED: npm registry] Phase 1 established; new `bonusInputSchema` will follow same pattern as `salaryInputSchema` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 4.4.0 | Date arithmetic for bonus date handling and next-payment resolution | [VERIFIED: npm registry] Phase 1 established; bonus date logic uses same utilities as salary-schedule logic |
| React Hook Form | latest (Phase 1 version) | Form state for bonus entry form | [VERIFIED: npm registry] Phase 1 established; bonus form follows salary-form pattern |

### Alternatives Considered

| Recommended | Alternative | Tradeoff |
|-------------|-------------|----------|
| Add `bonuses` table; extend `getCumulativeIncomeBeforeDate` to query bonuses | Create a separate "bonus repository" that feeds parallel cumulative-income calculation | The recommended approach keeps all income events in one cumulative chain (via single `getCumulativeIncomeBeforeDate` call that unions schedule-derived + bonus income); a parallel calculation risks drift and duplicated logic |
| Modify `accruedGrossBetween` to accept bonus events alongside schedule-derived events | Create a wrapper function that calls `accruedGrossBetween` then sums bonus income separately | A single coherent accrual engine is simpler to reason about and test; bonus integration is just "add more dated events to the fold" |
| Allow bonus deletion for any date (including past) | Block deletion of past bonuses (D-B06 current decision) | D-B06 is explicit: deletion silently erases what was actually paid; editing a wrong amount is a correction (allowed), deletion is erasure (forbidden for history). This asymmetry is intentional. |
| Store bonus amount as `decimal(14, 2)` in Postgres | Use `bigint` for kopecks (Phase 1 pattern) | Phase 1 established kopeck-as-integer for money; bonus schema must match for arithmetic consistency |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bonus CRUD with ownership isolation | Custom SQL or transaction-wrapped insert/update/delete | Drizzle ORM + `onConflictDoUpdate` (Phase 1 pattern) | Single atomic statement handles concurrent edits; no race windows; Neon HTTP driver has no interactive transactions |
| Cumulative income calculation with bonuses included | Hand-rolled loops that sum salary + bonuses separately, then merge | Extend `accruedGrossBetween` to accept additional dated-event entries (bonus income), keep one cumulative chain | Two separate sums risk drift; one cumulative chain is the source of truth (Phase 1 principle: "cumulative income as a derived value") |
| Next-payment date resolution with bonus dates | Separate logic for "next bonus date" + "next salary/avans date" then compare | Generalize `nextPaymentOnOrAfter` to accept a mixed list of payment events (schedule-derived + bonus-derived), return the soonest | D-B10 requires ONE unified "next payment" slot; two separate queries risk inconsistency across device syncs |
| Bonus form validation | Custom date/amount parsing in the Server Action | Use Zod schema in `src/lib/validation/bonus.ts` | Single schema enforces consistency; shared between client-side hints and server-side re-validation |
| Soft-delete tracking for bonus deletion (D-B06) | Add `deletedAt` column, filter queries to exclude soft-deleted rows | Enforce hard delete only for future-dated bonuses (D-B06 gate in the action), no soft-delete infrastructure | Hard delete is sufficient; the deletion gate (check bonus date vs. today in Moscow) is cheaper than soft-delete query overhead |

**Key insight:** Phase 1 established a "functional core, imperative shell" pattern with cumulative income as a derived value. Phase 2 keeps that pattern intact — bonuses are just more dated events in the cumulative chain. Do not bifurcate the accrual logic into separate salary + bonus paths.

## Architecture Patterns

### System Architecture Diagram

```
User Input (Bonus Form)
         ↓
   Zod Validation
         ↓
    Server Action (saveBonusAction)
         ↓
   Date Guard (D-B06: prevent past-bonus deletion)
         ↓
   Repository Layer (bonuses table)
         ↓
   Database (PostgreSQL)
         ↓
   Read Chain (when next-payment forecast is computed):
   ├─ getSchedule (avans/salary payment dates)
   ├─ listBonuses (bonus payment dates)
   ├─ listSalaryHistory (salary amounts per date)
   └─ getCumulativeIncomeBeforeDate (unions all dated events)
         ↓
   Pure Accrual Engine (accruedGrossBetween + bonus income)
         ↓
   Pure Tax Engine (calculateNdfl)
         ↓
   Next-Payment Resolver (nextPaymentOnOrAfter generalized)
         ↓
   Forecast Result (date, kind, gross, tax, net, breakdown?)
         ↓
   Server Component (forecast.ts calls this)
         ↓
   Client Component (renders next-payment-card with or without breakdown)
```

### Recommended Project Structure

```
src/
├── lib/db/
│   ├── schema.ts                  [ADD bonuses table definition]
│   ├── bonus-repository.ts        [NEW — bonus CRUD, list, access control]
│   └── salary-repository.ts       [MODIFY getCumulativeIncomeBeforeDate to include bonuses]
├── lib/validation/
│   └── bonus.ts                   [NEW — bonusInputSchema (amount, date, optional note)]
├── app/actions/
│   └── bonus.ts                   [NEW — saveBonusAction, deleteBonusAction, following salary.ts pattern]
├── domain/pay/
│   └── payment-accrual.ts         [MODIFY accruedGrossBetween to accept bonus events, OR create wrapper]
├── app/actions/
│   └── forecast.ts                [MODIFY nextPaymentOnOrAfter generalization or wrapper to consider bonus dates]
├── app/(app)/
│   ├── page.tsx                   [MODIFY next-payment-card rendering to show breakdown when bonus present]
│   └── bonuses/                   [NEW — bonus list page]
│       ├── page.tsx               [NEW — renders bonus list + add/edit form]
│       └── bonus-form.tsx         [NEW — reusable form component for create/edit]
└── components/
    └── next-payment-card.tsx      [MODIFY to conditionally show base + bonus breakdown]
```

### Pattern 1: Bonus Table Schema (Database-First)

**What:** A new `bonuses` table following Phase 1's schema conventions (Drizzle ORM, kopecks-as-integer, ownership-scoped, check constraints).

**When to use:** Bonuses are stored persistently and queried by user and date; this is the single source of truth.

**Definition:**
```typescript
// Source: Phase 1 schema.ts pattern, extended for bonuses
export const bonuses = pgTable(
  "bonuses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    amountKopecks: bigint("amount_kopecks", { mode: "number" }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    note: text("note"), // D-B08: optional
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    // Multiple bonuses on same date allowed (D-B03 sums them)
    uniqueIndex("bonuses_user_date_uq").on(table.userId, table.date),
    check("bonus_amount_positive", sql`${table.amountKopecks} > 0`),
  ],
);
```

**Consideration:** The unique index on (user_id, date) allows exactly one bonus row per user per date. D-B03 says "multiple bonuses on same date are summed" — this could mean:
1. One database row per (user, date) pair with `amountKopecks` representing the total, or
2. Multiple rows per date, summed at query time.

**Recommendation (requires confirmation):** Start with one row per (user, date) pair. If a user adds a second bonus to the same date, the action upserts (increases the amount), not inserts. This keeps queries simple and enforces D-B03's "summed and taxed together" naturally. [ASSUMED — confirm during planning whether "add another bonus to 2026-09-15" should create a second row or merge into the existing one.]

### Pattern 2: Bonus Repository (Ownership-Scoped Access)

**What:** A module mirroring `src/lib/db/salary-repository.ts` — every function takes `userId` as its first parameter, all queries carry `eq(bonuses.userId, userId)`.

**When to use:** Whenever code needs to read, create, edit, or delete bonuses for a specific user.

**Template:**
```typescript
// Source: salary-repository.ts pattern
export async function listBonuses(userId: string): Promise<BonusRow[]> {
  return db
    .select()
    .from(bonuses)
    .where(eq(bonuses.userId, userId))
    .orderBy(desc(bonuses.date));
}

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

export async function deleteBonusIfFuture(
  userId: string,
  bonusDate: string,
): Promise<boolean> {
  // D-B06: prevent deletion of past bonuses
  const today = todayIsoInMoscow();
  if (bonusDate <= today) {
    return false; // Deletion blocked
  }

  const deleted = await db
    .delete(bonuses)
    .where(and(eq(bonuses.userId, userId), eq(bonuses.date, bonusDate)))
    .returning();

  return deleted.length > 0;
}
```

### Pattern 3: Cumulative Income Extension (Including Bonuses)

**What:** Extend `getCumulativeIncomeBeforeDate` or create a wrapper that computes cumulative income from THREE sources: YTD baseline + schedule-derived income (salary/avans) + bonus income.

**When to use:** Any time the tax engine needs to compute cumulative YTD income up to a payment date, including bonus-affected dates.

**Approach A (Recommended):** Extend `accruedGrossBetween` to accept an optional `bonusEvents` parameter. [ASSUMED]

```typescript
// Source: payment-accrual.ts pattern, extended
export interface PaymentEvent {
  dateIso: string;
  kind: PaymentKind | "bonus"; // "bonus" is not part of normal PAYMENT_KIND_RANK
  grossKopecks: Kopecks;
}

export async function getCumulativeIncomeBeforeDate(
  userId: string,
  isoDate: string,
  kind: PaymentKind = "avans",
): Promise<number> {
  const [baseline, schedule, history, bonuses] = await Promise.all([
    getYtdBaseline(userId),
    getSchedule(userId),
    listSalaryHistory(userId),
    listBonuses(userId),  // NEW
  ]);

  // ... existing baseline logic ...

  const bonusEvents: PaymentEvent[] = bonuses
    .filter(b => b.date <= isoDate)
    .map(b => ({ dateIso: b.date, kind: "bonus", grossKopecks: b.amountKopecks }));

  const salaryHistoryEntries: SalaryHistoryEntry[] = history.map(...);

  const accruedKopecks = accruedGrossBetween(
    schedule,
    salaryHistoryEntries,
    windowBoundIso,
    { dateIso: isoDate, kind },
    bonusEvents,  // NEW optional parameter
  );

  return baselineAmountKopecks + accruedKopecks;
}
```

**Approach B (Alternative if A proves complex):** Keep `accruedGrossBetween` unchanged, compute bonus accrual separately, then sum.

```typescript
// Simpler, but risks drift
const scheduleAccrued = accruedGrossBetween(...);
const bonusAccrued = bonuses
  .filter(b => b.date > windowBoundIso && b.date <= isoDate)
  .reduce((sum, b) => sum + b.amountKopecks, 0);
return baselineAmountKopecks + scheduleAccrued + bonusAccrued;
```

**Recommendation:** Use Approach A. It keeps the cumulative chain unified (Phase 1's principle), avoids two separate sums, and makes the logic greppable in one place.

### Pattern 4: Next-Payment Resolver Generalization

**What:** Modify or wrap `nextPaymentOnOrAfter` to consider both scheduled payment dates AND bonus-only dates, selecting whichever is soonest (D-B10).

**When to use:** `src/app/actions/forecast.ts` needs to resolve the next payment event.

**Current code:**
```typescript
// Phase 1: only considers schedule-derived dates
const nextEvent = nextPaymentOnOrAfter(schedule, today);
// Returns: { date: "2026-09-10", kind: "avans" } | { date: "2026-09-25", kind: "salary" }
```

**Extended approach:**
```typescript
// NEW wrapper or modified function
async function nextPaymentEventOnOrAfter(
  userId: string,
  fromDate: string,
): Promise<{ date: string; kind: PaymentKind | "bonus"; isBonusOnly: boolean }> {
  const [schedule, bonuses] = await Promise.all([
    getSchedule(userId),
    listBonuses(userId),
  ]);

  if (!schedule) {
    // No regular schedule; next payment is the first future bonus
    const nextBonus = bonuses.find(b => b.date >= fromDate);
    if (nextBonus) {
      return { date: nextBonus.date, kind: "bonus", isBonusOnly: true };
    }
    // No bonus either; forecast is not configured
    return null;
  }

  // Regular schedule exists
  const nextScheduleEvent = nextPaymentOnOrAfter(schedule, fromDate);
  const nextBonusEvent = bonuses.find(b => b.date >= fromDate);

  // Compare dates, pick the soonest
  if (!nextBonusEvent) {
    return { ...nextScheduleEvent, isBonusOnly: false };
  }

  if (nextScheduleEvent.date <= nextBonusEvent.date) {
    return { ...nextScheduleEvent, isBonusOnly: false };
  } else {
    return { date: nextBonusEvent.date, kind: "bonus", isBonusOnly: true };
  }
}
```

### Pattern 5: Forecast Breakdown (D-B09)

**What:** When the next payment includes a bonus (i.e., the next event date has both a regular salary/avans AND a bonus on the same date, or a bonus-only event), display a breakdown: "Base: 50,000 + Bonus: 10,000 = 60,000 gross".

**When to use:** In `next-payment-card.tsx` when rendering the next payment's gross amount.

**Template:**
```typescript
// New interface for next-payment forecast
export interface NextPaymentForecast {
  date: string;
  kind: PaymentKind | "bonus";
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

**Rendering logic (component):**
```typescript
if (forecast.breakdown) {
  return (
    <div>
      <p>Base: {kopecksToRubles(forecast.breakdown.salaryOrAvansKopecks)} ₽</p>
      <p>Bonus: {kopecksToRubles(forecast.breakdown.bonusKopecks)} ₽</p>
      <p><strong>Total: {kopecksToRubles(forecast.grossKopecks)} ₽</strong></p>
    </div>
  );
} else {
  return <p>{kopecksToRubles(forecast.grossKopecks)} ₽</p>;
}
```

### Anti-Patterns to Avoid

- **Parallel cumulative-income calculations:** Do not compute "cumulative from salary" and "cumulative from bonuses" separately and merge them. This risks one-kopeck drift and makes the code harder to verify. Keep one cumulative chain (Pattern 3).
- **Client-side tax recalculation:** Never calculate НДФЛ or cumulative income on the browser. All tax-impacting mutations (add/edit bonus) must trigger a server-side recompute. Bonuses are financial data; trust only server calculations.
- **Separate "next bonus" slot on the home screen:** D-B10 is explicit — one unified "next payment" slot. Do not add a separate "upcoming bonuses" widget.
- **Soft-delete infrastructure for bonus deletion:** D-B06 allows hard delete of future-only bonuses. Do not add `deletedAt` columns and soft-delete query filters; the deletion gate (date check) is simpler and cheaper.
- **Bonus category selection without re-scoping TAX-02:** D-B07 locks "universal one-off payment type." If a future milestone adds tax-exempt categories, that will require extending the tax engine itself and re-reading the НК РФ. Do not add UI for categories in v1.

## Common Pitfalls

### Pitfall 1: Duplicate Bonuses on Same Date (D-B03 Ambiguity)

**What goes wrong:** The database allows multiple bonus rows on the same (user_id, date) pair. When tax is computed, you sum them into a single payment event. But if you later edit one, which one did you edit? If you delete one, does it re-cascade?

**Why it happens:** D-B03 says "multiple bonuses on same date are summed and taxed together," but doesn't specify whether they're stored as one fat row or multiple rows.

**How to avoid:** Store ONE row per (user, date) pair with a unique constraint. If the user adds a second bonus to the same date, the action upserts (increases `amountKopecks`), not inserts a new row. This keeps the constraint tight and edit/delete unambiguous.

**Warning signs:** If you see duplicate (user_id, date) rows in production, or if deleting one bonus somehow affects a different bonus on the same date, the implementation violated this pitfall's prevention.

### Pitfall 2: Bonus Date Shifting (D-02 Extension)

**What goes wrong:** A bonus is entered for "2026-09-13" (a Saturday). Does it shift to Friday like a salary payment does (D-02: "payment dates are moved backward to the last preceding working day")? Or is it taken literally?

**Why it happens:** CONTEXT.md flags this as a research question. Phase 1's resolve-payment-date.ts applies weekend/holiday shifting to avans/salary dates. D-B01 says bonuses can attach to "ANY date the user picks" — ambiguous whether that ANY includes weekend/holiday shifting.

**How to avoid:** RESEARCH DECISION REQUIRED during planning phase. Two options:
1. **Bonuses are "hard" dates** — if user enters 2026-09-13 (Saturday), the bonus is paid literally on Saturday (likely impossible, but we show the user their intention). The UI should warn "this is a weekend."
2. **Bonuses are "soft" dates** — apply the same D-02/D-03 shifting logic. A Saturday bonus shifts to Friday. The UI shows the shifted date after resolution.

**Recommendation (pending confirmation):** Option 2 (soft dates, apply shifting). Rationale: employers cannot pay on weekends/holidays in practice, and the user's intent ("pay me on this date") is better served by showing the actual payment date after shifting. But confirm this during planning.

**Warning signs:** If a bonus entered for a Saturday shows up in the forecast on Saturday, or if bonuses bypass the weekend/holiday check that salary payments go through, this pitfall was violated.

### Pitfall 3: Forward Recompute on Edit (D-B04)

**What goes wrong:** User edits a past bonus amount. The system updates the bonus row, but downstream forecasts still show the old tax amount for subsequent payments — the cumulative income up to those dates wasn't recalculated.

**Why it happens:** D-B04 says "editing a past bonus recomputes cumulative income and re-taxes every later payment forward." This is NOT automatic. The database row update happens, but the `getYtdBaseline` and `getCumulativeIncomeBeforeDate` functions are read-only; they fetch fresh data on each call. The recompute happens naturally IF the forecast is freshly computed after the edit. But if the client caches the forecast or doesn't re-query, the stale values remain.

**How to avoid:** When a bonus is edited (or deleted), the Server Action must call `revalidatePath("/")` and any other paths that render forecasts, so Next.js invalidates the server-side cache. On subsequent client navigation or refresh, the forecast is recomputed from fresh database reads. This matches Phase 1's pattern in `src/app/actions/salary.ts`.

**Warning signs:** If a user edits a past bonus and the next-payment forecast does NOT reflect the change until a full page refresh or app restart, this pitfall was violated.

### Pitfall 4: Date Boundary Off-by-One in Cumulative Income Query

**What goes wrong:** Computing cumulative income "before" a bonus date, you include or exclude the bonus itself, leading to the bonus taxing at its own rate instead of on top of prior cumulative income.

**Why it happens:** The tax engine computes `taxOnCumulative(cumulativeBefore) + paymentGross - cumulativeBefore`. If "before" is computed wrongly, the tax is wrong.

**How to avoid:** When extending `accruedGrossBetween` or `getCumulativeIncomeBeforeDate` to include bonuses, use the SAME boundary logic as salary/avans: cumulative income "strictly before" the target date. A bonus dated 2026-09-15 should not include itself in the "before" figure. Review the boundary condition in the extended function carefully.

**Warning signs:** If a bonus's net-take-home is off by more than a rounding error (>1 kopeck), especially if it's consistently too high (tax too low), the boundary logic is suspect.

### Pitfall 5: Deleting a Past Bonus (D-B06 Violation)

**What goes wrong:** User deletes a bonus from 2026-08-10. The database row is removed. Later, the forecast for 2026-08-15 is recomputed and no longer includes that 2026-08-10 bonus — the tax for 2026-08-15 changes silently, as if 2026-08-10 never happened.

**Why it happens:** D-B06 says "deleting a past bonus is forbidden." But if the action lacks a date guard, the delete happens anyway. The user may not notice that history changed, leading to confusion when comparing the app's forecast to their actual payslip.

**How to avoid:** Every delete operation must check: `if (bonusDate <= todayIsoInMoscow()) return error("Cannot delete past bonuses")`. The action returns a validation error, not silently failing. If the UI tries to delete, the user sees "You can only delete future bonuses" as feedback.

**Warning signs:** If a bonus from a past date can be deleted from the database (even if the UI hides the delete button), or if deleting a past bonus changes tax calculations for subsequent payments, this pitfall was violated.

## Code Examples

### Bonus Input Schema (Zod Validation)

**Source:** Phase 1 `src/lib/validation/salary.ts` pattern

```typescript
// File: src/lib/validation/bonus.ts
import { z } from "zod";
import { todayIsoInMoscow } from "@/domain/time";

export const bonusInputSchema = z.object({
  amountRubles: z
    .string()
    .refine((val) => !Number.isNaN(parseFloat(val)), "Invalid amount")
    .pipe(z.coerce.number().positive("Amount must be positive")),
  date: z
    .string()
    .date("Invalid date format (expected YYYY-MM-DD)"),
  note: z.string().optional().default(""),
});

export type BonusInput = z.infer<typeof bonusInputSchema>;
```

### Bonus Server Action

**Source:** Phase 1 `src/app/actions/salary.ts` pattern

```typescript
// File: src/app/actions/bonus.ts
"use server";

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
      fieldErrors: { date: ["Failed to save bonus"] },
    };
  }
}

export async function deleteBonusAction(date: string): Promise<BonusActionResult> {
  const userId = await requireUserId();

  const today = todayIsoInMoscow();
  if (date <= today) {
    return {
      success: false,
      fieldErrors: { date: ["Cannot delete past bonuses"] },
    };
  }

  const deleted = await deleteBonusIfFuture(userId, date);
  if (!deleted) {
    return {
      success: false,
      fieldErrors: { date: ["Bonus not found"] },
    };
  }

  revalidateBonusPaths();
  return { success: true };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate "avans," "salary," "bonus" tax calculations | Single cumulative НДФЛ engine (Phase 1), extended to include bonuses | Phase 1 (263-ФЗ compliance from 2023) | Bonuses integrate cleanly as additional dated events; no new tax code path needed |
| Bonus amounts stored as `decimal(14, 2)` in other systems | Kopeck-as-integer (Phase 1 pattern) | Phase 1 | Avoids floating-point rounding; arithmetic is exact; consistent with salary schema |
| Manual "next payment" calculation checking schedule only | Generalized next-payment resolver (this phase) | Phase 2 | Bonuses can be the next payment even if no salary is scheduled that month |

**Deprecated/outdated:**
- None — this is greenfield bonus functionality.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Bonus date shifting: bonuses should apply D-02/D-03 weekend/holiday shifting like salary dates do | Pitfall 2 | If bonuses are hard-dated (not shifted), forecast may show bonuses on weekends/holidays, confusing users; if shifted, the forecast correctly shows the actual payment date |
| A2 | One bonus row per (user_id, date): multiple bonuses on same date are upserted (increase amount), not inserted as separate rows | Pattern 1: Schema | If multiple rows allowed, edit/delete operations become ambiguous; if enforced strictly, D-B03's "summed" behavior is automatic |
| A3 | Bonus deletion blocks on past dates: `todayIsoInMoscow()` is the boundary; bonuses dated <= today cannot be deleted | Pitfall 5 | If deletion guard is absent, users can silently erase past bonuses, changing tax history; if too restrictive, users cannot correct data entry |

## Open Questions

1. **Bonus date shifting (D-02 extension):**
   - What we know: Phase 1 applies weekend/holiday shifting to avans/salary dates. D-B01 says bonuses can attach to "ANY date." CONTEXT.md flags this as a research question.
   - What's unclear: Should a bonus entered for a Saturday automatically shift to Friday (like salary does), or is it taken literally?
   - Recommendation: Treat bonuses identically to salary dates (apply shifting). Reason: employers cannot pay on weekends/holidays. Confirm during planning phase. If decision is "hard dates" (no shifting), update forecast logic to show the user exactly what date they entered, and flag it visually if it's a weekend.

2. **Multiple bonuses on same date (D-B03 interpretation):**
   - What we know: "Multiple bonuses can be added to the same payment date. They are summed and taxed together."
   - What's unclear: One database row per date (upsert to increase amount) or multiple rows (sum at query time)?
   - Recommendation: Implement as one row per (user_id, date) with a unique constraint. Upsert increases the amount. This keeps queries simple and enforces "summed" naturally. Confirm during planning.

3. **Bonus date in the past vs. forecast time ranges:**
   - What we know: D-B02 allows backdating bonuses. D-B04 allows editing past bonuses (recomputes tax forward).
   - What's unclear: If a user adds a bonus for 2026-01-15 on 2026-09-15, should the forecast include it (and recompute all payments from January forward), or only show future bonuses?
   - Recommendation: Include all bonuses (past and future) in cumulative income. The forecast is a recompute of what WOULD be owed if the entire year is recalculated with the new bonus. This matches Phase 1's pattern: edits are a "correction" to history, not just future dates.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Server Actions, Drizzle | ✓ | 20+ (Phase 1 established) | — |
| PostgreSQL (Neon) | bonuses table, getCumulativeIncomeBeforeDate | ✓ | 17-class | — |
| TypeScript | schema.ts, repository.ts type safety | ✓ | 6.0.3 (Phase 1 pinned) | — |
| Zod | bonusInputSchema validation | ✓ | 4.4.3 (Phase 1 established) | — |

**Missing dependencies with no fallback:** None — Phase 1 established all required tools.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.11 (Phase 1 established) |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- --run src/domain/` |
| Full suite command | `npm test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BON-01 | User can add a one-off bonus tied to a date | Integration | `npm test -- bonus.test.ts -t "saveBonusAction"` | ❌ Wave 0 |
| BON-02 | Bonus taxed through cumulative НДФЛ, affects take-home for that payment and subsequent payments | Unit + Integration | `npm test -- calculate-ndfl.test.ts -t "bonus"` + `npm test -- payment-accrual.test.ts -t "bonus"` | ❌ Wave 0 |
| HOME-01 (amended for bonuses) | If bonus lands on next payment, next-payment display reflects it (with breakdown per D-B09) | Integration | `npm test -- forecast.test.ts -t "nextPayment.*bonus"` | ❌ Wave 0 |

### Wave 0 Gaps

- [ ] `src/domain/pay/payment-accrual.test.ts` — extend existing tests to cover bonus events folded into cumulative income
- [ ] `src/lib/db/bonus-repository.test.ts` — new; CRUD operations, deletion guard, ownership scope
- [ ] `src/app/actions/bonus.test.ts` — new; saveBonusAction validation and persistence, deleteBonusAction guard
- [ ] `src/app/actions/forecast.test.ts` — extend existing next-payment tests to cover bonus-only dates, mixed dates, breakdown generation
- [ ] `src/lib/validation/bonus.test.ts` — new; bonusInputSchema validation (amount > 0, valid ISO date, optional note)

### Sampling Rate

- **Per task commit:** `npm test -- src/domain/ --run` (pure domain logic: tax, accrual)
- **Per wave merge:** `npm test -- --run` (full suite including integrations)
- **Phase gate:** Full suite green + manual UAT on bonus create/edit/delete/forecast flow before `/gsd-verify-work`

*(Existing test infrastructure covers Phase 1; bonuses add new test files and extend existing ones.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Better Auth (Phase 1 established); bonus actions inherit requireUserId() guard |
| V3 Session Management | No | Better Auth session cookies (Phase 1 established) |
| V4 Access Control | Yes | Every bonus query/mutation checks `eq(bonuses.userId, userId)` (ownership-scoped); no cross-user read/write |
| V5 Input Validation | Yes | Zod schema (bonusInputSchema) validates amount > 0 and ISO date; re-validated server-side in action |
| V6 Cryptography | No | No new encryption required; amounts stored as integers, dates as ISO strings |

### Known Threat Patterns for {Next.js + PostgreSQL + Zod + Drizzle}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via date or amount parameters | Tampering | Parameterized queries (Drizzle ORM only; never interpolate user input into SQL strings) |
| Privilege escalation (user reads/edits another user's bonus) | Elevation of Privilege | Ownership filter (`eq(bonuses.userId, userId)`) on every query; bonus-repository never accepts external userId parameter directly, only via `requireUserId()` isolation |
| Client-side bypass of amount validation (e.g., negative bonus) | Tampering | Server-side Zod re-validation in saveBonusAction; database check constraint `amountKopecks > 0` as second gate |
| Client-side bypass of deletion guard (user deletes past bonus) | Tampering | Server-side date guard in deleteBonusAction: `if (bonusDate <= todayIsoInMoscow()) return error(...)` |
| Concurrent edit race (two devices edit the same bonus simultaneously) | Tampering | Atomic `onConflictDoUpdate` upsert statement (Phase 1 pattern); Postgres serializes on unique index; last write wins |
| Malformed date input (e.g., "2026-13-45") | Tampering | Zod schema enforces `.date()` RFC 3339 format before reaching database; database column is type `date`, rejecting invalid strings |

## Sources

### Primary (HIGH confidence)

- Phase 1 existing code: `src/lib/db/schema.ts`, `src/lib/db/salary-repository.ts`, `src/app/actions/salary.ts`, `src/domain/pay/payment-accrual.ts`, `src/domain/tax/calculate-ndfl.ts` — established patterns for ownership-scoped access, Drizzle ORM schema, Server Action + Zod validation, cumulative income as a derived value [VERIFIED: repository read this session]
- `.planning/phases/02-bonuses-one-off-payments/02-CONTEXT.md` — all decisions D-B01 through D-B10 [VERIFIED: context file read this session]
- `.planning/REQUIREMENTS.md` — BON-01, BON-02 requirement definitions [VERIFIED: requirements file read this session]

### Secondary (MEDIUM confidence)

- Drizzle ORM documentation (drizzle-orm.org) — `onConflictDoUpdate` pattern and type-safe schema definition [CITED: official docs]
- Next.js documentation (nextjs.org/docs) — Server Actions, `revalidatePath` for cache invalidation [CITED: official docs]
- Zod documentation (zod.dev) — validation schema patterns, `.date()` validation [CITED: official docs]
- CLAUDE.md (project instructions) — TypeScript 6.0.3 pinning, stack choices, no new package installs without human-verify [VERIFIED: project instructions read this session]

### Tertiary (LOW confidence)

- Training knowledge of PostgreSQL date arithmetic and window functions — used for general background on cumulative calculations, not specific thresholds/behaviors [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Phase 1 established all tools; no new packages needed
- Architecture: HIGH — CONTEXT.md locked all major decisions; integration points are clear
- Pitfalls: MEDIUM-HIGH — derived from CONTEXT.md edge cases; Pitfall 2 (bonus date shifting) requires confirm during planning
- Test scope: MEDIUM — existing test infrastructure (Vitest, Playwright) carries over; new tests follow Phase 1 patterns but Wave 0 count is best-guess

**Research date:** 2026-08-30
**Valid until:** 2026-09-13 (2 weeks for stable, domain-locked decisions) — re-check if Phase 1 audit reveals new patterns or if planning uncovers assumptions (Pitfall 2, Assumption A2)

---

*Phase: 02-bonuses-one-off-payments*
*Research gathered: 2026-08-30*
*For: Planner to generate PLAN.md files for Phase 2 implementation*
