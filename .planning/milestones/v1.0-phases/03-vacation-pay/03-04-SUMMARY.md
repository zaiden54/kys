---
phase: 03-vacation-pay
plan: 04
subsystem: api, ui
tags: [next-server-actions, react-hook-form, zod, forecast, vacation-pay]

# Dependency graph
requires:
  - phase: 03-vacation-pay
    provides: "03-01's calculateVacationDays/calculateAverageDailyEarnings/calculateVacationPayGross/resolveVacationPaymentDate pure engine"
  - phase: 03-vacation-pay
    provides: "03-02's required BonusType ('premium'|'compensation') on every bonus row"
  - phase: 03-vacation-pay
    provides: "03-03's vacation-repository.ts CRUD/overlap/delete-guard and getCumulativeIncomeBeforeDate's vacation-accrual extension"
provides:
  - "saveVacationAction (create+edit, server-side overlap-checked) and deleteVacationAction (payment-date-guarded) in src/app/actions/vacation.ts"
  - "selectNextPaymentEvent widened to a third vacation-event candidate; forecastNextPayment resolves a vacation-only next event, taxed through the unchanged calculateNdfl engine"
  - "NextPaymentCard renders the отпускные row and the always-visible, non-dismissible D-V12 disclaimer"
  - "/vacations route: create/edit form, live day-count hint, full UI-SPEC-compliant history list with empty state and per-row edit/delete"
affects: [home-screen-forecast, annual-summary-phase-4]

# Actuals (#2632)
actuals:
  tokens: 10348
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "selectNextPaymentEvent's three-candidate resolution: push schedule/bonus/vacation in a fixed order into one array, then a stable sort on dateIso — the push order alone determines exact-date tie-break precedence, no explicit if/else chain of tie rules needed"
    - "A vacation-only forecast branch never populates NextPaymentForecast.breakdown and never calls getActiveSalaryAt, mirroring the pre-existing bonus-only branch's shape exactly rather than inventing a new combined-payment representation"

key-files:
  created:
    - src/app/actions/vacation.ts
    - src/app/actions/vacation.test.ts
    - src/app/(app)/vacations/page.tsx
    - src/app/(app)/vacations/vacation-form.tsx
    - src/app/(app)/vacations/vacation-row.tsx
  modified:
    - src/app/actions/forecast.ts
    - src/app/actions/forecast.test.ts
    - src/components/next-payment-card.tsx
    - src/app/(app)/layout.tsx

key-decisions:
  - "selectNextPaymentEvent's three-way tie-break (schedule beats bonus beats vacation) is implemented via fixed push order + Array.prototype.sort's guaranteed stability, not an explicit comparator chain — verified directly by four dedicated unit tests (null/all-empty, differing dates, three-way tie, bonus-vs-vacation tie) plus two live-database integration tests."
  - "A vacation-only resolved event's paymentGrossKopecks comes exclusively from calculateVacationPayGross, never combined with any same-date bonusKopecksOnDate — by construction of the tie-break rule, a vacation can never win the next-payment slot on a date a bonus or schedule event also occupies, so this never actually loses data in practice."
  - "Task 1's vacation.ts/page.tsx were written in a genuinely create-only, minimal-placeholder form first, verified in isolation (tsc + forecast.test.ts with Task 2's files temporarily removed from the working tree), committed, and only then extended to Task 2's edit/delete/full-list version — preserving true per-task commit atomicity despite both tasks touching the same two files."

patterns-established: []

requirements-completed: [VAC-01, VAC-02, VAC-03]

