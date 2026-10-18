# Phase 7: E2E Test Suite - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Every v1.0 golden path is protected by an automated Playwright suite that runs in CI against its own isolated data, so the upcoming visual redesign (Phase 8) has a real regression safety net. Covers: register→login→forecast (E2E-01), bonus/vacation add/edit/delete with forecast updates (E2E-02, E2E-03), annual pie-chart summary + PWA install/manifest flow (E2E-04), Playwright MCP wired into the repo for future test authoring (E2E-05), full suite runs in CI against its own isolated Neon branch (E2E-06). Explicitly excludes visual regression / screenshot baselines — deferred to Phase 8.

</domain>

<decisions>
## Implementation Decisions

### Test Data & Fixtures
- Shared `e2e/fixtures.ts` generates a unique test user email (timestamp/random suffix) per test run, following the disposable-test-account pattern already established by `scripts/verify-auth-security.mjs`
- Authenticated session for post-login tests (bonuses/vacations/pie-chart) reused via Playwright `storageState` — one setup project logs in once, dependent test projects reuse the saved state, per PITFALLS.md #5 guidance
- E2E-01 (register→login→forecast) exercises the real UI flow end-to-end since that IS the test's purpose; E2E-02/03/04 setup reuses `storageState` + direct navigation to keep tests fast
- No explicit teardown needed in CI (the isolated Neon branch is discarded after the run); local repeated runs follow `verify-auth-security.mjs`'s self-cleanup pattern (delete created users in `finally`/`afterAll`)

### CI Isolation & Execution
- Isolation mechanism: Playwright `globalSetup` creates one Neon branch for the whole CI run (not per-test), migrates it, points `DATABASE_URL` at it; `globalTeardown` deletes the branch. This pattern is already proven locally per prior milestone research (STATE.md research flag) — CI validation is this phase's own responsibility, not a re-decision.
- Execution mode: serial (`workers: 1` in CI) — all golden-path tests share one Neon branch/DB this run; parallel workers would reintroduce the shared-state flakiness PITFALLS.md #5 warns against.
- CI job location: new job added to the existing `.github/workflows/ci.yml` (alongside the lint/typecheck/build/unit-test job from Phase 5), reusing its already-established Neon/Vercel secrets scoping rather than a separate workflow file.
- Gate type: required (blocking) check, matching the other Phase 5 CI gates and E2E-06's stated purpose as a real regression safety net — advisory-only would defeat that purpose.

### Playwright MCP & Scope Boundaries
- "Wired into the repo" (E2E-05) means a one-time repo-level config addition (`.mcp.json` / README section) documenting `npx @playwright/mcp@latest` against the running dev server — not a runtime dependency of the CI suite itself.
- This phase's own golden-path tests are authored directly as `.spec.ts` files by the executor, like any other GSD-produced code — Playwright MCP is for future interactive test authoring/debugging by a human developer, not a requirement that these specific tests be produced through it.
- Visual regression (`toMatchScreenshot()` baselines, PITFALLS.md #6) is explicitly OUT of scope for Phase 7 — deferred to Phase 8 (Visual Redesign) per the existing STATE.md research flag; adding baselines now would be immediately invalidated by the redesign.
- Golden path includes logout + redirect verification (cheap addition to the auth test, closes a real regression class; explicitly called out as table-stakes in research/SUMMARY.md).

### Claude's Discretion
- Exact fixture file organization within `e2e/` (single fixtures.ts vs. split per domain) — implementation detail, no user-facing impact.
- Specific Playwright project/config naming for the `storageState` setup step.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/verify-auth-security.mjs` and `scripts/verify-auth-flow.mjs` — established disposable-test-account + self-cleanup pattern (raw fetch against Better Auth endpoints), reusable as a reference shape for e2e fixture design, though e2e tests drive the real browser UI rather than raw HTTP
- `.github/workflows/ci.yml` — existing single `ci` job (lint, typecheck, unit tests, build) from Phase 5; no deploy step (Vercel's native git integration owns deploys) — the new E2E job must not violate that DEPLOY-05 prohibition documented at the top of the file
- `src/lib/auth-allowed-hosts.ts` — dynamic host resolution (Phase 5 SEC-04) already trusts localhost:3000 and *.vercel.app, relevant if E2E tests ever run against a preview URL instead of local dev server

### Established Patterns
- Server Actions for mutations (salary, bonuses, vacations) — Playwright can drive these through real form submissions in the UI, no separate test-only API needed
- Route groups `(auth)` / `(app)` with Server Component auth enforcement — relevant to how `storageState` needs to carry a real session cookie, not a mocked auth state

### Integration Points
- No `e2e/` directory or `playwright.config.ts` exist yet — clean slate, no reconciliation needed with prior work
- `package.json`'s `test` script is currently `vitest run` only; a new `test:e2e` (or similar) script needs to be added alongside it without disturbing the existing unit-test invocation

</code_context>

<specifics>
## Specific Ideas

No specific UI/visual references — this phase is testing infrastructure for existing, already-built user flows. Test coverage scope is explicitly enumerated by E2E-01 through E2E-06 and research/SUMMARY.md's "E2E testing" table-stakes line (golden-path smoke tests, register/login, bonus calculation, vacation pay calculation, annual pie chart, logout + redirect checks, PWA installability audit).

</specifics>

<deferred>
## Deferred Ideas

- Visual regression / screenshot baseline testing (`toMatchScreenshot()`) — explicitly deferred to Phase 8 per PITFALLS.md #6 and the existing STATE.md research flag; adding it now would be immediately invalidated by the redesign.

</deferred>
