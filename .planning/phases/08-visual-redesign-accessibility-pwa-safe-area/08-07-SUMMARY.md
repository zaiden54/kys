---
phase: 08-visual-redesign-accessibility-pwa-safe-area
plan: 07
subsystem: ui
tags: [react, nextjs, recharts, testing-library, vitest, tdd]

# Dependency graph
requires:
  - phase: 08-visual-redesign-accessibility-pwa-safe-area
    provides: "08-06's whole-phase regression closure, which filed this gap as a BLOCKER in 08-VERIFICATION.md / STATE.md Blockers"
provides:
  - "AnnualPieChart renders a distinct empty-state card (not a degenerate 0%/0% pie) whenever summary.grossKopecks === 0"
  - "Render-test proof (not just a visual claim) that the branch fires correctly in both the zero and nonzero cases"
affects: []

# Actuals (#2632)
actuals:
  tokens: 1429
  tasks: 1
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Zero-value empty-state branch pattern for a client component that otherwise unconditionally renders a data visualization (grossKopecks === 0 ternary gating the whole PieChart+breakdown block, matching the bonuses/vacations list empty-state card convention)"

key-files:
  created: []
  modified:
    - src/components/annual-pie-chart.tsx
    - src/components/annual-pie-chart.render.test.tsx

key-decisions:
  - "Aligned the empty-state markup with the established bonuses/vacations empty-state pattern (rounded-[12px], bg-[color:var(--color-secondary)], gap-3) instead of the plan's literal rounded-[8px]/bg-[color:var(--color-dominant)]/gap-2 spec, per the plan-checker's consistency note — visual consistency with Plans 08-02/08-03 outweighs the plan's literal (non-binding) styling suggestion."
  - "Left the unconditional `data` array construction in place before the ternary (unused in the zero-income branch) rather than moving it inside the nonzero branch, per the plan's explicit minimal-diff instruction."

patterns-established:
  - "Client-component zero-value empty state: gate the entire visualization block (chart + numeric breakdown) behind a single `value === 0` ternary at the render-tree level, reusing the existing list-empty-state card class string (rounded-[12px] border bg-secondary p-6 text-center) rather than inventing a new visual pattern per component."

requirements-completed: [UI-01]

coverage:
  - id: D1
    description: "AnnualPieChart renders a distinct empty-state card (heading + body copy + Настроить оклад CTA) instead of a degenerate 0%/0% pie when summary.grossKopecks === 0"
    requirement: "UI-01"
    verification:
      - kind: unit
        ref: "src/components/annual-pie-chart.render.test.tsx#AnnualPieChart zero-income empty state > renders the empty-state heading and no <svg> when grossKopecks is 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Populated (nonzero grossKopecks) case is unchanged — pie chart <svg> still renders, no empty-state heading leaks into it"
    requirement: "UI-01"
    verification:
      - kind: unit
        ref: "src/components/annual-pie-chart.render.test.tsx#AnnualPieChart zero-income empty state > does not render the empty-state heading and renders the pie chart <svg> when grossKopecks is nonzero"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-09-03
status: complete
---

# Phase 8 Plan 07: Annual Pie Chart Zero-Income Empty State Summary

**Gated `AnnualPieChart`'s PieChart+breakdown block behind a `grossKopecks === 0` ternary, replacing a degenerate 0%/0% Recharts donut with a distinct empty-state card, proven by a render test asserting `<svg>` presence/absence in both branches.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-03T00:22:00Z
- **Completed:** 2026-09-03T00:24:49Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- `src/components/annual-pie-chart.tsx` now branches on `summary.grossKopecks === 0`, rendering an empty-state card ("Пока нет дохода в {taxYear} году" heading, explanatory body copy, and a "Настроить оклад" CTA linking to `/settings/salary`) instead of a meaningless 0%/0% pie chart
- Empty-state markup reuses the exact `bonuses`/`vacations` list-empty-state card class string (`rounded-[12px] border bg-secondary p-6 text-center` + heading/body/CTA structure) for visual consistency across the app
- New render test proves the branch fires: zero `<svg>` elements + heading present when `grossKopecks: 0`; heading absent + `<svg>` present (regression guard) when `grossKopecks` is nonzero
- Closes 08-VERIFICATION.md's single BLOCKER gap (UI-01 / 08-UI-SPEC.md backstop item #1)

