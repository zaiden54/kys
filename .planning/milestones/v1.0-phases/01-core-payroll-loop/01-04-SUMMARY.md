---
phase: 01-core-payroll-loop
plan: 04
subsystem: payroll
tags: [nextjs, drizzle, drizzle-zod, zod, react-hook-form, server-actions, postgres]

# Dependency graph
requires:
  - phase: 01-core-payroll-loop (Plan 02)
    provides: "requireUserId() ownership anchor, mounted Better Auth, working register/login"
  - phase: 01-core-payroll-loop (Plan 03)
    provides: "src/domain/schedule/pay-gap.ts (exceedsMaxPayGap, D-04) and src/domain/money.ts (rublesToKopecks/kopecksToRubles)"
provides:
  - "src/lib/validation/salary.ts: drizzle-zod-derived persistence schemas plus hand-authored ruble-input Zod schemas for the three pay-setup Server Action boundaries"
  - "src/lib/db/salary-repository.ts: server-only, userId-scoped Drizzle access to salary_history/payment_schedule/ytd_baseline, incl. D-14 exact-effective-date overwrite and the baseline-plus-sum getCumulativeIncomeBeforeDate contract Phase 2/3 will extend"
  - "src/app/actions/salary.ts: saveSalaryAction, saveScheduleAction, saveYtdBaselineAction, skipYtdBaselineAction — all deriving userId from requireUserId()"
  - "src/components/pay-setup-forms.tsx: SalaryForm/ScheduleForm/YtdForm shared by onboarding and settings"
  - "/onboarding and /settings/salary routes; register now lands new accounts on /onboarding (D-09)"
affects: [01-05]

# Actuals (#2632)
actuals:
  tokens: 11700
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Uniform ownership predicate: every repository query (including single-row primary-key lookups on payment_schedule/ytd_baseline) carries an explicit eq(<table>.userId, userId) filter — greppable, no exception, matching the pattern established in Plan 01-02's session.ts"
    - "Manual check-then-write upsert (select-by-userId, then update-or-insert) for the single-row-per-user payment_schedule/ytd_baseline tables, chosen over Drizzle's onConflictDoUpdate so the ownership filter stays textually present on every statement"
    - "replaceSalaryAt implements D-14 as delete-then-insert (not a DB transaction) — the installed drizzle-orm/neon-http driver does not support interactive transactions; documented in code as an accepted risk for this app's single-writer-per-request usage pattern"
    - "getCumulativeIncomeBeforeDate written as baseline + sumAdditionalIncomeEventsBetween(...) from day one, with the sum function currently returning 0 — the explicit seam Phase 2 (bonuses) and Phase 3 (vacation pay) extend without a signature change"

key-files:
  created:
    - src/lib/validation/salary.ts
    - src/lib/db/salary-repository.ts
    - src/lib/db/salary-repository.test.ts
    - src/app/actions/salary.ts
    - src/components/pay-setup-forms.tsx
    - src/app/(app)/onboarding/page.tsx
    - src/app/(app)/settings/salary/page.tsx
  modified:
    - vitest.config.ts
    - src/app/(auth)/register/page.tsx

key-decisions:
  - "Task 1 decision (D-14 collision granularity): exact-date match, resolved by the human before this execution resumed — matches the salary_history_user_effective_from_uq unique index Plan 01-01 already created; no schema change"
  - "replaceSalaryAt uses delete-then-insert as two sequential statements, not a transaction — drizzle-orm/neon-http (the installed Neon HTTP driver) does not support interactive transactions at all, which the plan's RESEARCH.md reference code assumed was available"
  - "vitest.config.ts now loads .env.local via Node's built-in process.loadEnvFile so the DB-backed integration suite can read DATABASE_URL under `vitest run` — no new dependency added"
  - "getYtdBaseline synthesizes a zero/estimated default row (rather than returning null) for a user who never saved one, matching the plan's explicit acceptance criterion and giving getCumulativeIncomeBeforeDate a well-defined zero baseline"

patterns-established:
  - "Server Action result shape: { success: true, ... } | { success: false, needsConfirmation?: true, ... } | { success: false, fieldErrors }, consumed directly by the client form component rather than via React's useFormState/useActionState — kept simple since each form calls its action manually from an RHF onSubmit handler"

requirements-completed: [SAL-01, SAL-02, SAL-03, AUTH-02]

