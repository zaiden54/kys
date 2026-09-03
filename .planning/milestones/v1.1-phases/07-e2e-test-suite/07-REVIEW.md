---
phase: 07-e2e-test-suite
reviewed: 2026-09-02T18:10:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - e2e/auth.setup.ts
  - e2e/auth.spec.ts
  - e2e/bonus.spec.ts
  - e2e/ci-branch-setup.mjs
  - e2e/ci-branch-teardown.mjs
  - e2e/fixtures.ts
  - e2e/global-setup.ts
  - e2e/global-teardown.ts
  - e2e/pie-chart.spec.ts
  - e2e/pwa.spec.ts
  - e2e/vacation.spec.ts
  - .github/workflows/ci.yml
  - .gitignore
  - .mcp.json
  - package.json
  - playwright.config.ts
  - README.md
findings:
  critical: 0
  warning: 0
  info: 4
  total: 4
status: clean
---

# Phase 07: Code Review Report

**Reviewed:** 2026-09-02T18:10:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** clean

## Summary

This is iteration 2 of the auto-fix loop. All 17 files were re-read from scratch (not diffed
against the prior report) and independently re-evaluated for bugs, security issues, and quality
defects, with particular attention to the four warnings fixed since the last review.

**Fix verification — all four confirmed correct and complete:**

- **WR-01** (`playwright.config.ts:40`): `command` is now `"npm run build && npm run start"`.
  The stray `--webpack` after `npm run build` (which npm silently dropped today, would hard-error
  in a future npm major) is gone. `package.json`'s `"build": "next build --webpack"` script still
  supplies the real flag, so behavior is unchanged, only the redundant/fragile CLI arg is removed.
- **WR-02** (`e2e/ci-branch-setup.mjs:91-96`): `console.log(`::add-mask::${uri}`)` now runs
  immediately after `uri` is resolved (gated on `process.env.GITHUB_ACTIONS`), before it is ever
  written to `$GITHUB_ENV` or `.env.local`. This is the only file that resolves a live connection
  URI at all now (`e2e/global-setup.ts`'s URI-resolving code was removed entirely by the WR-04
  fix), so there is no remaining unmasked code path. I traced every subsequent step that touches
  `DATABASE_URL` (`drizzle-kit push --force` with `stdio: "inherit"`, the Playwright-spawned
  `webServer`) — GitHub Actions' `::add-mask::` applies to the whole job's log stream from the
  point of registration onward regardless of which child process later emits the string, so a
  `drizzle-kit` connection error echoing the URI would still be masked.
- **WR-03** (`e2e/global-teardown.ts:34-54`): `unlinkSync(BRANCH_ID_FILE)` now runs only after
  `res.ok` is confirmed true, inside the `try` block, not in an unconditional `finally`. A failed
  or throwing `DELETE` now leaves the marker file in place, so the CI backstop step
  (`e2e/ci-branch-teardown.mjs`, gated on `existsSync(BRANCH_ID_FILE)`) can now actually detect
  and retry a genuinely leaked branch. Confirmed this is exactly the fix the prior review
  requested.
- **WR-04** (`e2e/global-setup.ts`): The ~90-line duplicate branch-creation flow (Neon API calls,
  `drizzle-kit push`, `.env.local` write) is fully removed. The file is now an 18-line guard: no-op
  outside CI, no-op if `e2e/.ci-branch.json` already exists, else throws a clear error naming
  `e2e/ci-branch-setup.mjs` as the required prerequisite step. The comment no longer overstates
  that a self-contained fallback flow "still works" — it now correctly states there is no fallback.
  `neonApi`, `NeonBranch`, `NeonDatabase`, and the `node:child_process`/extra `node:fs` imports
  that only that dead code used are all gone too — no orphaned unused imports left behind.

No new critical or warning-level issues were found on this fresh pass. I re-verified (independent
of the prior report) the selector accuracy of every spec file against its corresponding component
(`bonus-form.tsx`, `bonus-row.tsx`, `vacation-form.tsx`/`vacation-row.tsx`, `annual-pie-chart.tsx`,
`install-banner.tsx`) and the CI job structure/secret-scoping in `.github/workflows/ci.yml` — both
remain correct. Four info-level observations are listed below; none block a clean status.

**On status convention:** per this task's instructions, `status: clean` is used here because 0
critical and 0 warning findings remain (info-only findings do not block clean). Note for the
record: no prior `07-REVIEW.md`/`06-REVIEW.md`/`05-REVIEW.md` in this repo has ever actually used
`status: clean` — the one other info-only review in this repo (`06-REVIEW.md`, info: 3) was marked
`status: issues_found`, not `clean`. I'm following this task's explicit instruction rather than
that precedent, but flagging the inconsistency so the convention gets reconciled going forward.

