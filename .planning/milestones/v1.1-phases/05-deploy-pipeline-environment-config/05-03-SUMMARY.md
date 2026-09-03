---
phase: 05-deploy-pipeline-environment-config
plan: 03
subsystem: infra
tags: [github-actions, ci, vitest, drizzle, neon, branch-protection]

# Dependency graph
requires:
  - phase: 05-deploy-pipeline-environment-config
    provides: "05-01 (SEC-04 dynamic Better Auth baseURL), 05-02 (lint/typecheck/test all green baseline)"
provides:
  - "A real, enforced GitHub Actions CI check (`.github/workflows/ci.yml`) gating merges to main"
  - "Live GitHub branch-protection rule on main requiring the `ci` check, enforce_admins: true"
  - "Documented, ledgered coverage gap: CI does not exercise the DB/repository layer"
affects: [phase-07-e2e-test-suite]

# Actuals (#2632)
actuals:
  tokens: 920
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "CI scoped to lint+typecheck+build+pure-domain tests only — no database service container in CI at all"
    - "vitest --exclude passed via `npm test -- --exclude ...` for CI-only test scoping, leaving local `npm test` behavior unchanged"

key-files:
  created:
    - .github/workflows/ci.yml
  modified:
    - package.json

key-decisions:
  - "User decision (architectural checkpoint from prior session): Option A — scope CI down to lint+typecheck+build+pure-domain tests rather than fighting the neon-http driver's incompatibility with a vanilla postgres:17 container. Removed the Postgres service container and db:push step entirely."
  - "Repo search (per task instruction, not guessed) found 6 unmocked DB-integration test files, not the 3 named in the decision: schema.test.ts and two action-layer integration suites (annual-summary.test.ts, forecast.test.ts) also import `db` from \"@/lib/db\" directly, unmocked. All 6 excluded from CI's npm test invocation via vitest --exclude; local npm test is unaffected."
  - "DATABASE_URL/BETTER_AUTH_SECRET are still exported in CI (unreachable placeholder + freshly generated secret) because `next build` imports every route/action module during bundling, and src/env.ts's Zod validation runs at import time even though nothing ever connects — this is a build-time requirement independent of the test-database question."
  - "[Rule 3 - Blocking] CI Node.js bumped 20.x -> 22.x: vitest.config.ts's `--no-experimental-webstorage` flag only exists from Node 22.4+; Node 20 rejected it as \"bad option\" and crashed the test worker. Never previously reached because prior CI runs failed earlier at the now-removed db:push step."
  - "Branch protection on main: required_status_checks.contexts: [\"ci\"] (the real discovered check-run name, confirmed via `gh api .../check-runs`, not guessed), enforce_admins: true, required_pull_request_reviews/restrictions: null — verified live via a second GET after the PUT."

patterns-established:
  - "CI database strategy: until Phase 7's isolated-Neon-branch-per-CI-run lands, CI is DB-free by construction; any test needing a real `db` import must be excluded from the CI test invocation via vitest --exclude, not silently left to fail."

requirements-completed: [DEPLOY-03, DEPLOY-05]

coverage:
  - id: D1
    description: "Every PR runs lint + typecheck + unit tests (DB-free subset) + build via GitHub Actions, and a failing check blocks merge"
    requirement: "DEPLOY-03"
    verification:
      - kind: other
        ref: "gh pr checks 2 (run 33505524911) — ci pass in 1m33s, real PR #2 against main"
        status: pass
      - kind: other
        ref: "gh api repos/zaiden54/kys/branches/main/protection --jq '.required_status_checks.contexts' -> [\"ci\"], enforce_admins.enabled: true"
        status: pass
    human_judgment: false
  - id: D2
    description: "Zero deploy invocation exists in ci.yml — Vercel's native git integration remains the sole deployer per environment"
    requirement: "DEPLOY-05"
    verification:
      - kind: other
        ref: "grep -ci 'vercel deploy\\|vercel --prod' .github/workflows/ci.yml -> 0"
        status: pass
    human_judgment: false

duration: 51min (across two sessions, separated by a checkpoint: user decision on CI database strategy)
completed: 2026-09-01
status: complete
---

# Phase 5 Plan 3: CI Pipeline & Branch Protection Summary

