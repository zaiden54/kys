---
phase: 03-vacation-pay
plan: 03
subsystem: database
tags: [drizzle, postgres, neon, tdd, vacation-pay]

# Dependency graph
requires:
  - phase: 03-vacation-pay
    provides: "03-01's vacations table, resolveVacationPaymentDate, calculateVacationPayGross pure engine"
  - phase: 03-vacation-pay
    provides: "03-02's required BonusType ('premium'|'compensation') on every bonus row"
provides:
  - "vacation-repository.ts: ownership-scoped CRUD, inclusive-boundary overlap detection, and a payment-date-aware delete guard"
  - "validation/vacation.ts: vacationInputSchema for date-range input"
  - "getCumulativeIncomeBeforeDate extended to fold past vacation gross into the cumulative-income chain, exactly like bonuses"
affects: [03-04, vacation-server-actions, vacation-ui]

# Actuals (#2632)
actuals:
  tokens: 4925
  tasks: 2
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A pure-function-derived eligibility date (resolveVacationPaymentDate) that SQL cannot express directly is enforced via a read-then-write repository guard (SELECT to compute the date, conditional DELETE), not a single atomic statement — documented as an accepted, narrow race window (T-03-08) rather than solved with a persisted derived column."
    - "getCumulativeIncomeBeforeDate composes a third accrual term (vacationAccruedKopecks) alongside the existing baseline/accrued/bonus terms, using the identical strict-inequality window rule (windowBoundIso < eventDate < isoDate) already proven for bonuses — no new window-boundary logic invented."

key-files:
  created:
    - src/lib/db/vacation-repository.ts
    - src/lib/db/vacation-repository.test.ts
    - src/lib/validation/vacation.ts
    - src/lib/validation/vacation.test.ts
  modified:
    - src/lib/db/salary-repository.ts
    - src/lib/db/salary-repository.test.ts

key-decisions:
  - "Vacations have no note field — dropped from every repository/validation signature per the plan's own resolved design decision (03-UI-SPEC.md's Copywriting Contract and D-V09 through D-V12 never mention one; a vacation is identified purely by its date range)."
  - "checkOverlapVacations uses inclusive-boundary overlap semantics (existing.startDate <= newEndDate AND existing.endDate >= newStartDate) — a shared boundary day counts as an overlap, matching D-V11's plain-language intent."
  - "vacationAccruedKopecks is always recomputed live from full salary history + premium-filtered bonuses on every call to getCumulativeIncomeBeforeDate — never a stored отпускные amount — so a later backdated salary correction or bonus edit automatically changes it on the next read, with no cache to invalidate."

patterns-established: []

requirements-completed: [VAC-01, VAC-02]

coverage:
  - id: D1
    description: "A user can create, list, edit, overlap-check, and delete (subject to the payment-date guard) a vacation entirely through vacation-repository.ts, with full ownership isolation proven against the live database"
    requirement: "VAC-01"
    verification:
      - kind: integration
        ref: "src/lib/db/vacation-repository.test.ts (all 4 tests: create/list ordering+isolation, update ownership-scoping, overlap detection boundary cases, delete-guard status transitions)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Overlapping vacation ranges, including boundary-touching ones, are rejected before reaching the database; adjacent non-touching ranges and self-excluded ranges are correctly allowed"
    requirement: "VAC-01"
    verification:
      - kind: integration
        ref: "src/lib/db/vacation-repository.test.ts#checkOverlapVacations detects identical, boundary-touching, and containing ranges, and excludes adjacent or self-excluded ranges"
        status: pass
    human_judgment: false
  - id: D3
    description: "A payment dated after an already-paid vacation shows a cumulative-before figure exactly the vacation's computed gross higher, proven with an exact kopeck delta against the live database using calculateVacationPayGross as the test's own oracle"
    requirement: "VAC-02"
    verification:
      - kind: integration
        ref: "src/lib/db/salary-repository.test.ts#VAC-02: a payment dated after an already-paid vacation shows a cumulative-before figure exactly the vacation's computed gross higher"
        status: pass
    human_judgment: false
  - id: D4
    description: "A compensation-typed bonus inside a vacation's own 12-month lookback window never inflates that vacation's computed average-earnings base, proven at the live-database integration layer"
    requirement: "VAC-02"
    verification:
      - kind: integration
        ref: "src/lib/db/salary-repository.test.ts#VAC-02: a 'compensation'-typed bonus inside the vacation's own lookback window does not inflate its computed contribution"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-08-30
status: complete
---

# Phase 3 Plan 03: Vacation Repository and Cumulative-Income Integration Summary

**Ownership-scoped vacation CRUD with inclusive-boundary overlap detection and a payment-date-aware delete guard, plus `getCumulativeIncomeBeforeDate` extended to fold a past vacation's recomputed отпускные gross into the same cumulative-income figure a bonus already contributes to — proven with an exact kopeck delta against the live database.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2
- **Files modified:** 6 (4 new, 2 modified)

## Accomplishments