## Info

### IN-01: `global-teardown.ts`'s missing-marker-file branch remains unreachable under current CI wiring (carried over from prior review, still applies)

**File:** `e2e/global-teardown.ts:28-32`
**Issue:** Unchanged since the prior review. `if (!existsSync(BRANCH_ID_FILE))` is a defensive
guard for "setup may not have run," but under the current job wiring
(`.github/workflows/ci.yml`'s `e2e` job always runs `e2e/ci-branch-setup.mjs` as its own step
before `npm run test:e2e`, and a `webServer` startup failure aborts the whole Playwright run
before `globalTeardown` is reached), this branch has no live path to execute today.
**Fix:** Optional — add a one-line comment acknowledging the branch is currently unreached under
the documented job ordering.

### IN-02: Non-null assertion on `DATABASE_URL` in `fixtures.ts` gives an unclear failure if ever unset (carried over from prior review, still applies)

**File:** `e2e/fixtures.ts:23`
**Issue:** Unchanged since the prior review. `const sql = neon(process.env.DATABASE_URL!);`
asserts non-null without a guard; if `DATABASE_URL` is ever unset when a spec's cleanup runs, the
failure surfaces as whatever `neon(undefined)` throws internally rather than a clear message
pointing at the missing env var.
**Fix:**
```ts
export async function deleteUserByEmail(email: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for e2e/fixtures.ts cleanup");
  const sql = neon(databaseUrl);
  await sql`delete from "user" where email = ${email}`;
}
```

### IN-03: `pwa.spec.ts`'s post-test `localStorage.removeItem` cleanup is a no-op given how Playwright `storageState` actually works

**File:** `e2e/pwa.spec.ts:49-53`
**Issue:** The comment claims this cleanup exists so "a later local re-run of this same session
doesn't start with the banner already dismissed." But `playwright/.auth/user.json` (the
`authenticated` project's `storageState`) is a static snapshot written once by
`e2e/auth.setup.ts`, and `auth.setup.ts`'s `setup` project — a `dependencies: ["setup"]`
prerequisite of the `authenticated` project — reruns and rewrites that file from a brand-new
`uniqueEmail()` user on every single `npm run test:e2e` invocation, not just the first. There is
no browser profile or storage state that persists *between* separate `npx playwright test`
invocations for this project to leak into; each fresh context in `pwa.spec.ts` itself is also
isolated per `test()` block. The `localStorage.removeItem(...)` call therefore has no observable
effect on any later run or later test — it's dead code motivated by an incorrect assumption about
session persistence.
**Fix:** Either remove the line, or correct the comment to state what it actually guards against
(nothing, under the current per-run fresh-user setup) — if the intent was instead to guard a
hypothetical future change where the `setup` project's user became a genuinely persistent/reused
fixture account, say so explicitly so a future maintainer doesn't extend this pattern based on the
current (inaccurate) rationale.

### IN-04: `ci-branch-teardown.mjs`'s `finally` block unconditionally deletes the marker file even when the backstop's own DELETE fails, inconsistent with the pattern just adopted by WR-03

**File:** `e2e/ci-branch-teardown.mjs:48-62`
**Issue:** `unlinkSync(BRANCH_ID_FILE)` runs in a `finally` block that executes regardless of
whether the `DELETE` call inside the `try` succeeded, threw, or returned non-OK — the same shape
`e2e/global-teardown.ts` had before the WR-03 fix. Unlike `global-teardown.ts`, this is not a
functional bug: this backstop step is already the last `if: always()` step in the `e2e` job (see
`.github/workflows/ci.yml`), so there is no further downstream consumer of the marker file's
continued presence, and a failed delete here still surfaces via `process.exitCode = 1`, failing
the CI job loudly either way. Flagging only for consistency with the reasoning WR-03 just
established elsewhere in this same lifecycle.
**Fix:** Optional, for consistency only — move `unlinkSync` inside the `try` block, after the
`res.ok` check succeeds, mirroring `global-teardown.ts`'s current shape:
```js
try {
  const { branchId } = JSON.parse(readFileSync(BRANCH_ID_FILE, "utf8"));
  const res = await fetch(`${NEON_API_BASE}/projects/${projectId}/branches/${branchId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${process.env.NEON_API_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`DELETE branch ${branchId} failed: ${res.status}`);
  }
  unlinkSync(BRANCH_ID_FILE);
} catch (err) {
  console.error("CI backstop branch cleanup failed:", err);
  process.exitCode = 1;
}
```

---

_Reviewed: 2026-09-02T18:10:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
