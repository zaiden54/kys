---
phase: 05-deploy-pipeline-environment-config
plan: 02
subsystem: testing
tags: [eslint, react-hooks, useSyncExternalStore, vitest, ci-baseline, typescript]

# Dependency graph
requires:
  - phase: 05-deploy-pipeline-environment-config
    provides: "05-01's dynamic Better Auth baseURL work (src/lib/auth.ts, src/lib/auth-allowed-hosts.ts) — zero file overlap with this plan, confirmed untouched"
provides:
  - "Lint-clean, typecheck-clean baseline (`npm run lint` and `npx tsc --noEmit` both exit 0)"
  - "`npm run typecheck` script for Plan 05-03's CI workflow to call by name"
  - "2 pre-existing, unrelated forecast.test.ts failures visibly tracked as `it.skip` with dated tracking comments, not hidden or deleted"
affects: [05-03-ci-workflow-branch-protection]

# Actuals (#2632)
actuals:
  tokens: 1733
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useSyncExternalStore for reading a mount-time external mutable source (localStorage) instead of an effect-driven setState, with a synthetic same-tab change event since native `storage` events never fire in the writing tab"
    - "Deferring `handleSubmit(fn)` closure creation into the submit event handler (`onSubmit={(e) => handleSubmit(fn)(e)}`) instead of calling it during render, to satisfy React Compiler's `react-hooks/refs` rule against react-hook-form's ref-reading `handleSubmit` factory"

key-files:
  created: []
  modified:
    - "src/app/(app)/bonuses/bonus-row.tsx"
    - "src/app/(app)/vacations/vacation-row.tsx"
    - "src/components/install-banner.tsx"
    - "src/lib/use-standalone.ts"
    - "eslint.config.mjs"
    - "package.json"
    - "src/app/actions/forecast.test.ts"

key-decisions:
  - "install-banner.tsx rewritten to read the dismissed flag via useSyncExternalStore (not a lazy useState initializer) since SSR has no window and the client's first hydration render must match the server's false output"
  - "The 2 pre-existing forecast.test.ts failures (bonus/scheduled + same-date vacation composition) are skipped, not fixed — root cause is in forecastNextPayment's composition logic, out of scope for a deploy-pipeline cleanup plan; tracked in STATE.md Blockers/Concerns"

patterns-established:
  - "Serwist-generated public/sw.js / public/sw.js.map are ESLint-ignored via globalIgnores, matching their existing .gitignore exclusion — any future generated build artifact should follow the same pattern"

requirements-completed: [DEPLOY-03]

coverage:
  - id: D1
    description: "4 pre-existing react-hooks ESLint errors resolved with no behavior change (bonus-row.tsx, vacation-row.tsx, install-banner.tsx, use-standalone.ts)"
    requirement: "DEPLOY-03"
    verification:
      - kind: unit
        ref: "npx eslint on all 4 files — 0 errors, 0 warnings"
        status: pass
      - kind: unit
        ref: "src/components/install-banner.render.test.tsx — all 4 cases pass unmodified"
        status: pass
    human_judgment: false
  - id: D2
    description: "npm run lint, npx tsc --noEmit, and npm run typecheck all exit 0 on the branch"
    requirement: "DEPLOY-03"
    verification:
      - kind: unit
        ref: "npm run lint (command invocation)"
        status: pass
      - kind: unit
        ref: "npx tsc --noEmit (command invocation)"
        status: pass
      - kind: unit
        ref: "npm run typecheck (command invocation)"
        status: pass
    human_judgment: false
  - id: D3
    description: "2 pre-existing unrelated forecast.test.ts failures visibly skipped with tracking comments, not hidden or deleted; all other tests pass"
    requirement: "DEPLOY-03"
    verification:
      - kind: unit
        ref: "npm test — 360 passed, 2 skipped, 0 failed (35 test files)"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-09-01
status: complete
---

# Phase 05 Plan 02: CI Baseline Cleanup Summary

