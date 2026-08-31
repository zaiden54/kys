---
phase: 02-bonuses-one-off-payments
plan: 04
subsystem: ui, forms, testing
tags: [react-hook-form, vitest, testing-library, jsdom]

requires:
  - phase: 02-bonuses-one-off-payments
    provides: BonusRow component, saveBonusAction, bonus repository (plans 02-01/02/03)
provides:
  - toDefaults(bonus)/reset-based form resync fix for BonusRow, closing CR-01's two data-loss failure paths (cancel-then-reopen, cross-device prop update while mounted)
  - formatPaymentDate helper in bonus-row.tsx fixing the IN-01 delete-confirm formatting inconsistency
  - bonus-row.render.test.tsx: first render-based (jsdom + Testing Library) regression test in this codebase, proving RHF form resync behavior the existing AST-only bonus-row.test.ts structurally cannot catch
  - jsdom + @testing-library/dom + @testing-library/react devDependencies and a *.test.tsx-aware vitest.config.ts, enabling render-based tests for future phases
affects: [phase 02 re-verification, any future phase adding render-based component tests]

actuals:
  tokens: 1785
  tasks: 3
  commits: 2

tech-stack:
  added: [jsdom, "@testing-library/dom", "@testing-library/react"]
  patterns: ["per-file // @vitest-environment jsdom docblock to scope jsdom only to render tests, keeping the global vitest environment node so server-only guards (src/lib/session.ts) don't fire for unrelated test files"]

key-files:
  created:
    - "src/app/(app)/bonuses/bonus-row.render.test.tsx"
  modified:
    - "src/app/(app)/bonuses/bonus-row.tsx"
    - "vitest.config.ts"
    - "package.json"
    - "package-lock.json"

key-decisions:
  - "Used React Hook Form's `values` option (not `defaultValues`) plus explicit `reset(toDefaults(bonus))` on both Cancel and onEdit's success branch — `values` alone only fixes the cross-device resync path (RHF passively re-diffs the prop), it does not fix Cancel (typing never changes the `bonus` prop, so RHF's passive resync never fires); both were required to close both CR-01 failure paths"
  - "Scoped jsdom to a single test file via `// @vitest-environment jsdom` docblock rather than flipping vitest.config.ts's global environment, because src/lib/session.ts throws immediately if `window` is defined, which would break every other test file that transitively imports it"
  - "Bundled the trivial IN-01 delete-confirm formatting fix into this plan (same file, one line) per 02-VERIFICATION.md's explicit bundling allowance, rather than opening a separate plan for it"

patterns-established:
  - "Render-based component regression tests: vi.mock the Server Action import (mirrors src/app/actions/bonus.test.ts's pattern) to sever the transitive db/env/auth/next-cache import chain, keeping the test hermetic and independent of a live DATABASE_URL"

requirements-completed: [BON-01, BON-02]

coverage:
  - id: D1
    description: "BonusRow no longer resubmits a stale, previously-typed value after Cancel-then-reopen (CR-01 failure path 1)"
    requirement: "BON-01"
    verification:
      - kind: unit
        ref: "src/app/(app)/bonuses/bonus-row.render.test.tsx#discards an unsaved edit when the user cancels and reopens edit mode"
        status: pass
    human_judgment: false
  - id: D2
    description: "BonusRow resyncs to a cross-device bonus prop update delivered while the row is still mounted, before the user reopens edit mode (CR-01 failure path 2)"
    requirement: "BON-01"
    verification:
      - kind: unit
        ref: "src/app/(app)/bonuses/bonus-row.render.test.tsx#resyncs the form to a bonus prop update delivered while the row is still mounted"
        status: pass
    human_judgment: false
  - id: D3
    description: "IN-01 delete-confirm dialog now uses formatKopecks/formatPaymentDate instead of raw kopecksToRubles number and raw ISO date string"
    verification:
      - kind: unit
        ref: "src/app/(app)/bonuses/bonus-row.test.ts#catches the awaited action in onEdit... (WR-02 AST contract, re-verified unaffected)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No regression across the full pre-existing Phase 1/2 suite (262 tests) plus the 2 new render-based cases"
    verification:
      - kind: integration
        ref: "npm test (full suite) — 20 test files, 264 tests, all passed"
        status: pass
    human_judgment: false

duration: 28min
completed: 2026-08-30
status: complete
---

# Phase 02 Plan 04: BonusRow Edit-Form Resync Summary

**Fixed BonusRow's edit form to always resync to the bonus's real current data — via React Hook Form's `values` option plus explicit `reset(toDefaults(bonus))` on Cancel and save-success — closing CR-01's two data-loss paths (stale-typed-value-on-cancel, stale-value-on-cross-device-resync), proven by this codebase's first render-based (jsdom + Testing Library) regression test.**

