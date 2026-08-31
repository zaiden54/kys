---
phase: 01-core-payroll-loop
plan: 02
subsystem: auth
tags: [nextjs, better-auth, drizzle, neon, react-hook-form, zod, typescript]

# Dependency graph
requires:
  - phase: 01-core-payroll-loop (Plan 01)
    provides: "Next.js 16 scaffold, src/lib/db/schema.ts, src/lib/db/auth-schema.ts, src/lib/auth.ts (Better Auth config, not yet mounted)"
provides:
  - "Phase 1 schema (user, session, account, verification, salary_history, payment_schedule, ytd_baseline) applied and verified against the live Neon database"
  - "Better Auth HTTP handler mounted at /api/auth/[...all] on the Node runtime"
  - "src/lib/auth-client.ts: the sole browser-side auth surface (authClient, signUp, signIn, signOut, useSession)"
  - "src/lib/session.ts: getSessionUser() / requireUserId() — the single server-side ownership anchor for every later user-scoped query"
  - "Working register -> sign-in -> protected home route path, proven end-to-end by scripts/verify-auth-flow.mjs against a real dev server and real Postgres rows"
affects: [01-04, 01-05]

# Actuals (#2632)
actuals:
  tokens: 5400
  tasks: 3
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "requireUserId() is the single ownership anchor — no Server Action or repository function may accept a client-supplied userId (T-01-01 mitigation)"
    - "server-only guard implemented as a runtime `typeof window !== 'undefined'` throw in src/lib/session.ts, avoiding a new package install (package installs require a human-verify checkpoint per executor deviation rules; the plan explicitly permits 'an equivalent')"
    - "Better Auth's CSRF check requires an explicit Origin header on POST requests made outside a browser (browsers send it automatically) — scripts/verify-auth-flow.mjs sets it manually on every mutating call"
    - "drizzleAdapter(db, { provider: 'pg', schema: authSchema }) — the adapter cannot resolve model names like 'user' without the generated schema module passed explicitly"

key-files:
  created:
    - "src/app/api/auth/[...all]/route.ts"
    - "src/lib/auth-client.ts"
    - "src/lib/session.ts"
    - "src/app/(auth)/register/page.tsx"
    - "src/app/(auth)/login/page.tsx"
    - "src/app/(app)/layout.tsx"
    - "src/app/(app)/page.tsx"
    - "src/components/sign-out-button.tsx"
    - "scripts/verify-auth-flow.mjs"
  modified:
    - "src/lib/auth.ts"

key-decisions:
  - "No new npm packages were installed for this plan — the server-only guard is a functional equivalent (runtime window check) rather than the `server-only` package, keeping the plan free of any package-legitimacy checkpoint"
  - "Deleted src/app/page.tsx (create-next-app's placeholder) because it collided with the new src/app/(app)/page.tsx route for the same URL, '/' — Next.js route groups don't add a path segment"
  - "scripts/verify-auth-flow.mjs sets an explicit Origin header on every POST to /api/auth/* since Better Auth's CSRF check rejects requests without one and Node's fetch does not send it automatically the way a browser does"

patterns-established:
  - "Auth ownership anchor pattern: requireUserId() / getSessionUser() in src/lib/session.ts is the only sanctioned way any later Server Action or repository function may learn 'whose data is this' — established for Plans 01-04/01-05 to build on"

requirements-completed: [AUTH-01, AUTH-02]

coverage:
  - id: D1
    description: "Phase 1 schema (7 tables incl. bigint kopeck money columns and the salary_history unique index) applied to the live Neon database"
    requirement: "AUTH-01"
    verification:
      - kind: integration
        ref: "node --env-file=.env.local information_schema/pg_indexes assertion script (Task 1 <verify>)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Better Auth HTTP handler mounted on the Node runtime; server-only session module exposes getSessionUser()/requireUserId() as the ownership anchor"
    requirement: "AUTH-02"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit && node auth-surface assertion script (Task 2 <verify>)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A visitor can register at /register, is signed in with no verification step, and lands on a protected home route rendering their own account email; anonymous visitors are redirected to /login; duplicate and concurrent registrations for one email yield exactly one account"
    requirement: "AUTH-01"
    verification:
      - kind: e2e
        ref: "scripts/verify-auth-flow.mjs (Task 3 <verify> automated, run against `npm run build` + `npm run dev`)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Cross-device session parity: two independent sessions for the same account both read the same account row (AUTH-02's cross-device-sync assumption)"
    requirement: "AUTH-02"
    verification:
      - kind: integration
        ref: "ad hoc two-session curl-style script run this session (two independent sign-ins for one account, both GET / render the same email) — not a committed test file"
        status: pass
    human_judgment: true
    rationale: "This environment has no browser available to the executor. The script above proves the server-side session/account model supports two concurrent sessions, but the plan's own Nyquist validation (01-VALIDATION.md § Manual-Only Verifications) designates the actual two-browser visual check, plus the D-06 (no verification interstitial) and D-08 (no forgot-password affordance) visual confirmations, as human-only. Needs a real UAT pass before this deliverable is fully signed off."
  - id: D5
    description: "No password-reset affordance (D-08) and no 'upcoming salary change' indicator (D-15) anywhere in the auth or home UI"
    verification:
      - kind: other
        ref: "grep -rn 'forgot|reset-password|resetPassword' src/app/(auth)/ and grep -rn 'upcoming|raise' src/app/(app)/page.tsx (Task 3 acceptance_criteria) — both return no matches"
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-08-28
status: complete
---

