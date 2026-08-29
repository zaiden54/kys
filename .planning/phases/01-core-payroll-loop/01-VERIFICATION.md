---
phase: 01-core-payroll-loop
verified: 2026-08-29T00:15:00Z
status: gaps_found
score: 2/5 must-haves verified
behavior_unverified: 1
overrides_applied: 0
gaps:
  - truth: "User can change their salary amount, and the system retains a dated history of prior salary values (SAL-02)"
    status: failed
    reason: "Confirmed present in current codebase (matches 01-REVIEW.md CR-02, unresolved): replaceSalaryAt (src/lib/db/salary-repository.ts:101-120) performs a non-atomic delete-then-insert with no transaction (the Neon HTTP driver doesn't support one). If the insert fails after the delete succeeds, the user's salary row for that date is permanently gone with no rollback and no user-visible warning that data was lost. This compounds with a check-then-write race in saveSalaryAction (src/app/actions/salary.ts:74-84): findSalaryAt and replaceSalaryAt are two unlocked round trips, so two near-simultaneous submissions — explicitly a supported scenario per this app's cross-device-sync core constraint — can both observe 'no existing row' and both write, silently bypassing the D-14 confirm-before-overwrite guarantee the plan's own must_haves.prohibitions marked 'resolved'. This is a live, unresolved data-integrity defect in a financial app, not a theoretical edge case."
    artifacts:
      - path: "src/lib/db/salary-repository.ts"
        issue: "replaceSalaryAt (lines 101-120): sequential delete then insert, no transaction, no rollback on partial failure"
      - path: "src/app/actions/salary.ts"
        issue: "saveSalaryAction (lines 59-87): findSalaryAt existence check and replaceSalaryAt write are two unlocked round trips — a race window that can bypass the D-14 confirmation UX"
    missing:
      - "Atomic upsert via INSERT ... ON CONFLICT (user_id, effective_from) DO UPDATE, as the review's own suggested fix demonstrates, removing both the partial-failure window and the check-then-write race"
  - truth: "The home screen shows the amount and date of the next upcoming payment, taxed via the progressive НДФЛ scale applied to cumulative year-to-date income (TAX-01, TAX-02, HOME-01)"
    status: failed
    reason: "The tax computation itself is correct and well-tested (58/58 Vitest tests pass, domain engine verified against bracket boundaries). But the DATE half of this truth is unreliable: confirmed present in current codebase (matches 01-REVIEW.md CR-01, unresolved) — no file anywhere anchors 'today' to Europe/Moscow. src/app/actions/forecast.ts:98 passes a bare `new Date()` into nextPaymentOnOrAfter, which reads local-timezone accessors that default to UTC on typical serverless deployments (Moscow is UTC+3) — for the first ~3 hours of every Moscow calendar day the server can still believe it is 'yesterday'. src/app/(app)/onboarding/page.tsx:13, src/app/(app)/settings/salary/page.tsx:16, and src/components/pay-setup-forms.tsx:55 all use `new Date().toISOString().slice(0,10)`, which is always UTC regardless of server config — wrong on every deployment near MSK midnight, not just misconfigured ones. This directly undermines the app's stated core value ('точно спланировать бюджет, зная сумму и дату ближайшей выплаты' — PROJECT.md) since the shown 'next payment' date can be off by a day for real users in Russia. The same root cause also mis-years the YTD baseline at the Dec 31/Jan 1 boundary (src/app/actions/salary.ts:151, src/lib/db/salary-repository.ts:181, both use `new Date().getFullYear()`), touching SAL-03's zero-baseline dating."
    artifacts:
      - path: "src/app/actions/forecast.ts"
        issue: "Line 98: bare `new Date()` passed to nextPaymentOnOrAfter — no Europe/Moscow anchor"
      - path: "src/app/(app)/onboarding/page.tsx"
        issue: "Line 13: `new Date().toISOString().slice(0,10)` is always UTC"
      - path: "src/app/(app)/settings/salary/page.tsx"
        issue: "Line 16: same UTC-slice pattern"
      - path: "src/components/pay-setup-forms.tsx"
        issue: "Line 55: same UTC-slice pattern in SalaryForm's default effectiveFrom"
      - path: "src/app/actions/salary.ts"
        issue: "Line 151: `new Date().getFullYear()` in skipYtdBaselineAction — can mis-year the baseline at the Dec31/Jan1 MSK boundary"
      - path: "src/lib/db/salary-repository.ts"
        issue: "Line 181: same getFullYear() pattern in defaultYtdBaseline"
    missing:
      - "A single `nowInMoscow()`/`todayIsoInMoscow()` helper (e.g. via date-fns-tz's toZonedTime, or a hand-rolled UTC+3 offset since Russia doesn't observe DST) that every 'what is today' computation in the app routes through, replacing both the bare `new Date()` passed to `nextPaymentOnOrAfter` and every `toISOString().slice(0,10)` call"
