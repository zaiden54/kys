---
phase: 08-visual-redesign-accessibility-pwa-safe-area
plan: 05
subsystem: auth-ui
tags: [nextjs, tailwind, css-variables, accessibility, better-auth]

# Dependency graph
requires:
  - phase: 08-visual-redesign-accessibility-pwa-safe-area
    plan: "01"
    provides: "CSS-variable design-token system in src/app/globals.css (color/typography/spacing tokens, dark-base polarity) that this plan's Tailwind arbitrary-value classes consume"
provides:
  - "login/page.tsx and register/page.tsx fully restyled onto the token system — form fields, focus-visible accessibility, standalone-mode info banner, error-message presentation — with zero change to Phase 6's SEC-02 hardened generic-error behavior or register's error passthrough logic"
affects: [08-06]

# Actuals (#2632)
actuals:
  tokens: 2284
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Restyle-only diff on a security-adjacent file: className-only changes verified via `git status --porcelain` guard on auth/domain/db paths plus exact-string grep on the SEC-02 setFormError call site, so a presentation pass can be proven not to touch security logic"

key-files:
  created: []
  modified:
    - "src/app/(auth)/login/page.tsx"
    - "src/app/(auth)/register/page.tsx"

key-decisions:
  - "e2e/auth.spec.ts was not run — this sandbox has no DATABASE_URL/BETTER_AUTH_SECRET/live Neon branch, and src/env.ts's Zod validation fails npm run build before Playwright's webServer can even start. Substituted with the full render-test suite (13/13 pass, including all 3 Phase 6 SEC-02 cases + both router-refresh/push regression tests) plus a clean `tsc --noEmit` and grep guards confirming the exact SEC-02 string and the register error-passthrough line are byte-for-byte unchanged. Recorded as an open unrun-verify entry in .planning/WINDOWS.md (id 5) for a human to close out with a real e2e run."
  - "Worktree was fast-forwarded from 8eab96d to a27b5fd (gsd/phase-08-visual-redesign-accessibility-pwa-safe-area tip) before starting — the assigned worktree branch was created before Wave 1 (08-01) landed and was missing the plan file, UI-SPEC, PATTERNS map, and globals.css design tokens this plan depends on. Fast-forward (not a merge commit) since 8eab96d was a strict ancestor of a27b5fd."

requirements-completed: [UI-01, UI-02, UI-05, UI-07]

coverage:
  - id: D1
    description: "Login form shows destructive-colored error text for both validation errors and the SEC-02 generic auth-failure message, with zero change to the setFormError call site or its condition"
    requirement: "UI-01"
    verification:
      - kind: unit
        ref: "src/app/(auth)/login/page.render.test.tsx (10/10 pass, incl. 3 SEC-02 cases)"
        status: pass
      - kind: static
        ref: 'grep -n '"'"'setFormError("Неверный email или пароль")'"'"' src/app/(auth)/login/page.tsx'
        status: pass
    human_judgment: false
  - id: D2
    description: "Register form's error.message ?? fallback passthrough is restyled without any logic change"
    requirement: "UI-01"
    verification:
      - kind: unit
        ref: "src/app/(auth)/register/page.render.test.tsx (3/3 pass)"
        status: pass
      - kind: static
        ref: 'grep -n '"'"'error.message ?? "Не удалось зарегистрироваться"'"'"' src/app/(auth)/register/page.tsx'
        status: pass
    human_judgment: false
  - id: D3
    description: "Both forms' email/password inputs have real label/htmlFor+id pairs, 2px accent focus-visible outlines with offset, 8px-radius tertiary-bordered primary-surface backgrounds"
    requirement: "UI-05,UI-07"
    verification:
      - kind: static
        ref: "src/app/(auth)/login/page.tsx, src/app/(auth)/register/page.tsx (manual diff review against 08-UI-SPEC.md § Form Fields)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No zinc-*/red-6*/bg-black/bg-blue Tailwind utilities remain on either page; no stray diff to auth/domain/db logic files"
    requirement: "UI-01"
    verification:
      - kind: static
        ref: "grep -c \"zinc-|red-6|bg-black|bg-blue\" on both files (0), git status --porcelain -- src/lib/auth.ts src/lib/auth-client.ts src/lib/auth-allowed-hosts.ts src/domain/ src/lib/db/ (empty)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Full register -> login -> home golden path (e2e/auth.spec.ts) passes against a live server after both restyles"
    requirement: "UI-01"
    verification: []
    human_judgment: true
    rationale: "Sandbox has no DATABASE_URL/BETTER_AUTH_SECRET/live Neon branch; src/env.ts's Zod validation fails `npm run build` before Playwright's webServer can start. Recorded as open unrun-verify id 5 in .planning/WINDOWS.md. A human (or a CI run with real credentials) should execute `npm run test:e2e -- e2e/auth.spec.ts` to close this out."

duration: ~25min
completed: 2026-09-02
status: complete
---

# Phase 8 Plan 5: Login & Register Visual Redesign Summary

