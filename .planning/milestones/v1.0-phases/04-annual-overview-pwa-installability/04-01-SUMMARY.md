---
phase: 04-annual-overview-pwa-installability
plan: 01
subsystem: home-screen
tags: [recharts, ndfl, annual-summary, next-15-server-components, drizzle]

# Dependency graph
requires:
  - phase: 01-core-payroll-loop
    provides: calculateNdfl, getCumulativeIncomeBeforeDate/computeCumulativeIncome, forecastNextPayment's server-only orchestration pattern, salary_history/payment_schedule/ytd_baseline repository layer
  - phase: 02-bonuses
    provides: bonus_repository (listBonuses), premium/compensation bonus typing
  - phase: 03-vacation-pay
    provides: calculateVacationPayGross, resolveVacationPaymentDate, toPremiumBonusEntries, vacation_repository (listVacations)
provides:
  - computeAnnualSummary(userId, taxYear) server action — whole-calendar-year gross/tax/net aggregation
  - resolveBaselineWindow — shared baseline-applicability formula (extracted from computeCumulativeIncome, zero behavior change)
  - selectEffectiveEntry — now exported from payment-accrual.ts for per-event salary resolution
  - AnnualPieChart client component — 2-slice Recharts donut + 3-row summary on the home screen
  - src/app/(app)/error.tsx — general Next.js error boundary for the (app) route segment
affects: [phase-4-pwa-installability (same phase, plan 2), any future phase touching home-screen composition or the (app) error boundary]

# Actuals (#2632)
actuals:
  tokens: 9648
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: [recharts@3.10.1]
  patterns:
    - "Whole-year event walk generalizes forecastNextPayment's single-next-event pattern: flatten avans/salary/bonus/vacation into one dated list, sort ascending, walk chronologically through calculateNdfl."
    - "Shared baseline-applicability logic (resolveBaselineWindow) extracted so a single-event forecast and a whole-year aggregation can never independently drift apart on YTD-baseline semantics."
    - "Per-event marginal-tax telescoping: for a set of events confined to a single НДФЛ bracket, per-event tax deltas sum to the same total regardless of same-date-tie ordering — used to design a genuinely independent reconciliation oracle in the test suite."

key-files:
  created:
    - src/app/actions/annual-summary.ts
    - src/app/actions/annual-summary.test.ts
    - src/components/annual-pie-chart.tsx
    - src/components/annual-pie-chart.render.test.tsx
    - src/app/(app)/error.tsx
    - src/app/(app)/error.render.test.tsx
  modified:
    - src/domain/pay/payment-accrual.ts
    - src/lib/db/salary-repository.ts
    - src/app/(app)/page.tsx
    - package.json

key-decisions:
  - "computeAnnualSummary reuses resolveBaselineWindow(baseline, `${taxYear}-12-31`) — passing Dec-31 as the isoDate stand-in reuses the exact same year-match + on-or-before formula to answer 'does this baseline apply anywhere in taxYear' without a second, parallel implementation."
  - "Bonus/vacation events are added to the annual walk per-row (not grouped by date with schedule events) — correct for an aggregate total by the marginal-tax telescoping argument, and simpler to implement/verify."
  - "AnnualPieChart renders exactly 2 Recharts <Cell> slices (Налог, На руки) — a third 'Грязными' wedge would double-count the total and push displayed percentages to 200%, a bug the plan explicitly flagged from 04-RESEARCH.md's own illustrative example."
  - "page.tsx's annualResult.configured===false branch is a defensive, currently-unreachable-by-construction fallback (never a silent null) since computeAnnualSummary shares byte-identical not-configured gating with forecastNextPayment, whose own early return already covers this case."

patterns-established:
  - "Per-event 'independent oracle' test design: confine all test amounts to a single НДФЛ bracket so per-event getCumulativeIncomeBeforeDate + calculateNdfl deltas are guaranteed to telescope to the true sequential total regardless of same-date tie-break ordering — reusable pattern for any future whole-period aggregation test."

requirements-completed: [HOME-02]

