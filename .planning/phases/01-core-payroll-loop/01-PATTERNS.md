# Phase 1: Core Payroll Loop - Pattern Map (Gap Closure)

**Mapped:** 2026-08-29
**Mode:** gap_closure — no new files/roles, only remediation of existing files named in 01-VERIFICATION.md
**Files analyzed:** 6 (all existing, all modification targets)
**Analogs found:** 0 exact in-repo precedent for `onConflictDoUpdate` or Moscow-time helper — this phase is establishing both patterns fresh. Strong sibling-module conventions exist and are documented below as the pattern to imitate.

## File Classification

| File | Role | Data Flow | Closest Analog (same repo) | Match Quality |
|------|------|-----------|------------------------------|----------------|
| `src/lib/db/salary-repository.ts` (`replaceSalaryAt`) | repository (Drizzle data access) | CRUD (atomic upsert) | `upsertSchedule`/`upsertYtdBaseline` in the same file (lines 141-173, 212-248) — select-then-branch, NOT atomic, but same file/role/conventions | role-match, not flow-match (these have the same race, WR-01, and should ideally be fixed too) |
| `src/app/actions/salary.ts` (`saveSalaryAction`) | Server Action (request-response, form mutation) | request-response | Other actions in same file (`saveScheduleAction`, `saveYtdBaselineAction`) — no race in those but same call shape | role-match (self-file) |
| `src/app/actions/forecast.ts` (line 98, `nextPaymentOnOrAfter(..., new Date())`) | server-side orchestration (read-only, RSC-invoked) | request-response | none — first "what is today" call site to be fixed | none — establishes the pattern |
| `src/domain/schedule/resolve-payment-date.ts` | pure domain module (date math) | transform | itself — the consumer, not the fix site; shows the module boundary the new time-helper must respect (`Permitted imports: date-fns, date-holidays, and sibling domain modules only`) | reference only |
| `src/app/(app)/onboarding/page.tsx`, `src/app/(app)/settings/salary/page.tsx` | route/page (Server Component) | request-response | each other — identical `new Date().toISOString().slice(0,10)` default-date line, same fix applies to both | exact (mirror files) |
| `src/components/pay-setup-forms.tsx` (`SalaryForm`, line 55) | component (client, form) | request-response | onboarding/settings pages above — same UTC-slice idiom, just client-side instead of server-side | exact pattern, different execution context |

## Pattern Assignments

### 1. `src/lib/db/salary-repository.ts` — atomic upsert for `replaceSalaryAt`

**No existing `onConflictDoUpdate` usage anywhere in this repo** (confirmed via grep across `src/`). This will be the first. Follow Drizzle's standard `.onConflictTarget()` syntax, targeting the existing unique index rather than a raw column list, since the index already has a name.

**Current non-atomic implementation** (`src/lib/db/salary-repository.ts:101-120`):
```typescript
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
```

**Unique constraint it must target** (`src/lib/db/schema.ts:32-37`):
```typescript
(table) => [
  uniqueIndex("salary_history_user_effective_from_uq").on(
    table.userId,
    table.effectiveFrom,
  ),
],
```

**Target atomic shape** (Drizzle `onConflictDoUpdate`, conflict target must reference the table columns that back the named unique index — `[salaryHistory.userId, salaryHistory.effectiveFrom]`):
```typescript
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
      set: { grossAmountKopecks },
    })
    .returning();

  const row = upserted[0];
  if (!row) {
    throw new Error("replaceSalaryAt: upsert into salary_history returned no row");
  }
  return row;
}
```
Notes for the planner:
- Confirm at implementation time that `drizzle-orm@0.45.2`'s Neon HTTP driver supports `.onConflictDoUpdate()` on a single non-transactional statement (it does — this is a single SQL statement, not a multi-statement transaction, so the Neon HTTP driver's lack of interactive-transaction support, called out in the function's existing doc comment, does not block this fix).
- Update the function's doc comment (lines 87-100) — it currently justifies the delete-then-insert as "an acceptable risk," which is no longer true; this comment must be corrected, not just the code (echoes the ndfl-brackets.ts stale-comment issue flagged elsewhere in verification — don't leave a similar stale claim behind here).
- The sibling functions `upsertSchedule` (141-173) and `upsertYtdBaseline` (212-248) have the same select-then-branch race (WR-01, lower severity per verification, not a blocker) — same `onConflictDoUpdate` pattern applies if the gap-closure plan chooses to address WR-01 too. `paymentSchedule` and `ytdBaseline` both use `userId` as their primary key directly (see schema.ts:46-48, 63-65), so their conflict target is simply `paymentSchedule.userId` / `ytdBaseline.userId` — even simpler than the salary_history compound-key case.

