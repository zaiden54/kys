---
phase: 04-annual-overview-pwa-installability
plan: 03
subsystem: [auth]
tags: [nextjs, app-router, useRouter, vitest, testing-library, gap-closure]

requires:
  - phase: 01-core-payroll-loop
    provides: "login/page.tsx and register/page.tsx auth pages, authClient (Better Auth client), (app)/layout.tsx server-side getSessionUser() session gate"
provides:
  - "router.refresh() before router.push() on both login and register success paths, closing UAT gap G-04-2"
  - "First-ever automated regression test for register/page.tsx (previously zero coverage)"
  - "Real call-order/destination/error-path assertions for both auth redirect flows via vi.hoisted() router spies"
affects: [auth, pwa-installability, standalone-login]

actuals:
  tokens: 5500
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "vi.hoisted() module-level router spies (pushMock/refreshMock) returned from a next/navigation useRouter mock factory, so test bodies can assert against the same instances the component calls -- an inline vi.fn() inside a mock factory is a fresh, unreachable instance per call and cannot be asserted against"

key-files:
  created:
    - src/app/(auth)/register/page.render.test.tsx
  modified:
    - src/app/(auth)/login/page.tsx
    - src/app/(auth)/login/page.render.test.tsx
    - src/app/(auth)/register/page.tsx

key-decisions:
  - "Applied the identical two-line fix (router.refresh() immediately before router.push()) independently to both login and register onSubmit, per the diagnosis that both pages carry the same anti-pattern independently since Phase 01-02's tracer commit"
  - "Rebuilt login/page.render.test.tsx's router mock from an inline unreachable vi.fn() to vi.hoisted() pushMock/refreshMock spies so tests can actually assert call order and destination -- this was the structural blind spot named in the root-cause diagnosis"

requirements-completed: [PWA-01]

coverage:
  - id: D1
    description: "login/page.tsx calls router.refresh() before router.push('/') on successful sign-in"
    requirement: "PWA-01"
    verification:
      - kind: unit
        ref: "src/app/(auth)/login/page.render.test.tsx#LoginPage submit redirect (G-04-2) > calls router.refresh() before router.push() on successful sign-in"
        status: pass
      - kind: unit
        ref: "src/app/(auth)/login/page.render.test.tsx#LoginPage submit redirect (G-04-2) > calls router.push with exactly '/'"
        status: pass
      - kind: unit
        ref: "src/app/(auth)/login/page.render.test.tsx#LoginPage submit redirect (G-04-2) > does not call router.refresh() or router.push() when sign-in errors"
        status: pass
    human_judgment: false
  - id: D2
    description: "register/page.tsx calls router.refresh() before router.push('/onboarding') on successful sign-up"
    requirement: "PWA-01"
    verification:
      - kind: unit
        ref: "src/app/(auth)/register/page.render.test.tsx#RegisterPage submit redirect (G-04-2) > calls router.refresh() before router.push() on successful sign-up"
        status: pass
      - kind: unit
        ref: "src/app/(auth)/register/page.render.test.tsx#RegisterPage submit redirect (G-04-2) > calls router.push with exactly '/onboarding'"
        status: pass
      - kind: unit
        ref: "src/app/(auth)/register/page.render.test.tsx#RegisterPage submit redirect (G-04-2) > does not call router.refresh() or router.push() when sign-up errors"
        status: pass
    human_judgment: false
  - id: D3
    description: "Redirect actually completes end-to-end in a real browser/standalone iOS PWA (G-04-2 UAT-level closure)"
    requirement: "PWA-01"
    verification: []
    human_judgment: true
    rationale: "The plan's own <verification> section requires a human to re-run Test 2 (and the now-unblocked Test 3) from 04-UAT.md on a real device/browser; automated jsdom tests cover call order, destination, and the error path but cannot exercise real browser navigation, cookie propagation, or standalone-mode behavior."

duration: 6min
completed: 2026-08-31
status: complete
---

# Phase 04 Plan 03: Auth Redirect Fix (G-04-2) Summary

**Fixed missing `router.refresh()` before `router.push()` in both login and register `onSubmit` handlers, and rebuilt the router mocks in their tests from unreachable inline spies into real assertable `vi.hoisted()` spies — closing UAT gap G-04-2.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-31T15:37:00Z (approx.)
- **Completed:** 2026-08-31T15:43:13Z
- **Tasks:** 2
- **Files modified:** 4 (2 modified source files, 1 modified test file, 1 new test file)

## Accomplishments

- `login/page.tsx`'s `onSubmit` now calls `router.refresh()` immediately before `router.push("/")` on successful sign-in, forcing `(app)/layout.tsx`'s server-side `getSessionUser()` to read the just-set session cookie fresh instead of soft-navigating against stale pre-auth Server Component data.
- `register/page.tsx`'s `onSubmit` carries the identical, independently-applied fix before `router.push("/onboarding")`.
- `login/page.render.test.tsx`'s `useRouter` mock rebuilt from an inline `vi.fn()` (a fresh, unreachable instance per render — the exact reason the original tests never caught this) to `vi.hoisted()` `pushMock`/`refreshMock` spies, with new tests asserting refresh-before-push call order, the push destination, and the error-path non-navigation case.
- `register/page.render.test.tsx` created net-new (register/page.tsx previously had zero automated test coverage of any kind), mirroring the same structure and assertions against `signUp.email`.
- Full suite (`npm test`: 352 tests, 33 files) and `npm run build` both pass with zero failures/errors after the change.

## Task Commits

1. **Task 1: Fix login redirect (G-04-2)** - `a200bb8` (fix)
2. **Task 2: Fix register redirect (G-04-2)** - `d293dca` (fix)

**Plan metadata:** (pending — see final commit in this session)

## Files Created/Modified

- `src/app/(auth)/login/page.tsx` - Added `router.refresh()` before `router.push("/")` on successful sign-in
- `src/app/(auth)/login/page.render.test.tsx` - Rebuilt router mock as `vi.hoisted()` spies; added 3 new tests for refresh/push order, destination, and error-path
- `src/app/(auth)/register/page.tsx` - Added `router.refresh()` before `router.push("/onboarding")` on successful sign-up
- `src/app/(auth)/register/page.render.test.tsx` - New file: 3 tests mirroring the login test's structure against `signUp.email`

## Decisions Made

- Applied the identical two-line fix to both pages independently rather than extracting a shared helper — the plan explicitly scoped this as "a two-line addition to the success path only" per page, matching the root-cause diagnosis that both pages drifted into the same bug independently since the Phase 01-02 tracer commit.
- Used `vi.hoisted()` for the router spies (not a shared test-utils module) to keep each test file self-contained, matching the plan's explicit modeling instruction ("modeled directly on the now-updated login/page.render.test.tsx's structure").

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 04 complete (all 3 plans summarized), ready for verification.
G-04-2's code-level fix is done and covered by passing automated tests; the
UAT-level closure still requires a human to re-run Test 2 (and the
now-unblocked Test 3) from 04-UAT.md on a real device/browser per STATE.md's
existing "Real-device iPhone UAT... not performed in this autonomous session"
blocker.

## Self-Check: PASSED

All created/modified files and both task commit hashes were verified present
on disk / in git history.

---
*Phase: 04-annual-overview-pwa-installability*
*Completed: 2026-08-31*
