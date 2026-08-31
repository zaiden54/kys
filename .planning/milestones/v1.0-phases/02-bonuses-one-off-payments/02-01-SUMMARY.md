---
phase: 02-bonuses-one-off-payments
plan: 01
subsystem: payments
tags: [postgres, drizzle, zod, react-hook-form, ndfl, nextjs]
requires:
  - phase: 01-core-payroll-loop
    provides: salary schedule, cumulative income, progressive NDFL, next-payment card
provides:
  - ownership-scoped bonus persistence with same-date independent rows
  - bonus-aware cumulative income and unified next-payment forecasting
  - bonus creation action, form, history route, and payment breakdown UI
affects: [02-02, bonuses, forecast, cumulative-income]
actuals:
  tokens: 18000
  tasks: 3
  commits: 6
tech-stack:
  added: []
  patterns: [independent bonus rows summed by date, unified schedule-or-bonus event selection]
key-files:
  created: [src/lib/db/bonus-repository.ts, src/lib/validation/bonus.ts, src/app/actions/bonus.ts, src/app/(app)/bonuses/page.tsx, src/app/(app)/bonuses/bonus-form.tsx]
  modified: [src/lib/db/schema.ts, src/lib/db/salary-repository.ts, src/app/actions/forecast.ts, src/components/next-payment-card.tsx]
key-decisions:
  - "Persist every bonus as an independent row and sum same-date rows only when computing payment events."
  - "Treat literal bonus dates as payment events without salary-schedule holiday shifting."
patterns-established:
  - "Bonus income enters the existing getCumulativeIncomeBeforeDate composition point, never a parallel tax path."
requirements-completed: [BON-01, BON-02]
coverage:
  - id: D1
    description: "Users can persist multiple ownership-scoped bonuses on any date, including past dates."
    requirement: BON-01
    verification:
      - kind: integration
        ref: "src/lib/db/bonus-repository.test.ts"
        status: pass
      - kind: unit
        ref: "src/lib/validation/bonus.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Bonus income joins the cumulative NDFL chain with strict baseline and payment-date boundaries."
    requirement: BON-02
    verification:
      - kind: integration
        ref: "src/lib/db/salary-repository.test.ts#bonus boundary cases"
        status: pass
      - kind: integration
        ref: "src/app/actions/forecast.test.ts#past bonus increases tax"
        status: pass
    human_judgment: false
  - id: D3
    description: "The home forecast resolves bonus-only and combined salary-plus-bonus payment events."
    requirement: BON-02
    verification:
      - kind: integration
        ref: "src/app/actions/forecast.test.ts#bonus forecast tracer cases"
        status: pass
      - kind: other
        ref: "npm run build"
        status: pass
    human_judgment: false
  - id: D4
    description: "The bonus form, history route, and visual payment breakdown match the approved interaction design."
    requirement: BON-01
    verification: []
    human_judgment: true
    rationale: "Visual hierarchy and browser interaction require the Phase 2 manual UAT planned after 02-02."
duration: 10min
completed: 2026-08-30
status: complete
---

# Phase 02 Plan 01: Bonus Creation and Forecast Tracer Summary

**Independent one-off bonuses now flow from a validated form through Neon persistence and the shared cumulative NDFL engine into one unified next-payment forecast.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-30T02:16:00+03:00
- **Completed:** 2026-08-30T02:26:00+03:00
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- Added the live `bonuses` table, ownership-scoped repository, validation, and strict cumulative-income boundaries.
- Generalized next-payment selection to schedule, standalone bonus, or same-date combined payment events.
- Added the create action, `/bonuses` form/history page, and conditional home-screen breakdown.

## Task Commits

1. **Task 1: Add and apply bonuses table** — `c357000`
2. **Task 2 RED: Bonus persistence tests** — `e02fd53`
3. **Task 2 GREEN: Persistence and cumulative income** — `1df8f2a`
4. **Task 3 RED: Forecast tracer tests** — `696e119`
5. **Task 3 GREEN: Forecast, action, and UI** — `324b7ec`

## Files Created/Modified

- `src/lib/db/schema.ts` — additive bonuses table, positive-amount check, ownership index.
- `src/lib/db/bonus-repository.ts` — independent create and ownership-scoped listing.
- `src/lib/validation/bonus.ts` — amount, real-date, optional-note validation.
- `src/lib/db/salary-repository.ts` — bonus accrual in the single cumulative-income function.
- `src/app/actions/forecast.ts` — unified schedule-or-bonus event resolution and breakdown.
- `src/app/actions/bonus.ts` — authenticated validated creation action.
- `src/app/(app)/bonuses/*` — create form and full read-only history.
- `src/components/next-payment-card.tsx` — bonus label and combined gross breakdown.

## Decisions Made

- Same-date bonuses retain independent IDs and notes; aggregation occurs at computation time.
- A concrete user-selected bonus date is not passed through schedule holiday-shifting logic.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `npm run db:push` did not load `.env.local`; reran the same Drizzle command through Node's `--env-file=.env.local`, after which the additive schema push and live assertions passed.
- The action integration test required mocking Next's request-scoped `revalidatePath`; production behavior was unchanged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Bonus creation and forecasting are complete. Plan 02-02 can add ownership-scoped update/delete operations and the final history-row interaction design.

## Self-Check: PASSED

- Live Neon schema assertions passed.
- Full suite: 16 files, 246 tests passed.
- Production build passed, including dynamic `/bonuses` route generation.

---
*Phase: 02-bonuses-one-off-payments*
*Completed: 2026-08-30*
