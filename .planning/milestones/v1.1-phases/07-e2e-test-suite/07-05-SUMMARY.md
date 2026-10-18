---
phase: 07-e2e-test-suite
plan: 05
subsystem: testing
tags: [playwright, github-actions, neon, ci-cd, mcp, e2e]

requires:
  - phase: 07-e2e-test-suite
    provides: "07-01/02/03/04's local Playwright golden-path suite (auth, bonus, vacation, pie-chart, PWA specs) that this plan wires into CI"
provides:
  - "CI-only Neon branch lifecycle (globalSetup/globalTeardown + a standalone pre-webServer provisioning script) giving every CI run its own throwaway, isolated Postgres branch (E2E-06)"
  - "A required `e2e` GitHub Actions check on `main`, proven green on a real PR run, alongside the existing `ci` check"
  - "A committed .mcp.json exposing Playwright MCP for interactive test authoring (E2E-05)"
affects: [08-visual-redesign]

actuals:
  tokens: 5194
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "CI-only resource lifecycle scripts (.mjs, not TS) run as their own GitHub Actions steps when they must complete before a tool's own internal task ordering (Playwright's globalSetup) would otherwise be too late"
    - "Idempotent Playwright globalSetup/globalTeardown hooks that check for a sentinel file before acting, so they safely coexist with an external CI step that already did the work"
    - "CI-level `if: always()` backstop cleanup step as a second line of defense behind an in-process teardown hook, for the case where the in-process hook's own task chain never gets reached"

key-files:
  created:
    - e2e/global-setup.ts
    - e2e/global-teardown.ts
    - e2e/ci-branch-setup.mjs
    - e2e/ci-branch-teardown.mjs
    - .mcp.json
  modified:
    - playwright.config.ts
    - .github/workflows/ci.yml
    - .gitignore
    - README.md

key-decisions:
  - "Neon branch provisioning moved out of Playwright's globalSetup hook into a standalone e2e/ci-branch-setup.mjs run as its own GitHub Actions step before `npm run test:e2e` — Playwright starts `config.webServer` before running the user's globalSetup file (confirmed against a real CI run), so DATABASE_URL was never available before `next build`/`next start` were spawned"
  - "e2e/global-setup.ts kept as a defensive no-op/fallback (skips when e2e/.ci-branch.json already exists) rather than deleted, preserving the plan's locked artifact list and playwright.config.ts's globalSetup/globalTeardown wiring"
  - "Added a CI-level `if: always()` backstop cleanup step (e2e/ci-branch-teardown.mjs) in addition to Playwright's own globalTeardown, since a webServer startup failure after branch creation would otherwise leak a billed Neon branch with no owning process left to delete it"

patterns-established:
  - "07-PATTERNS.md: CI-only lifecycle logic that must run before a framework's own hook ordering allows for it belongs in a plain standalone script invoked as its own CI step, not forced into the framework's hook"

requirements-completed: [E2E-05, E2E-06]

coverage:
  - id: D1
    description: "Every CI run provisions its own throwaway, isolated Neon branch, applies the current schema to it, points the app at only that branch for the whole run, and deletes it afterward (pass or fail)"
    requirement: E2E-06
    verification:
      - kind: e2e
        ref: "gh run 33641989899 (PR #4) — e2e job passed in 2m6s; log confirms branch br-patient-sunset-b15wli33 provisioned by e2e/ci-branch-setup.mjs and no 'still present' warning from the if:always() backstop, meaning Playwright's own global-teardown.ts deleted it"
        status: pass
    human_judgment: false
  - id: D2
    description: "The `e2e` job is a required (blocking) status check on `main`, alongside the existing `ci` job"
    requirement: E2E-06
    verification:
      - kind: other
        ref: "gh api repos/zaiden54/kys/branches/main/protection/required_status_checks --jq '.contexts' -> [\"ci\",\"e2e\"], confirmed via live GET after the PUT"
        status: pass
    human_judgment: false
  - id: D3
    description: "A committed .mcp.json lets a developer/Claude Code session start @playwright/mcp against the running dev server with no further setup"
    requirement: E2E-05
    verification:
      - kind: other
        ref: "node -e \"JSON.parse(require('fs').readFileSync('.mcp.json','utf8'))\" exits 0; mcpServers.playwright.command === 'npx', args includes '@playwright/mcp@latest'; grep -c '@playwright/mcp' package.json == 0"
        status: pass
    human_judgment: false

duration: ~35min (Task 2, this session; Tasks 1/3 executed in a prior session before the checkpoint)
completed: 2026-09-02
status: complete
---

# Phase 07 Plan 05: CI-Isolated E2E Suite & Playwright MCP Summary