coverage:
  - id: D1
    description: "A vacation saved through a real Server Action is taxed through the unchanged cumulative calculateNdfl engine and, when it is the soonest upcoming event, appears as the home screen's unified next-payment forecast with the отпускные amount"
    requirement: "VAC-02"
    verification:
      - kind: integration
        ref: "src/app/actions/forecast.test.ts#(15) a user with no payment_schedule row and one future vacation gets a configured vacation forecast taxed through calculateNdfl"
        status: pass
      - kind: integration
        ref: "src/app/actions/forecast.test.ts#(18) a vacation saved through the server action appears in the forecast (tracer's end-to-end proof)"
        status: pass
    human_judgment: false
  - id: D2
    description: "selectNextPaymentEvent correctly resolves a three-way schedule/bonus/vacation candidate set, including the documented tie-break order (schedule beats bonus beats vacation)"
    requirement: "VAC-02"
    verification:
      - kind: unit
        ref: "src/app/actions/forecast.test.ts#selectNextPaymentEvent (5 cases: null vacation-only, earliest-of-three, three-way tie, bonus-vs-vacation tie, all-empty)"
        status: pass
      - kind: integration
        ref: "src/app/actions/forecast.test.ts#(16) a vacation whose computed payment date is earlier than both the next scheduled event and the next bonus date wins the next-payment slot"
        status: pass
      - kind: integration
        ref: "src/app/actions/forecast.test.ts#(17) an exact-date tie between a bonus and a vacation resolves to the bonus (tie-break order)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The home screen's vacation display always shows the exact non-dismissible D-V12 caption directly below the отпускные amount"
    requirement: "VAC-03"
    verification:
      - kind: unit
        ref: "grep -n \"Расчёт не учитывает исключаемые периоды\" src/components/next-payment-card.tsx (unconditional render, no dismiss state anywhere in the component)"
        status: pass
    human_judgment: true
    rationale: "Grep proves the exact string is present in an unconditional render branch; visually confirming placement/hierarchy on a real rendered card is a UI judgment call this SUMMARY's Deviations section documents as not click-through-verified in this autonomous session (see WINDOWS.md entry)."
  - id: D4
    description: "A vacation can be created, edited, and deleted (subject to the D-V10 payment-date guard) entirely through /vacations, with server-side overlap enforcement on both create and edit"
    requirement: "VAC-01"
    verification:
      - kind: unit
        ref: "src/app/actions/vacation.test.ts (9 cases: create, edit, overlap on create, overlap on edit, not-found on edit, repository-error hiding, blocked delete, not-found delete, malformed-id rejection)"
        status: pass
    human_judgment: false
  - id: D5
    description: "/vacations satisfies the UI-SPEC's empty-state, populated-list, and edit/delete-row states, and is reachable from the app's main navigation"
    requirement: "VAC-01"
    verification:
      - kind: unit
        ref: "grep -n 'href=\"/vacations\"' src/app/(app)/layout.tsx; grep -n \"Нет отпусков\" src/app/(app)/vacations/page.tsx"
        status: pass
    human_judgment: true
    rationale: "Grep and a successful `npm run build` (route /vacations compiles and is registered as dynamic) prove the markup exists and the module graph is sound; the full click-through UAT (add/edit/overlap/blocked-delete/nav flows in a real browser) specified in 03-VALIDATION.md's Manual-Only Verifications row was not performed in this autonomous single-session execution — recorded as an open unrun-verify item in .planning/WINDOWS.md rather than silently skipped."

duration: 45min
completed: 2026-08-30
status: complete
---

# Phase 3 Plan 04: Vacation Server Actions, Forecast Integration, and UI Summary

**A vacation saved through `/vacations` now flows end-to-end into the home screen's unified next-payment forecast — taxed through the same cumulative `calculateNdfl` engine as salary/bonus, with the always-visible D-V12 disclaimer — and `/vacations` gained the full create/edit/delete history list matching 03-UI-SPEC.md.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2
- **Files modified:** 9 (5 new, 4 modified)

## Accomplishments

