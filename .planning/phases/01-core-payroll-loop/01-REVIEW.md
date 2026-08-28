---
phase: 01-core-payroll-loop
reviewed: 2026-08-28T21:06:56Z
depth: standard
files_reviewed: 49
files_reviewed_list:
  - AGENTS.md
  - CLAUDE.md
  - drizzle.config.ts
  - .env.example
  - eslint.config.mjs
  - .gitignore
  - next.config.ts
  - package.json
  - postcss.config.mjs
  - public/file.svg
  - public/globe.svg
  - public/next.svg
  - public/vercel.svg
  - public/window.svg
  - README.md
  - scripts/verify-auth-flow.mjs
  - src/app/actions/forecast.test.ts
  - src/app/actions/forecast.ts
  - src/app/actions/salary.ts
  - src/app/api/auth/[...all]/route.ts
  - src/app/(app)/layout.tsx
  - src/app/(app)/onboarding/page.tsx
  - src/app/(app)/page.tsx
  - src/app/(app)/settings/salary/page.tsx
  - src/app/(auth)/login/page.tsx
  - src/app/(auth)/register/page.tsx
  - src/app/favicon.ico
  - src/app/globals.css
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
  - src/domain/tax/ndfl-brackets.ts
  - src/env.ts
  - src/lib/auth-client.ts
  - src/lib/auth.ts
  - src/lib/db/auth-schema.ts
  - src/lib/db/index.ts
  - src/lib/db/salary-repository.test.ts
  - src/lib/db/salary-repository.ts
  - src/lib/db/schema.ts
  - src/lib/session.ts
  - src/lib/validation/salary.ts
  - tsconfig.json
  - vitest.config.ts
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-08-28T21:06:56Z
**Depth:** standard
**Files Reviewed:** 49 (scaffold-default files — `public/*.svg`, `favicon.ico`, `eslint.config.mjs`, `postcss.config.mjs`, `next.config.ts`, `AGENTS.md` — were spot-checked only, per reviewer instructions)
**Status:** issues_found

## Summary

The core domain engines (`src/domain/tax`, `src/domain/schedule`) are well-designed, thoroughly tested, and carefully documented — the progressive НДФЛ cumulative-rounding logic and the payment-date resolver both correctly implement the tricky rules they describe, and their test suites exercise real edge cases (bracket boundaries, holiday chaining, D-day clamping) rather than happy-path-only assertions.

The weak points are at the seams: (1) the app never establishes an explicit Europe/Moscow anchor for "today," and mixes `toISOString()` (always UTC) with bare `new Date()` (server-local, effectively undefined on typical serverless deployments) to compute the date that drives the app's single core value proposition — the next payment's date and amount; and (2) the salary-history write path is a non-atomic check-then-delete-then-insert sequence that can lose a user's data on partial failure, a real risk given the module's own comment acknowledges the underlying driver has no transaction support. Several smaller robustness and consistency gaps round out the findings below.

## Critical Issues

### CR-01: No explicit timezone anchor — "today" is computed inconsistently and can be off by a calendar day near midnight in Russia

**File:** `src/app/actions/forecast.ts:98`
**Also affects:** `src/app/(app)/onboarding/page.tsx:13`, `src/app/(app)/settings/salary/page.tsx:16`, `src/components/pay-setup-forms.tsx:55`, `src/app/actions/salary.ts:151`, `src/lib/db/salary-repository.ts:181`

**Issue:** This is a RU-only PWA (per CLAUDE.md: "Пользователь может заранее и точно спланировать бюджет, зная сумму и дату ближайшей выплаты") whose single most important number is "the date and amount of the next payment," yet no file anywhere in the reviewed set anchors "today" to `Europe/Moscow`. Two distinct incorrect patterns are used interchangeably:

1. `forecast.ts:98` passes a bare `new Date()` into `nextPaymentOnOrAfter`, which then reads `getFullYear()/getMonth()/getDate()` off it (`resolve-payment-date.ts:85-91,113-119`). Those accessors return the **server process's local timezone**, which is unset/undefined on typical serverless (Vercel) deployments and defaults to UTC. Moscow is UTC+3, so for the first ~3 hours of every Moscow calendar day, the server still believes it is "yesterday" — a payment scheduled for "today" (MSK) will not yet be considered due, and a payment that was actually paid yesterday (MSK) may still be reported as the upcoming one.
2. `onboarding/page.tsx:13`, `settings/salary/page.tsx:16`, and `pay-setup-forms.tsx:55` all compute `new Date().toISOString().slice(0, 10)`. `toISOString()` is **always UTC**, regardless of server configuration — this is wrong on every deployment, not just misconfigured ones. Near midnight MSK (21:00–24:00 UTC = 00:00–03:00 MSK the next day), this yields **yesterday's** date, so `getActiveSalaryAt(userId, today)` on the settings page can show the previous salary as "active" and the salary-entry date picker defaults to the wrong day, for the first three hours of every new day in Russia.