# Phase 1 Plan 2: Auth Mounted + Walking Skeleton Closed Summary

**Better Auth mounted on Next.js 16's App Router (Node runtime) with a `requireUserId()` server-only ownership anchor, register/login pages, and a protected home route — closing the Walking Skeleton with a real browser-to-Postgres round trip proven by `scripts/verify-auth-flow.mjs`.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-28T19:35:00Z (approx.)
- **Completed:** 2026-08-28T20:10:32Z
- **Tasks:** 3 (Task 1 database-only, no local diff; Tasks 2-3 committed)
- **Files modified:** 11 (10 created/modified, 1 deleted)

## Accomplishments
- Applied the Phase 1 Drizzle schema to the live Neon database via `npm run db:push` and verified all 7 tables, both `bigint` kopeck money columns, and the `salary_history_user_effective_from_uq` unique index exist live
- Mounted the Better Auth HTTP handler at `src/app/api/auth/[...all]/route.ts` (Node runtime, `toNextJsHandler(auth)`)
- Built `src/lib/auth-client.ts` (the sole client-side auth surface) and `src/lib/session.ts` (`getSessionUser()`/`requireUserId()`, the ownership anchor every later user-scoped query must route through)
- Closed the Walking Skeleton: `/register` and `/login` pages (react-hook-form + Zod), a protected `(app)` route-group shell that redirects anonymous visitors to `/login`, and a home screen rendering the signed-in account's email — all proven end-to-end against a real dev server and real Postgres rows by `scripts/verify-auth-flow.mjs`, including the sequential-duplicate and concurrent-race email edges

## Task Commits

Each code-producing task was committed atomically:

1. **Task 1: [BLOCKING] Apply the Phase 1 schema to the live Neon database** — no commit (database-only change via `drizzle-kit push`; no local files were generated or modified). Verified live via `information_schema`/`pg_indexes` query.
2. **Task 2: Mount the Better Auth handler and the server-side session anchor** — `bd9faec` (feat)
3. **Task 3: Tracer — register, sign in, and land on a protected home screen end-to-end** — `db14032` (feat)

**Plan metadata:** committed immediately after this file.

## Files Created/Modified
- `src/app/api/auth/[...all]/route.ts` - mounts `toNextJsHandler(auth)` on the Node runtime
- `src/lib/auth-client.ts` - `createAuthClient` wrapper; exports `authClient`, `signUp`, `signIn`, `signOut`, `useSession`
- `src/lib/session.ts` - `getSessionUser()` / `requireUserId()`, server-only ownership anchor
- `src/app/(auth)/register/page.tsx` - email+password registration form (react-hook-form + Zod), no verification/reset affordances
- `src/app/(auth)/login/page.tsx` - matching login form
- `src/app/(app)/layout.tsx` - server component gating the authenticated shell; redirects to `/login` when unauthenticated
- `src/app/(app)/page.tsx` - minimal home screen shell rendering the signed-in account email
- `src/components/sign-out-button.tsx` - client control wired to `authClient.signOut`
- `scripts/verify-auth-flow.mjs` - standalone Node assertion script for the full auth flow plus duplicate/concurrent-signup edges
- `src/lib/auth.ts` - fixed: `drizzleAdapter` now receives the generated auth schema module (see Deviations)
- `src/app/page.tsx` - deleted (create-next-app placeholder; collided with the new `(app)/page.tsx` route for `/`)