## Task Commits

Each task was committed atomically, following TDD RED → GREEN:

1. **Task 1 (RED): add failing test for zero-income empty state** - `8174546` (test)
2. **Task 1 (GREEN): implement zero-income empty state branch** - `2099f0f` (feat)

**Plan metadata:** (final docs commit, see below)

## Files Created/Modified
- `src/components/annual-pie-chart.tsx` - Added `grossKopecks === 0` ternary gating the entire PieChart+gross-line+breakdown-`<dl>` block; new empty-state branch with heading, body copy, and `next/link` CTA to `/settings/salary`
- `src/components/annual-pie-chart.render.test.tsx` - Added `describe("AnnualPieChart zero-income empty state", ...)` with two cases: zero-gross renders heading + zero `<svg>`, nonzero-gross renders no heading + at least one `<svg>`

## Decisions Made
- Aligned empty-state styling with the established bonuses/vacations empty-state card pattern (`rounded-[12px]`, `bg-[color:var(--color-secondary)]`, `gap-3`) rather than the plan's literal `rounded-[8px]`/`bg-[color:var(--color-dominant)]`/`gap-2` spec, per the plan-checker's explicit consistency note — this is a cosmetic deviation from the plan's exact class values, not from its behavioral intent, and was flagged as acceptable ("use your judgment") by the plan checker itself.
- Left the `data` array construction (`[{name: "Налог", ...}, {name: "На руки", ...}]`) unconditional above the ternary, per the plan's explicit minimal-diff instruction — it is simply unused in the zero-income branch.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - consistency, plan-checker-flagged] Used established empty-state class pattern instead of plan's literal class values**
- **Found during:** Task 1 (implementation)
- **Issue:** Plan's `<action>` specified `bg-[color:var(--color-dominant)]`, `rounded-[8px]`, `gap-2` for the empty-state container, which diverges from the established list empty-state pattern used elsewhere in Phase 8 (`bonuses`/`vacations` pages: `bg-[color:var(--color-secondary)]`, `rounded-[12px]`, `gap-3`)
- **Fix:** Used the established pattern's class values instead, matching `BonusListContent`'s empty-state card exactly (structure, spacing, colors) for visual consistency across the app
- **Files modified:** src/components/annual-pie-chart.tsx
- **Verification:** Visual class values match `src/app/(app)/bonuses/page.tsx`'s zero-rows branch verbatim; all 4 render tests still pass (tests only assert text content and `<svg>` presence, not class strings, so this had zero test impact)
- **Committed in:** 2099f0f (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 consistency alignment, explicitly pre-approved by the plan-checker's note)
**Impact on plan:** Purely cosmetic class-value change within the plan's own designed empty-state pattern; no scope creep, no behavioral change beyond what the plan specified.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 08-VERIFICATION.md's single BLOCKER gap is now closed. Phase 8 (Visual Redesign, Accessibility & PWA Safe-Area) has no remaining open structural gaps.
- Full unit suite green: 372 passed, 2 pre-existing skips (unrelated forecast.test.ts skips from Phase 5, out of scope), 0 failures.
- `npx tsc --noEmit` clean.
- Zero changes to `src/domain/**`, `src/lib/db/**`, `src/app/actions/**`, or `src/app/(app)/page.tsx` — confirmed via `git status --porcelain` gates, satisfying the "zero change to calculation logic" v1.1 milestone constraint.

---
*Phase: 08-visual-redesign-accessibility-pwa-safe-area*
*Completed: 2026-09-03*

## Self-Check: PASSED

- FOUND: src/components/annual-pie-chart.tsx
- FOUND: src/components/annual-pie-chart.render.test.tsx
- FOUND: .planning/phases/08-visual-redesign-accessibility-pwa-safe-area/08-07-SUMMARY.md
- FOUND commit: 8174546
- FOUND commit: 2099f0f
