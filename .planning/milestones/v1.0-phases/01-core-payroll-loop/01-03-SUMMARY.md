---
phase: 01-core-payroll-loop
plan: 03
subsystem: domain
tags: [tax-engine, ndfl, payment-schedule, date-holidays, date-fns, vitest, tdd]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Next.js 16 scaffold, vitest.config.ts (@ alias, test include glob), date-fns and date-holidays already installed"
provides:
  - "src/domain/money.ts: Kopecks type, rublesToKopecks/kopecksToRubles/formatKopecks — zero-import pure module"
  - "src/domain/tax/ndfl-brackets.ts: versioned 2025 five-bracket 176-ФЗ scale, bracketsForYear(), UnsupportedTaxYearError, MAX_VERIFIED_TAX_YEAR=2026"
  - "src/domain/tax/calculate-ndfl.ts: roundToRuble (ст.52), taxOnCumulative, calculateNdfl — pure cumulative marginal НДФЛ engine, avans and salary share one code path"
  - "src/domain/schedule/resolve-payment-date.ts: resolvePaymentDate (D-03 clamp + D-02 weekend/holiday shift), generatePaymentEvents (sorted, avans-before-salary tie-break), nextPaymentOnOrAfter (on-or-after-today lookahead)"
  - "src/domain/schedule/pay-gap.ts: MAX_PAY_GAP_DAYS, payGapDays, exceedsMaxPayGap — D-04 non-blocking ТК РФ gap signal"
affects: [01-04, 01-05]

# Actuals (#2632)
actuals:
  tokens: 6738
  tasks: 2
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "src/domain/** is pure: zero imports from @/lib, next, or react — enforced by grep-based purity assertions in each task's <verify> command"
    - "Money as integer kopecks throughout (Kopecks = number alias); ruble rounding (ст.52 НК РФ) happens exactly once, on the cumulative tax figure, never on a per-payment delta"
    - "Tax-year-versioned bracket registry (NDFL_SCALES keyed by effective year) with an explicit MAX_VERIFIED_TAX_YEAR ceiling — an unregistered/unverified year throws UnsupportedTaxYearError instead of silently returning a wrong number"
    - "date-holidays results are always filtered to type === 'public' before treating a date as non-working (observances/optional days are working days)"

key-files:
  created:
    - src/domain/money.ts
    - src/domain/tax/ndfl-brackets.ts
    - src/domain/tax/calculate-ndfl.ts
    - src/domain/tax/calculate-ndfl.test.ts
    - src/domain/schedule/resolve-payment-date.ts
    - src/domain/schedule/resolve-payment-date.test.ts
    - src/domain/schedule/pay-gap.ts
    - src/domain/schedule/pay-gap.test.ts
  modified: []

key-decisions:
  - "Corrected the plan's Feb-2026 D-03 clamp test example: 2026-02-28 is a real Saturday, so the composite resolvePaymentDate function (clamp, then D-02 shift) correctly walks it back one further day to 2026-02-27, not 2026-02-28 as the plan's illustrative behavior-block value stated"
  - "Chose (2026, January, dayOfMonth=3) instead of the plan's dayOfMonth=10 to demonstrate D-02's multi-day chain through the New Year holiday block into the prior year — verified against the installed date-holidays@3.36.0 RU data that January 9, 2026 is in fact a working Friday (breaking a day-10 chain before it reaches December), while day 3 genuinely chains three consecutive holiday days back into 2025-12-31"
  - "roundToRuble implemented with strict integer arithmetic (add 50, integer-divide by 100, multiply by 100) per the plan's explicit instruction — no floating-point tie-break path"
  - "payGapDays computes both circular distances on a fixed 30-day reference cycle and returns the larger, matching all four plan-specified cases exactly (15, 15, 19, 29)"

patterns-established:
  - "TDD RED/GREEN gate per task: implementation temporarily moved out of the working tree to confirm the test suite genuinely fails (module-not-found) before restoring and committing GREEN — used for both tax and schedule tasks"

requirements-completed: [TAX-01, TAX-02, SAL-01]

