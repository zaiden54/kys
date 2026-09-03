---
phase: 05-deploy-pipeline-environment-config
plan: 01
subsystem: auth
tags: [better-auth, vercel, env-config, sec-hardening]

# Dependency graph
requires:
  - phase: 01-core-payroll-loop
    provides: Better Auth email/password auth with Drizzle adapter (src/lib/auth.ts)
provides:
  - "ALLOWED_AUTH_HOSTS single source of truth for trusted Better Auth origins (localhost:3000, *.vercel.app)"
  - "Dynamic, request-resolved Better Auth baseURL (no static per-environment env var)"
  - "BETTER_AUTH_URL retired from required config (env schema, .env.example, README)"
affects: [05-02, 05-03, 05-04]

# Actuals (#2632)
actuals:
  tokens: 1833
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dynamic Better Auth baseURL via { allowedHosts } instead of a static string, with no fallback so an unrecognized Host header fails closed"

key-files:
  created:
    - src/lib/auth-allowed-hosts.ts
    - src/lib/auth-allowed-hosts.test.ts
  modified:
    - src/lib/auth.ts
    - src/env.ts
    - .env.example
    - README.md

key-decisions:
  - "baseURL config omits protocol (defaults to \"auto\", resolves from the request's own URL scheme) and omits fallback (unrecognized Host header throws, fail-closed) — both deliberate departures from 05-PATTERNS.md's NODE_ENV-conditional protocol line"
  - "auth-allowed-hosts.test.ts imports ALLOWED_AUTH_HOSTS from ./auth-allowed-hosts (not ./auth) and matchesHostPattern/resolveDynamicBaseURL directly from better-auth, so the test never transitively constructs the Drizzle-backed Better Auth instance and needs zero live DATABASE_URL"
  - "BETTER_AUTH_URL made optional (no .default(...)) in src/env.ts rather than removed outright, for backward compatibility with any existing .env.local"

patterns-established:
  - "Dynamic Better Auth baseURL: { allowedHosts: [...] } single source of truth in its own zero-dependency module, imported by both the runtime auth config and its test, so they can never drift apart"

requirements-completed: [SEC-04]

coverage:
  - id: D1
    description: "Better Auth's baseURL resolves dynamically per request Host against an explicit allowlist (localhost:3000, *.vercel.app) and fails closed (throws) on an unrecognized host, replacing the single static BETTER_AUTH_URL"
    requirement: "SEC-04"
    verification:
      - kind: unit
        ref: "src/lib/auth-allowed-hosts.test.ts#matchesHostPattern + resolveDynamicBaseURL (7 tests: exact match, real staging alias, real per-deployment hash host, evil.com rejected by every pattern, resolves https for staging, resolves http for localhost, throws for evil.com)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Live, three-environment login proof (localhost / PR-preview / staging / production all resolving the correct origin and cookie with no cross-environment failures)"
    requirement: "SEC-04"
    verification: []
    human_judgment: true
    rationale: "Requires real staging/preview deployments, which don't exist yet — deferred to Plan 05-04 per this plan's own must_haves note. This plan delivers only the proven code-level mechanism."

duration: 8min
completed: 2026-09-01
status: complete
---

# Phase 5 Plan 1: Dynamic Better Auth baseURL Resolution (SEC-04) Summary

**Replaced the static `env.BETTER_AUTH_URL` Better Auth baseURL with a dynamic, per-request `{ allowedHosts: ["localhost:3000", "*.vercel.app"] }` config that fails closed on unrecognized hosts, proven by a DB-independent unit test against the real installed `better-auth@1.7.2` resolver functions.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-01T10:51:45Z
- **Completed:** 2026-09-01T10:58:44Z
- **Tasks:** 2
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- `src/lib/auth-allowed-hosts.ts` created as the single, dependency-free source of truth for every trusted Better Auth origin (`localhost:3000`, `*.vercel.app`) — no import from `@/env` or `@/lib/db`, so it (and its test) can be imported without a live database.
- `src/lib/auth.ts` now resolves `baseURL` dynamically per request instead of reading a static `BETTER_AUTH_URL`: `baseURL: { allowedHosts: ALLOWED_AUTH_HOSTS }`, with `protocol` left at its `"auto"` default and no `fallback` configured, so an unrecognized `Host` header throws rather than silently defaulting to a fixed origin.
- `src/lib/auth-allowed-hosts.test.ts` proves the mechanism end-to-end against the real installed `better-auth` functions (`matchesHostPattern`, `resolveDynamicBaseURL`) — 7 passing assertions covering exact match, the real predicted staging git-branch alias, a real observed per-deployment hash hostname, universal rejection of `evil.com`, correct https URL construction for staging, correct http URL construction for localhost, and fail-closed throwing for an untrusted host.
- `BETTER_AUTH_URL` retired from required config: `src/env.ts` now marks it `.optional()` (no default, since nothing reads it), `.env.example`'s line is commented out with a `# DEPRECATED:` note, and `README.md`'s setup instructions reference only the two remaining required variables (`DATABASE_URL`, `BETTER_AUTH_SECRET`).

## Task Commits

Each task was committed atomically (Task 1 as TDD RED → GREEN per its `tdd="true"` attribute):