- `selectNextPaymentEvent` in `src/app/actions/forecast.ts` widened from a two-candidate (schedule/bonus) to a three-candidate (schedule/bonus/vacation) resolver, using a fixed push order + stable sort so the existing schedule-beats-bonus tie-break naturally extends to "and both beat vacation" with no new branching logic.
- `forecastNextPayment` resolves a vacation-only next event by computing its gross live via `calculateVacationPayGross` (full salary history + premium-filtered bonuses, never a stored amount) and taxing it through the exact same `getCumulativeIncomeBeforeDate` → `calculateNdfl` path every other payment kind uses — no separate vacation-specific tax code path exists anywhere.
- `src/app/actions/vacation.ts` exports `saveVacationAction` (create-or-edit by presence of `id`, server-side `checkOverlapVacations` before every write) and `deleteVacationAction` (UUID-validated, deferring to `deleteVacationIfFuture`'s D-V10 payment-date guard) — the overlap and delete-guard enforcement cannot be bypassed by a modified client calling the action directly.
- `NextPaymentCard` renders a dedicated `kind === "vacation"` branch: the отпускные amount, immediately followed by the exact, unconditional D-V12 caption ("Расчёт не учитывает исключаемые периоды…"), then withheld tax — with no dismiss state or hidden flag anywhere in the component.
- `/vacations` now has a real create form (`VacationForm`, live `{N} дней отпуска` hint via `calculateVacationDays`) and a full history list (`VacationRow`) matching every resolved UI-SPEC List/Edit/Delete state: empty-state card, column headers, per-row edit (React Hook Form `values`/`reset()` + `editSessionRef` resync pattern, identical to `bonus-row.tsx`), and delete (`window.confirm` with the exact UI-SPEC copy, "Удаляется…" pending state, the exact D-V10 blocked message).
- An "Отпуска" nav link was added to the app header alongside the existing "Бонусы" link.

## Task Commits

Each task was committed atomically. Because Tasks 1 and 2 both extend `src/app/actions/vacation.ts` and `src/app/(app)/vacations/page.tsx`, Task 1's commit captures those two files in their genuine create-only / minimal-placeholder form (verified in isolation — `tsc --noEmit` and `forecast.test.ts` run with Task 2's not-yet-existing files removed from the working tree) before Task 2 extends them:

1. **Task 1: Tracer — a saved vacation is taxed and appears as the next-payment forecast** - `86e26f2` (feat)
2. **Task 2: Edit/delete Server Actions and the full UI-SPEC-compliant vacation list** - `66d0890` (feat)

## Files Created/Modified

- `src/app/actions/forecast.ts` - `NextPaymentForecast.kind`/`vacationId` widened; `selectNextPaymentEvent` gains a third vacation-event parameter; `forecastNextPayment` gains a vacation-only branch (live gross via `calculateVacationPayGross`, `getActiveSalaryAt` never called, `breakdown` stays `undefined`)
- `src/app/actions/forecast.test.ts` - 4 new integration cases ((15)-(18): no-schedule vacation forecast, earliest-of-three-wins, bonus-vs-vacation tie, tracer save-then-forecast) plus a 5-case `selectNextPaymentEvent` pure-unit `describe` block
- `src/app/actions/vacation.ts` - new module: `VacationActionResult`, `saveVacationAction` (create+edit), `deleteVacationAction`
- `src/app/actions/vacation.test.ts` - new: 9 mocked-boundary cases mirroring `bonus.test.ts`'s style
- `src/components/next-payment-card.tsx` - `KIND_LABELS.vacation`; a dedicated vacation-kind render branch with the D-V12 caption
- `src/app/(app)/vacations/page.tsx` - new route: create form + full history list (empty-state card, column headers, per-row `VacationRow` with server-precomputed gross)
- `src/app/(app)/vacations/vacation-form.tsx` - new: create form with live day-count hint
- `src/app/(app)/vacations/vacation-row.tsx` - new: display/edit/delete row component
- `src/app/(app)/layout.tsx` - added the "Отпуска" nav link

## Decisions Made

- `selectNextPaymentEvent`'s tie-break is implemented via fixed push order (schedule, bonus, vacation) plus JavaScript's guaranteed-stable `Array.prototype.sort`, rather than an explicit multi-branch comparator — the same technique already implicit in the pre-existing two-candidate version, now proven explicitly correct for three candidates by five dedicated unit tests.
- A vacation-only event's gross never combines with a same-date bonus (`breakdown` stays `undefined`) — per the plan's own pre-resolved "Design decisions," this is safe because the tie-break rule guarantees a vacation can never win the next-payment slot on a date a bonus or schedule event also occupies.
- Task 1's two shared files (`vacation.ts`, `vacations/page.tsx`) were deliberately written, isolation-verified, and committed in their genuine Task-1-only form before being extended for Task 2, to preserve true per-task commit atomicity rather than let Task 2's changes silently ride along in Task 1's commit.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' behavioral contracts, exact Russian copy, and threat-model mitigations (`T-03-10` through `T-03-14`) were implemented as specified with no bug fixes, missing-functionality additions, or blocking issues encountered.