coverage:
  - id: D1
    description: "taxOnCumulative implements the fixed-base-plus-marginal-excess formula across all five 2025 brackets (13/15/18/20/22%), verified at all four threshold boundaries (2.4M/5M/20M/50M rub) plus one ruble past the first threshold"
    requirement: "TAX-01"
    verification:
      - kind: unit
        ref: "src/domain/tax/calculate-ndfl.test.ts#taxOnCumulative (8 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "calculateNdfl splits a bracket-straddling payment marginally (13%/15%), explicitly rejecting the flat-13% result; avans and salary run through the identical code path (two sequential payments equal one combined payment); zero-gross and a 24-payment rounding-drift sequence both hold exactly"
    requirement: "TAX-02"
    verification:
      - kind: unit
        ref: "src/domain/tax/calculate-ndfl.test.ts#calculateNdfl (5 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "bracketsForYear throws UnsupportedTaxYearError outside the registered/verified range (2024, 2027) and returns the five-bracket scale for 2025/2026; the thrown message names the year"
    requirement: "TAX-01"
    verification:
      - kind: unit
        ref: "src/domain/tax/calculate-ndfl.test.ts#bracketsForYear (5 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The 2025 НДФЛ bracket thresholds/rates/fixed-bases in src/domain/tax/ndfl-brackets.ts are confirmed against primary НК РФ ст.224 statute text (closes RESEARCH.md Assumption A1 / the matching STATE.md blocker)"
    requirement: "TAX-01"
    verification: []
    human_judgment: true
    rationale: "This execution environment has no live web access (consultant.ru/pravo.gov.ru both unreachable from this sandbox — verified with curl). The task's <human-check> step explicitly requires a human to open the primary statute text and confirm the five thresholds, five rates, and four fixed bases. The bracket table itself is implemented exactly per RESEARCH.md's already-cross-checked (garant.ru + nalog-nalog.ru + ФНС regional page) figures, but the final primary-source confirmation this plan's task called for could not be performed by the executor. Carried forward as an open blocker (see STATE.md and Next Phase Readiness below)."
  - id: D5
    description: "resolvePaymentDate clamps day-of-month values to the target month's last valid day (D-03, including leap-year Feb 29) and shifts earlier off weekends and RU public holidays, chaining through multiple consecutive non-working days (D-02)"
    requirement: "SAL-01"
    verification:
      - kind: unit
        ref: "src/domain/schedule/resolve-payment-date.test.ts#resolvePaymentDate (8 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "generatePaymentEvents sorts ascending and resolves same-date avans/salary collisions deterministically avans-first (verified across repeated runs); nextPaymentOnOrAfter treats today as eligible (on-or-after, not strictly-after) and looks ahead into the following month when the current month's payments have already passed"
    requirement: "SAL-01"
    verification:
      - kind: unit
        ref: "src/domain/schedule/resolve-payment-date.test.ts#generatePaymentEvents and #nextPaymentOnOrAfter (5 tests)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The ТК РФ 15-day avans/salary gap is computed as a non-blocking signal (payGapDays / exceedsMaxPayGap) matching all four plan-specified cases exactly"
    requirement: "SAL-01"
    verification:
      - kind: unit
        ref: "src/domain/schedule/pay-gap.test.ts (9 tests)"
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-08-28
status: complete
---

# Phase 1 Plan 3: Domain Tax and Schedule Engines Summary

**Pure, zero-I/O progressive НДФЛ engine (cumulative marginal calc across all five 2025 brackets, ст.52 ruble rounding) and payment-date resolver (D-03 month-length clamping, D-02 weekend/RU-holiday backward shifting, D-04 gap signal), built RED-then-GREEN with 45 passing Vitest tests.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-28T23:14:00Z
- **Completed:** 2026-08-28T23:24:00Z
- **Tasks:** 2 (both `tdd="true"`, each producing a test-then-feat commit pair)
- **Files modified:** 8 (all newly created)

## Accomplishments
- `src/domain/money.ts` — kopeck money primitives (`Kopecks`, `rublesToKopecks`, `kopecksToRubles`, `formatKopecks`), zero imports beyond TypeScript types
- `src/domain/tax/ndfl-brackets.ts` — the verified 2025 five-bracket 176-ФЗ scale, versioned by effective year, with `bracketsForYear()` throwing `UnsupportedTaxYearError` outside `[earliest registered, MAX_VERIFIED_TAX_YEAR=2026]`
- `src/domain/tax/calculate-ndfl.ts` — `roundToRuble` (ст.52 integer rounding), `taxOnCumulative` (fixed-base-plus-marginal-excess), `calculateNdfl` (tax as the delta of two ruble-rounded cumulative values) — avans and salary run through this one identical path
- `src/domain/schedule/resolve-payment-date.ts` — `resolvePaymentDate`, `generatePaymentEvents`, `nextPaymentOnOrAfter`, all pure, using `date-fns` for month-length clamping and a module-scope `date-holidays` RU instance filtered to `type === 'public'`
- `src/domain/schedule/pay-gap.ts` — the ТК РФ 15-day avans/salary gap as a non-blocking advisory signal
- 45/45 Vitest tests pass across `src/domain`; `npx tsc --noEmit` exits 0; both tasks' grep-based purity and bracket-constant assertions pass; `npx eslint src/domain` is clean