### 2. `src/app/actions/salary.ts` — remove check-then-write race in `saveSalaryAction`

**Current implementation** (lines 59-87), showing the race: `findSalaryAt` (read) and `replaceSalaryAt` (write) are two unlocked round trips:
```typescript
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

  await replaceSalaryAt(userId, rublesToKopecks(grossRubles), effectiveFrom);
  revalidatePaySetupPaths();
  return { success: true };
}
```
This is a Server Action (`"use server"` at top of file, line 1), part of the module documented as: "Every action begins by calling `requireUserId()` and never reads a user id from its arguments" — that convention stays unchanged; only the confirmation-check-vs-write ordering needs fixing.

**Recommended fix shape:** keep `findSalaryAt` purely for the D-14 confirmation-prompt UX (still needed — the user must see the existing amount before confirming), but make the actual persistence unconditionally atomic via the fixed `replaceSalaryAt` above. Since `replaceSalaryAt` will now be an atomic upsert regardless of prior state, the race is closed at the DB layer even though `findSalaryAt` is still called first for UX purposes — two concurrent requests can no longer both "win" a lost-update, because the final `INSERT ... ON CONFLICT DO UPDATE` is itself atomic per row. No structural change to the action's control flow is required beyond relying on the now-atomic repository function; the planner should note this explicitly so the fix isn't over-engineered with app-level locking.

**`SalaryActionResult` type** (lines 41-49) — no change needed, but worth citing for the planner as the contract the fix must preserve:
```typescript
export type SalaryActionResult =
  | { success: true }
  | {
      success: false;
      needsConfirmation: true;
      existingAmountRubles: number;
      effectiveFrom: string;
    }
  | { success: false; needsConfirmation?: false; fieldErrors: Record<string, string[]> };
```

**Year-boundary bug**, `skipYtdBaselineAction` (line 151):
```typescript
export async function skipYtdBaselineAction(): Promise<{ success: true }> {
  const userId = await requireUserId();
  const januaryFirstOfCurrentYear = `${new Date().getFullYear()}-01-01`;
  await upsertYtdBaseline(userId, 0, januaryFirstOfCurrentYear, true);
  revalidatePaySetupPaths();
  return { success: true };
}
```
This must call the new Moscow-time helper (see pattern 3 below) instead of `new Date().getFullYear()`.

### 3. `src/app/actions/forecast.ts` — Moscow-anchored "now"

**Current call site** (line 96-99, inside `forecastNextPayment`):
```typescript
const paymentEvent = nextPaymentOnOrAfter(
  { avansDay: schedule.avansDay, salaryDay: schedule.salaryDay },
  new Date(),
);
```

