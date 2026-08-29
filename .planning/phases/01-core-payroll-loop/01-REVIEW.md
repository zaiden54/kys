---
phase: 01-core-payroll-loop
reviewed: 2026-08-29T09:04:06Z
depth: standard
files_reviewed: 43
files_reviewed_list:
  - .env.example
  - .gitignore
  - README.md
  - drizzle.config.ts
  - package.json
  - scripts/verify-auth-flow.mjs
  - src/app/(app)/layout.tsx
  - src/app/(app)/onboarding/page.tsx
  - src/app/(app)/page.tsx
  - src/app/(app)/settings/salary/page.tsx
  - src/app/(auth)/login/page.tsx
  - src/app/(auth)/register/page.tsx
  - src/app/actions/forecast.test.ts
  - src/app/actions/forecast.ts
  - src/app/actions/salary.ts
  - src/app/api/auth/[...all]/route.ts
  - src/app/layout.tsx
  - src/components/next-payment-card.tsx
  - src/components/pay-setup-forms.tsx
  - src/components/sign-out-button.tsx
  - src/components/ytd-estimate-banner.tsx
  - src/domain/money.ts
  - src/domain/schedule/pay-gap.test.ts
  - src/domain/schedule/pay-gap.ts
  - src/domain/schedule/resolve-payment-date.test.ts
  - src/domain/schedule/resolve-payment-date.ts
  - src/domain/tax/calculate-ndfl.test.ts
  - src/domain/tax/calculate-ndfl.ts
  - src/domain/tax/ndfl-brackets.test.ts
  - src/domain/tax/ndfl-brackets.ts
  - src/domain/time.test.ts
  - src/domain/time.ts
  - src/env.ts
  - src/lib/auth-client.ts
  - src/lib/auth.ts
  - src/lib/db/auth-schema.ts
  - src/lib/db/index.ts
  - src/lib/db/salary-repository.test.ts
  - src/lib/db/salary-repository.ts
  - src/lib/db/schema.test.ts
  - src/lib/db/schema.ts
  - src/lib/session.ts
  - src/lib/validation/salary.ts
  - tsconfig.json
  - vitest.config.ts
findings:
  critical: 1
  warning: 4
  info: 5
  total: 10
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-08-29T09:04:06Z
**Depth:** standard
**Files Reviewed:** 43
**Status:** issues_found

## Summary

This is a fresh, independent pass over all 43 files, including the three gap-closure plans (01-06, 01-07, 01-08) that landed since the prior review. The prior review's tracked items check out as genuinely fixed:

- **CR-01 (timezone anchoring):** `src/domain/time.ts` correctly derives Moscow wall-clock fields via a fixed UTC+3 shift and local-accessor round-trip, `forecastNextPayment` now sources "today" from `nowInMoscow()`, and `forecast.test.ts`'s test 7 concretely proves divergence from an unanchored UTC read across the 21:00–24:00 UTC gap window. Verified correct.
- **CR-02 / WR-01 (atomic upserts):** `replaceSalaryAt`, `upsertSchedule`, and `upsertYtdBaseline` all now use single-statement `INSERT ... ON CONFLICT ... DO UPDATE` against the correct unique targets, and are exercised by concurrent-write tests in `salary-repository.test.ts`. Verified correct.
- **WR-02 (gross-split reconciliation):** `halfSplitGross` floors the avans half and gives the remainder to salary, verified by a dedicated property-style test suite in `forecast.test.ts`. Verified correct.
- **WR-03 (DB check constraints):** `salary_gross_amount_positive` and `ytd_amount_nonnegative` exist and are proven live against Postgres by `schema.test.ts`. Verified correct, but incomplete — see WR-01/WR-02 below, a materially similar gap the same gap-closure plan did not cover.
- **WR-04 (bracket ordering assertion):** `assertStrictlyAscending` is implemented, wired into `bracketsForYear`'s chokepoint, and unit-tested including the "transposed pair" case. Verified correct.
- **WR-05 (product metadata):** `src/app/layout.tsx` carries real title/description metadata. Verified correct.

New issues found during this pass, independent of the prior review: one input-validation gap that lets ordinary form input trigger an unhandled server exception instead of a graceful validation message (Critical), and four quality/robustness gaps in the DB schema and repository layer that partially undercut the very defense-in-depth pattern WR-03 established.

## Critical Issues

