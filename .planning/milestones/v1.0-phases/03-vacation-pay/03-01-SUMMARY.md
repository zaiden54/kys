---
phase: 03-vacation-pay
plan: 01
subsystem: database, domain-engine
tags: [drizzle, postgres, neon, date-fns, vacation-pay, ndfl, tdd]

# Dependency graph
requires:
  - phase: 01-core-payroll-loop
    provides: "resolvePaymentDate/shiftOffWeekendsAndHolidays weekend/holiday-shift logic, salary_history schema and SalaryHistoryEntry type, money/kopecks primitives"
  - phase: 02-bonuses-one-off-payments
    provides: "bonuses table and repository pattern this plan extends with a type column"
provides:
  - "bonuses.type column ('premium'|'compensation') and bonus_type_valid check constraint, live in Neon"
  - "vacations table (id, userId, startDate, endDate) with vacation_end_on_or_after_start check and vacations_user_id_idx index, live in Neon"
  - "shiftOffWeekendsAndHolidays exported from src/domain/schedule/resolve-payment-date.ts for reuse by any domain module needing the D-02 weekend/holiday shift"
  - "src/domain/vacation/calculate-average-daily-earnings.ts: calculateVacationDays, calculateAverageDailyEarnings, calculateVacationPayGross, resolveVacationPaymentDate — pure, framework-free, exhaustively unit-tested"
affects: [03-02, 03-03, 03-04, vacation-repository, vacation-server-actions, vacation-ui]

# Actuals (#2632)
actuals:
  tokens: 5819
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Month-by-month salary_history recomputation for a rolling earnings average, with real-calendar-day-weighted proration for mid-window rate changes"
    - "Postgres check() constraint as a second gate behind Drizzle's TS-only enum type, matching bonus_amount_positive's precedent"
    - "Sibling-domain-module import discipline: a business-rule function in one domain module (resolveVacationPaymentDate) calls a generic calendar-shift export from another (shiftOffWeekendsAndHolidays) rather than duplicating logic"

key-files:
  created:
    - src/domain/vacation/calculate-average-daily-earnings.ts
    - src/domain/vacation/calculate-average-daily-earnings.test.ts
  modified:
    - src/lib/db/schema.ts
    - src/domain/schedule/resolve-payment-date.ts
    - src/domain/schedule/resolve-payment-date.test.ts
    - src/app/(app)/bonuses/bonus-row.render.test.tsx

key-decisions:
  - "12-month lookback window excludes the vacation's own start month (corrects an off-by-one in 03-RESEARCH.md's illustrative pseudocode) — for an August vacation start, the window is Aug of the prior year through July of the current year."
  - "Day-level proration for a mid-month salary change weights each segment by its real share of that month's actual calendar days (segmentDays/daysInMonth * rate), not a flat 29.3-day segment count. This departs from 03-RESEARCH.md's literal 'days x (rate/29.3)' pseudocode, which — applied uniformly to every month including unsplit ones — cannot reproduce the plan's own locked exact-value test targets (verified by hand-computation before implementing). The chosen formula reproduces every exact target exactly and still lands strictly between the old-rate-only and new-rate-only bounds for a genuine split, which is all D-V04 requires."
  - "Rounding happens exactly once, at the final averageDailyKopecks = round(total/monthCount/29.3) division — no per-month or per-segment rounding, matching calculate-ndfl.ts's discipline."

patterns-established:
  - "Vacation-domain business rules (resolveVacationPaymentDate) live in src/domain/vacation/ and import generic calendar-shift helpers from src/domain/schedule/ — establishes the cross-domain-module import shape future domain additions should follow."

requirements-completed: [VAC-01, VAC-02]