**GitHub Actions CI (lint/typecheck/build/pure-domain-tests, DB-free) genuinely blocking merges on main via live branch protection, after discovering the neon-http driver cannot speak to a vanilla Postgres container**

## Performance

- **Duration:** 51 min total (14:06–15:02 UTC+3), split across two sessions by an architectural checkpoint
- **Started:** 2026-09-01T14:11:20+03:00 (first `ci.yml` commit)
- **Completed:** 2026-09-01T15:02:02+03:00 (Node 22.x fix, CI verified green)
- **Tasks:** 2
- **Files modified:** 2 (`.github/workflows/ci.yml`, `package.json`)

## Accomplishments
- `.github/workflows/ci.yml` runs lint, typecheck, build, and 29/35 test files (pure-domain + mocked-action suites) on every PR against `main`, with zero database service container
- A real PR (#2) ran this workflow to a genuine green pass (`ci` check, 1m33s, run `33505524911`)
- `main` is now actually protected: `gh api repos/zaiden54/kys/branches/main/protection` returns 200 with `required_status_checks.contexts: ["ci"]` and `enforce_admins: true` — a red `ci` check will block merge, including for repo admins
- Coverage gap (CI skips the DB/repository layer) is documented in this SUMMARY and recorded as ledger entry #3 in `.planning/WINDOWS.md`, pointing at Phase 7's isolated-branch-per-CI-run as the fix

## Task Commits

Task 1 (CI workflow, real PR, green run) spanned both sessions:

1. **Task 1a: Write CI workflow, open PR** (prior session) - `9f6ab67` (feat) — created `.github/workflows/ci.yml` with a `postgres:17` service container + `db:push`; opened PR #2
2. **Task 1b: Fix typecheck script** (prior session) - `89b64b5` (fix) — `next typegen && tsc --noEmit`, unrelated to the DB issue, correct as-is
3. **[CHECKPOINT: architectural decision on CI database strategy — resolved by user: Option A]**
4. **Task 1c: Scope CI to lint+typecheck+build+pure-domain tests** (this session) - `fca3dd2` (fix) — removed Postgres service + db:push; excluded 6 (not 3) unmocked DB-integration test files from CI's `npm test` invocation
5. **Task 1d: Bump CI Node.js 20.x -> 22.x** (this session) - `c24ff67` (fix) — fixed a pre-existing `--no-experimental-webstorage` incompatibility, newly exposed once CI reached the test step for the first time

**Task 2: Enforce branch protection** — no source-file commit (GitHub API config change only, per plan's `files: N/A`); applied via `gh api ... branches/main/protection --method PUT`, verified via a live re-fetch.

**Plan metadata:** (this commit) `docs(05-03): complete CI pipeline & branch protection plan`

## Files Created/Modified
- `.github/workflows/ci.yml` - CI workflow: lint, typecheck, build, DB-free test subset; no deploy step, no database service
- `package.json` - `typecheck` script fixed to run `next typegen` before `tsc --noEmit` (prior session, 89b64b5)

## Decisions Made

See `key-decisions` in frontmatter. Summary:
1. **CI database strategy (user decision, Option A):** No database in CI at all, rather than fighting `@neondatabase/serverless`'s neon-http protocol against a vanilla `postgres:17` container, or standing up isolated-Neon-branch infrastructure prematurely (that's Phase 7's job).
2. **Exclusion list expanded from 3 to 6 files** after the required repo search surfaced `schema.test.ts`, `annual-summary.test.ts`, and `forecast.test.ts` as additional unmocked `db` importers — all 6 live under `src/lib/db/` and `src/app/actions/`, none mocked.
3. **Node 20 → 22 bump**, a genuine pre-existing bug (not introduced by this plan) that had simply never been reached by any prior CI run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Exclusion list expanded from 3 to 6 DB-touching test files**
- **Found during:** Task 1 (implementing the user's Option A decision)
- **Issue:** The user's decision named 3 files (`salary-repository.test.ts`, `bonus-repository.test.ts`, `vacation-repository.test.ts`) but explicitly instructed "search the repo to confirm their exact paths — do not guess." That search found `src/lib/db/schema.test.ts`, `src/app/actions/annual-summary.test.ts`, and `src/app/actions/forecast.test.ts` also import `db` from `@/lib/db` directly and unmocked — leaving them in CI's `npm test` invocation would have crashed at import time (`src/env.ts`'s Zod schema throws on missing `DATABASE_URL`/malformed value once no service container exists to make even a placeholder connection meaningful for these paths) or attempted real queries with no reachable database.
- **Fix:** Added all 3 additional files to the `vitest --exclude` list alongside the originally-named 3, for a total of 6.
- **Files modified:** `.github/workflows/ci.yml`
- **Verification:** `npm test -- --exclude ... (6 flags)` run locally: 29/35 test files, 288/288 tests pass. Same command ran green in the real CI run.
- **Committed in:** `fca3dd2`

**2. [Rule 3 - Blocking] Bumped CI Node.js from 20.x to 22.x**
- **Found during:** Task 1, first real CI run after removing the Postgres service container (run `33505373506`, failed at "Unit tests" after 34s)
- **Issue:** `vitest.config.ts` passes `--no-experimental-webstorage` to Node so jsdom's own `localStorage` implementation is used instead of Node's built-in global. That flag only exists starting Node 22.4.0 (`process.allowedNodeEnvironmentFlags.has('--no-experimental-webstorage')` is `false` on Node 20). Node 20 rejected it as "bad option: --no-experimental-webstorage" and the vitest worker process crashed immediately. This is a pre-existing incompatibility between `ci.yml`'s original `node-version: 20.x` (matching Next.js's stated minimum) and the test suite's actual Node 22+ requirement — never previously surfaced because both prior CI runs failed earlier, at the typecheck step and then at the now-removed `db:push` step, before ever reaching "Unit tests".
- **Fix:** Changed `actions/setup-node@v4`'s `node-version` from `20.x` to `22.x`.
- **Files modified:** `.github/workflows/ci.yml`
- **Verification:** Second real CI run (`33505524911`) passed end-to-end in 1m33s — lint, typecheck, unit tests (29 files, 288 tests), and build all green.
- **Committed in:** `c24ff67`

---

**Total deviations:** 2 auto-fixed (1 missing-critical scope correction, 1 blocking pre-existing bug)
**Impact on plan:** Both were necessary to reach a real, honest green CI run rather than a workflow that merely looked plausible. No scope creep beyond what was needed for the user's Option A decision to actually work.

## Issues Encountered

- First post-decision CI run failed fast (34s) at "Unit tests" due to the Node 20/`--no-experimental-webstorage` incompatibility described above — diagnosed via `gh run view <id> --log-failed`, fixed, re-pushed, re-verified green. No workflow steps were weakened or skipped to force a pass.

## User Setup Required

None — no external service configuration required. Branch protection was applied programmatically via `gh api` and verified live.

## Known Coverage Gap (tracked, not blocking)

CI's `npm test` step excludes 6 files that exercise the repository/DB layer directly against a real database (money/tax-critical code paths: salary, bonus, vacation repositories; schema-level check constraints; the annual-summary and next-payment-forecast action integration suites). These 6 files still run and pass locally against a real Neon dev branch (`npm test`, unaffected by this change) — they are simply not exercised by the automated CI gate until Phase 7 delivers an isolated-Neon-branch-per-CI-run (research/SUMMARY.md's E2E-06, referenced in ROADMAP.md Phase 7). Recorded as `.planning/WINDOWS.md` entry #3 (kind: `unrun-verify`, status: `open`).

## Next Phase Readiness

- Phase 5's CI/branch-protection deliverable (DEPLOY-03, DEPLOY-05) is fully live and independently verifiable via `gh api`/`gh pr checks` — no further action needed for this plan.
- Phase 7 (E2E test suite) should close WINDOWS.md entry #3 by wiring the 6 excluded files (or their Playwright-suite equivalents) into CI against an isolated per-run Neon branch, per the existing research flag.
- Plan 05-04 (if any remains in this phase) is unblocked — 05-01, 05-02, 05-03 are all complete.

---
*Phase: 05-deploy-pipeline-environment-config*
*Completed: 2026-09-01*

## Self-Check: PASSED

- FOUND: `.github/workflows/ci.yml`
- FOUND: `.planning/phases/05-deploy-pipeline-environment-config/05-03-SUMMARY.md`
- FOUND commit: `9f6ab67`
- FOUND commit: `89b64b5`
- FOUND commit: `fca3dd2`
- FOUND commit: `c24ff67`