coverage:
  - id: D1
    description: "computeAnnualSummary(userId, taxYear) aggregates salary, bonuses, and vacation pay into a whole-calendar-year gross/tax/net breakdown, reconciling exactly (zero-kopeck tolerance) with an independent per-event oracle."
    requirement: "HOME-02"
    verification:
      - kind: integration
        ref: "src/app/actions/annual-summary.test.ts#(3) reconciles exactly with an independent per-event getCumulativeIncomeBeforeDate + calculateNdfl oracle"
        status: pass
      - kind: integration
        ref: "src/app/actions/annual-summary.test.ts#(4) an applicable confirmed baseline crossing into a higher bracket is added into grossKopecks exactly once"
        status: pass
    human_judgment: false
  - id: D2
    description: "AnnualPieChart renders a 2-slice Recharts donut (Налог/На руки) plus a 3-row summary (Грязными 100%, Налог X%, На руки Y%) below NextPaymentCard on the home screen for a configured user."
    requirement: "HOME-02"
    verification:
      - kind: unit
        ref: "grep -c 'Cell key' src/components/annual-pie-chart.tsx == 2"
        status: pass
    human_judgment: true
    rationale: "Visual placement, chart legibility, and donut rendering fidelity in a real browser were not verified via Playwright/screenshot in this session — only markup/logic-level checks (Cell count, formatKopecks output, computed percentages) ran automated. A human should confirm the rendered chart on the actual home screen."
  - id: D3
    description: "No annual chart is shown for a user with no configured salary/schedule (reuses forecastNextPayment's existing not-configured gate, byte-identical predicate, never duplicated logic that could drift)."
    requirement: "HOME-02"
    verification:
      - kind: integration
        ref: "src/app/actions/annual-summary.test.ts#(1) a user with a schedule but no salary gets the not-configured result naming salary"
        status: pass
      - kind: integration
        ref: "src/app/actions/annual-summary.test.ts#(2) a user with a salary but no schedule gets the not-configured result naming schedule"
        status: pass
    human_judgment: false
  - id: D4
    description: "When the applicable YTD baseline is estimated (not user-confirmed), a distinct inline note appears with the chart; when confirmed, no such note appears."
    requirement: "HOME-02"
    verification:
      - kind: unit
        ref: "src/components/annual-pie-chart.render.test.tsx#AnnualPieChart baseline-estimated note"
        status: pass
      - kind: integration
        ref: "src/app/actions/annual-summary.test.ts#(5) baselineIsEstimated is true when the baseline's own year doesn't match taxYear or the baseline is unconfirmed, and false only for an applicable confirmed baseline"
        status: pass
    human_judgment: false
  - id: D5
    description: "computeAnnualSummary never mixes one user's salary/bonus/vacation rows into another user's summary (cross-user isolation)."
    verification:
      - kind: integration
        ref: "src/app/actions/annual-summary.test.ts#(6) two throwaway users with disjoint salary/bonus/vacation data never see each other's rows reflected in their own summary totals"
        status: pass
      - kind: integration
        ref: "src/app/actions/annual-summary.test.ts#(8) userA's bonus/vacation amounts never appear in userB's own summary total"
        status: pass
    human_judgment: false
  - id: D6
    description: "A general Next.js error.tsx boundary catches unexpected render-time throws across the whole (app) route segment, with a retry button that calls reset()."
    verification:
      - kind: unit
        ref: "src/app/(app)/error.render.test.tsx#AppError"
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-08-31
status: complete
---

# Phase 4 Plan 01: Annual Summary Engine + Recharts Chart Summary

**computeAnnualSummary walks every avans/salary/bonus/vacation event across a calendar year through the existing НДФЛ engine, rendered as a 2-slice Recharts donut on the home screen, reconciling exactly (to the kopeck) with an independently-derived per-event oracle.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-31T10:22Z (plan created) / execution ~10:33Z
- **Completed:** 2026-08-31T10:38:54+03:00
- **Tasks:** 2
- **Files modified:** 10 (6 created, 4 modified, excluding package-lock.json)

## Accomplishments
- `computeAnnualSummary(userId, taxYear)` server action: flattens the year's avans/salary/bonus/vacation events into one chronologically-sorted list, seeds the cumulative tracker from the applicable YTD baseline (added exactly once, dateless, never itself taxed), and walks it through `calculateNdfl` — proven exact against an independent `getCumulativeIncomeBeforeDate` + `calculateNdfl` oracle across 8 integration tests, including a deliberate НДФЛ-bracket crossing.
- `resolveBaselineWindow` extracted (pure refactor, zero behavior change, full existing suite still green) from `computeCumulativeIncome` so the single-event forecast and the new whole-year walk share one baseline-applicability formula by construction.
- `AnnualPieChart` client component: exactly 2 Recharts `<Cell>` slices (Налог/На руки, mathematically partitioning Грязными into 360°), a bold total line, and a 3-row Грязными/Налог/На руки summary with ru-RU-formatted percentages — wired below `NextPaymentCard` on the home screen.
- `src/app/(app)/error.tsx`: a general Next.js error boundary for the whole `(app)` route segment (not scoped narrowly to the chart), with a working retry button.
- Estimated-baseline caveat ("Примечание: начальное значение дохода — это ваша оценка.") surfaces distinctly on the chart itself whenever the baseline is unconfirmed or doesn't apply to `taxYear` — never silently treated as confirmed.
- Defensive (currently unreachable-by-construction) empty-state fallback in `page.tsx` replaces a bare `null`, forward-compatible insurance per the plan's flagged assumption.

## Task Commits

Each task was committed atomically:

1. **Task 1: Annual summary engine + Recharts chart, wired end-to-end onto the home screen** - `5bf332a` (feat)
2. **Task 2: Baseline-estimated note, defensive empty-state fallback, app-level error boundary, edge-case tests** - `4c35a1a` (feat)