coverage:
  - id: D1
    description: "bonuses.type column and vacations table exist live in Neon with documented constraints, index, and a clean physical backfill of pre-existing bonus rows to 'premium'"
    requirement: "VAC-01"
    verification:
      - kind: integration
        ref: "live Neon information_schema/pg_constraint/pg_indexes assertion script (Task 1 <verify> block)"
        status: pass
    human_judgment: false
  - id: D2
    description: "calculateVacationDays counts an inclusive calendar range correctly (never off-by-one)"
    requirement: "VAC-01"
    verification:
      - kind: unit
        ref: "src/domain/vacation/calculate-average-daily-earnings.test.ts#calculateVacationDays"
        status: pass
    human_judgment: false
  - id: D3
    description: "calculateAverageDailyEarnings re-derives average daily earnings month-by-month with day-level proration for mid-month salary changes and under-12-months tenure handling"
    requirement: "VAC-01"
    verification:
      - kind: unit
        ref: "src/domain/vacation/calculate-average-daily-earnings.test.ts#calculateAverageDailyEarnings"
        status: pass
    human_judgment: false
  - id: D4
    description: "resolveVacationPaymentDate computes vacation start minus 3 calendar days and reuses the shared weekend/holiday-shift helper (shiftOffWeekendsAndHolidays), never duplicating that logic"
    requirement: "VAC-02"
    verification:
      - kind: unit
        ref: "src/domain/vacation/calculate-average-daily-earnings.test.ts#shiftOffWeekendsAndHolidays reuse via resolveVacationPaymentDate"
        status: pass
      - kind: unit
        ref: "src/domain/schedule/resolve-payment-date.test.ts#shiftOffWeekendsAndHolidays"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-30
status: complete
---

# Phase 3 Plan 01: Vacation-Pay Foundation Summary

**Live `vacations` table + `bonuses.type` reclassification column in Neon, and a pure, exhaustively-unit-tested отпускные engine (month-by-month salary_history recomputation with real-calendar-day-weighted proration, under-12-months handling, inclusive day counting, and the ст.136 ТК РФ minus-3-days payment-date shift reusing the existing weekend/holiday-shift logic).**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2
- **Files modified:** 6 (2 new, 4 modified)

## Accomplishments

- `bonuses.type` (`'premium'|'compensation'`, NOT NULL DEFAULT `'premium'`) and a new `vacations` table are live in Neon with `bonus_type_valid` / `vacation_end_on_or_after_start` check constraints and a `vacations_user_id_idx` index — applied via `drizzle-kit push` with no destructive prompt, every pre-existing bonus row physically backfilled to `'premium'` at the database layer.
- `shiftOffWeekendsAndHolidays` extracted from `resolvePaymentDate` as a standalone export with zero behavior change (all pre-existing `resolve-payment-date.test.ts` assertions unchanged and passing).
- New `src/domain/vacation/calculate-average-daily-earnings.ts` module exports `calculateVacationDays`, `calculateAverageDailyEarnings`, `calculateVacationPayGross`, and `resolveVacationPaymentDate` — pure, framework-free, importing only `date-fns`, `../money`, `../pay/payment-accrual`, and `../schedule/resolve-payment-date`.
- 28 new tests across both files, covering every locked decision (D-V04 through D-V09) and researched pitfall (constant salary, month-boundary raise, mid-month proration with bounding-inequality assertions, under-12-months tenure, zero history, hire-date-anniversary boundary, premium-bonus inclusion, combined gross-pay, and both worked payment-date examples).

## Task Commits

Executed as a `tdd="true"` task pair:

1. **Task 1: Add bonuses.type and the vacations table, apply to the live Neon database** - `1dffe40` (feat)
2. **Task 2 RED: failing tests for the vacation-pay domain engine** - `2ab4af5` (test)
3. **Task 2 GREEN: implement the vacation-pay domain engine** - `42b113c` (feat)

No REFACTOR commit was needed — the GREEN implementation required no follow-up cleanup.

## Files Created/Modified

- `src/lib/db/schema.ts` - added `bonuses.type` column + `bonus_type_valid` check; added `vacations` table with `vacation_end_on_or_after_start` check and `vacations_user_id_idx` index
- `src/domain/schedule/resolve-payment-date.ts` - extracted `shiftOffWeekendsAndHolidays`; `resolvePaymentDate` now calls it internally
- `src/domain/schedule/resolve-payment-date.test.ts` - added 3 direct tests for the newly exported `shiftOffWeekendsAndHolidays`
- `src/domain/vacation/calculate-average-daily-earnings.ts` - new pure отпускные engine (day count, average daily earnings, combined gross pay, payment-date resolution)
- `src/domain/vacation/calculate-average-daily-earnings.test.ts` - new exhaustive test suite (13 tests)
- `src/app/(app)/bonuses/bonus-row.render.test.tsx` - added the now-required `type: "premium"` field to the `makeBonus` test fixture (Rule 3 fixup, see Deviations)