Compounding this: `skipYtdBaselineAction` (`salary.ts:151`) and `defaultYtdBaseline` (`salary-repository.ts:181`) both use `new Date().getFullYear()`, which is subject to the same class of bug at the Dec 31/Jan 1 boundary — a user skipping YTD entry at 23:30 MSK on Dec 31 (20:30 UTC, still "this year" in UTC) gets a baseline dated to the correct year, but the same call at 00:30 MSK on Jan 1 (21:30 UTC Dec 31, still "last year" in UTC) would date the baseline to the *previous* year, mis-seeding the cumulative-tax baseline for the new tax year.

**Fix:** Introduce a single `today()`/`nowInMoscow()` helper (e.g. via `date-fns-tz`'s `toZonedTime(new Date(), "Europe/Moscow")`, or a hand-rolled UTC+3 offset since Russia does not observe DST) and route every "what is today" computation in the app through it, replacing both the `toISOString().slice(0,10)` pattern and the bare `new Date()` passed to `nextPaymentOnOrAfter`.

```ts
// src/domain/moscow-time.ts (new)
import { toZonedTime, format as formatTz } from "date-fns-tz";

const MOSCOW_TZ = "Europe/Moscow";

export function nowInMoscow(): Date {
  return toZonedTime(new Date(), MOSCOW_TZ);
}

export function todayIsoInMoscow(): string {
  return formatTz(nowInMoscow(), "yyyy-MM-dd", { timeZone: MOSCOW_TZ });
}
```

---

### CR-02: `replaceSalaryAt` can permanently lose a user's salary row on partial failure (non-atomic delete-then-insert)

**File:** `src/lib/db/salary-repository.ts:101-120`
**Also affects:** `src/app/actions/salary.ts:74-84` (check-then-write race)

**Issue:** `replaceSalaryAt` deletes the existing row for `(userId, effectiveFrom)` and then inserts the replacement as two sequential, non-transactional statements (the comment at lines 96-99 explicitly acknowledges the Neon HTTP driver doesn't support interactive transactions). If the `delete` succeeds and the subsequent `insert` throws for any reason — a dropped connection, a transient Neon error, a future DB-level constraint the app-level Zod validation didn't anticipate — the user's previously-saved salary row for that date is gone and nothing is written in its place. The thrown error propagates to `saveSalaryAction` uncaught, so the user sees a generic failure with no indication their data was just deleted. This is a genuine, unrecoverable data-loss path, not merely a theoretical concurrency edge case — Neon's HTTP driver is documented to be more failure-prone across network boundaries than a persistent connection, which is exactly the situation this two-step write runs under on every call.

This compounds with the check-then-write race in `saveSalaryAction`: `findSalaryAt` (existence check) and `replaceSalaryAt` (delete+insert) are two separate round trips with no locking between them, so two near-simultaneous submissions (double-click, or the same user editing from two devices — explicitly a supported scenario per this project's "cloud sync between devices" core constraint) can both observe "no existing row," both proceed to write, and the confirmation-required UX (D-14) never fires for either, silently discarding whichever write lands second.

**Fix:** At minimum, wrap the delete+insert in a single `INSERT ... ON CONFLICT (user_id, effective_from) DO UPDATE SET gross_amount_kopecks = excluded.gross_amount_kopecks` using the existing `salary_history_user_effective_from_uq` unique index — this makes the replace atomic and removes the partial-failure window entirely, without requiring interactive-transaction support:

```ts
export async function replaceSalaryAt(
  userId: string,
  grossAmountKopecks: number,
  effectiveFrom: string,
): Promise<SalaryHistoryRow> {
  const [row] = await db
    .insert(salaryHistory)
    .values({ userId, grossAmountKopecks, effectiveFrom })
    .onConflictDoUpdate({
      target: [salaryHistory.userId, salaryHistory.effectiveFrom],
      set: { grossAmountKopecks },
    })
    .returning();
  if (!row) throw new Error("replaceSalaryAt: upsert returned no row");
  return row;
}
```

## Warnings

### WR-01: `upsertSchedule` / `upsertYtdBaseline` use a select-then-branch pattern that races under concurrent writes

**File:** `src/lib/db/salary-repository.ts:141-173, 212-248`
**Issue:** Both functions `SELECT` to check for an existing row, then conditionally `UPDATE` or `INSERT` based on that result — two round trips with no locking. Two concurrent calls for the same `userId` (e.g. the same user submitting the schedule form from two open tabs/devices, which is explicitly this app's target usage pattern per the "cloud sync between devices" core constraint) can both see "no existing row" and both attempt `INSERT`, and the second insert throws a primary-key violation that propagates uncaught to the Server Action caller as an opaque 500-style failure instead of the intended "just save my current value" upsert behavior.
**Fix:** Use Drizzle's `onConflictDoUpdate` against the primary key, matching the pattern suggested in CR-02:
```ts
const [row] = await db
  .insert(paymentSchedule)
  .values({ userId, avansDay, salaryDay })
  .onConflictDoUpdate({ target: paymentSchedule.userId, set: { avansDay, salaryDay, updatedAt: new Date() } })
  .returning();
```

### WR-02: `halfSplitGross` rounds each half independently, so avans + salary don't always reconcile to the monthly gross

**File:** `src/app/actions/forecast.ts:74-83`
**Issue:** The doc comment claims "the annual total across twelve months is always `oklad * 12`," but `halfSplitGross` computes `Math.round(monthlyGrossKopecks / 2)` independently for whichever payment is being forecast — it is not told "this is the first half" vs "this is the second half." For a gross amount with an odd kopeck count (fully reachable: the salary form accepts two decimal places, e.g. `100000.01` ₽ → `10_000_001` kopecks), `Math.round(10_000_001 / 2) = Math.round(5_000_000.5) = 5_000_001` — both the avans and the salary payment independently round to `5_000_001`, summing to `10_000_002`, one kopeck more than the actual monthly gross of `10_000_001`. This is the exact class of drift the tax engine's own doc comments elsewhere (`calculate-ndfl.ts:6-11`) go out of their way to warn against ("never round each payment's tax independently, which would compound rounding drift"), applied here to gross instead of tax.
**Fix:** Make the split explicit and reconciling — e.g. avans gets `Math.floor(gross / 2)` and salary gets `gross - Math.floor(gross / 2)` (or vice versa, consistently), so the two halves always sum to exactly `gross` regardless of parity:
```ts
function halfSplitGross(monthlyGrossKopecks: Kopecks, kind: PaymentKind): Kopecks {
  const avansShare = Math.floor(monthlyGrossKopecks / 2);
  return kind === "avans" ? avansShare : monthlyGrossKopecks - avansShare;
}
```

### WR-03: `salary_history.gross_amount_kopecks` and `ytd_baseline.amount_kopecks` have no DB-level positivity check, unlike `payment_schedule`

**File:** `src/lib/db/schema.ts:19-38, 62-70` (contrast with the `check(...)` constraints at `43-57`)
**Issue:** `payment_schedule` enforces `avans_day`/`salary_day` in `[1, 31]` at the database layer via `check()`. `salary_history.grossAmountKopecks` and `ytd_baseline.amountKopecks` have no equivalent constraint (e.g. `> 0` and `>= 0` respectively), relying entirely on the Zod schemas in `src/lib/validation/salary.ts` to keep bad values out. Since the app's own module docs explicitly worry about defense-in-depth for money values (see the "ownership predicate stays uniform" reasoning in `salary-repository.ts:19-21`), the same reasoning applies to value bounds — any future code path that writes to these tables outside `saveSalaryAction`/`saveYtdBaselineAction` (a migration script, an admin tool, a Phase 2/3 feature) has no backstop against a negative or nonsensical amount reaching the tax engine.
**Fix:** Add matching `check()` constraints, e.g. `check("gross_amount_positive", sql`${table.grossAmountKopecks} > 0`)` and `check("ytd_amount_nonnegative", sql`${table.amountKopecks} >= 0`)`.

### WR-04: НДФЛ bracket selection assumes `NDFL_SCALES` entries are ascending-sorted with no runtime assertion

**File:** `src/domain/tax/calculate-ndfl.ts:45-62`, `src/domain/tax/ndfl-brackets.ts:41-57`
**Issue:** `taxOnCumulative`'s bracket-selection loop (`for (const candidate of brackets) { if (cumulative >= candidate.fromKopecks) bracket = candidate; else break; }`) is only correct if `brackets` is sorted ascending by `fromKopecks` — true today by construction of the single hand-written `NDFL_SCALE_2025` array, but nothing enforces it. This codebase is otherwise unusually careful about failing loudly instead of silently computing a wrong number (`UnsupportedTaxYearError`'s entire reason for existing, per `ndfl-brackets.ts:12-14`); a future annual bracket update that appends an out-of-order or mistyped threshold to a new `NDFL_SCALES` entry would silently select the wrong bracket rather than throw, exactly the failure mode this module otherwise goes to lengths to avoid.
**Fix:** Assert sortedness once, e.g. in `bracketsForYear` after lookup, or in a module-level self-check over `NDFL_SCALES`:
```ts
function assertAscending(brackets: readonly NdflBracket[]): void {
  for (let i = 1; i < brackets.length; i++) {
    if (brackets[i].fromKopecks <= brackets[i - 1].fromKopecks) {
      throw new Error(`NDFL bracket scale is not strictly ascending at index ${i}`);
    }
  }
}
```

### WR-05: Root layout still ships `create-next-app`'s scaffold metadata in production

**File:** `src/app/layout.tsx:15-18`
**Issue:** `metadata.title` is `"Create Next App"` and `metadata.description` is `"Generated by create next app"` — this is the unmodified `create-next-app` scaffold, not the product's actual name ("НаРуки"). This is user-visible in the browser tab, in social/link previews, and (once a PWA manifest and `apple-mobile-web-app-title` are wired up per the stack's Serwist plan) as the name shown when a user adds the app to their iPhone home screen — a core requirement of this project per CLAUDE.md's PWA constraint.
**Fix:**
```ts
export const metadata: Metadata = {
  title: "НаРуки",
  description: "Расчёт и прогноз зарплаты «на руки» с учётом НДФЛ",
};
```

## Info

### IN-01: `NEXT_PUBLIC_BETTER_AUTH_URL` is read via raw `process.env`, undocumented and unvalidated

**File:** `src/lib/auth-client.ts:7`, `.env.example:1-3`
**Issue:** `authClient` reads `process.env.NEXT_PUBLIC_BETTER_AUTH_URL` directly rather than through `src/env.ts`'s `@t3-oss/env-nextjs` schema (which only declares `DATABASE_URL`/`BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`, all server-only). This variable also isn't listed in `.env.example`, so a deployment that needs a client baseURL different from same-origin (e.g. a separate API subdomain) has no discoverable place to configure it, and a typo'd value would fail silently rather than at startup like the other three env vars.
**Fix:** Add a `client` block to `createEnv` in `src/env.ts` declaring `NEXT_PUBLIC_BETTER_AUTH_URL` as optional, and document it in `.env.example` with a comment noting the same-origin fallback.

### IN-02: `bigint(... mode: "number")` kopeck columns have no runtime bound against `Number.MAX_SAFE_INTEGER`

**File:** `src/lib/db/schema.ts:28, 66`
**Issue:** `grossAmountKopecks` and `ytdBaseline.amountKopecks` are stored as Postgres `bigint` (correctly sized to avoid the 32-bit overflow the comment calls out) but read back into JS as `mode: "number"`. Currently safe because `MAX_RUBLES = 100_000_000` in `src/lib/validation/salary.ts` caps every write well under `Number.MAX_SAFE_INTEGER`, but there is no assertion tying that cap to the column's safe range — if `MAX_RUBLES` is ever raised without revisiting this, values could silently lose precision on read instead of failing loudly.
**Fix:** A code comment cross-referencing `MAX_RUBLES` in `schema.ts`, or a shared constant, would keep the two in sync; not urgent given the current cap.

### IN-03: Hardcoded test credential in a dev-only script

**File:** `scripts/verify-auth-flow.mjs:53`
**Issue:** `const password = "correct-horse-battery-staple-1";` is a hardcoded plaintext credential. Low risk since this script is not shipped to production and only exercises throwaway, randomly-suffixed email accounts against a dev/test database, but flagging per standard hygiene — hardcoded credentials are easy to accidentally reuse or copy-paste into a context where they matter.
**Fix:** Generate the password alongside the unique email (`` `pw-${randomUUID()}` ``) for defense-in-depth, though not blocking.

---

_Reviewed: 2026-08-28T21:06:56Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