human_verification:
  - test: "Two-browser AUTH-02 cross-device check: sign in as the same account in two independent browser sessions and confirm both see identical salary/schedule/YTD/forecast data."
    expected: "Identical data on both sessions, since both read the same per-user Postgres rows through independently-authenticated sessions (no client-side cache, no conflict resolution)."
    why_human: "No browser is available in any execution sandbox used across all five plans (consistently documented as human_judgment: true in every plan's SUMMARY.md coverage block). Only ad hoc, uncommitted scripts and architectural review have substituted for this so far."
  - test: "Visual confirmation that /register and /login carry no email-verification interstitial and no forgot-password/reset-password affordance (D-06, D-08)."
    expected: "Sign-up completes immediately with no verification step; neither page shows a password-reset link."
    why_human: "grep-based checks confirm no matching strings exist in source, but the actual rendered UX has not been visually confirmed in a browser."
  - test: "Confirm the 2025 НДФЛ bracket thresholds (0 / 2,400,000 / 5,000,000 / 20,000,000 / 50,000,000 rub), rates (13/15/18/20/22%), and fixed bases (312,000 / 702,000 / 3,402,000 / 9,402,000 rub) in src/domain/tax/ndfl-brackets.ts against the primary НК РФ ст.224 statute text (pravo.gov.ru or consultant.ru's full-article view)."
    expected: "All values match the primary statute text exactly, and the scale is confirmed still in force (justifying MAX_VERIFIED_TAX_YEAR = 2026)."
    why_human: "No live web access in this verification sandbox (same limitation documented in 01-03-SUMMARY.md's D4 and carried forward in STATE.md as an open blocker). Note: src/domain/tax/ndfl-brackets.ts's file-header comment currently claims this was 're-confirmed against primary statute text as part of this plan's task 1 human-check' — that claim is not supported by 01-03-SUMMARY.md, which explicitly records the human-check as NOT performed (no web access) and the item as an open blocker. The code comment should be corrected to avoid asserting a verification that did not happen."
  - test: "D-11 banner persists across a real page reload; D-14 confirm-before-replace modal actually appears and behaves as designed; D-04 gap-warning renders next to a successful schedule save; D-13 backdated salary entries appear in the dated history list; D-02 the shown next-payment date is correct against a real calendar for a schedule day landing on a weekend/RU holiday; the next-payment card's wording genuinely reads as a non-authoritative forecast; a future-dated salary change produces no visible 'upcoming raise' indicator anywhere (D-15)."
    expected: "All behave as designed when interacted with in a real browser against a running dev server."
    why_human: "No browser available in any execution sandbox; only ad hoc/uncommitted scripts and static code assertions have substituted for this across all five plans."
---

# Phase 1: Core Payroll Loop Verification Report