coverage:
  - id: D1
    description: "Zod validation layer: drizzle-zod-derived persistence schemas (salaryHistoryInsertSchema, paymentScheduleInsertSchema, ytdBaselineInsertSchema) plus hand-authored ruble-input schemas (salaryInputSchema, scheduleInputSchema, ytdBaselineInputSchema) with positive-amount, day-range, and past-date-allowed rules"
    requirement: "SAL-01"
    verification:
      - kind: unit
        ref: "Task 2 <verify> node assertion script (server-only/no-console/ownership-count/export checks) + npx tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D2
    description: "Ownership-scoped salary_history repository proving D-14's exact-effective-date collision/overwrite (Task 1's resolved decision) and per-user isolation"
    requirement: "SAL-02"
    verification:
      - kind: integration
        ref: "src/lib/db/salary-repository.test.ts (7/7 tests pass against the live Neon DB)"
        status: pass
    human_judgment: false
  - id: D3
    description: "getCumulativeIncomeBeforeDate implemented as baseline-plus-sum (not a bare baseline read), equal to the stored baseline for a user with one and zero for a user without"
    requirement: "SAL-03"
    verification:
      - kind: integration
        ref: "src/lib/db/salary-repository.test.ts#getCumulativeIncomeBeforeDate"
        status: pass
    human_judgment: false
  - id: D4
    description: "Server Actions boundary: every action calls requireUserId() and accepts no client-supplied userId, parses FormData through Zod before any DB call, D-14 pre-overwrite disclosure via findSalaryAt, D-04 non-blocking gap warning via exceedsMaxPayGap, no logging calls"
    requirement: "SAL-01"
    verification:
      - kind: unit
        ref: "Task 3 <verify> node assertion script (server-module/no-console/action-exports/requireUserId-count/no-userId-param/exceedsMaxPayGap/findSalaryAt/register-redirect checks) + npx tsc --noEmit + npm run build"
        status: pass
    human_judgment: false
  - id: D5
    description: "/onboarding and /settings/salary are auth-gated and render SalaryForm, ScheduleForm, and YtdForm; the YTD question renders unconditionally on /onboarding (D-09, no month-based conditional); /settings/salary additionally renders the dated salary-history list (SAL-02)"
    requirement: "SAL-03"
    verification:
      - kind: integration
        ref: "ad hoc read-path script run this session against a live dev server (anonymous GET redirects, authenticated GET renders all three Russian-language form headings plus the history section) — not a committed test file"
        status: pass
    human_judgment: false
  - id: D6
    description: "Full interactive UX: salary/schedule save round-trip, D-04 gap-warning display, D-13 backdated entry appearing in history, D-14 confirm-before-replace modal flow on an exact-date collision, D-10 YTD edit clearing the estimated flag, and AUTH-02 two-browser cross-device parity"
    requirement: "SAL-01, SAL-02, SAL-03, AUTH-02"
    verification: []
    human_judgment: true
    rationale: "This execution sandbox has no browser available to the executor (same limitation documented in 01-02-SUMMARY.md's D4 and 01-03-SUMMARY.md's D4). Task 3's own <human-check> block enumerates these 7 steps explicitly as the manual verification plan requires. The underlying data layer (D2/D3) and the Server Action boundary (D4) are proven by automated tests; what remains unverified is the browser-rendered interaction itself — form submission, the confirmation modal's actual appearance, and real cross-device session parity."

# Metrics
duration: 45min
completed: 2026-08-28
status: complete
---

# Phase 1 Plan 4: Salary/Schedule/YTD Input Slice Summary

**Zod-validated Server Actions writing through an ownership-scoped Drizzle repository into salary_history/payment_schedule/ytd_baseline, surfaced by a first-run onboarding flow and an always-available settings page — the first slice where a signed-in user can record and correct what they actually earn.**

## Performance

- **Duration:** ~45 min (resumed after a Task 1 checkpoint; no code existed at resume start)
- **Started:** 2026-08-28T20:26:00Z (approx., resume point)
- **Completed:** 2026-08-28T20:43:45Z
- **Tasks:** 3 (Task 1 was a `checkpoint:decision` resolved by the human before this execution — no code; Tasks 2-3 committed)
- **Files modified:** 9 (7 created, 2 modified)