**Playwright's `e2e` GitHub Actions job now runs every PR against a throwaway, isolated Neon branch and is a required (blocking) check on `main`, proven green on a real PR run; a committed `.mcp.json` also makes Playwright MCP available for interactive test authoring.**

## Performance

- **Duration:** ~35 min for Task 2 (this session, resumed after a human-action checkpoint for GitHub secrets); Tasks 1 and 3 were completed in the prior session
- **Completed:** 2026-09-02T17:25:31+03:00
- **Tasks:** 3/3
- **Files modified:** 9 (5 created, 4 modified)

## Accomplishments

- CI-only Neon branch lifecycle: `e2e/ci-branch-setup.mjs` runs as its own GitHub Actions step, discovers the project's real default branch, creates a fresh branch with a read-write endpoint, resolves its connection URI, writes it to both `$GITHUB_ENV` and `.env.local`, and applies the current Drizzle schema — all before `npm run test:e2e` (and its Playwright-spawned `next build`/`next start`) is ever invoked
- New sibling `jobs.e2e` in `.github/workflows/ci.yml` (`needs: ci`), proven passing on a real PR run (`gh run 33641989899`, 2m6s) — not just configured
- `main`'s branch protection `required_status_checks.contexts` now includes both `"ci"` and `"e2e"`, confirmed via a live GET after the PUT
- `.mcp.json` committed with a `playwright` MCP server entry (`npx @playwright/mcp@latest`), never added as an npm dependency
- README.md gained an "## E2E tests" section documenting local vs. CI execution paths and the Playwright MCP setup

## Task Commits

