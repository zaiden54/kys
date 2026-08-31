---
phase: 01-core-payroll-loop
plan: 12
subsystem: validation
tags: [zod, calendar-validation, auth-secret, security, vitest]
requires:
  - phase: 01-core-payroll-loop
    provides: "01-09 persisted-precision salary validation and the existing shared dated-input schemas"
provides:
  - "Calendar round-trip validation shared by salary effective dates and YTD as-of dates"
  - "Pure Better Auth secret schema rejecting placeholders and low-diversity values"
  - "Fail-closed environment template with an empty BETTER_AUTH_SECRET and generation command"
affects: [01-11-salary-confirmation, authentication, deployment]
actuals:
  tokens: 7400
  tasks: 2
  commits: 5
tech-stack:
  added: []
  patterns:
    - "Shape validation followed by UTC ISO round-trip validation for calendar-only strings"
    - "Pure environment-value schemas tested independently from process.env"
key-files:
  created:
    - src/lib/validation/auth-secret.ts
    - src/lib/validation/auth-secret.test.ts
  modified:
    - src/lib/validation/salary.ts
    - src/lib/validation/salary.test.ts
    - src/env.ts
    - .env.example
key-decisions:
  - "Calendar validity is established by a UTC parse-and-ISO-round-trip after the existing yyyy-MM-dd shape check, preserving both existing Russian messages and timezone independence."
  - "Auth-secret validation combines a marker denylist with a minimum of eight distinct characters; failures name BETTER_AUTH_SECRET and the generation command but never echo the candidate."
patterns-established:
  - "Boot-sensitive secrets use pure shared schemas, while env.ts remains the sole process-environment parser."
requirements-completed: [SAL-01, SAL-02, SAL-03, AUTH-01]
coverage:
  - id: D1
    description: "Impossible calendar dates are rejected on both dated salary inputs without normalisation, while leap days and valid past/future dates remain accepted."
    requirement: SAL-01
    verification:
      - kind: unit
        ref: "src/lib/validation/salary.test.ts#calendar date table exercised against salaryInputSchema and ytdBaselineInputSchema"
        status: pass
    human_judgment: false
  - id: D2
    description: "Known placeholders, short values, and low-diversity authentication secrets are rejected without leaking the submitted value; generated 32-byte base64 secrets pass unchanged."
    requirement: AUTH-01
    verification:
      - kind: unit
        ref: "src/lib/validation/auth-secret.test.ts#accept/reject table"
        status: pass
    human_judgment: false
  - id: D3
    description: "The committed environment template cannot boot verbatim because BETTER_AUTH_SECRET is empty and env.ts validates it through the shared hardened schema."
    requirement: AUTH-01
    verification:
      - kind: other
        ref: "grep '^BETTER_AUTH_SECRET=$' .env.example and grep 'betterAuthSecretSchema' src/env.ts"
        status: pass
    human_judgment: true
    rationale: "The plan explicitly requests a scratch-environment boot attempt to judge the operator-facing failure output; the automated schema and production-build checks prove the underlying gate but not that manual setup flow."
duration: 7min
completed: 2026-08-29
status: complete
---

# Phase 1 Plan 12: Calendar and Authentication-Secret Validation Summary

**Both dated payroll inputs now reject impossible calendar days without normalisation, and deployments cannot boot from the committed example authentication secret configuration.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-08-29T17:33:27+03:00
- **Completed:** 2026-08-29T17:40:14+03:00
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Tightened the one shared ISO date schema used by salary effective dates and YTD as-of dates with a timezone-independent UTC round trip.
- Added a pure, directly tested `betterAuthSecretSchema` that rejects placeholders and low-diversity secrets without disclosing candidates.
- Wired the shared secret schema into `env.ts` and changed `.env.example` to fail closed while documenting `openssl rand -base64 32`.

## Task Commits

1. **Task 1 RED:** `e139a45` — failing calendar round-trip table for both dated inputs.
2. **Task 1 GREEN:** `d1fe9e8` — reject calendar dates that do not round-trip.
3. **Task 2 RED:** `a4f9ae3` — auth-secret accept/reject and non-disclosure table.
4. **Task 2 GREEN:** `85b9860` — pure placeholder and diversity schema.
5. **Task 2 integration:** `f536d51` — wire env validation and fail-closed template.

## Files Created/Modified

- `src/lib/validation/auth-secret.ts` — pure auth-secret constants, placeholder predicate, and Zod schema.
- `src/lib/validation/auth-secret.test.ts` — generated-secret, placeholder, diversity, and error non-disclosure coverage.
- `src/lib/validation/salary.ts` — shared UTC calendar round-trip predicate.
- `src/lib/validation/salary.test.ts` — leap-day and overflow table for both dated schemas.
- `src/env.ts` — `BETTER_AUTH_SECRET` now uses `betterAuthSecretSchema`.
- `.env.example` — empty fail-closed secret with generation guidance.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

None in implementation. The plan's mechanical `grep -c 'refine' ... <= 2` acceptance probe is stale: the file already had two unrelated refinements (amount precision and distinct schedule days), so adding the required shared calendar refinement makes the count three. Semantic coverage is provided by 97 focused passing tests and inspection confirms the date rule remains defined once and shared by both dated schemas.

## Issues Encountered

- The recovery run's full suite reached **186 passing tests** but all 28 live-Neon cases failed uniformly because the configured `on-hands_owner` password is no longer accepted. This is an external credential failure, not a `01-12` regression; the two plan-owned suites pass 97/97, TypeScript and lint pass, and the Next.js production build completes.

## User Setup Required

Generate and configure a real secret with `openssl rand -base64 32`; the committed `.env.example` intentionally contains no runnable secret.

## Next Phase Readiness

Ready for `01-11`, whose HMAC salary-replacement claim relies on the hardened `BETTER_AUTH_SECRET`. Live database verification for `01-11` requires restoring the Neon credential.

## Self-Check: PASSED

- Both created files exist and all five task commits are present.
- `npx vitest run src/lib/validation/salary.test.ts src/lib/validation/auth-secret.test.ts`: 97/97 pass.
- `npx tsc --noEmit`: pass.
- `npm run lint`: pass.
- `npm run build`: pass.
- Fail-closed template and env wiring probes: pass.

---
*Phase: 01-core-payroll-loop*
*Completed: 2026-08-29*
