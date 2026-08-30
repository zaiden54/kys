---
phase: 02-bonuses-one-off-payments
fixed_at: 2026-08-30T16:31:48Z
review_path: .planning/phases/02-bonuses-one-off-payments/02-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-08-30T16:31:48Z
**Source review:** .planning/phases/02-bonuses-one-off-payments/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (fix_scope: critical_warning → CR-* and WR-*): 3
- Fixed: 3
- Skipped: 0

IN-01 (duplicated `formatPaymentDate`) was out of scope for this run (`fix_scope: critical_warning`) and was not touched.

## Fixed Issues

### CR-01: `onEdit`'s success-path `reset()` used the stale pre-save `bonus`, not the just-saved `values`

**Files modified:** `src/app/(app)/bonuses/bonus-row.tsx`
**Commit:** `8e79fdc`
**Applied fix:** Changed the success branch of `onEdit` from `reset(toDefaults(bonus))` to `reset(values)`. `bonus` is the closure-captured pre-edit prop, guaranteed stale until Next.js's revalidated RSC payload lands; `values` is the just-submitted, now-authoritative `BonusInput`. This removes the race window where reopening edit before the prop refresh landed showed (and could resubmit) the pre-save amount.

### WR-01: Unconditional `values` resync could silently discard an in-progress edit with no user warning

**Files modified:** `src/app/(app)/bonuses/bonus-row.tsx`, `src/app/(app)/bonuses/bonus-row.render.test.tsx`
**Commit:** `c24efbc`
**Applied fix:** Added `resetOptions: { keepDirtyValues: true }` to the `useForm` config. Chose this over an inline "your edits were discarded" notice — it's the smaller-surface change (one config line vs. new derived state + UI + dismissal behavior) and it directly preserves correctness: a field the user is actively typing into is no longer silently overwritten by a concurrent cross-device revalidation, while untouched fields still adopt the fresh server value. Because `resetOptions` on `useForm` is also picked up by explicit `reset()` calls (verified against `node_modules/react-hook-form`'s source — the exported `reset()` merges `{...configuredResetOptions, ...callOptions}`), both existing explicit `reset()` call sites (Cancel button, and the CR-01 post-save reset) were updated to pass an explicit `{ keepDirtyValues: false }` override, preserving their original full-discard/full-adopt semantics. Added a render test (`bonus-row.render.test.tsx`) proving a dirty field survives a mid-edit prop resync while an untouched field picks up the new value.

**Trade-off (documented per review's guidance):** this narrows, but does not fully close, the possibility of eventually submitting a value based on a premise that changed underneath the user (the review's own caveat on this option) — the user is still responsible for noticing the conflict before hitting save. No inline conflict notice was added; this is a deliberate scope choice for this fix pass, not an oversight.

### WR-02: A superseded (cancelled) in-flight submission could retroactively clobber a newer edit session when it resolved

**Files modified:** `src/app/(app)/bonuses/bonus-row.tsx`, `src/app/(app)/bonuses/bonus-row.render.test.tsx`
**Commit:** `0c74f87`
**Applied fix:** Added an `editSessionRef` (numeric token, `useRef(0)`) that is incremented at the start of every `onEdit` submission and on every Cancel click. Both the success and error/catch continuations in `onEdit` now check `editSessionRef.current !== session` immediately after the `await saveBonusAction(data)` settles, and no-op if the session has moved on (i.e., the user cancelled and/or started a new submission since this particular call began). Added a render test that pauses `saveBonusAction` on a controlled promise, cancels mid-flight, opens a second edit session with different input, then resolves the first (now-superseded) call and asserts the second session's mode and typed value survive untouched.

## Verification

**Where verification ran:** All checks below ran inside the isolated git worktree created for this fix run (`.claude/worktrees/rf-02-1158280-1788106909`, branch `gsd-reviewfix/02-1158280`), not the main checkout. `node_modules` was made available via a symlink to the main checkout's `node_modules` (safe on this Linux environment — `git worktree remove` does not recurse through a directory symlink), and `.env.local` was copied in from the main checkout (gitignored, untracked, required by four DB/env-dependent test files). These are not part of any commit. The worktree's commits are fast-forwarded onto the user's branch and the worktree is torn down as part of this run's cleanup tail, so these exact commands are reproducible from the main checkout post-merge (same source tree, same `.env.local`, same `node_modules`).

- `npx tsc --noEmit`: 1 error, pre-existing and unrelated — `src/app/layout.tsx(20,50): error TS2304: Cannot find name 'LayoutProps'`. Confirmed present before any of this run's edits (baseline check run first). No new type errors introduced by any of the three fixes.
- `npm test` (full suite): **266 passed / 266** (20 test files). Baseline before these fixes was 264 passed; the 2 additional passing tests are the new WR-01 and WR-02 render-test cases added in this run. No existing test was weakened, skipped, or deleted.

## Skipped Issues

None — all 3 in-scope findings (CR-01, WR-01, WR-02) were fixed.

---

_Fixed: 2026-08-30T16:31:48Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