## Performance
- **Duration:** 28min
- **Started:** 2026-08-30T15:38:00Z
- **Completed:** 2026-08-30T16:05:44Z
- **Tasks:** 3 completed (Task 1 pre-approved checkpoint, Task 2 RED+GREEN, Task 3 full regression sweep)
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- Closed 02-REVIEW.md's sole remaining CRITICAL finding (CR-01): BonusRow's edit form can no longer silently resubmit stale client-cached data over a bonus's real, current saved value, on either the Cancel-then-reopen path or the cross-device-resync-while-mounted path.
- Added the first render-based (real DOM, real user-event simulation) component regression test in this codebase, backed by jsdom + @testing-library/react, proving the fix rather than merely asserting it — the existing bonus-row.test.ts is AST-only and structurally cannot catch this class of bug.
- Bundled the trivial IN-01 delete-confirm formatting fix (raw kopecks/ISO-date -> formatKopecks/formatPaymentDate) into the same file/diff.
- Full regression sweep: `npx tsc --noEmit` clean, full `npm test` green at 264/264 (262 pre-existing + 2 new), zero regressions, zero skipped/deleted tests.

## Task Commits
1. **Task 1: Package legitimacy checkpoint** — approved by user (jsdom, @testing-library/dom, @testing-library/react), no commit (gate-only task)
2. **Task 2: Install test deps, prove CR-01 red, fix BonusRow's form resync, prove green** — `f8a61e9` (RED: failing render test + deps/config), `b026727` (GREEN: bonus-row.tsx fix)
3. **Task 3: Full regression sweep** — verification only, no commit (zero TypeScript errors, 264/264 tests passing); required regenerating gitignored Next.js route-type declarations (`next typegen`) as an environment-bootstrap step, see Deviations

**Plan metadata:** committed alongside this SUMMARY (docs commit, see below)

## Files Created/Modified
- `src/app/(app)/bonuses/bonus-row.tsx` — added `toDefaults(bonus)` and `formatPaymentDate(isoDate)` helpers; `useForm` now uses `values: toDefaults(bonus)` instead of `defaultValues`; `reset(toDefaults(bonus))` wired into the Cancel button and onEdit's success branch; delete-confirm dialog now uses `formatKopecks`/`formatPaymentDate`
- `src/app/(app)/bonuses/bonus-row.render.test.tsx` — new render-based regression test (jsdom + @testing-library/react), 2 cases: cancel-discards-edit, prop-update-resyncs-form
- `vitest.config.ts` — `test.include` extended to also collect `*.test.tsx` files
- `package.json` / `package-lock.json` — added `jsdom`, `@testing-library/dom`, `@testing-library/react` as devDependencies

## Decisions Made
- `values` (not `defaultValues`) plus explicit `reset(toDefaults(bonus))` on both Cancel and save-success — see key-decisions in frontmatter for why both were necessary.
- jsdom scoped per-file via `// @vitest-environment jsdom` docblock rather than globally, to avoid breaking `src/lib/session.ts`'s server-only `window` guard for unrelated test files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Missing Next.js generated route-type declarations broke `npx tsc --noEmit`**
- **Found during:** Task 3 (full regression sweep)
- **Issue:** `npx tsc --noEmit` failed with `TS2304: Cannot find name 'LayoutProps'` in `src/app/layout.tsx` (a file this plan never touches). Root cause: this fresh worktree checkout had no `.next/` directory, so Next.js's generated `.next/types/**/*.ts` route/layout type declarations (referenced in `tsconfig.json`'s `include`) had never been generated — these are normally produced by `next dev`/`next build` and are gitignored, not committed.
- **Fix:** Ran `npx next typegen` (a lightweight, non-destructive, dedicated Next.js CLI command that generates only the TypeScript definitions, without a full build). This is environment bootstrap, not an application-code change.
- **Files modified:** None (output is gitignored `.next/types/`; confirmed via `git status --short` returning empty both before and after)
- **Verification:** `npx tsc --noEmit` re-run clean (zero errors) after typegen
- **Commit:** N/A (no tracked files changed)

### Process Note (not a Rule 1-4 deviation)

Task 3 carries a `<precondition>` requiring a working `DATABASE_URL` (`.env.local`) for the live-DB integration tests in the full suite. This worktree, being freshly created, did not have `.env.local` copied into it (git-ignored, so `git worktree` never copies it). Per the executor's precondition-check protocol, this was surfaced as a blocking-human checkpoint rather than auto-resolved — the coordinator subsequently approved and performed the copy of the main checkout's `.env.local` into this worktree, after which Task 3 proceeded normally with no further issues.

**Total deviations:** 1 auto-fixed (Rule 3 — build/environment bootstrap, zero application-code impact). **Impact:** none on shipped behavior; both are pure dev/CI-environment concerns.

## Issues Encountered
Task 3 was blocked once by a genuinely unmet precondition (missing `.env.local`/`DATABASE_URL` in this isolated worktree) — resolved via coordinator-approved credential copy, documented above. No other issues.

## User Setup Required
None beyond what already occurred during this session (coordinator copied `.env.local` into the worktree to unblock Task 3; no further action needed).

## Next Phase Readiness
This is the last plan in Phase 02. CR-01 (the sole remaining CRITICAL finding) is closed, and 02-VERIFICATION.md truths 11 and 12 should now be satisfiable on re-verification — truth 12's underlying tax/accrual forward-recompute logic was already database-verified correct in Phase 2 and is untouched by this plan; only its edit-form precondition (CR-01) was blocking it. Phase 02 is ready for re-verification (`/gsd-verify-work` or equivalent) to confirm truths 11/12 and mark the phase complete.

---
*Phase: 02-bonuses-one-off-payments*
*Completed: 2026-08-30*