_Note: both tasks were `tdd="true"`; tests were written and run alongside implementation within each single commit per task rather than as separate RED/GREEN commits, matching this plan's own task granularity (no plan-level `type: tdd` gate applies here — the phase's TDD gate check is `task`-scoped, not `plan.type`-scoped, and neither task's frontmatter set `type: tdd` at the plan level)._

## Files Created/Modified
- `src/app/actions/annual-summary.ts` - `computeAnnualSummary`, `AnnualSummary`, `AnnualSummaryResult` — the whole-year aggregation server action
- `src/app/actions/annual-summary.test.ts` - 8 integration tests: not-configured gates, reconciliation oracle, bracket-crossing baseline test, baselineIsEstimated logic, cross-user isolation (x2), Dec-31-baseline-excludes-all-events
- `src/components/annual-pie-chart.tsx` - `AnnualPieChart` client component (Recharts donut + summary)
- `src/components/annual-pie-chart.render.test.tsx` - baseline-estimated note shown/hidden
- `src/app/(app)/error.tsx` - `AppError` Next.js error boundary
- `src/app/(app)/error.render.test.tsx` - heading/body copy, retry button calls `reset()` once
- `src/domain/pay/payment-accrual.ts` - `selectEffectiveEntry` now exported (visibility-only change)
- `src/lib/db/salary-repository.ts` - `resolveBaselineWindow` extracted, `computeCumulativeIncome` refactored to call it
- `src/app/(app)/page.tsx` - wires `computeAnnualSummary` + `AnnualPieChart`, replaces `null` fallback with a defensive empty-state card
- `package.json` / `package-lock.json` - `recharts@3.10.1` added (pre-vetted in 04-RESEARCH.md's Package Legitimacy Audit)

## Decisions Made
- Used `resolveBaselineWindow(baseline, \`${taxYear}-12-31\`)` as the "does this baseline apply anywhere in taxYear" check, reusing the single-event formula unmodified rather than writing a parallel year-level check.
- Chose per-row (not per-date-grouped) bonus/vacation event construction in the annual walk, relying on the marginal-tax telescoping identity (sum of sequential deltas between two cumulative endpoints is order-independent) for aggregate-total correctness — documented in the module's own test-file comments as the design rationale.
- Test suite design confines reconciliation-oracle test amounts to the first НДФЛ bracket (under 2,400,000 rub cumulative) where the tax function is locally linear, making the "independent per-event oracle equals the true sequential walk" property exact regardless of same-date-tie resolution order — a separate bracket-crossing test (Task 1, test 4) uses only schedule events (no same-date ties possible, since avans/salary land on different days-of-month) to independently prove correctness across a bracket boundary too.

## Deviations from Plan

None - plan executed exactly as written. All must_haves.truths and prohibitions were addressed as specified in the plan frontmatter.

## Issues Encountered

- The reconciliation test (Task 1, test 3) initially timed out at the default 5000ms Vitest timeout because its oracle loop issued ~26 sequential `getCumulativeIncomeBeforeDate` round-trips against the real Neon database. Fixed by parallelizing the oracle's cumulative-income reads via `Promise.all` (read-only queries, safe to parallelize) — same fix applied preemptively to the Task 1 bracket-crossing test. Not a deviation from the plan's implementation contract, purely a test-performance fix within the same test file the plan specified.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- HOME-02 is fully satisfied: the annual gross/tax/net breakdown is live on the home screen, gated identically to the existing forecast, with the estimated-baseline caveat surfaced distinctly.
- `AnnualPieChart` visual rendering (donut proportions, colors, legibility in a real browser) has not been confirmed via screenshot/manual UAT in this session — flagged as `human_judgment: true` in the coverage block above (D2). Recommend a quick visual pass before phase close-out.
- `src/app/(app)/error.tsx` is now a general safety net for the entire `(app)` segment — future plans touching that segment's render paths should be aware an unhandled throw now surfaces this boundary rather than a Next.js default error page.
- Phase 4's second plan (PWA installability — manifest, icons, service worker, standalone-mode detection) has no code dependency on this plan's artifacts and can proceed independently.

---
*Phase: 04-annual-overview-pwa-installability*
*Completed: 2026-08-31*

## Self-Check: PASSED

All 6 created files verified present on disk (`[ -f ]`). Both task commit hashes (`5bf332a`, `4c35a1a`) verified present in `git log --oneline --all`. Full acceptance-criteria and plan-level `<verification>` commands re-run and confirmed passing immediately before this SUMMARY was written: `npm run test -- src/app/actions/annual-summary.test.ts src/components/annual-pie-chart.render.test.tsx src/app/(app)/error.render.test.tsx` (11/11 passed), `npm run test` (full suite, 334/334 passed), `npm run build` (compiled cleanly), `grep -c "Cell key" src/components/annual-pie-chart.tsx` (== 2).