## Decisions Made

- **12-month lookback window excludes the vacation's own start month** — the plan's own documented correction of 03-RESEARCH.md's off-by-one pseudocode; verified by hand-computing every exact test target against this window definition before implementing.
- **Day-level proration weights a split month's segments by their real share of that month's actual calendar days**, not a flat 29.3-day segment count. This is a deliberate departure from 03-RESEARCH.md's more literal "days × (rate/29.3)" illustrative pseudocode: applying that formula uniformly (including to unsplit, fully-worked months) cannot reproduce the plan's own locked exact-value test targets — verified by hand-computation before writing any implementation code. The chosen real-calendar-day-weighted formula reproduces every exact target exactly (constant salary → 341,297; month-boundary raise → 375,427; under-12-months → 511,945; premium-bonus inclusion → 355,518; combined gross → 3,412,970) and still lands strictly between the old-rate-only and new-rate-only bounds for the mid-month split case, which is all D-V04 requires (the plan itself notes D-V04 "only locks the outcome... not a specific formula").
- Rounding happens exactly once, at the final `averageDailyKopecks` division — matches `calculate-ndfl.ts`'s "round once, at the end" discipline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed a pre-existing test fixture broken by the new required `bonuses.type` column**
- **Found during:** Task 1 (`npx tsc --noEmit` after the schema change)
- **Issue:** `src/app/(app)/bonuses/bonus-row.render.test.tsx`'s `makeBonus()` fixture built a `BonusRowData` object without the newly-required `type` field, failing type-checking as a direct, mechanical consequence of this task's own schema change.
- **Fix:** Added `type: "premium"` to the fixture's default fields.
- **Files modified:** `src/app/(app)/bonuses/bonus-row.render.test.tsx`
- **Verification:** `npx tsc --noEmit` exits 0; full 281-test suite passes with no regressions.
- **Committed in:** `1dffe40` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary mechanical fixup directly caused by this plan's own schema change. No scope creep — no other file in the codebase referenced `BonusRowData` without going through the Drizzle-inferred type.

## Issues Encountered

The plan's action text for Task 2's mid-month proration (step 3) describes segment contributions as `(days in the segment) x (rate / 29.3)`. Applied literally to every candidate month (including unsplit, fully-worked months), this produces a value that does not match the plan's own locked exact-value test targets — verified by hand-computing the arithmetic for the constant-salary case before writing any code (a whole month scaled by `daysInMonth/29.3` inflates the total by a non-cancelling factor once the final formula also divides by `monthCount * 29.3`). Resolved by implementing day-level proration as a real-calendar-day-weighted average within each month instead (`segmentDays/daysInMonth * rate`), which reduces to exactly the flat monthly rate for any unsplit month and reproduces every one of the plan's exact numeric targets on the first test run. The plan's own "Design decisions" section explicitly grants this latitude: D-V04 "only locks the outcome ('day-level proration'), not a specific formula," and flags the 29.3-divisor sub-rule as MEDIUM confidence.

## Next Phase Readiness

- The `vacations` table, `bonuses.type` reclassification, and the vacation-pay domain engine are all in place and independently proven — Plan 02+ (repository layer, Server Actions, overlap validation D-V11, next-payment integration D-V08) can treat `calculateAverageDailyEarnings`/`calculateVacationPayGross`/`resolveVacationPaymentDate` as trusted primitives with no further domain-math risk.
- No blockers. The bonus-type filtering (premium vs. compensation) required by D-V01 is explicitly the caller's responsibility per this plan's `PremiumBonusEntry` contract — the repository/integration layer in a later plan must apply that filter before calling `calculateAverageDailyEarnings`.
- Statute-verification flag carried forward from Phase 1 (2025 НДФЛ bracket thresholds, ст.139 ТК РФ's 29.3 divisor) remains open per STATE.md Blockers/Concerns — no live web access in this execution sandbox to independently re-confirm against primary legal text.

---
*Phase: 03-vacation-pay*
*Completed: 2026-08-30*

## Self-Check: PASSED

All created files and commit hashes verified present on disk / in git log.