## Task Commits

Each task was executed as a genuine RED-GREEN TDD cycle (implementation files were temporarily moved out of the working tree to confirm each test suite failed with "module not found" before being restored and committed as GREEN):

1. **Task 1: Pure progressive НДФЛ engine** — RED `f7f9f3b` (test), GREEN `eb6c10a` (feat)
2. **Task 2: Pure payment-date resolver and ТК РФ gap signal** — RED `eb74574` (test), GREEN `e381d69` (feat)

**Plan metadata:** commit created immediately after this file (see below)

_No REFACTOR commits were needed — both implementations were clean on first GREEN._

## Files Created/Modified
- `src/domain/money.ts` - `Kopecks` type alias, ruble/kopeck conversion, ru-RU currency formatting
- `src/domain/tax/ndfl-brackets.ts` - versioned 2025 НДФЛ bracket scale, `bracketsForYear`, `UnsupportedTaxYearError`, `MAX_VERIFIED_TAX_YEAR`
- `src/domain/tax/calculate-ndfl.ts` - `roundToRuble`, `taxOnCumulative`, `calculateNdfl`, `NdflResult`
- `src/domain/tax/calculate-ndfl.test.ts` - 22 tests: rounding, all bracket boundaries, straddling/parity/zero-gross/24-payment-rounding-drift, year-range errors
- `src/domain/schedule/resolve-payment-date.ts` - `resolvePaymentDate`, `generatePaymentEvents`, `nextPaymentOnOrAfter`, `PaymentKind`/`PaymentSchedule`/`PaymentEvent` types
- `src/domain/schedule/resolve-payment-date.test.ts` - 15 tests: clamping (incl. leap year), weekend/holiday shifts, multi-day New Year chain, sorted event generation, same-date tie-break, on-or-after-today lookahead
- `src/domain/schedule/pay-gap.ts` - `MAX_PAY_GAP_DAYS`, `payGapDays`, `exceedsMaxPayGap`
- `src/domain/schedule/pay-gap.test.ts` - 8 tests covering all four plan-specified gap cases plus the strict-inequality boundary

## Decisions Made
- Corrected the plan's Feb-2026 D-03 clamp illustrative example: `resolvePaymentDate(2026, 1, 31)` clamps to 2026-02-28, but that date is itself a real Saturday (verified with `Date.getDay()`), so D-02's weekend shift correctly walks it one further day back to 2026-02-27. The test asserts the composite, spec-correct result (2026-02-27) rather than the plan's stated 2026-02-28, with an inline comment explaining why.
- Replaced the plan's `dayOfMonth=10` New Year chain example with `dayOfMonth=3`. Verified against the installed `date-holidays@3.36.0` RU data that January 9, 2026 is a genuine working Friday (the library's fixed rule only covers Jan 1–8 as a holiday block every year, regardless of actual weekday alignment), so a day-10 chain would stop at Jan 9 rather than reaching December as the plan claimed. Day 3 genuinely chains three consecutive holiday days (Jan 3→2→1) back into 2025-12-31, which is what the D-02 "chains through consecutive non-working days" behavior actually needs to demonstrate.
- `roundToRuble` and `payGapDays` implemented with the exact integer-arithmetic formulas the plan specified — no floating-point tie-break paths anywhere in the tax or schedule modules.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's Feb-2026 clamp test value ignored that the clamped date is a real Saturday**
- **Found during:** Task 2 (writing `resolve-payment-date.test.ts`)
- **Issue:** The plan's `<behavior>` block asserted `resolvePaymentDate(2026, 1, 31) → 2026-02-28`, documenting it as a pure D-03 clamping example. But `resolvePaymentDate` is a composite function (clamp, then D-02 weekend/holiday shift, per the plan's own `<action>` spec), and 2026-02-28 is a genuine Saturday — the composite function correctly walks it back one further day to 2026-02-27.
- **Fix:** Corrected the test's expected value to 2026-02-27, with an inline comment explaining the composite-function reasoning. Implementation was NOT changed — it already correctly implements the composite clamp-then-shift contract exactly as specified.
- **Files modified:** `src/domain/schedule/resolve-payment-date.test.ts`
- **Verification:** `npx vitest run src/domain/schedule` — 23/23 pass
- **Committed in:** `e381d69` (Task 2 GREEN commit)

