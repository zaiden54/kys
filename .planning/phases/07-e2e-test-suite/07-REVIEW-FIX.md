---
phase: 07-e2e-test-suite
fixed_at: 2026-09-02T15:05:00Z
review_path: /home/zaiden/code/kys/.planning/phases/07-e2e-test-suite/07-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 07: Code Review Fix Report

**Fixed at:** 2026-09-02T15:05:00Z
**Source review:** /home/zaiden/code/kys/.planning/phases/07-e2e-test-suite/07-REVIEW.md
**Iteration:** 1

**Verification environment:** All fixes were applied, verified, and committed inside an
isolated git worktree (`.claude/worktrees/rf-07-57761-1788360392`, on temp branch
`gsd-reviewfix/07-57761`), per `workflow.use_worktrees=true`. No `node_modules` were present
in the worktree, so Tier 2 syntax checks (`tsc --noEmit`) were unavailable for the `.ts`
files; `node --check` was used for the one `.mjs` file touched. All fixes therefore rely on
Tier 1 (re-read/structural) verification plus (where available) Tier 2 syntax checks — this
is not a substitute for the project's full lint/typecheck/build gates, which should still run
in the main checkout before merge. The worktree's commits were fast-forwarded onto
`gsd/phase-07-e2e-test-suite` during cleanup, so these commits are reproducible from the main
checkout.

**Summary:**
- Findings in scope: 4 (fix_scope: critical_warning — 0 critical, 4 warning; 2 info findings
  excluded from scope)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### WR-01: `webServer.command` passes `--webpack` in a way npm silently drops today and will hard-error on in a future major version

**Files modified:** `playwright.config.ts`
**Commit:** a2ddec4
**Applied fix:** Removed the redundant, unforwarded `--webpack` flag from the npm invocation.
`command` is now `"npm run build && npm run start"` — the `build` npm script already hardcodes
`--webpack` internally, so nothing behavioral changes; this only removes the npm CLI
unknown-config warning today and prevents a future hard-error once npm's next major version
ships.

### WR-02: Neon connection URI (with live DB password) is never masked in CI logs

**Files modified:** `e2e/ci-branch-setup.mjs`, `e2e/global-setup.ts`
**Commit:** 48a7f2d
**Applied fix:** In both files, immediately after resolving `uri` from the Neon connection-URI
API call, added a `console.log(`::add-mask::${uri}`)` guarded by `process.env.GITHUB_ACTIONS`
(so local/non-CI test runs of these files don't emit the masking directive pointlessly). This
registers the live-credential-bearing connection string with GitHub Actions' log-masking
before it is ever written to `GITHUB_ENV` or `.env.local`, closing the gap the review
identified — any future accidental echo of `DATABASE_URL` in a later CI step will now render
as `***` in logs instead of the cleartext password.

### WR-03: Teardown deletes its own tracking file even when the remote Neon DELETE fails, defeating the backstop's retry signal

**Files modified:** `e2e/global-teardown.ts`
**Commit:** dd40b15
**Applied fix:** Moved `unlinkSync(BRANCH_ID_FILE)` out of the unconditional `finally` block and
into the end of the `try` block, right after the `DELETE` response is confirmed `res.ok`. The
marker file is now only cleared once deletion is confirmed successful; on a thrown error (fetch
failure or non-OK response), the file is left in place so the CI workflow's `if: always()`
backstop cleanup step can detect and retry a genuinely leaked branch. `process.exitCode = 1` on
failure is preserved unchanged.

### WR-04: `global-setup.ts`'s fallback branch-provisioning path is dead code, and its comment overstates that it still works

**Files modified:** `e2e/global-setup.ts`
**Commit:** 338112a
**Applied fix:** Removed the ~55-line duplicated branch-creation flow (the `neonApi` helper,
`NeonBranch`/`NeonDatabase` interfaces, and steps 1-6 that re-implemented
`e2e/ci-branch-setup.mjs`'s logic) since the review established it could never actually execute
in the one scenario it claimed to rescue (CI with no pre-existing `DATABASE_URL` — `next
build` inside `webServer` fails before this hook runs). Kept only the `existsSync(BRANCH_ID_FILE)`
early-return guard, and replaced the missing-file branch with a `throw new Error(...)` that
states plainly that `e2e/ci-branch-setup.mjs` must run first as its own CI step, rather than
silently attempting (and failing) to duplicate that work. Rewrote the file's header comment to
match the corrected contract. Verified no other file imports the removed `neonApi`/interfaces
(only `playwright.config.ts` references `global-setup.ts`, via `require.resolve` for the
`globalSetup` hook itself).

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-09-02T15:05:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