### CR-01: Sub-half-kopeck gross salary input passes Zod validation but violates the DB check constraint, crashing the Server Action

**File:** `src/lib/validation/salary.ts:50-56`, `src/app/actions/salary.ts:71-99`, `src/lib/db/schema.ts:37`

**Issue:** `salaryInputSchema.grossRubles` only requires `gt(0, ...)` at ruble precision. `rublesToKopecks` (`src/domain/money.ts:21-23`) converts via `Math.round(rubles * 100)`. Any value in the open interval `(0, 0.005)` rubles — e.g. a user typing `0.001` — passes the `gt(0)` check but rounds to **0 kopecks** (`Math.round(0.1) === 0`). Because both `SalaryForm` and `ScheduleForm`/`YtdForm` render their `<form>` with `noValidate`, the browser's native `type="number" step="0.01"` constraint is explicitly disabled, so nothing stops this value from reaching `saveSalaryAction`.

`saveSalaryAction` then calls `replaceSalaryAt(userId, 0, effectiveFrom)` with no `try/catch`. The `salary_history` table's `salary_gross_amount_positive` check constraint (`grossAmountKopecks > 0`) rejects the insert at the database, and Postgres throws. That exception propagates uncaught out of the Server Action.

On the client, `pay-setup-forms.tsx`'s `submit()` (`src/components/pay-setup-forms.tsx:80-99`) also has no `try/catch` around `await saveSalaryAction(...)`, so the rejection surfaces as an unhandled promise rejection inside react-hook-form's `handleSubmit` wrapper instead of the intended `setServerError(...)` field-level message. The net effect: a plausible, non-malicious user input (a typo like `0.001` instead of `1000`) produces a hard, ungraceful failure instead of "Оклад должен быть больше нуля" or similar — exactly the failure mode the DB constraint (WR-03) and the Zod schema were both meant to prevent gracefully.

**Fix:** Align the validation boundary with the actual persisted precision — reject values that round to zero kopecks, and/or add a `try/catch` around the repository call so a constraint violation degrades to a field error instead of an unhandled throw:
```ts
// src/lib/validation/salary.ts
export const salaryInputSchema = z.object({
  grossRubles: z.coerce
    .number({ error: "Оклад должен быть числом" })
    .gt(0, "Оклад должен быть больше нуля")
    .max(MAX_RUBLES, "Оклад превышает допустимый максимум")
    .refine((v) => Math.round(v * 100) > 0, {
      message: "Оклад должен быть не меньше одной копейки",
    }),
  effectiveFrom: isoDateString,
});
```
```ts
// src/app/actions/salary.ts — defense in depth in case of any other future bypass
try {
  await replaceSalaryAt(userId, rublesToKopecks(grossRubles), effectiveFrom);
} catch (err) {
  return { success: false, fieldErrors: { grossRubles: ["Не удалось сохранить оклад."] } };
}
```

## Warnings

### WR-01: `payment_schedule` has no DB-level constraint enforcing `avansDay !== salaryDay`

**File:** `src/lib/db/schema.ts:44-58`

**Issue:** `scheduleInputSchema` (`src/lib/validation/salary.ts:62-78`) refines that `avansDay !== salaryDay`, but this invariant exists only at the Zod layer. `schema.ts`'s `paymentSchedule` table only checks each day is in `[1, 31]` independently — there is no `CHECK (avans_day <> salary_day)`. `schema.test.ts` already demonstrates, for the sibling positive/non-negative constraints, that a writer can and does bypass the Server Action / Zod layer entirely and write straight through Drizzle. Under that same bypass, a degenerate single-day schedule (`avansDay === salaryDay`) can be persisted, silently defeating the avans/salary split the rest of the domain logic (`resolve-payment-date.ts`, `pay-gap.ts`) assumes is meaningful.

**Fix:** Add the same style of check constraint used for `salary_gross_amount_positive`/`ytd_amount_nonnegative`:
```ts
(table) => [
  check("avans_day_range", sql`${table.avansDay} >= 1 AND ${table.avansDay} <= 31`),
  check("salary_day_range", sql`${table.salaryDay} >= 1 AND ${table.salaryDay} <= 31`),
  check("avans_salary_day_distinct", sql`${table.avansDay} <> ${table.salaryDay}`),
],
```

### WR-02: bigint "number"-mode money columns have no upper-bound check, unlike their lower-bound siblings

