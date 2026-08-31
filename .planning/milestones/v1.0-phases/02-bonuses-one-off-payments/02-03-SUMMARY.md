---
phase: 02-bonuses-one-off-payments
plan: 03
subsystem: bonuses-forecast-validation
tags: [gap-closure, ndfl-forecast, bonus-form, bonus-row, validation, roadmap-contract]
requires:
  - "02-01: bonus tracer (createBonus, saveBonusAction, forecast integration)"
  - "02-02: bonus edit/delete (bonus-row.tsx onEdit/onDelete)"
provides:
  - "Valid, committed Phase 2 ROADMAP.md user-story goal (unblocks gsd-verifier's MVP pre-flight guard)"
  - "forecastNextPayment.baselineIsEstimated gated on the same year/date boundary getCumulativeIncomeBeforeDate honors"
  - "Guarded bonus create (bonus-form.tsx) and edit (bonus-row.tsx) save paths that always surface a rejected saveBonusAction call"
  - "bonusInputSchema rejection of sub-kopeck ruble precision (more than two decimal places)"
affects:
  - "src/app/actions/forecast.ts"
  - "src/app/(app)/bonuses/bonus-form.tsx"
  - "src/app/(app)/bonuses/bonus-row.tsx"
  - "src/lib/validation/bonus.ts"
actuals:
  tokens: 4900
  tasks: 3
  commits: 5
tech-stack:
  added: []
  patterns:
    - "AST-inspection regression tests (ts.createSourceFile over the component source) for try/catch-guarded Server Action calls, extended from pay-setup-forms.test.ts to bonus-form.test.ts and bonus-row.test.ts"
    - "Derive a boundary-applicability flag (baselineApplies) once in the caller, mirroring a repository-layer boundary check exactly, so a confidence flag can never disagree with the number it describes"
key-files:
  created:
    - "src/app/(app)/bonuses/bonus-form.test.ts"
    - "src/app/(app)/bonuses/bonus-row.test.ts"
  modified:
    - "src/app/actions/forecast.ts"
    - "src/app/actions/forecast.test.ts"
    - "src/app/(app)/bonuses/bonus-form.tsx"
    - "src/app/(app)/bonuses/bonus-row.tsx"
    - "src/lib/validation/bonus.ts"
    - "src/lib/validation/bonus.test.ts"
key-decisions:
  - "Phase 2 ROADMAP.md Goal line required no edit — it was already committed in valid user-story format by a prior session (commit 79a253d); Task 1 became a verification-only no-op with nothing new to commit for that file."
  - "The WR-01 regression test uses a 2025/2026 year pair (not 2026/2027) because 2027 exceeds MAX_VERIFIED_TAX_YEAR and calculateNdfl throws UnsupportedTaxYearError before the assertion under test can run."
patterns-established:
  - "A caller-side confidence flag that describes whether a stored value was actually used must re-derive the exact same boundary condition the value-producing function applies, not copy the value's own flag independently."
requirements-completed: [BON-01, BON-02]
coverage:
  - id: D1
    description: "Phase 2 ROADMAP.md Goal line validates as a well-formed user story (non-empty role/capability/outcome), unblocking gsd-verifier's mandatory MVP pre-flight guard"
    requirement: null
    verification:
      - kind: command
        ref: "gsd-tools query user-story.validate --story \"As a signed-in user, I want to attach a one-off bonus or compensation (ex. sports) to a payment date, so that I can see how it affects my cumulative НДФЛ and future take-home payments.\""
        status: pass
    human_judgment: false
  - id: D2
    description: "A confirmed YTD baseline outside the applicable year/date boundary is never reported as baselineIsEstimated: false"
    requirement: BON-02
    verification:
      - kind: test
        ref: "src/app/actions/forecast.test.ts (13), (14)"
        status: pass
      - kind: command
        ref: "npx tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D3
    description: "Rejected saveBonusAction calls from create (bonus-form.tsx) and edit (bonus-row.tsx) always surface the fixed generic Russian retry message"
    requirement: BON-01
    verification:
      - kind: test
        ref: "src/app/(app)/bonuses/bonus-form.test.ts, src/app/(app)/bonuses/bonus-row.test.ts"
        status: pass
      - kind: command
        ref: "npx tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D4
    description: "bonusInputSchema rejects ruble amounts with more than two decimal places before rublesToKopecks can silently round them"
    requirement: BON-01
    verification:
      - kind: test
        ref: "src/lib/validation/bonus.test.ts (1.001, 1.005 rejected; 1.01 accepted)"
        status: pass
    human_judgment: false
duration: "~15 min"
completed: 2026-08-30
status: complete
---

# Phase 02 Plan 03: Roadmap Contract Fix and Forecast/Bonus Warning Closure Summary

**Locked in the already-valid Phase 2 user-story goal, gated `baselineIsEstimated` on the exact boundary `getCumulativeIncomeBeforeDate` honors, guarded both bonus save paths against unhandled rejections, and closed the sub-kopeck precision gap in `bonusInputSchema` — retiring all three open `02-REVIEW.md` warnings and the sole `02-VERIFICATION.md` gap.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-30
- **Completed:** 2026-08-30
- **Tasks:** 3/3
- **Files:** 8 (2 created, 6 modified)

## Accomplishments