## Accomplishments
- `src/lib/validation/salary.ts` — two-layer validation: `drizzle-zod`-derived persistence schemas kept in step with `src/lib/db/schema.ts`, plus hand-authored ruble-input schemas (positive-amount, 1..31 day range, avans≠salary, past dates allowed for D-13)
- `src/lib/db/salary-repository.ts` — server-only, userId-scoped access to all three app tables; `replaceSalaryAt` implements D-14's exact-effective-date overwrite (Task 1's resolved decision); `getCumulativeIncomeBeforeDate` written as baseline-plus-sum from day one per RESEARCH.md's anti-pattern guidance
- `src/lib/db/salary-repository.test.ts` — 7 integration tests against the live Neon DB proving D-14 collision/overwrite, D-13 backdating, active-salary-at-date lookup, and per-user ownership isolation (T-01-01)
- `src/app/actions/salary.ts` — four Server Actions, each deriving `userId` exclusively from `requireUserId()`, validating via Zod before any DB write, disclosing a pending D-14 overwrite before it happens, and surfacing the D-04 gap warning as non-blocking
- `src/components/pay-setup-forms.tsx` — `SalaryForm`/`ScheduleForm`/`YtdForm` (react-hook-form + Zod resolver), shared by onboarding and settings
- `/onboarding` (first-run, YTD always shown per D-09) and `/settings/salary` (edit-anytime per D-10, plus dated salary history for SAL-02); registration now routes new accounts to `/onboarding`
- All 52 project Vitest tests pass (7 new); `npm run build` and `npx tsc --noEmit` both exit 0; a live-dev-server read-path check confirmed both routes are auth-gated and render correctly

## Task Commits

1. **Task 1: Confirm D-14 collision granularity** — no commit (checkpoint:decision, resolved by the human as `exact-date` before this execution resumed)
2. **Task 2: Validation schemas and the ownership-scoped salary repository** — `a3f676c` (feat)
3. **Task 3: Server Actions plus the onboarding and settings pay-setup surfaces** — `5e3c5fa` (feat)

**Plan metadata:** committed immediately after this file.

## Files Created/Modified
- `src/lib/validation/salary.ts` - persistence (drizzle-zod) + input (hand-authored) Zod schemas
- `src/lib/db/salary-repository.ts` - ownership-scoped repository for all three pay-setup tables
- `src/lib/db/salary-repository.test.ts` - integration suite against the live Neon DB
- `src/app/actions/salary.ts` - four Server Actions (save salary/schedule/YTD, skip YTD)
- `src/components/pay-setup-forms.tsx` - SalaryForm, ScheduleForm, YtdForm client components
- `src/app/(app)/onboarding/page.tsx` - first-run pay setup route
- `src/app/(app)/settings/salary/page.tsx` - edit-anytime settings route with salary history
- `vitest.config.ts` - loads `.env.local` via `process.loadEnvFile` for DB-backed test runs
- `src/app/(auth)/register/page.tsx` - post-signup navigation now targets `/onboarding`