**File:** `src/lib/db/schema.ts:28`, `:69`

**Issue:** `grossAmountKopecks` and `amountKopecks` are declared `bigint(..., { mode: "number" })`. Drizzle's `mode: "number"` decodes the Postgres `bigint` value into a native JS `number`, which silently loses precision above `Number.MAX_SAFE_INTEGER` (2^53 − 1) rather than erroring. The application-level ceiling (`MAX_RUBLES = 100_000_000` in `src/lib/validation/salary.ts:36`) only bounds writes that go through the Zod-validated Server Actions. `schema.test.ts`'s own module comment states the check constraints exist specifically "to protect against future writers that never pass through a Server Action" — but only the lower bound got that protection. A write that bypasses Zod (exactly the pattern `schema.test.ts` itself exercises) can insert a `bigint` value beyond safe-integer range and get it silently corrupted on every subsequent read.

**Fix:** Add a matching upper-bound check, mirroring the app's own ceiling:
```ts
check("salary_gross_amount_bounded", sql`${table.grossAmountKopecks} <= 10000000000`), // 100,000,000 RUB in kopecks
```
(and similarly for `ytd_baseline.amount_kopecks`).

### WR-03: `replaceSalaryAt` overwrites `created_at` on every conflict-update, destroying the row's true creation time

**File:** `src/lib/db/salary-repository.ts:107-126`

**Issue:** `replaceSalaryAt`'s `onConflictDoUpdate` sets `{ grossAmountKopecks, createdAt: new Date() }`. Unlike `payment_schedule` and `ytd_baseline`, `salary_history` has no separate `updatedAt` column (`src/lib/db/schema.ts:19-39`) — `createdAt` is the only timestamp, and this code repurposes it as a de-facto "last written at" on every D-14 overwrite. That means the column's name no longer matches its semantics: after two writes to the same `(user, effectiveFrom)`, `createdAt` reflects the second write's time, not when the row was first created. This isn't used by any current query, but it is a real latent-data-integrity/naming defect that will confuse anyone using this column for audit or debugging later (and is inconsistent with the `updatedAt` pattern used everywhere else in this same file for the exact same "record when a write happened" need).

**Fix:** Either add a real `updatedAt` column to `salary_history` and stop touching `createdAt` on update, or explicitly omit `createdAt` from the `set` clause so it's only assigned by `defaultNow()` on the original insert:
```ts
.onConflictDoUpdate({
  target: [salaryHistory.userId, salaryHistory.effectiveFrom],
  set: { grossAmountKopecks }, // do not touch createdAt on update
})
```

### WR-04: `effectiveFrom`/`asOfDate` are never bounded relative to "today", so a future-dated YTD baseline silently produces a nonsensical cumulative figure once Phase 2/3 add dated income events

**File:** `src/lib/validation/salary.ts:39-44, 84-90`, `src/lib/db/salary-repository.ts:267-274`