- Confirmed `.planning/ROADMAP.md`'s Phase 2 Goal line already validates as a well-formed user story (`role`, `capability`, `outcome` all non-empty) via `gsd-tools query user-story.validate` — it was corrected and committed in a prior session (commit `79a253d`), so no new edit or commit was needed for this task.
- Closed WR-01: `forecastNextPayment` now derives `baselineApplies` using the identical `asOfDate`/year boundary `getCumulativeIncomeBeforeDate` already enforces on the cumulative-income figure, and reports `baselineIsEstimated: true` whenever the stored baseline was silently ignored (wrong year, or dated after the payment) — the confidence flag can no longer disagree with the number it describes.
- Closed WR-02: both `bonus-form.tsx`'s `onSubmit` and `bonus-row.tsx`'s `onEdit` now wrap the awaited `saveBonusAction` call in `try/catch`, setting and rendering the same fixed generic Russian retry message (`"Не удалось сохранить бонус. Попробуйте ещё раз."`) the delete flow and `SalaryForm` already use — no caught error detail is ever read or interpolated.
- Closed WR-03: `bonusInputSchema.amountRubles` gained a second `refine` rejecting any ruble amount carrying more than two decimal places (e.g. `1.001`, `1.005`) before `rublesToKopecks`'s `Math.round(value * 100)` could silently round it.
- Added two new AST-inspection regression test files (`bonus-form.test.ts`, `bonus-row.test.ts`) extending the `ts.createSourceFile`-based pattern already established by `pay-setup-forms.test.ts`, plus new regression cases in `forecast.test.ts` and `bonus.test.ts`.
- Full verification block passed: `user-story.validate` reports `valid: true`; all four named test files pass; the full suite (`npm test -- --run`) passes at 19 files / 262 tests; `npx tsc --noEmit` and `npm run build` both exit 0.

## Task Commits

| # | Task | Commit | Type |
|---|------|--------|------|
| 1 | Lock in corrected Phase 2 user-story goal | *(no new commit — already committed in `79a253d`; verified via `user-story.validate`)* | — |
| 2a | RED — failing test for baselineIsEstimated boundary | `611cf6f` | test |
| 2b | GREEN — gate baselineIsEstimated on the cumulative-income boundary | `cebd9d3` | feat |
| 3a | RED — failing tests for save/edit guards + precision | `7b21d4b` | test |
| 3b | GREEN — guard bonus save/edit, reject sub-kopeck precision | `442fac7` | feat |

## Files Created/Modified

**Created:**
- `src/app/(app)/bonuses/bonus-form.test.ts` — AST regression test for the guarded `onSubmit`/`saveBonusAction` call and `serverError` rendering
- `src/app/(app)/bonuses/bonus-row.test.ts` — AST regression test for the guarded `onEdit`/`saveBonusAction` call and `error` rendering while still in editing mode

**Modified:**
- `src/app/actions/forecast.ts` — `baselineApplies` derivation and `baselineIsEstimated: !baselineApplies || ytdBaseline.isEstimated`
- `src/app/actions/forecast.test.ts` — tests (13) and (14): year-boundary regression and in-boundary control case
- `src/app/(app)/bonuses/bonus-form.tsx` — `serverError` state, `try/catch` around `saveBonusAction`, rendered error
- `src/app/(app)/bonuses/bonus-row.tsx` — `try/catch` around `onEdit`'s `saveBonusAction`, `error` rendered in editing-mode `<li>`
- `src/lib/validation/bonus.ts` — second `refine` on `amountRubles` rejecting sub-kopeck precision
- `src/lib/validation/bonus.test.ts` — precision rejection (`1.001`, `1.005`) and acceptance (`1.01`) cases

## Decisions Made

- Phase 2 ROADMAP.md Goal line required no edit — it was already committed in valid user-story format by a prior session (commit `79a253d`); Task 1 became a verification-only step with nothing new to stage or commit for that file.
- The WR-01 regression test uses a 2025 baseline / 2026 payment year pair rather than 2026/2027, since 2027 exceeds `MAX_VERIFIED_TAX_YEAR` and `calculateNdfl` throws `UnsupportedTaxYearError` before the assertion under test could run — the test still exercises the exact same year-mismatch boundary condition.

## Deviations from Plan

None - plan executed exactly as written. Task 1 required only a verification run (no file edit) since the ROADMAP.md goal line was already correct and committed before this plan started, which the plan's own `<action>` explicitly anticipated ("Confirm the Phase 2 `**Goal:**` line ... already reads as a valid ... user story — it does").

## Issues Encountered

None.

## Authentication Gates

None - no external service authentication was required for this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

All three `02-REVIEW.md` warnings (WR-01, WR-02, WR-03) and the sole `02-VERIFICATION.md` gap (`G-02-roadmap-userstory`) are closed. `.planning/ROADMAP.md`'s Phase 2 Goal line is a valid, committed user story, so `/gsd-execute-phase 02 --gaps-only` (or a direct re-run of `gsd-verifier`) can now evaluate BON-01/BON-02 against real implementation evidence instead of refusing at the MVP pre-flight gate. No BON-01/BON-02 behavior from 02-01/02-02 was altered beyond the three named fixes. Full test suite (262 tests) and production build are green.

## Self-Check: PASSED

All 8 created/modified source files and this SUMMARY.md were confirmed present on disk. All 4 task commit hashes (`611cf6f`, `cebd9d3`, `7b21d4b`, `442fac7`) were confirmed present in `git log`.
