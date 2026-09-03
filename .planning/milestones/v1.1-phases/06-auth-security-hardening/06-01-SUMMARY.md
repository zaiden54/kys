---
phase: 06-auth-security-hardening
plan: 01
subsystem: auth
tags: [better-auth, next.js, vitest, security, session-cookies]

# Dependency graph
requires:
  - phase: 05-deploy-pipeline-environment-config
    provides: "PR-preview deploy pipeline (Vercel git integration, per-branch Neon DB isolation via preview/<branch>, ALLOWED_AUTH_HOSTS dynamic host resolution) that Task 3's live verification depends on"
provides:
  - "Login form renders one hardcoded generic error (\"Неверный email или пароль\") regardless of Better Auth's actual error payload, closing the account-enumeration vector at the UI layer"
  - "scripts/verify-auth-security.mjs — a repeatable, self-cleaning script that empirically proves against a real running server: (1) wrong-password and unknown-email sign-in attempts return byte-identical HTTP status + error code, (2) the wrong password never appears in the request URL or either response body, (3) the session cookie carries HttpOnly + Path=/ (and Secure when BASE_URL is https)"
  - "npm run verify:auth-security wired as a reusable local verification command"
  - "PR #3 (gsd/phase-06-auth-security-hardening → main) open, CI green, live PR-preview URL captured for the end-of-phase human DevTools check"
affects: [07-e2e-test-suite, 08-visual-redesign]

# Actuals (#2632)
actuals:
  tokens: 2128
  tasks: 3
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-error-to-UI-text boundary: onSubmit never branches on error.message/error.code — always a single hardcoded literal string, verified by tests that intentionally mock a mismatching message to prove the pass-through is gone"
    - "verify-auth-security.mjs follows verify-auth-flow.mjs's established script shape (shebang, @neondatabase/serverless import, BASE_URL/DATABASE_URL env, fail(step, message) helper, numbered PASS/FAIL console output, .finally() cleanup deleting every test user row it created)"

key-files:
  created:
    - scripts/verify-auth-security.mjs
  modified:
    - src/app/(auth)/login/page.tsx
    - src/app/(auth)/login/page.render.test.tsx
    - package.json

key-decisions:
  - "Task 1 hardcodes the generic error as a literal string (no fallback chain) per 06-CONTEXT.md's locked exact string \"Неверный email или пароль\"; registration's page.tsx left byte-for-byte untouched"
  - "Task 2 chose raw fetch() over Playwright for the verification script, matching the existing verify-auth-flow.mjs pattern and avoiding a premature Playwright dependency ahead of Phase 7 (E2E-01)"
  - "Task 3: PR #3 already existed from a prior session (opened during the interleaved password-visible-devtools debug session on this branch) — no new PR was created, this run only pushed the latest commits, confirmed CI went green, and captured the live preview URL"
  - "The Task 3 human-check (live DevTools inspection of the PR-preview's Network tab and Set-Cookie header) is intentionally deferred to end-of-phase UAT per workflow.human_verify_mode=end-of-phase — not performed by this executor run, matching the plan's own <done> criterion for Task 3 which only requires CI-green + URL captured, not the human-check's outcome"

patterns-established:
  - "Generic-error-at-UI-boundary: never let a server error payload's message/code reach rendered text for auth-failure paths; hardcode instead"

requirements-completed: [SEC-01, SEC-02, SEC-03]

coverage:
  - id: D1
    description: "Login always renders the identical hardcoded generic error, never Better Auth's raw error.message/code (SEC-02, UI layer)"
    requirement: "SEC-02"
    verification:
      - kind: unit
        ref: "src/app/(auth)/login/page.render.test.tsx#LoginPage generic auth error (SEC-02)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Wrong-password and unknown-email sign-in attempts return byte-identical HTTP status and error code from the live server (SEC-02, server-side defense in depth)"
    requirement: "SEC-02"
    verification:
      - kind: integration
        ref: "BASE_URL=http://localhost:3000 npm run verify:auth-security (step 4 assertion)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Password never appears in the sign-in request URL or either response body, confirmed against a real running server (SEC-01, local)"
    requirement: "SEC-01"
    verification:
      - kind: integration
        ref: "BASE_URL=http://localhost:3000 npm run verify:auth-security (step 5 assertion)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Session cookie carries HttpOnly and Path=/ locally, and the protocol-appropriate Secure/__Secure- behavior (present on https, correctly absent on http) is structurally proven (SEC-03, local/structural)"
    requirement: "SEC-03"
    verification:
      - kind: integration
        ref: "BASE_URL=http://localhost:3000 npm run verify:auth-security (step 6 assertion)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Live PR-preview DevTools confirmation: password never in Network tab URL/query, identical generic error for both failure cases in the browser, session cookie shows __Secure- prefix + HttpOnly + Secure + Path=/ over real HTTPS"
    requirement: "SEC-01"
    verification: []
    human_judgment: true
    rationale: "PR-preview deployments sit behind Vercel Authentication (SSO) project-wide (DEPLOYMENT.md) — no CLI/API token in this environment can reach a protected preview URL unauthenticated, so this confirmation cannot be scripted. Deferred to end-of-phase UAT per workflow.human_verify_mode=end-of-phase; PR #3's live preview URL is captured below for that pass."

duration: ~65min (Tasks 1-2 committed in a prior session at 2026-09-01T19:21:32+03:00; this continuation session executed Task 3 only, 2026-09-01T20:23-20:26Z)
completed: 2026-09-01
status: complete
---

# Phase 6 Plan 1: Auth Security Hardening Summary

**Login collapses every auth failure into one hardcoded generic message, a new verify-auth-security.mjs script empirically proves SEC-01/SEC-02/SEC-03 against a live dev server, and PR #3 is open with CI green awaiting the end-of-phase live HTTPS cookie/network check.**