**Issue:** `isoDateString` only validates format and calendar-validity, not ordering relative to "today". Nothing stops a user from saving a YTD baseline `asOfDate` in the future (e.g. next year). Currently this is inert because `getCumulativeIncomeBeforeDate`'s `sumAdditionalIncomeEventsBetween` is hardcoded to `0` (Phase 1 has no dated income events yet), so the `isoDate`/`asOfDate` relationship is never actually checked against anything. But the function's own doc comment explicitly plans for Phase 2/3 to turn this into a real `baseline.asOfDate < event.date <= isoDate` window query — at that point, an unvalidated future `asOfDate` (or a `asOfDate` that ends up after a resolved payment's date) will produce either double-counted or negative-window income sums with no error, since nothing today establishes the invariant "`asOfDate` must be on or before the date it's used as a baseline for."

**Fix:** Bound `asOfDate` (and arguably `effectiveFrom`, though D-13 explicitly wants past dates permitted there) to not exceed `todayIsoInMoscow()`:
```ts
export const ytdBaselineInputSchema = z.object({
  amountRubles: z.coerce.number(...).min(0, ...).max(MAX_RUBLES, ...),
  asOfDate: isoDateString.refine((v) => v <= todayIsoInMoscow(), {
    message: "Дата не может быть в будущем",
  }),
});
```

## Info

### IN-01: `formatKopecks` rounding strategy is inconsistent with the codebase's own documented ст.52 rounding rule

**File:** `src/domain/money.ts:35-42`

**Issue:** `roundToRuble` in `calculate-ndfl.ts` deliberately implements a specific "add 50, integer-divide" half-up rounding rule to match ст.52 НК РФ and to avoid floating-point tie-break ambiguity. `formatKopecks`, however, formats arbitrary (non-ruble-exact) figures like `forecast.grossKopecks`/`forecast.netKopecks` (which are not always multiples of 100 — see `halfSplitGross`'s odd-kopeck remainder) via `Intl.NumberFormat(..., { maximumFractionDigits: 0 })`, whose rounding behavior is engine/locale-defined and not guaranteed to match `roundToRuble`'s explicit rule. The discrepancy is at most half a kopeck and currently unlikely to be visible, but it's a latent inconsistency between the two money-rounding code paths in the same app.

**Fix:** Route `formatKopecks`'s input through `roundToRuble` before formatting, so both display and tax rounding follow one rule.

### IN-02: `SalaryForm.onConfirmReplace` bypasses `handleSubmit`/Zod validation and can act on a stale confirmation banner

**File:** `src/components/pay-setup-forms.tsx:105-107, 142-158`

**Issue:** `onConfirmReplace` calls `submit(getValues(), true)` directly instead of going through `handleSubmit`, so if the user edits `grossRubles`/`effectiveFrom` after the confirmation banner appears (without resubmitting normally first), the edited-but-unvalidated values are sent straight to the server. The server does re-validate via Zod, so no bad data reaches the DB, but client-side field errors are skipped for that path, and the visible `pendingConfirmation` text (which existing amount/date triggered the prompt) can be stale relative to what's actually about to be written.

**Fix:** Re-run `handleSubmit((values) => submit(values, true))()` from the confirm button instead of reading `getValues()` directly, so the same validation path applies on both submit routes.

### IN-03: No redirect-away for an already-authenticated user visiting `/login` or `/register`

**File:** `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx`

**Issue:** `(app)/layout.tsx` redirects an unauthenticated user away from the app to `/login`, but there is no equivalent guard the other direction — a signed-in user who navigates to `/login`/`/register` (e.g. via a stale bookmark or back-button) simply sees the auth forms again with no automatic redirect to `/`.

**Fix:** Add a lightweight session check at the top of both pages (or a small `(auth)/layout.tsx`) that redirects to `/` when `getSessionUser()` already returns a user.

### IN-04: `NEXT_PUBLIC_BETTER_AUTH_URL` is read via raw `process.env` outside the `@t3-oss/env-nextjs` schema

**File:** `src/lib/auth-client.ts:7`

**Issue:** `src/env.ts` validates `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL` via `createEnv`, specifically to catch a missing/malformed env var at build/boot time rather than at first use. `auth-client.ts` reads `process.env.NEXT_PUBLIC_BETTER_AUTH_URL` directly, bypassing that safety net entirely — a typo in the variable name would silently fall back to `undefined` (and then to the current origin) with no validation error, exactly the class of bug `@t3-oss/env-nextjs` was added to prevent.

**Fix:** Add a `client` block to `src/env.ts` for `NEXT_PUBLIC_BETTER_AUTH_URL` (optional, `z.string().url().optional()`) and import `env.NEXT_PUBLIC_BETTER_AUTH_URL` in `auth-client.ts` instead of touching `process.env` directly.

### IN-05: `forecast.test.ts` tests 1–6 compare against a live (non-frozen) `nowInMoscow()`, creating a rare midnight-boundary flake risk

**File:** `src/app/actions/forecast.test.ts:75-177`

**Issue:** Only test 7 freezes the clock (`vi.useFakeTimers()`); tests 1–6 call `nextPaymentOnOrAfter(schedule, nowInMoscow())` as the "expected" value at assertion time, separately from whatever instant `forecastNextPayment` itself observed a few lines earlier. If a run happens to straddle a Moscow-midnight (or a payment-date) boundary between the two calls, the two independently-computed "today"s could disagree, producing a rare, timing-dependent test failure unrelated to any actual code defect.

**Fix:** Freeze the clock in these tests too (matching the convention `time.test.ts` and `forecast.test.ts` test 7 already establish), so the "expected" and "actual" computations are guaranteed to observe the same instant.

---

_Reviewed: 2026-08-29T09:04:06Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