**Cleared 4 real react-hooks ESLint errors and 71 false-positive sw.js lint warnings, added `npm run typecheck`, and visibly tracked 2 unrelated pre-existing test failures — so Plan 05-03's CI gate starts from a genuinely green baseline instead of a permanently-red one.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-09-01
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Fixed all 4 real `react-hooks` ESLint errors in committed source: deferred `handleSubmit(onEdit)` closure creation into the submit event handler in `bonus-row.tsx`/`vacation-row.tsx` (clears `react-hooks/refs`); removed a redundant duplicate `setIsStandalone` call in `use-standalone.ts`'s mount effect; rewrote `install-banner.tsx`'s dismissed-flag read to `useSyncExternalStore` with a synthetic same-tab change event (both clear `react-hooks/set-state-in-effect`)
- Added `public/sw.js` and `public/sw.js.map` to `eslint.config.mjs`'s `globalIgnores` — dropped total lint problems from 76 (5 errors) to 2 (0 errors, 2 pre-existing legitimate warnings, out of scope)
- Added `npm run typecheck` (`tsc --noEmit`) as a first-class script for Plan 05-03's CI workflow
- Marked the 2 genuinely broken, unrelated `forecast.test.ts` cases (`composes scheduled pay and vacation pay...`, `composes bonus and vacation pay...`) as `it.skip` with an explicit tracking comment pointing at STATE.md's Blockers/Concerns — not deleted, not silently red

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix the 4 real pre-existing react-hooks ESLint errors** - `496299c` (fix)
2. **Task 2: Ignore generated files in ESLint, add typecheck script, track 2 pre-existing test failures** - `a2a94c0` (chore)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/app/(app)/bonuses/bonus-row.tsx` - `onSubmit` closure deferred into the event handler
- `src/app/(app)/vacations/vacation-row.tsx` - same fix, identical pattern
- `src/components/install-banner.tsx` - rewritten to `useSyncExternalStore` for the dismissed-flag read
- `src/lib/use-standalone.ts` - removed redundant `setIsStandalone` call in mount effect
- `eslint.config.mjs` - `globalIgnores` extended with Serwist-generated `public/sw.js`/`public/sw.js.map`
- `package.json` - added `"typecheck": "tsc --noEmit"` script
- `src/app/actions/forecast.test.ts` - 2 pre-existing failing tests marked `it.skip` with tracking comments

## Decisions Made
- `install-banner.tsx`'s dismissed flag genuinely cannot use a lazy `useState` initializer (SSR has no `window`; first hydration render must match the server's `false`), so `useSyncExternalStore` is the React-idiomatic fix rather than a workaround
- The 2 `forecast.test.ts` failures are a real domain bug in `forecastNextPayment`'s bonus/scheduled + same-date-vacation composition, not a Phase 5 regression — confirmed identical failure against the unmodified repo during planning (`git stash`) and re-confirmed live in this plan before skipping; fixing the domain logic is explicitly out of scope for a deploy-pipeline cleanup plan and needs dedicated investigation

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their `<action>` blocks precisely; all `<acceptance_criteria>` passed on the first attempt with no auto-fixes required.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `npm run lint`, `npx tsc --noEmit`, `npm run typecheck`, and `npm test` all exit 0 on this branch (verified live: lint 0 errors/2 warnings, tsc clean, typecheck clean, 360 passed/2 skipped/0 failed)
- Plan 05-03's CI workflow can now gate on `npm run lint && npm run typecheck && npm test` with real signal — no permanently-red baseline blocking every future PR
- The 2 skipped `forecast.test.ts` cases remain an open item — tracked in STATE.md Blockers/Concerns and this plan's coverage table; a future phase should investigate `forecastNextPayment`'s same-date bonus/scheduled + vacation composition logic

## Self-Check: PASSED

- FOUND: src/app/(app)/bonuses/bonus-row.tsx
- FOUND: src/app/(app)/vacations/vacation-row.tsx
- FOUND: src/components/install-banner.tsx
- FOUND: src/lib/use-standalone.ts
- FOUND: eslint.config.mjs (public/sw.js, public/sw.js.map in globalIgnores)
- FOUND: package.json ("typecheck": "tsc --noEmit")
- FOUND: src/app/actions/forecast.test.ts (2 it.skip with tracking comments)
- FOUND commit: 496299c
- FOUND commit: a2a94c0

---
*Phase: 05-deploy-pipeline-environment-config*
*Completed: 2026-09-01*