**Phase Goal:** A registered user can enter their gross salary and avans/salary payment schedule and see an accurate amount and date for their next take-home payment, computed via the progressive 2025 НДФЛ scale applied cumulatively from the start of the calendar year — with data synced across their devices.
**Verified:** 2026-08-29
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can register and log in; logging in from a second device shows the same salary/schedule data (AUTH-01, AUTH-02) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Register/login/session code is real and tested (`scripts/verify-auth-flow.mjs` proves register→session→protected-read plus duplicate/concurrent-signup edges per 01-02-SUMMARY.md; `src/lib/session.ts`'s `requireUserId()` is the sole ownership anchor, verified wired into every action/repository call). The cross-device sync claim itself rests on architecture only (single Postgres row per user, session-cookie auth, no cache) — no committed automated test proves two independent sessions read identical data; every plan's SUMMARY records this as `human_judgment: true` because no browser was available to any execution session. |
| 2 | User can enter a gross salary and configure avans + salary payment dates twice a month (SAL-01) | ✓ VERIFIED | `src/lib/validation/salary.ts` (Zod schemas, `createInsertSchema` from drizzle-zod), `src/lib/db/salary-repository.ts`, `src/app/actions/salary.ts`, `src/components/pay-setup-forms.tsx` (SalaryForm/ScheduleForm) fully wired; live Neon DB confirmed to hold `salary_history`/`payment_schedule` with `bigint` money columns, 1..31 day check constraints, and the `salary_history_user_effective_from_uq` unique index. 58/58 Vitest tests pass, `npx tsc --noEmit` and `npm run build` exit 0. |
| 3 | User can change their salary amount, and the system retains a dated history of prior salary values (SAL-02) | ✗ FAILED | Basic functionality works and is tested (`salary-repository.test.ts` D-13/D-14 scenarios pass; `listSalaryHistory` renders on `/settings/salary`). But `replaceSalaryAt`'s non-atomic delete-then-insert and the unlocked `findSalaryAt`→`replaceSalaryAt` race (01-REVIEW.md CR-02, confirmed still present) mean a partial failure can permanently lose a salary row, and concurrent submissions — an explicitly supported cross-device scenario for this app — can silently bypass the D-14 confirm-before-overwrite guarantee. See gaps. |
| 4 | On first use, user can optionally enter YTD income, or sees an explicit warning assuming zero income since Jan 1 (SAL-03) | ✓ VERIFIED | `/onboarding` renders `YtdForm` unconditionally (no month conditional, confirmed by grep and by reading the page); `skipYtdBaselineAction` stores a zero, `isEstimated: true` baseline; `YtdEstimateBanner` is a persistent, non-dismissible server component rendered only while `baselineIsEstimated` is true; `/settings/salary` allows editing it anytime (D-10). Note: the same `new Date().getFullYear()` timezone gap documented under Truth 5 can mis-year this baseline right at the Dec31/Jan1 MSK boundary — a narrow-window instance of the same unresolved root cause, not a separate defect. |
| 5 | Home screen shows amount and date of next payment, taxed via the progressive НДФЛ scale (13/15/18/20/22%) applied to cumulative YTD income, avans/salary as independent taxable events (TAX-01, TAX-02, HOME-01) | ✗ FAILED | Tax computation itself is correct and thoroughly tested: `calculateNdfl`/`taxOnCumulative` (`src/domain/tax/calculate-ndfl.ts`) implement cumulative marginal calculation with ст.52 rounding exactly as specified, avans and salary share one code path, `forecastNextPayment` (`src/app/actions/forecast.ts`) folds this correctly, no tax logic reaches the presentation layer (grep-verified). But the DATE half of this truth is unreliable: `forecast.ts:98` passes a bare `new Date()` (server-local/UTC-dependent) into the schedule resolver, and three other files use `toISOString().slice(0,10)` (always UTC) — both confirmed present in the current codebase (01-REVIEW.md CR-01, unresolved). This can show the wrong next-payment date and the wrong "active" salary for roughly the first 3 hours of every Moscow calendar day, on every deployment. See gaps. |

**Score:** 2/5 truths verified (1 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/env.ts` | Boot-validated env | ✓ VERIFIED | Exports `env`, validates `DATABASE_URL`/`BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` |
| `src/lib/db/index.ts` | Drizzle client bound to Neon | ✓ VERIFIED | `drizzle({ client: neon(env.DATABASE_URL) })` |
| `src/lib/db/schema.ts` | `salary_history`, `payment_schedule`, `ytd_baseline` | ✓ VERIFIED | Live DB confirms all 3 tables, `bigint` money columns, unique index, check constraints |
| `src/lib/auth.ts` | Better Auth server config | ✓ VERIFIED | email+password, `requireEmailVerification: false` (D-06), 30-day `expiresIn` (D-07), no OAuth/reset config |
| `src/lib/db/auth-schema.ts` | Generated Better Auth tables | ✓ VERIFIED | `user`/`session`/`account`/`verification` present in live DB |
| `src/lib/auth-client.ts` | Browser auth client | ✓ VERIFIED | `createAuthClient`, exports `authClient` |
| `src/lib/session.ts` | `getSessionUser`/`requireUserId` | ✓ VERIFIED | Reads `auth.api.getSession`, `requireUserId()` redirects to `/login`, `server-only` guard present |
| `src/app/api/auth/[...all]/route.ts` | Better Auth route handler | ✓ VERIFIED | `toNextJsHandler(auth)`, Node runtime |
| `src/app/(auth)/register/page.tsx`, `login/page.tsx` | Auth forms | ✓ VERIFIED | react-hook-form + Zod, no forgot-password link, register routes to `/onboarding` |
| `src/app/(app)/layout.tsx` | Auth-gated shell | ✓ VERIFIED | Redirects to `/login` when `getSessionUser()` is null |
| `src/domain/money.ts`, `src/domain/tax/*`, `src/domain/schedule/*` | Pure domain engines | ✓ VERIFIED | Zero I/O imports (grep-enforced in each module's own tests); 45 domain-level Vitest tests pass |
| `src/lib/validation/salary.ts` | Zod input + drizzle-zod persistence schemas | ✓ VERIFIED | `createInsertSchema` used 3+ times, positive-amount/day-range/backdating rules present |
| `src/lib/db/salary-repository.ts` | Ownership-scoped repository | ⚠️ ORPHANED-RISK (functional but unsafe) | All 9 functions present, ownership filter uniform (`eq(table.userId, userId)`), but `replaceSalaryAt` is non-atomic — see gaps |
| `src/app/actions/salary.ts` | Server Actions | ✓ VERIFIED (with race caveat) | All 4 actions call `requireUserId()`, no client-supplied userId, D-04 warning non-blocking — see gaps for the check-then-write race |
| `src/components/pay-setup-forms.tsx` | Salary/Schedule/YTD forms | ✓ VERIFIED | All 3 exported, D-14 confirm UI, D-04 warning display present |
| `src/app/(app)/onboarding/page.tsx`, `settings/salary/page.tsx` | Pay-setup routes | ✓ VERIFIED | Both render all 3 forms; settings additionally renders `listSalaryHistory` |
| `src/app/actions/forecast.ts` | Forecast orchestration | ✓ VERIFIED (date caveat) | Correct ordering (schedule→event→salary-at-date→cumulative→tax), `UnsupportedTaxYearError` propagates uncaught, no logging — but see the timezone gap |
| `src/components/next-payment-card.tsx`, `ytd-estimate-banner.tsx` | Home screen display | ✓ VERIFIED | No tax computation in presentation layer (grep-verified), banner has no dismiss control/storage |
| `src/app/(app)/page.tsx` | Home screen | ✓ VERIFIED | Calls `requireUserId()`→`forecastNextPayment()`, renders not-configured prompt with no money value when applicable |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/lib/auth.ts` | `src/lib/db/index.ts` | `drizzleAdapter(db, {...})` | ✓ WIRED | Confirmed in source |
| `src/lib/session.ts` | `src/lib/auth.ts` | `auth.api.getSession({headers})` | ✓ WIRED | Confirmed in source |
| `src/app/actions/salary.ts` | `src/lib/session.ts` | `requireUserId()` | ✓ WIRED | Every action calls it first |
| `src/app/actions/salary.ts` | `src/lib/validation/salary.ts` | `schema.safeParse` | ✓ WIRED | Confirmed for all 3 input schemas |
| `src/lib/db/salary-repository.ts` | `src/lib/db/schema.ts` | `eq(table.userId, userId)` filters | ✓ WIRED | Uniform ownership predicate on every query |
| `src/app/actions/forecast.ts` | `src/domain/tax/calculate-ndfl.ts` | `calculateNdfl(...)` | ✓ WIRED | Sole tax computation site, confirmed by grep across presentation layer (absent there) |
| `src/app/actions/forecast.ts` | `src/domain/schedule/resolve-payment-date.ts` | `nextPaymentOnOrAfter(...)` | ✓ WIRED | Confirmed, but fed a non-Moscow-anchored `Date` — see gaps |
| `src/app/(app)/page.tsx` | `src/app/actions/forecast.ts` | server-render call | ✓ WIRED | Computed during RSC render, not client-fetched |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `next-payment-card.tsx` | `forecast.netKopecks`/`grossKopecks`/`taxKopecks` | `forecastNextPayment()` → `calculateNdfl()` → live `salary_history`/`ytd_baseline` rows via Neon | Yes | ✓ FLOWING |
| `onboarding/page.tsx`, `settings/salary/page.tsx` | Prefilled form defaults | `getActiveSalaryAt`/`getSchedule`/`getYtdBaseline` → live DB | Yes | ✓ FLOWING |
| `settings/salary/page.tsx` history list | `listSalaryHistory(userId)` | Live `salary_history` table, ownership-filtered | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full project test suite runs and passes | `npx vitest run` | 5 test files, 58/58 tests pass | ✓ PASS |
| Type checking is clean | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Live schema matches plan (7 tables, bigint money cols, unique index) | direct Neon query via `@neondatabase/serverless` | all 7 tables present, both money columns `bigint`, `salary_history_user_effective_from_uq` present | ✓ PASS |
| `scripts/verify-auth-flow.mjs` (e2e register/login/duplicate/race) | not re-run (requires a live dev server + fresh DB mutations) | — | ? SKIP — SUMMARY.md documents this was run and passed in the execution session; not re-run here per the no-server-start/no-mutation spot-check constraint |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| AUTH-01 | 01-01, 01-02 | Register/login | ✓ SATISFIED | Register/login pages, Better Auth mount, e2e script (per SUMMARY) |
| AUTH-02 | 01-01, 01-02, 01-04 | Cross-device sync | ? NEEDS HUMAN | Architecture sound (session + shared Postgres row); no browser-verified cross-device test in any session |
| SAL-01 | 01-01, 01-03, 01-04 | Enter salary + avans/salary schedule | ✓ SATISFIED | Full input→persist→display chain verified |
| SAL-02 | 01-01, 01-04 | Change salary, retain history | ✗ BLOCKED | Retains history in the happy path, but CR-02's atomicity/race defect threatens the guarantee under failure/concurrency |
| SAL-03 | 01-01, 01-04, 01-05 | YTD entry or explicit zero-income warning | ✓ SATISFIED | Unconditional YTD question, persistent banner, editable anytime |
| TAX-01 | 01-03, 01-05 | Progressive НДФЛ, cumulative from Jan 1 | ✓ SATISFIED (computation) | Domain engine exhaustively tested; bracket primary-source confirmation still an open item (see human_verification) |
| TAX-02 | 01-03, 01-05 | Avans/salary as independent taxable events | ✓ SATISFIED | Single shared code path, proven by tests |
| HOME-01 | 01-02, 01-05 | Home screen shows next payment amount + date | ✗ BLOCKED | Amount computation correct; date computation unreliable near MSK midnight/year boundary (CR-01) |

No orphaned requirements — all 8 phase-1 IDs (AUTH-01, AUTH-02, SAL-01, SAL-02, SAL-03, TAX-01, TAX-02, HOME-01) are claimed across the 5 plans' `requirements` frontmatter and appear in REQUIREMENTS.md's traceability table.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/db/salary-repository.ts` | 106-113 | Non-atomic delete-then-insert (`replaceSalaryAt`) | 🛑 Blocker | Confirmed unresolved instance of 01-REVIEW.md CR-02 |
| `src/app/actions/forecast.ts` | 98 | Bare `new Date()`, no timezone anchor | 🛑 Blocker | Confirmed unresolved instance of 01-REVIEW.md CR-01 |
| `src/app/(app)/onboarding/page.tsx`, `settings/salary/page.tsx`, `pay-setup-forms.tsx` | 13, 16, 55 | `new Date().toISOString().slice(0,10)` (always UTC) | 🛑 Blocker | Same CR-01 family |
| `src/app/actions/salary.ts`, `src/lib/db/salary-repository.ts` | 151, 181 | `new Date().getFullYear()` at year boundary | 🛑 Blocker | Same CR-01 family, affects SAL-03 baseline year |
| `src/domain/tax/ndfl-brackets.ts` | 8-10 | File-header comment claims primary-statute re-confirmation happened | ⚠️ Warning | Contradicts 01-03-SUMMARY.md's explicit "NOT performed (no web access)" record — misleading doc comment, should be corrected |
| `src/lib/db/salary-repository.ts` | 141-173, 212-248 | `upsertSchedule`/`upsertYtdBaseline` select-then-branch race (01-REVIEW.md WR-01) | ⚠️ Warning | Same class of defect as CR-02 but lower severity (no confirm-UX bypass) |
| `src/app/actions/forecast.ts` | 81-83 | `halfSplitGross` independent per-half rounding (01-REVIEW.md WR-02) | ⚠️ Warning | 1-kopeck drift possible on odd-kopeck gross amounts |
| `src/lib/db/schema.ts` | 19-38, 62-70 | No DB-level positivity check on money columns (01-REVIEW.md WR-03) | ⚠️ Warning | Defense-in-depth gap, Zod is the only backstop |
| `src/domain/tax/calculate-ndfl.ts` | 45-62 | Bracket-ascending-order assumed, not asserted (01-REVIEW.md WR-04) | ℹ️ Info | Correct today, no runtime guard for future scale edits |
| `src/app/layout.tsx` | 15-18 | create-next-app scaffold metadata still in place (01-REVIEW.md WR-05) | ℹ️ Info | Cosmetic; PWA manifest work is Phase 4 scope |

No `TBD`/`FIXME`/`XXX` debt markers found in phase-modified files.

### Human Verification Required

See frontmatter `human_verification`. In summary: the AUTH-02 two-browser cross-device check, D-06/D-08 visual confirmation, the НДФЛ bracket primary-statute confirmation (open blocker carried from Plan 01-03), and the remaining Task 3 (Plan 01-05) visual/interactive checks (D-11 reload persistence, D-02 real-calendar cross-check, D-15 visual confirmation, card wording) — none of these had browser access in any execution session and are consistently documented as such in every plan's SUMMARY.md, not silently marked complete.

### Gaps Summary

The phase's architecture is sound and the large majority of it is genuinely built, wired, and tested: 58/58 Vitest tests pass, `tsc`/`build` are clean, the live Neon database matches the schema exactly, ownership scoping is uniform and greppable, and the tax/schedule domain engines are pure and exhaustively tested against real edge cases. This is not a stub-riddled phase.

However, two Critical findings from the phase's own code review (01-REVIEW.md, committed 2026-08-28) remain unresolved in the current codebase, and both were independently re-confirmed by direct code inspection during this verification:

1. **CR-02 (SAL-02):** `replaceSalaryAt`'s non-atomic delete-then-insert, compounded by an unlocked check-then-write race in `saveSalaryAction`, can permanently lose a user's salary data on partial failure and can silently bypass the D-14 confirm-before-overwrite UX under concurrent writes — a scenario this app explicitly supports (cross-device editing of the same account).
2. **CR-01 (HOME-01/TAX-01/TAX-02, and touching SAL-03):** No file anchors "today" to Europe/Moscow. A bare `new Date()` feeds the payment-date resolver, and three other call sites use `toISOString().slice(0,10)` (always UTC) — both confirmed present. This can show the wrong next-payment date and the wrong "active" salary for roughly the first three hours of every Moscow calendar day, on every deployment, undermining the app's stated core value proposition of a precisely-dated forecast.

Both are fixable with the specific, concrete remediations 01-REVIEW.md already proposed (an `onConflictDoUpdate` atomic upsert for CR-02; a single `nowInMoscow()`/`todayIsoInMoscow()` helper routed through everywhere for CR-01). Given this is a financial-planning app whose entire value proposition is "know precisely when and how much," both are treated as blockers rather than warnings.

---

_Verified: 2026-08-29_
_Verifier: Claude (gsd-verifier)_