## Issues Encountered

While authoring test (16) (a vacation payment date beating both a scheduled event and a bonus), an initial January-2026 date choice landed inside the RU New Year holiday chain (Jan 1–8, verified directly against `date-holidays@3.36.0`'s live output): `resolveVacationPaymentDate`'s backward weekend/holiday shift walked the computed date past `todayIsoInMoscow()` and out of `futureVacationEventsAscending`'s future filter entirely, so the vacation candidate silently disappeared from `selectNextPaymentEvent`'s input and the test failed with `kind: "bonus"` instead of `"vacation"`. Resolved by moving the test's frozen clock and dates into September 2026, a month independently confirmed to be holiday-free — not a production code defect, purely a test-data construction issue caught by the test's own first run.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. Every UI-SPEC state resolved as in-scope for this plan (per 03-04-PLAN.md's "Flagged assumptions") is implemented with real data — no hardcoded empty/placeholder values reach any rendered component.

## Manual UAT Not Performed (recorded, not silently skipped)

This plan's two `<human-check>` blocks — Task 1's tracer preview check and Task 2's full VAC-01/02/03 manual UAT (03-VALIDATION.md's Manual-Only Verifications row) — specify browser click-through steps (`npm run dev`, visit `/vacations`, add/edit/delete a vacation, observe the home screen). This execution ran as a single autonomous sequential session with no interactive browser tool invoked, and `.planning/config.json`'s `workflow.auto_advance`/`workflow._auto_chain_active` were both `false` (interactive checkpoint mode), yet no user was present to click through a running dev server mid-session.

In lieu of the literal click-through, this plan substituted:
- A full production build (`npm run build`) succeeding, with `/vacations` compiling and registering as a dynamic server-rendered route.
- The complete automated suite passing clean: 315 tests across 24 files, including 23 real-database `forecast.test.ts` integration cases (covering every one of the plan's specified vacation scenarios: no-schedule forecast, tie-breaks, and the tracer's own save-then-forecast round trip) and 9 mocked `vacation.test.ts` cases covering every specified create/edit/overlap/delete/malformed-id path.
- Every acceptance-criteria `grep` from both tasks, confirmed passing.

This gap is recorded as an open `unrun-verify` entry in `.planning/WINDOWS.md` (kind: `unrun-verify`, phase 03) rather than silently dropped, per the executor's broken-windows ledger protocol. A human should still complete the literal browser walkthrough before considering VAC-01/02/03 fully closed for UAT purposes.

## Next Phase Readiness

- Phase 3's three requirements (VAC-01, VAC-02, VAC-03) are now implemented end-to-end: vacation entry, average-earnings-based отпускные calculation, next-payment forecast integration, and the non-dismissible D-V12 disclaimer.
- Phase 4 (annual pie-chart summary, PWA installability) can build on a complete income picture: salary, bonuses, and vacation отпускные are all now visible to `getCumulativeIncomeBeforeDate` and `forecastNextPayment`.
- Outstanding: the browser-based manual UAT walkthrough documented above (`.planning/WINDOWS.md` unrun-verify entry) should be completed by a human before Phase 3 is considered fully closed out.
- Statute-verification flag carried forward from Phase 1 (2025 НДФЛ bracket thresholds, ст.139 ТК РФ's 29.3 divisor) remains open per STATE.md Blockers/Concerns — no live web access in this execution sandbox to independently re-confirm against primary legal text.

---
*Phase: 03-vacation-pay*
*Completed: 2026-08-30*

## Self-Check: PASSED

All created/modified files and both task commit hashes (`86e26f2`, `66d0890`) verified present on disk / in git log.