- `src/lib/db/vacation-repository.ts` exports `createVacation`, `listVacations`, `updateVacation`, `checkOverlapVacations`, and `deleteVacationIfFuture`, all ownership-scoped, mirroring `bonus-repository.ts`'s server-only guard and query style.
- `checkOverlapVacations` implements inclusive-boundary overlap semantics (D-V11): identical, boundary-touching, and fully-containing ranges are detected as overlaps; adjacent non-touching ranges and the range's own excluded id are correctly not flagged.
- `deleteVacationIfFuture` reuses `resolveVacationPaymentDate` (never re-derives the minus-3-days/holiday-shift rule) as a read-then-write guard: deletes only when the vacation's computed payment date is still strictly in the future, returning `"deleted"`, `"blocked"`, or `"not-found"`.
- `src/lib/validation/vacation.ts` exports `vacationInputSchema` — validated ISO date range with `endDate >= startDate`, accepting a past `startDate` (D-V10).
- `getCumulativeIncomeBeforeDate` now folds a third accrual term, `vacationAccruedKopecks`, computed by recomputing `calculateVacationPayGross` fresh from the full salary history and premium-filtered bonuses for every vacation whose payment date falls strictly within the accrual window — never a stored отпускные amount.
- Two live-database integration tests prove VAC-02's most consequential must-have: an exact-kopeck-delta assertion that a payment dated after an already-paid vacation includes exactly that vacation's gross, and a companion test proving a compensation-typed bonus inside the vacation's own lookback window does not change its contribution.

## Task Commits

Each task was executed as a `tdd="true"` RED/GREEN pair:

1. **Task 1 RED: failing tests for vacation repository and validation** - `f7b8f8a` (test)
2. **Task 1 GREEN: implement vacation repository and validation schema** - `a50463e` (feat)
3. **Task 2 RED: failing tests for vacation-accrual in cumulative income** - `e863d9f` (test)
4. **Task 2 GREEN: fold past vacation gross into cumulative-income chain** - `c8b416d` (feat)

No REFACTOR commits were needed for either task.

## Files Created/Modified

- `src/lib/db/vacation-repository.ts` - new module: `VacationRow`, `createVacation`, `listVacations`, `updateVacation`, `checkOverlapVacations`, `deleteVacationIfFuture`
- `src/lib/db/vacation-repository.test.ts` - new: ownership isolation, ordering, overlap-boundary matrix, delete-guard status matrix, all against the live database with throwaway two-user fixtures
- `src/lib/validation/vacation.ts` - new: `vacationInputSchema`, `VacationInput`
- `src/lib/validation/vacation.test.ts` - new: valid range, endDate-before-startDate rejection with exact message, impossible calendar date, past-date acceptance
- `src/lib/db/salary-repository.ts` - `getCumulativeIncomeBeforeDate` gained `listVacations` to its `Promise.all`, a `premiumBonusEntries` defensive filter (`type !== "compensation"`), and a `vacationAccruedKopecks` term added to both return paths
- `src/lib/db/salary-repository.test.ts` - two new live-database tests proving the exact-kopeck-delta vacation-accrual behavior and the compensation-bonus-exclusion behavior

## Decisions Made

- Vacations carry no `note` field anywhere in this plan's scope — resolved per the plan's own pre-baked design decision, since neither 03-UI-SPEC.md's Copywriting Contract nor D-V09–D-V12 mention one.
- `checkOverlapVacations` treats a shared boundary day as an overlap (inclusive-boundary semantics), matching the plan's stated reading of D-V11.
- `deleteVacationIfFuture`'s read-then-write guard is accepted as non-atomic (T-03-08 in the plan's threat model) rather than solved with a persisted payment-date column — the race window is narrow and single-user-scoped.
- `vacationAccruedKopecks` is always recomputed live inside `getCumulativeIncomeBeforeDate`, never cached or stored, so a later salary/bonus edit automatically changes every affected forecast on the next read.

## Deviations from Plan

None - plan executed exactly as written. The plan's own "Design decisions" section had already pre-resolved every ambiguity this task might otherwise have surfaced (the `note` field question, the overlap-boundary semantics, and the non-atomic delete guard), so no Rule 1-4 deviation was needed.

## Issues Encountered

None. `npx tsc --noEmit` and the full 297-test suite (`npm test -- --run`) pass clean after both tasks, with zero regressions in any pre-existing Phase 1/2/3-01/3-02 test.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The vacation repository and validation module are ready for Plan 03-04's Server Actions to call — `checkOverlapVacations` is documented as the mandatory single enforcement point every write path must invoke before `createVacation`/`updateVacation` (T-03-07), and Plan 03-04's action tests are expected to verify it is actually invoked.
- `getCumulativeIncomeBeforeDate` now correctly includes past vacation отпускные in every later payment's tax base — Plan 03-04's forecast integration can rely on this without any additional wiring.
- No blockers. Full 297-test suite and `npx tsc --noEmit` both pass clean.

---
*Phase: 03-vacation-pay*
*Completed: 2026-08-30*

## Self-Check: PASSED

All created files and commit hashes verified present on disk / in git log.
