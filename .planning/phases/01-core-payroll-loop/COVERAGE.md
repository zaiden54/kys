# Phase 1 — API Coverage Decision

**Decided:** 2026-08-28 (plan-phase)

No external API integration: Phase 1 uses only in-process libraries and its own Postgres database on Neon; it integrates no third-party service API whose capability coverage could be silently incomplete.

## Reasoning per dependency

| Dependency | External API? | Why not a coverage matrix |
|---|---|---|
| Better Auth 1.7.2 + `@better-auth/drizzle-adapter` | No | In-process TypeScript library. It exposes HTTP routes we mount ourselves and persists into our own Postgres tables; there is no remote vendor endpoint and no per-capability quota, billing surface, or hidden feature set a user could reasonably expect to "just work". Its unused capabilities (OAuth providers, password reset, email verification, organisations, 2FA) are not silent gaps — each is an explicit CONTEXT.md deferral: D-05 defers OAuth, D-06 disables email verification, D-08 defers password reset. |
| Neon Postgres via `@neondatabase/serverless` | No | This is the application's own database, not a third-party service API in the opt-in/opt-out sense this checkpoint targets. Its "capabilities" are SQL, and coverage is governed by the schema, not by a capability matrix. |
| `date-holidays` | No | Ships static rule data in the package; performs no network call at runtime. It was chosen over `isdayoff` specifically to avoid introducing a remote API dependency into date computation (01-RESEARCH.md § Standard Stack). Its one known coverage gap — the RF government's annual weekend-transfer decree data being stale past 2022 — is documented as an accepted v1 limitation in 01-RESEARCH.md § Common Pitfalls and recorded in a file-header note by Plan 01-03. |
| `date-fns`, `zod`, `drizzle-zod`, `react-hook-form` | No | Pure in-process libraries. |

## Deferred to a later phase

Phase 4 (PWA-01) introduces Serwist and a Vercel deployment target. Neither is a third-party runtime API either, but if a genuine external service is added in any later phase — a payment provider, an email sender, a bank aggregator — this checkpoint should fire there and produce a real capability matrix.