## Decisions Made
- No new npm package installs in this plan — `src/lib/session.ts`'s server-only guard is a runtime `typeof window !== "undefined"` throw instead of the `server-only` package, since any new package install requires a human-verify checkpoint under the executor's deviation rules and the plan text explicitly allows "an equivalent"
- `scripts/verify-auth-flow.mjs` sends an explicit `origin` header on every mutating request — Better Auth's CSRF protection rejects requests with no `Origin`, which a real browser sends automatically but Node's `fetch` does not

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `drizzleAdapter` could not resolve the Better Auth `"user"` model**
- **Found during:** Task 3 (tracer verify — first `POST /api/auth/sign-up/email` returned 500 with `BetterAuthError: The model "user" was not found in the schema object`)
- **Issue:** `src/lib/auth.ts` (created in Plan 01-01) called `drizzleAdapter(db, { provider: "pg" })` without passing the generated auth-schema module, so the adapter had no table map to resolve Better Auth's internal model names against
- **Fix:** Imported `* as authSchema from "@/lib/db/auth-schema"` and passed it as `drizzleAdapter(db, { provider: "pg", schema: authSchema })`
- **Files modified:** `src/lib/auth.ts`
- **Verification:** `scripts/verify-auth-flow.mjs` step 2 (fresh sign-up) now returns 2xx with a session cookie; full 5-assertion script exits 0
- **Committed in:** `db14032` (Task 3 commit)

**2. [Rule 3 - Blocking] `src/app/page.tsx` collided with the new `(app)/page.tsx` route**
- **Found during:** Task 3 (creating `src/app/(app)/page.tsx`)
- **Issue:** Next.js route groups (`(app)`) don't add a URL segment, so `src/app/(app)/page.tsx` maps to the same path `/` as the pre-existing `src/app/page.tsx` (create-next-app's default placeholder) — a duplicate-route condition
- **Fix:** Deleted `src/app/page.tsx`; the new authenticated home screen is now the sole owner of `/`
- **Files modified:** `src/app/page.tsx` (deleted)
- **Verification:** `npm run build` succeeds with `/` listed once, as a dynamic (ƒ) route
- **Committed in:** `db14032` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both were necessary corrections discovered while proving the tracer end-to-end; neither changed the plan's scope, files list, or architecture. No scope creep.

## Issues Encountered
- The plan's flagged assumption on AUTH-02 (cross-device sync has no automated in-repo test) held true. This session ran an ad hoc two-independent-sessions script (not committed, see coverage `D4`) as extra confidence that the server-side session/account model supports two concurrent logins for one account — both sessions independently resolve to the same account email. The genuinely human-only parts (visual confirmation across two actual browsers, the D-06 "no verification step" UX, and the D-08 "no forgot-password link" UX) remain outstanding and are flagged in `coverage.D4` with `human_judgment: true` for `/gsd-verify-work` to route to a human.

## User Setup Required

None - `.env.local` (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`) was already configured and verified against the live Neon DB before this plan started (per Plan 01-01's completed `01-USER-SETUP.md`). No further manual configuration was required for this plan's scope.

## Next Phase Readiness
- The auth surface (`authClient`, `getSessionUser`, `requireUserId`) is stable and ready for Plans 01-04 (salary/schedule/YTD forms) and 01-05 (forecast home screen) to build on
- `requireUserId()` is the mandatory ownership anchor — every Server Action written in later plans must derive `userId` from it, never from client input
- The manual UAT described in Task 3's `<human-check>` (two real browsers, D-06/D-08 visual confirmation) has not been performed by a human yet — recommended before/alongside `/gsd-verify-work` for this phase
- No blockers identified for Plan 01-04

---
*Phase: 01-core-payroll-loop*
*Completed: 2026-08-28*

## Self-Check: PASSED

- All 9 code files + this SUMMARY.md verified present on disk with `[ -f ]`.
- All 3 task commit hashes (`bd9faec`, `db14032`) plus the summary commit (`957f8ee`) verified present via `git log --oneline --all`.
- Plan-level `<verification>` re-run: live schema query confirms all 7 tables present; `npx tsc --noEmit` exits 0; `npm run build` exits 0 (re-run twice during execution); `scripts/verify-auth-flow.mjs` exits 0 against a running dev server (re-run twice, including after the `auth.ts` fix and the `(app)/page.tsx` grep-safe comment edit).
- Manual UAT (Task 3 `<human-check>`, in particular the two-browser AUTH-02 check) was not performed by a human in this session — flagged in `coverage.D4` and "Next Phase Readiness" for follow-up via `/gsd-verify-work`.