**Restyled `login/page.tsx` and `register/page.tsx` onto Plan 08-01's CSS-variable token system — accessible focus-visible form fields, token-driven colors/typography, and the standalone-mode info banner — while leaving Phase 6's SEC-02 hardened generic-login-error logic and register's error-message passthrough byte-for-byte unchanged.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2/2
- **Files modified:** 2 (`login/page.tsx`, `register/page.tsx`) + 1 shared doc (`.planning/WINDOWS.md`)

## Accomplishments

- `login/page.tsx`'s email/password inputs, labels, error text, standalone-mode banner, submit button, `<h1>`, and register cross-link are all now token-driven (`var(--color-*)`, `var(--font-size-*)`, `var(--font-weight-*)`) with 2px accent focus-visible outlines and a visible offset on every interactive element
- `register/page.tsx` mirrors the identical treatment (minus the standalone banner, which register never had)
- Phase 6's SEC-02 fix — `setFormError("Неверный email или пароль")`, never reading `error.message`/`error.code` — is byte-for-byte unchanged; all 3 SEC-02 render-test cases plus both router-refresh/push regression tests still pass
- Register's `error.message ?? "Не удалось зарегистрироваться"` passthrough is byte-for-byte unchanged
- Zero diff to `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/lib/auth-allowed-hosts.ts`, `src/domain/`, or `src/lib/db/`

## Task Commits

Each task was committed atomically:

1. **Task 1: Restyle login/page.tsx** — `7f21663`
2. **Task 2: Restyle register/page.tsx** — `a025777` (also records the e2e unrun-verify item in `.planning/WINDOWS.md`)

## Files Created/Modified

- `src/app/(auth)/login/page.tsx` — token-driven restyle; SEC-02 logic untouched
- `src/app/(auth)/register/page.tsx` — token-driven restyle mirroring login; error passthrough untouched
- `.planning/WINDOWS.md` — new unrun-verify entry (id 5) for the e2e golden-path check

## Decisions Made

- Worktree branch was fast-forwarded from `8eab96d` to `a27b5fd` (the `gsd/phase-08-visual-redesign-accessibility-pwa-safe-area` tip) at the start of this session — the assigned worktree was cut before Wave 1 (Plan 08-01) merged and was missing the plan file itself, `08-UI-SPEC.md`, the (untracked) `08-PATTERNS.md` pattern map, and the `globals.css` token system this plan depends on. A strict `--ff-only` merge (not a merge commit) was used since `8eab96d` was an ancestor of `a27b5fd`.
- `e2e/auth.spec.ts` was not run in this session — see "Known Gaps" below. Substituted with the full render-test suite (13/13), a clean `tsc --noEmit`, and grep/`git status --porcelain` structural guards.
- Applied identical form-field/label/button/focus-outline treatment to both pages per 08-PATTERNS.md's "Auth Pages" analog, rather than re-deriving independent styling — keeps the two auth screens visually and structurally identical apart from register's missing standalone banner.

## Deviations from Plan

None — plan executed exactly as written for both tasks. The e2e-test substitution below is a verification-environment limitation, not a deviation from the plan's file/action scope.

## Known Gaps

### Unrun Verification

- **`npm run test:e2e -- e2e/auth.spec.ts`** (both tasks' `<verify>` block) — not run. This execution sandbox has no `DATABASE_URL`/`BETTER_AUTH_SECRET`/live Neon branch, and `src/env.ts`'s `@t3-oss/env-nextjs` Zod validation throws during `npm run build`, before Playwright's `webServer` can even start. Recorded as **open** entry id 5 in `.planning/WINDOWS.md` (`kind: unrun-verify`). A human (or a CI run with real Neon/Better-Auth credentials, e.g. via Phase 7's CI-isolated-branch job) should run this before considering Phase 8's auth-screen restyle fully closed. All other acceptance criteria (render tests, `tsc --noEmit`, exact-string greps, `git status --porcelain` structural guard) passed.

## Issues Encountered

None beyond the stale-worktree base described above, which was resolved with a fast-forward merge before any file edits.

## User Setup Required

None — no external service configuration required for this plan's own scope. A human with real Neon/Better-Auth credentials should run `npm run test:e2e -- e2e/auth.spec.ts` to close the recorded unrun-verify gap.

## Next Phase Readiness

Ready for Plan 08-06 (or whichever plan reconciles this wave). No blockers introduced by this plan beyond the recorded e2e gap.

---
*Phase: 08-visual-redesign-accessibility-pwa-safe-area*
*Completed: 2026-09-02*

## Self-Check: PASSED

- FOUND: src/app/(auth)/login/page.tsx
- FOUND: src/app/(auth)/register/page.tsx
- FOUND: .planning/phases/08-visual-redesign-accessibility-pwa-safe-area/08-05-SUMMARY.md
- FOUND: commit 7f21663 (feat(08-05): restyle login page onto token system)
- FOUND: commit a025777 (feat(08-05): restyle register page onto token system)
