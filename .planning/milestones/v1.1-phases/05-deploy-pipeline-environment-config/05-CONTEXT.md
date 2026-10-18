# Phase 5: Deploy Pipeline & Environment Config - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — smart discuss skipped)

<domain>
## Phase Boundary

Changes move from feature branch to production through one safe, unambiguous pipeline — a persistent staging environment separate from production, environment-scoped configuration, and no double-deploy races — with `BETTER_AUTH_URL`/allowed-hosts resolving correctly everywhere before staging goes live.

Covers: DEPLOY-01 (persistent staging URL + own Neon branch), DEPLOY-02 (environment-scoped env vars confirmed), DEPLOY-03 (PR checks: lint + typecheck + unit tests via GitHub Actions, blocking), DEPLOY-04 (documented feature-branch → staging → production release procedure, exercised once for real), DEPLOY-05 (exactly one deploy path per environment — no GitHub Actions/Vercel auto-deploy double-deploy race), SEC-04 (`BETTER_AUTH_URL`/allowed-hosts resolve correctly on PR-preview, staging, and production).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase, no user-facing behavior to design. Use the ROADMAP phase goal, success criteria, and codebase conventions (Vercel + Neon stack per CLAUDE.md) to guide decisions. In particular:
- How `BETTER_AUTH_URL`/trusted-origins resolve per environment (static per-environment env var vs. dynamic request-derived origin) is an implementation choice, constrained only by success criterion 2 (must work correctly on PR-preview, staging, and production without cross-environment redirect/cookie failures).
- Whether the single deploy path (success criterion 3) is "GitHub Actions deploys, Vercel auto-deploy disabled" or "Vercel auto-deploy only, GitHub Actions runs checks but not deploy" is Claude's call — either satisfies "exactly one deploy path per environment."
- Naming/structure of the staging Neon branch and Vercel domain is Claude's call.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/env.ts` — `@t3-oss/env-nextjs` typed env schema already in place; currently declares `BETTER_AUTH_URL` as a single static `z.string().url()` — this is the exact SEC-04 gap (no per-environment resolution yet, only one fixed value works at a time).
- `.env.example` — existing convention for documenting required env vars (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`); extend rather than replace.
- `drizzle.config.ts` — existing Neon/Postgres connection config to model a staging-branch variant on.

### Established Patterns
- `src/lib/auth.ts` — Better Auth instance reads `baseURL: env.BETTER_AUTH_URL` and `secret: env.BETTER_AUTH_SECRET` directly from the typed env module — any dynamic-origin fix flows through this file.
- No `.github/workflows/` directory exists yet — GitHub Actions CI (DEPLOY-03) is being introduced fresh in this phase, not modified.
- No `vercel.json` exists yet — deploy path configuration (DEPLOY-05) starts from Vercel's zero-config defaults.
- Package scripts (`package.json`): `build` is `next build --webpack` (Turbopack intentionally disabled for `@serwist/next` compatibility per Phase 4 decision) — any CI workflow must build with `--webpack`, not the Turbopack default.
- `next.config.ts` — Serwist service worker config with empty precache (T-04-04 mitigation) — not expected to need changes in this phase.

### Integration Points
- `src/env.ts` is the single choke point for all environment-derived config — any new environment-scoped variables (e.g., distinguishing staging vs. production Neon URLs, or a computed base URL) should route through it rather than reading `process.env` ad hoc elsewhere.
- `src/lib/auth.ts` is the only consumer of `BETTER_AUTH_URL` found in the codebase — the SEC-04 fix has a single, well-contained integration point.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase goal and success criteria (DEPLOY-01 through DEPLOY-05, SEC-04).

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped (infrastructure phase).

</deferred>