## Performance

- **Duration:** ~65 min total across sessions (Tasks 1-2: prior session, committed 2026-09-01T19:21:32+03:00; Task 3: this continuation, 2026-09-01T20:23:48Z-20:26:03Z)
- **Started:** 2026-09-01T19:21:32+03:00 (Task 1)
- **Completed:** 2026-09-01T20:26:03Z (Task 3)
- **Tasks:** 3/3
- **Files modified:** 4 (this continuation added 0 new files — Task 3 is git/PR operations only)

## Accomplishments
- `src/app/(auth)/login/page.tsx`'s `onSubmit` now calls `setFormError("Неверный email или пароль")` unconditionally — never reads `error.message`/`error.code` — closing SEC-02's account-enumeration vector at the UI layer, proven by 3 new render tests plus the pre-existing regression test
- `scripts/verify-auth-security.mjs` empirically proves against a real running dev server: byte-identical status/error-code for wrong-password vs. unknown-email (SEC-02 server-side), the password never leaking into a request URL or response body (SEC-01), and HttpOnly/Path=/ (plus protocol-correct Secure behavior) on the session cookie (SEC-03, local/structural); wired as `npm run verify:auth-security`
- Phase branch pushed; PR #3 (`gsd/phase-06-auth-security-hardening` → `main`) confirmed open with all checks green (`ci` pass 1m10s, `Vercel` pass, `Vercel Preview Comments` pass) and its live preview URL captured for the deferred end-of-phase human DevTools check

## Task Commits

Each task was committed atomically:

1. **Task 1: Login always shows the identical generic error (SEC-02)** — TDD: `ae2419b` (test: failing enumeration tests, RED), `548d3f5` (feat: render a generic login error, GREEN)
2. **Task 2: scripts/verify-auth-security.mjs — empirical SEC-01/02/03 proof** — `8984bfc` (test(06-01): add live auth security verification)
3. **Task 3: Push branch, confirm PR + CI green, capture live preview URL** — no file changes, no commit (git push / gh pr operations only, per this task's `<files>(none)</files>`)

**Plan metadata:** (this commit, following SUMMARY/STATE/ROADMAP updates)

_Note: Task 1 is TDD — RED then GREEN. Task 3 produces no commit by design._

## Files Created/Modified
- `src/app/(auth)/login/page.tsx` — `onSubmit`'s `if (error)` block now hardcodes the generic error string instead of passing through Better Auth's `error.message`
- `src/app/(auth)/login/page.render.test.tsx` — new `describe("LoginPage generic auth error (SEC-02)", ...)` block, 3 cases
- `scripts/verify-auth-security.mjs` — new script empirically proving SEC-01/SEC-02(server)/SEC-03(structural) against a live dev server
- `package.json` — added `"verify:auth-security": "node scripts/verify-auth-security.mjs"`

## Decisions Made
- Hardcoded literal string, no fallback chain, for the generic login error (06-CONTEXT.md's locked exact copy) — registration's own duplicate-email error text is explicitly untouched, per this phase's locked out-of-scope decision
- Raw `fetch()` over Playwright for `verify-auth-security.mjs`, matching the existing `verify-auth-flow.mjs` pattern and deferring Playwright's introduction to Phase 7 (E2E-01)
- PR #3 was found already open (created during an interleaved `/gsd-debug` session on the same branch that investigated and resolved a separate issue, "password-visible-devtools", discovered during manual dry-run testing) — this run did not create a duplicate PR, it verified the existing one and confirmed CI

## Deviations from Plan

None — plan executed exactly as written. Task 3's PR already existing (rather than being newly created by this run) is not a deviation: the plan's own action text says "Check for an existing PR... If none exists, open one" — the existing-PR branch of that instruction was the one that applied.

## Issues Encountered

- This sandbox's HTTPS egress to `github.com`/`api.github.com` was suspected broken per the dispatch's `<environment_note>` (a `gh auth status` call did time out with "keyring" errors). In practice, `git push` (SSH) worked as expected, and `gh pr list`/`gh pr checks`/`gh pr view` (which use `api.github.com` over HTTPS) also succeeded on direct attempt — the earlier reported failure did not reproduce for this session's actual `gh` invocations. No fallback to a `checkpoint:human-action` was needed.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**Outstanding before this phase can be considered fully closed (tracked in STATE.md Blockers/Concerns and Pending Todos):**
- The Task 3 `<human-check>` is still open: a human logged into their own Vercel account must open PR #3's preview URL (`https://on-hands-git-gsd-phase-06-auth-bca434-careeremit-9861s-projects.vercel.app`), inspect the DevTools Network tab for a wrong-password and an unknown-email login attempt (password never in URL/query, identical generic error text for both), then inspect the session cookie after a successful login for the `__Secure-` prefix + HttpOnly + Secure + Path=/ flags. This is deferred to end-of-phase UAT per `workflow.human_verify_mode=end-of-phase`, not a blocker to marking this plan/phase's automated work complete.
- Ready for Phase 7 (E2E Test Suite) once the above human-check closes out Phase 6.

---
*Phase: 06-auth-security-hardening*
*Completed: 2026-09-01*

## Self-Check: PASSED

- FOUND: src/app/(auth)/login/page.tsx
- FOUND: src/app/(auth)/login/page.render.test.tsx
- FOUND: scripts/verify-auth-security.mjs
- FOUND: package.json (`verify:auth-security` script entry confirmed present)
- FOUND: commit ae2419b (test: failing enumeration tests)
- FOUND: commit 548d3f5 (feat: render a generic login error)
- FOUND: commit 8984bfc (test: add live auth security verification)