1. **Task 1 RED: failing test for dynamic allowedHosts resolution** - `0595d36` (test)
2. **Task 1 GREEN: dynamic baseURL/allowedHosts resolution for Better Auth** - `fbe6171` (feat)
3. **Task 2: retire BETTER_AUTH_URL from required config** - `2a242b5` (docs)

_Task 1 is this plan's `tracer` — the riskiest, most novel piece of Phase 5. Its automated `<verify>` (`DATABASE_URL= npx vitest run src/lib/auth-allowed-hosts.test.ts`) was re-run and confirmed passing before proceeding to Task 2's expansion, per the tracer feedback gate._

## Files Created/Modified

- `src/lib/auth-allowed-hosts.ts` - New: `ALLOWED_AUTH_HOSTS` constant, the single source of truth for trusted Better Auth origins
- `src/lib/auth-allowed-hosts.test.ts` - New: DB-independent proof of dynamic baseURL resolution against real `better-auth` functions
- `src/lib/auth.ts` - `baseURL` changed from `env.BETTER_AUTH_URL` to `{ allowedHosts: ALLOWED_AUTH_HOSTS }`
- `src/env.ts` - `BETTER_AUTH_URL` schema changed from required `z.string().url()` to `z.string().url().optional()`
- `.env.example` - `BETTER_AUTH_URL=` line commented out with a deprecation note
- `README.md` - Setup instructions updated to reference only `DATABASE_URL` and `BETTER_AUTH_SECRET`

## Decisions Made

- `protocol` deliberately omitted from the `baseURL` config (defaults to `"auto"`, resolving from the request's own URL scheme) — correct for both local `http://localhost:3000` and every https-terminated Vercel deployment, and a deliberate improvement over 05-PATTERNS.md's `NODE_ENV`-conditional line, which this plan supersedes.
- `fallback` deliberately omitted — an unrecognized host throws rather than silently resolving to a default origin (fail-closed), matching `security_asvs_level=1`/`security_block_on=high` and this plan's SEC-04 prohibition against widening the allowlist to silence errors.
- `advanced: { trustedProxyHeaders: true }` deliberately not added — Vercel presents the correct native `Host`/request-URL protocol already, so trusting spoofable proxy headers would add risk with no benefit here.
- `BETTER_AUTH_URL` made optional rather than removed outright, for backward compatibility with any existing `.env.local`.

## Deviations from Plan

None - plan executed exactly as written. `matchesHostPattern`, `resolveDynamicBaseURL`, `isDynamicBaseURLConfig` were all confirmed exported from the installed `better-auth@1.7.2` package's main entry point (`node_modules/better-auth/dist/index.d.mts`) exactly as the plan's `<read_first>` predicted.

One minor self-correction during Task 1: the initial `auth-allowed-hosts.ts` doc comment literally spelled out `` `@/env` `` and `` `@/lib/db` `` inside prose, which tripped the plan's own acceptance-criteria grep (`grep -c '@/env\|@/lib/db' ... == 0`) as a false positive on the comment text, not an actual import. Reworded the comment to describe the constraint without using those literal path strings — no functional change, not tracked as a numbered deviation since it was caught and fixed before either commit landed.

## Issues Encountered

Ran the full test suite (with a real `DATABASE_URL` loaded from `.env.local`) to confirm this plan's changes caused no regressions elsewhere. Found 2 pre-existing failures in `src/app/actions/forecast.test.ts` (vacation-composition tests asserting against live Neon database state) that are unrelated to `auth.ts`/`auth-allowed-hosts.ts` — confirmed via `git diff --stat` that neither file was touched by this plan. Logged to `.planning/phases/05-deploy-pipeline-environment-config/deferred-items.md` and left unfixed, per the executor's scope-boundary rule (only auto-fix issues directly caused by the current task's changes).

## User Setup Required

None - no external service configuration required. (Any existing `.env.local`'s `BETTER_AUTH_URL` line can now be safely left in place or removed — it is no longer read.)

## Next Phase Readiness

- SEC-04's code-level mechanism is proven and in place: `ALLOWED_AUTH_HOSTS` is the single tested source of truth, and Better Auth's dynamic `baseURL` resolution will accept every real Vercel-hosted origin this project will ever have (via `*.vercel.app`) while rejecting arbitrary untrusted hosts.
- Plan 05-04 (staging environment) has real staging/preview origins to complete the live, three-environment login proof deferred here (D2 above).
- If a future custom production domain is added, it must be appended to `ALLOWED_AUTH_HOSTS` in `src/lib/auth-allowed-hosts.ts`, not substituted in for the existing entries.

---
*Phase: 05-deploy-pipeline-environment-config*
*Completed: 2026-09-01*

## Self-Check: PASSED

- FOUND: src/lib/auth-allowed-hosts.ts
- FOUND: src/lib/auth-allowed-hosts.test.ts
- FOUND: src/lib/auth.ts
- FOUND: src/env.ts
- FOUND: .env.example
- FOUND: README.md
- FOUND: .planning/phases/05-deploy-pipeline-environment-config/05-01-SUMMARY.md
- FOUND commit: 0595d36 (test(05-01))
- FOUND commit: fbe6171 (feat(05-01))
- FOUND commit: 2a242b5 (docs(05-01))