**2. [Rule 1 - Bug] Plan's New-Year-chain test date (day 10) does not actually chain to December given the real installed holiday library data**
- **Found during:** Task 2 (writing `resolve-payment-date.test.ts`, before implementation)
- **Issue:** The plan's `<behavior>` block described `resolvePaymentDate(2026, 0, 10)` as shifting "past the New Year holiday block to the last working day of December 2025." Direct inspection of `date-holidays@3.36.0`'s RU data for 2026 shows the library's fixed holiday rule only spans January 1–8 every year (it does not track the government's actual annual перенос decree, per RESEARCH.md's own documented limitation); January 9, 2026 is consequently a genuine working Friday. A day-10 chain therefore stops at January 9, never reaching December.
- **Fix:** Used `dayOfMonth=3` instead, verified by direct inspection of the installed library's `isHoliday()` output for each day, to construct a genuine 3-day backward chain (Jan 3 → Jan 2 → Jan 1, all holidays) landing on 2025-12-31 (a real working Wednesday) — an accurate demonstration of D-02's "chains through consecutive non-working days" requirement.
- **Files modified:** `src/domain/schedule/resolve-payment-date.test.ts` (written this way from the start, before the RED run)
- **Verification:** `npx vitest run src/domain/schedule` — 23/23 pass; manually cross-checked with a standalone Node script walking `date-holidays`' `isHoliday()` day-by-day
- **Committed in:** `eb74574` (Task 2 RED commit) / `e381d69` (Task 2 GREEN commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — test-expectation corrections to match the real, installed `date-holidays@3.36.0` calendar data; no implementation logic was changed for either)
**Impact on plan:** Both fixes correct test *expectations*, not the domain logic itself — the composite `resolvePaymentDate` function was implemented exactly per the plan's `<action>` spec in both cases. No scope creep; no architectural change.

## Issues Encountered
None beyond the two deviations documented above.

## User Setup Required

None - no external service configuration required for this plan's pure-domain-logic scope.

## Next Phase Readiness
- `src/domain/money.ts`, `src/domain/tax/*`, and `src/domain/schedule/*` are complete, pure, and exhaustively unit-tested (45 tests, 100% pass), ready for Plans 01-04/01-05 to wire into Server Actions and the home-screen forecast RSC
- **Open blocker carried forward (unresolved this plan):** the task 1 `<human-check>` — confirming the 2025 НДФЛ bracket thresholds/rates/fixed-bases against primary НК РФ ст.224 statute text (pravo.gov.ru or consultant.ru's full-article view) — could not be performed by this executor; this sandbox has no live web access (`curl` to consultant.ru and pravo.gov.ru both failed to connect). The bracket table itself is implemented exactly per `01-RESEARCH.md`'s already-cross-checked figures (garant.ru + nalog-nalog.ru + an official ФНС regional page), so the numbers are believed correct, but the plan's explicit final-confirmation step is still outstanding. Recommend a human perform this check before `/gsd-verify-work` on this phase, alongside the existing Plan 01-02 manual UAT items already flagged in STATE.md.
- No other blockers identified for Plans 01-04/01-05

---
*Phase: 01-core-payroll-loop*
*Completed: 2026-08-28*

## Self-Check: PASSED

- All 8 files listed in `key-files.created` verified present on disk with `[ -f ]`.
- All four task commit hashes (`f7f9f3b`, `eb6c10a`, `eb74574`, `e381d69`) verified present via `git log --oneline --all`.
- Plan-level `<verification>` re-run: `npx vitest run src/domain` — 45/45 pass; `npx tsc --noEmit` exits 0; both tasks' purity/bracket-constant/export assertion scripts pass; `npx eslint src/domain` clean.
- Task 1 `<human-check>` NOT performed (no live web access in this environment) — recorded as `human_judgment: true` in coverage (D4) and as an open blocker in STATE.md, not silently marked complete.