1. **Task 1: Neon branch lifecycle (globalSetup/globalTeardown)** - `b2a2ea9` (feat) — completed in the prior session, before the checkpoint
2. **Task 2: New `e2e` CI job, proven on a real PR, made a required check** - `9b8730c` (feat, adds the workflow job) + `627ab6b` (fix, moves provisioning out of Playwright's globalSetup hook after the first real CI run proved the hook ordering was wrong)
3. **Task 3: Playwright MCP config and README documentation** - `26fd77e` (docs) — completed in the prior session, before the checkpoint

_No separate plan-metadata commit is listed here; the final `docs(07-05): complete...` commit for STATE.md/ROADMAP.md/SUMMARY.md follows this summary._

## Files Created/Modified

- `e2e/global-setup.ts` - Playwright globalSetup hook; no-ops locally and now also no-ops in CI when `e2e/.ci-branch.json` already exists (provisioned by the CI step), otherwise still performs the full branch-creation flow as a fallback
- `e2e/global-teardown.ts` - Playwright globalTeardown hook; unchanged from Task 1 — reads the branch id, deletes the Neon branch, logs (not throws) on failure
- `e2e/ci-branch-setup.mjs` - **New.** Standalone CI-only script (not a Playwright hook) that provisions the isolated Neon branch and exports `DATABASE_URL` before `npm run test:e2e` runs
- `e2e/ci-branch-teardown.mjs` - **New.** CI-level `if: always()` backstop delete, idempotent no-op if `e2e/.ci-branch.json` is already gone
- `playwright.config.ts` - `globalSetup`/`globalTeardown` top-level keys (Task 1); unchanged in Task 2
- `.github/workflows/ci.yml` - New sibling `jobs.e2e` entry with a "Provision isolated Neon branch" step before the test run and a "Backstop Neon branch cleanup" step after (`if: always()`)
- `.gitignore` - `/e2e/.ci-branch.json` and `.env.local` coverage (Task 1)
- `.mcp.json` - **New.** Playwright MCP server declaration (Task 3)
- `README.md` - New "## E2E tests" section (Task 3)

## Decisions Made

- Moved Neon branch provisioning out of Playwright's `globalSetup` hook and into a standalone `e2e/ci-branch-setup.mjs`, run as its own GitHub Actions step before `npm run test:e2e` — see Deviations below for the full root cause
- Kept `e2e/global-setup.ts` in place (not deleted) as a defensive no-op/fallback, preserving the plan's locked artifact list and `playwright.config.ts`'s existing `globalSetup`/`globalTeardown` wiring rather than restructuring that file
- Added a CI-level `if: always()` backstop cleanup step in addition to Playwright's own `globalTeardown`, since the exact failure mode observed on the first real CI run (webServer failing to start after a branch was already created) would otherwise leave Playwright's own teardown chain unreached and leak a billed Neon branch

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Neon branch never got applied before `next build`/`next start` — Playwright starts `webServer` before the user's `globalSetup` file**
- **Found during:** Task 2, the first real CI run of the new `e2e` job (run `33640958121`)
- **Issue:** The `e2e` job failed with `❌ Invalid environment variables: [{ path: ['DATABASE_URL'], message: 'Invalid input' }]` during `next build`. Investigation of `playwright/lib/runner/index.js`'s `createGlobalSetupTasks` confirmed Playwright's fixed internal task order runs `createPluginSetupTasks` (which starts `config.webServer`) *before* `config.globalSetups` (our `e2e/global-setup.ts`). Since `webServer.command` runs `npm run build --webpack && npm run start`, and `next build` imports `src/env.ts`'s Zod-validated `DATABASE_URL` at module-collection time, the webServer child process was spawned with no `DATABASE_URL` at all — our custom globalSetup file, which was supposed to provision the real one, hadn't run yet and never would in time, since child processes only inherit a snapshot of `process.env` at spawn time, not future updates to the parent process's `process.env`.
- **Fix:** Extracted the Neon branch-creation logic (find default branch, create branch, resolve connection URI, write `.env.local`, run `drizzle-kit push --force`) into a new standalone script `e2e/ci-branch-setup.mjs`, added as its own "Provision isolated Neon branch" GitHub Actions step *before* the "E2E tests" step in `.github/workflows/ci.yml`. This guarantees `DATABASE_URL` is exported via `$GITHUB_ENV` (inherited by the entire job's remaining steps, including `npm run test:e2e` and its Playwright-spawned `webServer` child) and written to `.env.local` before Playwright — and therefore its `webServer` plugin — is ever invoked. `e2e/global-setup.ts` was updated with an idempotency guard (skip if `e2e/.ci-branch.json` already exists) so it no longer tries to provision a second, duplicate branch when it eventually runs (after `webServer`, per Playwright's fixed order) in the CI path. `e2e/global-teardown.ts` needed no change — its ordering (always runs at the very end of a completed Playwright run) was never affected by this bug, only branch *creation* was. Also added a CI-level `if: always()` backstop cleanup step (`e2e/ci-branch-teardown.mjs`) covering the case where the whole run aborts before Playwright's own teardown chain is reached at all (exactly the scenario that triggered this bug in the first place).
- **Files modified:** `e2e/ci-branch-setup.mjs` (new), `e2e/ci-branch-teardown.mjs` (new), `e2e/global-setup.ts`, `.github/workflows/ci.yml`
- **Verification:** Re-ran the `e2e` job on the same PR after the fix (run `33641989899`) — passed in 2m6s. Log confirms `Provisioned isolated Neon branch br-patient-sunset-b15wli33 (e2e-ci-33641989899)` and no "still present" warning from the backstop step, proving `e2e/global-teardown.ts` deleted the branch normally. Local `npx playwright test --list e2e/auth.spec.ts` with `CI` unset still lists both tests, confirming the no-op guards are intact. `npx tsc --noEmit -p tsconfig.json` clean.
- **Committed in:** `627ab6b` (separate commit from the workflow-job addition itself, `9b8730c`)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for E2E-06's actual purpose (a real CI regression safety net) — without this fix the `e2e` job would never pass, and the isolated-branch-per-CI-run pattern this plan exists to prove would have shipped broken. No scope creep: the fix stayed within Task 2's own files (`.github/workflows/ci.yml`) plus the minimum necessary touch to Task 1's `e2e/global-setup.ts` (an idempotency guard, not a rewrite).

## Issues Encountered

- First real CI run of the `e2e` job failed exactly as flagged as a risk in this plan's own `flagged_assumptions` (STATE.md's "Neon globalSetup... needs validation once it actually runs inside GitHub Actions") — see Deviations above. Second run passed.

## User Setup Required

None further — `NEON_API_KEY` and `NEON_PROJECT_ID` were added as GitHub Actions repository secrets by the user before this session resumed (verified live via `gh secret list` both before Task 2 started and implicitly by the passing CI run).

## Next Phase Readiness

- E2E-05 and E2E-06 are both closed: the full Playwright suite runs automatically on every PR against its own isolated, disposable Neon branch, is a required (blocking) check on `main`, and `.mcp.json` makes Playwright MCP available with zero further setup.
- Phase 7 (E2E Test Suite) is now fully complete — all 5 plans executed. Phase 8 (Visual Redesign) can proceed with this suite as its regression safety net, matching the phase-ordering rationale in `research/SUMMARY.md`.
- PR #4 (`gsd/phase-07-e2e-test-suite` -> `main`) is open with both `ci` and `e2e` checks green.

---
*Phase: 07-e2e-test-suite*
*Completed: 2026-09-02*

## Self-Check: PASSED

All created/modified files confirmed present on disk; all 4 task commits (`b2a2ea9`, `26fd77e`, `9b8730c`, `627ab6b`) confirmed in `git log --oneline --all`.
