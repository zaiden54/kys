---
phase: 05-deploy-pipeline-environment-config
fixed_at: 2026-09-01T13:49:55Z
review_path: .planning/phases/05-deploy-pipeline-environment-config/05-REVIEW.md
iteration: 3
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-09-01T13:49:55Z
**Source review:** .planning/phases/05-deploy-pipeline-environment-config/05-REVIEW.md
**Iteration:** 3

**Summary:**
- Findings in scope: 2 (CR-01, WR-01 — `fix_scope: critical_warning`)
- Fixed: 2
- Skipped: 0

**Verification environment:** All syntax/type checks and test runs were executed inside the isolated review-fix worktree (`.claude/worktrees/rf-05-*`), using a symlink to the main checkout's `node_modules` (removed before commit/cleanup, never staged — `node_modules` is gitignored). The worktree's commits were fast-forwarded onto `gsd/phase-05-deploy-pipeline-environment-config` and the worktree removed as part of this run's cleanup, so these numbers are reproducible by checking out the two listed commit hashes on the main branch and re-running `npx vitest run` / `npx tsc --noEmit` from the main checkout (with `node_modules` installed there).

## Fixed Issues

### CR-01: `ALLOWED_AUTH_HOSTS` wildcard does not match 2 of the 3 documented production domains — breaks auth on production

**Files modified:** `src/lib/auth-allowed-hosts.ts`, `src/lib/auth-allowed-hosts.test.ts`
**Commit:** `7bb51d7`
**Applied fix:** Added the two missing production hostnames as explicit exact-match entries in `ALLOWED_AUTH_HOSTS` (`on-hands-careeremit-9861s-projects.vercel.app` and `on-hands-three.vercel.app`), alongside the existing wildcard pattern (kept as-is for PR previews and branch aliases). Updated the module's doc comment to explain why the wildcard alone can't match the bare hostnames (the two-hyphen requirement of `better-auth`'s `wildcardMatch`).

Verified empirically against the actually-installed `better-auth@1.7.2` package (same method the reviewer used) before and after the fix:

```
Before fix — matchesHostPattern per documented production host:
on-hands-three.vercel.app => false
on-hands-careeremit-9861s-projects.vercel.app => false
on-hands-git-main-careeremit-9861s-projects.vercel.app => true

After fix — matchesHostPattern (any pattern in ALLOWED_AUTH_HOSTS) per documented production host:
on-hands-three.vercel.app => true
on-hands-careeremit-9861s-projects.vercel.app => true
on-hands-git-main-careeremit-9861s-projects.vercel.app => true
```

Added regression tests to `auth-allowed-hosts.test.ts` pinned to all three real production hostnames from `DEPLOYMENT.md`, exercising both `matchesHostPattern` (via `ALLOWED_AUTH_HOSTS.some(...)`, matching the existing test file's idiom) and `resolveDynamicBaseURL` (asserting the resolved `https://` origin for both previously-broken bare hostnames), so a future edit that narrows the allowlist and reintroduces this regression will fail CI. Full test file run: 10/10 passing (was 8 before the two new tests were added). `tsc --noEmit` reports no errors in either modified file.

### WR-01: `install-banner.tsx` has no error handling around `localStorage` access — a thrown storage error crashes the render

**Files modified:** `src/components/install-banner.tsx`
**Commit:** `098089d`
**Applied fix:** Wrapped both `getDismissedSnapshot` (used as `useSyncExternalStore`'s `getSnapshot`) and `setDismissedFlag`'s `localStorage` calls in `try`/`catch`, exactly as the review's suggested fix specified. `getDismissedSnapshot` falls back to `false` (banner stays visible) on a thrown `SecurityError`/`QuotaExceededError`; `setDismissedFlag` silently no-ops the persistence (dismissal still fires the same-tab `install-banner-dismissed-changed` event either way, so in-session UI state stays consistent — only cross-reload persistence is lost when storage is unavailable). Existing `install-banner.render.test.tsx` suite (4 tests) still passes unmodified; no test in scope specifically exercises the `localStorage`-throws path, so this fix is verified via syntax/type-check + full existing suite pass rather than a new dedicated throw-path test (not required by the review's fix suggestion, which only asked for the try/catch wrapping).

## Skipped Issues

None — both in-scope findings (fix_scope: critical_warning) were fixed. The five Info-tier findings (IN-01 through IN-06 minus one non-existent) are out of scope for this run and remain as documented in `05-REVIEW.md`.

---

_Fixed: 2026-09-01T13:49:55Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3_