## Decisions Made
- D-14 collision granularity resolved as **exact-date match** by the human before this execution resumed (Task 1's checkpoint:decision) — matches the `salary_history_user_effective_from_uq` unique index already in the schema; no migration needed.
- `replaceSalaryAt` implements D-14 as **delete-then-insert as two sequential statements**, not inside a DB transaction — `drizzle-orm/neon-http` (the actually-installed Neon driver) does not support interactive transactions at all, which the plan's RESEARCH.md reference code implicitly assumed. Accepted as a low-risk gap for this app's single-writer-per-request usage pattern; documented in the function's doc comment.
- `payment_schedule`/`ytd_baseline` upserts use a manual select-then-update-or-insert pattern rather than Drizzle's `onConflictDoUpdate`, so the ownership `eq(<table>.userId, userId)` filter stays textually present on every statement per the plan's "no exception, uniform, greppable" instruction.
- `getYtdBaseline` synthesizes a zero/estimated default row for a user with no saved baseline (rather than returning `null`), matching the plan's explicit acceptance criterion and giving `getCumulativeIncomeBeforeDate` a well-defined zero to fold forward from.
- `vitest.config.ts` loads `.env.local` via Node's built-in `process.loadEnvFile` (Node 20.6+) so the new DB-backed integration suite can read `DATABASE_URL` under `vitest run`, which — unlike `next dev`/`next build` — does not load `.env.local` automatically. No new dependency added.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `vitest run` had no path to `DATABASE_URL`, blocking the new integration suite**
- **Found during:** Task 2 (writing `salary-repository.test.ts`)
- **Issue:** The plan's test-database strategy requires the integration suite to run against the real `DATABASE_URL`-named Neon database, but `vitest.config.ts` had no mechanism to load `.env.local` — `@t3-oss/env-nextjs`'s `createEnv` would throw on a missing `DATABASE_URL` the moment `src/lib/db/index.ts` was imported under `vitest run`.
- **Fix:** Added a small `process.loadEnvFile(...)` call (Node's built-in env-file loader, no new dependency) at the top of `vitest.config.ts`, wrapped in try/catch so pure-domain test runs without a configured DB still succeed.
- **Files modified:** `vitest.config.ts`
- **Verification:** `npx vitest run` — all 52 tests (including the 7 new DB-backed ones) pass
- **Committed in:** `a3f676c` (Task 2 commit)

**2. [Rule 1 - Bug] RESEARCH.md's D-14 reference implementation assumed a DB transaction the installed driver does not support**
- **Found during:** Task 2 (implementing `replaceSalaryAt`)
- **Issue:** `01-RESEARCH.md`'s code example wraps the delete-then-insert in `db.transaction(...)`, but `drizzle-orm/neon-http`'s `NeonHttpSession.transaction()` is a stub that does not actually run an interactive transaction (the Neon HTTP driver has no session-level transaction support at all — confirmed by inspecting the driver's own type declarations, which mark the callback parameters as unused).
- **Fix:** Implemented `replaceSalaryAt` as two sequential statements (delete, then insert) without wrapping them in `db.transaction(...)`, with a doc comment explaining why and naming the accepted risk (a vanishingly small race window for a single-writer-per-request row pair, not a transaction-atomicity guarantee).
- **Files modified:** `src/lib/db/salary-repository.ts`
- **Verification:** `src/lib/db/salary-repository.test.ts`'s D-14 test (backdated write onto an existing exact effective date leaves exactly one row) passes
- **Committed in:** `a3f676c` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking — missing env var path for tests, 1 bug — an untested-driver-capability assumption in the plan's own reference code)
**Impact on plan:** Both fixes were necessary for the plan's own explicitly-required deliverables (the integration test suite, and a working `replaceSalaryAt`) to actually run/be correct. No scope creep, no architectural change.

## Issues Encountered
- The Task 3 `<human-check>` block (7 interactive steps: register→onboarding, salary+schedule save, D-04 gap warning display, D-13 backdated history, D-14 confirm-and-replace modal, D-10 YTD edit, AUTH-02 two-browser parity) could not be performed by a human in this session — this execution sandbox has no browser, matching the same limitation already documented in 01-02-SUMMARY.md (D4) and 01-03-SUMMARY.md (D4). As partial substitute confidence, an ad hoc (not committed) read-path script was run against a live `next dev` server this session, proving both `/onboarding` and `/settings/salary` are auth-gated and render all three forms (plus the history section on settings) correctly — see `coverage.D5`. The genuinely interactive parts remain flagged in `coverage.D6` with `human_judgment: true`.
- A second `next dev` server was already running on port 3000 from a concurrent session sharing this working tree (per this execution's `<sequential_execution>` context, this is expected and was pre-approved). The ad hoc verification script targeted that existing server rather than starting a duplicate.

## User Setup Required

None - no new external service configuration required for this plan's scope. `DATABASE_URL` was already configured and verified in prior plans.

## Next Phase Readiness
- The full salary/schedule/YTD data model is validated, ownership-scoped, and proven correct by integration tests — ready for Plan 01-05 to wire `getActiveSalaryAt`/`getSchedule`/`getCumulativeIncomeBeforeDate` into the `forecastNextPayment()` orchestration and the home-screen forecast card.
- `getCumulativeIncomeBeforeDate`'s baseline-plus-sum shape is the seam Phase 2 (bonuses) and Phase 3 (vacation pay) extend without a signature change — no rewrite anticipated.
- **Carried-forward blockers (unchanged from 01-02/01-03, not addressed by this plan):** the Task 3 human-check (this plan) and the equivalent items in 01-02/01-03 (two-browser AUTH-02 check, D-06/D-08 visual confirmation, НДФЛ bracket primary-statute confirmation) all remain outstanding, pending a human UAT session with real browser access — recommended before `/gsd-verify-work` on this phase.
- No other blockers identified for Plan 01-05.

---
*Phase: 01-core-payroll-loop*
*Completed: 2026-08-28*

## Self-Check: PASSED

- All 7 created files (`src/lib/validation/salary.ts`, `src/lib/db/salary-repository.ts`, `src/lib/db/salary-repository.test.ts`, `src/app/actions/salary.ts`, `src/components/pay-setup-forms.tsx`, `src/app/(app)/onboarding/page.tsx`, `src/app/(app)/settings/salary/page.tsx`) and both modified files (`vitest.config.ts`, `src/app/(auth)/register/page.tsx`) verified present on disk with `[ -f ]`.
- Both task commit hashes (`a3f676c`, `5e3c5fa`) verified present via `git log --oneline --all`.
- Plan-level `<verification>` re-run: `npx vitest run` — 52/52 pass; `npm run build` and `npx tsc --noEmit` both exit 0; ownership assertion (10 `eq(<table>.userId, ...)` occurrences ≥ 8) and no-logging assertion (0 `console.` matches) both pass for the repository and actions modules; Task 3's automated grep+tsc assertion script passes.
- Task 3 `<human-check>` NOT performed by a human in this session (no browser access) — recorded as `human_judgment: true` in `coverage.D6` and in "Next Phase Readiness," not silently marked complete. A read-path-only automated substitute (`coverage.D5`) was run and passed.