**No timezone utility exists anywhere in the repo yet** (`src/lib/`, `src/domain/` both grepped — no match for `Moscow`, `toZonedTime`, `date-fns-tz`, or any hand-rolled offset). `date-fns-tz` is **not installed** (`package.json` shows only `date-fns@^4.4.0`, no `-tz` package) — per the new-package-install constraint documented inline in `salary-repository.ts` ("new package installs require a human-verify checkpoint per executor deviation rules"), the gap-closure plan should default to a **hand-rolled UTC+3 offset** (Russia does not observe DST, confirmed in 01-VERIFICATION.md's own `missing:` field), not add `date-fns-tz` as a new dependency, unless the plan explicitly flags a human-verify checkpoint to add it.

**Where the new helper module should live**, based on existing layering conventions:
- `src/domain/schedule/resolve-payment-date.ts` (lines 1-21) documents strict import boundaries: "Permitted imports: `date-fns`, `date-holidays`, and sibling domain modules only. Nothing from `@/lib`, `next`, or React." A pure "what date/time is it in Moscow right now" function has no I/O and fits the "functional core" rule from `research/ARCHITECTURE.md`, so it belongs as a new pure module, e.g. `src/domain/time.ts` or `src/domain/moscow-time.ts` — sibling to `src/domain/money.ts` (a similarly small, pure, single-purpose module) — NOT inside `src/lib/db/` or `src/app/actions/` (those are the imperative shell).
- Suggested shape (hand-rolled, no new dependency):
```typescript
const MOSCOW_UTC_OFFSET_HOURS = 3;

/** Current date/time in Europe/Moscow (UTC+3, no DST) as a native Date whose
 * UTC-accessor fields (getUTCFullYear, getUTCMonth, ...) read as Moscow's
 * local wall-clock fields. */
export function nowInMoscow(): Date {
  const utcNow = new Date();
  return new Date(utcNow.getTime() + MOSCOW_UTC_OFFSET_HOURS * 60 * 60 * 1000);
}

/** Today's date in Europe/Moscow, formatted yyyy-MM-dd. */
export function todayIsoInMoscow(): string {
  const moscowNow = nowInMoscow();
  return moscowNow.toISOString().slice(0, 10);
}
```
Caution for the planner: `nextPaymentOnOrAfter` and other `date-fns` consumers currently use *local* accessors (`.getFullYear()`, not `.getUTCFullYear()`) in some places (e.g. `forecast.ts:125` `paymentEvent.date.getFullYear()`) and UTC-based `.toISOString()` in others — the fix must audit each call site for which accessor family it uses and keep the offset-shifted `Date`'s UTC accessors as the single source of truth to avoid re-introducing a second timezone bug. This detail should be spelled out as an explicit task-level check in the plan, not left implicit.

**Call site fix** (`forecast.ts` line 98): replace `new Date()` with `nowInMoscow()` (import from the new domain module — `forecast.ts` already imports from `@/domain/tax/calculate-ndfl` and `@/domain/schedule/resolve-payment-date`, so a new `@/domain/...` import is consistent with this file's existing import block, lines 41-49).

### 4. UTC-slice date-default sites — `onboarding/page.tsx`, `settings/salary/page.tsx`, `pay-setup-forms.tsx`

**Exact duplicated line, three call sites:**
- `src/app/(app)/onboarding/page.tsx:13`: `const today = new Date().toISOString().slice(0, 10);`
- `src/app/(app)/settings/salary/page.tsx:16`: identical line
- `src/components/pay-setup-forms.tsx:55` (inside `SalaryForm`, a `"use client"` component): identical line, but this one runs **client-side in the browser**, not on the server — the browser's local timezone is whatever the user's device is set to, which for the app's actual Russian audience is very likely already MSK, so this call site's practical bug window is narrower than the two server-side ones, but the pattern should still route through the shared helper for consistency and correctness on misconfigured devices.

Both page.tsx files: replace with `todayIsoInMoscow()` imported from the new `src/domain/...` module (both files already import from `@/lib/db/salary-repository` and `@/domain/money` — same import-block convention applies, e.g. `onboarding/page.tsx:1-5`).

`pay-setup-forms.tsx` is a client component (`"use client"`, line 1) — the pure `todayIsoInMoscow()` helper has zero I/O and no server-only guard, so it is safe to import into a client bundle exactly like `@/domain/money`'s `kopecksToRubles`/`rublesToKopecks` are already imported client-side elsewhere in this same file (lines 15-31 import from `@/lib/validation/salary` and `@/app/actions/salary` — a new `@/domain/...` import fits the same pattern). No new client/server boundary issue is introduced as long as the helper module stays pure (no `db`, no `next/headers`, etc.) — confirm this constraint is preserved when writing the module.

## Shared Patterns

### Server-only guard convention (repository/action modules)
**Source:** `src/lib/db/salary-repository.ts:1-10`, mirrored in `src/app/actions/forecast.ts:1-15`
```typescript
if (typeof window !== "undefined") {
  throw new Error(
    "<module path> is server-only and must never be imported into a client component.",
  );
}
```
**Apply to:** N/A for this gap-closure — the new Moscow-time domain module must NOT carry this guard (it needs to be importable client-side per pattern 4 above); only note this so the planner doesn't reflexively copy it onto the wrong file.

### No-logging-of-money constraint
**Source:** doc comments in `salary-repository.ts:23-25`, `forecast.ts:33-34`, `salary.ts:12-14`
**Apply to:** Any new/modified code in these files — the gap-closure fixes must not introduce `console.log`/logging calls that could leak a kopecks amount, consistent with the existing convention across all three touched modules.

### Comment-accuracy discipline
**Source:** verification flagged `src/domain/tax/ndfl-brackets.ts:8-10` for a doc comment asserting a check that didn't happen (unrelated file, but the same discipline applies here)
**Apply to:** `replaceSalaryAt`'s doc comment (`salary-repository.ts:87-100`) currently justifies the non-atomic approach as low-risk — this must be rewritten to describe the new atomic behavior, not merely have its code changed underneath a stale comment.

## Test Conventions to Follow

**Existing repository test file:** `src/lib/db/salary-repository.test.ts` — integration-style, runs against the real dev database (no mocking, no separate test DB/Neon branch for Phase 1, per its own header comment lines 1-11). Pattern per test:
1. `beforeEach`: create throwaway `user` row(s) via `createThrowawayUser()` (lines 30-38), random UUID + `.invalid` email.
2. `afterEach`: delete the throwaway user(s); cascade delete (`onDelete: "cascade"` on every FK to `user.id`) cleans up dependent rows.
3. Existing D-14 test (lines 56-65) already exercises the "second write to the same effective date replaces the first" behavior — this test's assertions (`toHaveLength(1)`, correct final `grossAmountKopecks`) should still pass unchanged against the new atomic `onConflictDoUpdate` implementation; it becomes a regression test for the fix essentially for free. The gap-closure plan should add a **new** test alongside it that exercises true concurrency (e.g. `Promise.all([replaceSalaryAt(...), replaceSalaryAt(...)])` racing two writes to the same `(userId, effectiveFrom)` pair) and asserts exactly one row survives with one of the two values — this is the regression test that actually proves CR-02 is fixed, since the existing sequential D-14 test does not exercise concurrency.
4. Import style: named imports from `@/lib/db/salary-repository`, `@/lib/db`, `@/lib/db/auth-schema`, `drizzle-orm`'s `eq`, and `vitest`'s `describe/it/expect/beforeEach/afterEach` (lines 13-28).

**Existing action test file:** `src/app/actions/forecast.test.ts` exists — the planner should read it directly when writing the Moscow-time regression test to confirm its mocking/fixture conventions for `forecastNextPayment`, since a new `nowInMoscow()` test will likely need to freeze/mock system time (e.g. `vi.setSystemTime`) rather than rely on real wall-clock time — this repo's Vitest version (4.1.11) supports `vi.useFakeTimers()`/`vi.setSystemTime()` natively.

## No Analog Found

| File/Concern | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Moscow-timezone helper module (new) | domain/utility | transform | First timezone-aware utility in the codebase; no analog exists. Pattern above (hand-rolled UTC+3, placed in `src/domain/`) is synthesized from the project's own layering rules (`ARCHITECTURE.md`'s functional-core/imperative-shell split, `resolve-payment-date.ts`'s explicit import-boundary comment) rather than copied from an existing file. |
| Atomic `onConflictDoUpdate` usage | repository | CRUD | No prior Drizzle upsert exists anywhere in `src/`; pattern above is synthesized from Drizzle ORM's documented API plus the existing unique-index name in `schema.ts`, not copied from an in-repo precedent. |

## Metadata

**Analog search scope:** `src/lib/db/`, `src/app/actions/`, `src/app/(app)/`, `src/components/`, `src/domain/` (full read of all 6 target files plus `schema.ts` and both existing test files' headers)
**Files scanned:** 9 read directly; grep sweep across `src/` for `onConflictDoUpdate`, `date-fns-tz`, `Europe/Moscow`, `toZonedTime`, `UTC+3`
**Pattern extraction date:** 2026-08-29
