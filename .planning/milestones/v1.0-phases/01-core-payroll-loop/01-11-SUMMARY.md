---
phase: 01-core-payroll-loop
plan: 11
subsystem: payments
tags: [hmac, compare-and-swap, drizzle, server-actions, react, concurrency]
requires:
  - phase: 01-core-payroll-loop
    provides: "01-07 atomic salary upsert, 01-09 safe action errors, 01-10 accrual, and 01-12 hardened BETTER_AUTH_SECRET"
provides:
  - "Ten-minute HMAC-signed salary-replacement claims"
  - "Conditional insert and compare-and-swap salary writes"
  - "Snapshot-bound replacement confirmation UI with a dedicated in-flight guard"
  - "Live-database race and stale-expectation regression cases"
affects: [authentication, salary-history, cross-device-consistency]
actuals:
  tokens: 14500
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns:
    - "Server-issued signed consent claims; untrusted FormData never supplies the write expectation"
    - "INSERT ON CONFLICT outcomes modelled as written-or-conflict unions"
    - "Client confirmation stores the exact submitted snapshot beside its claim"
key-files:
  created: [src/lib/salary-confirmation-token.ts, src/lib/salary-confirmation-token.test.ts]
  modified: [src/lib/db/salary-repository.ts, src/lib/db/salary-repository.test.ts, src/app/actions/salary.ts, src/app/actions/salary.test.ts, src/components/pay-setup-forms.tsx, src/components/pay-setup-forms.test.ts]
key-decisions:
  - "Salary replacement claims use base64url(JSON).base64url(HMAC-SHA256), expire after ten minutes, reject future issuance, and are verified with timingSafeEqual after a signature-length guard."
  - "Invalid, expired, foreign-user, or stale claims are safe fall-throughs to a fresh insert/conflict observation and prompt, never hard errors or writes."
patterns-established:
  - "Consent-bound destructive updates compare trusted signed expectations inside the database statement."
requirements-completed: [SAL-02, AUTH-02]
coverage:
  - id: D1
    description: "A replacement is authorized only by a valid server-signed claim and writes only while the disclosed stored amount remains current."
    requirement: SAL-02
    verification:
      - kind: unit
        ref: "src/lib/salary-confirmation-token.test.ts and src/app/actions/salary.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The client confirms the stored salary snapshot and claim, never edited live form values, and disables its own confirm request while in flight."
    requirement: SAL-02
    verification:
      - kind: other
        ref: "src/components/pay-setup-forms.test.ts#TypeScript AST confirmation contract"
        status: pass
    human_judgment: true
    rationale: "The plan also requires a real-browser edit-after-prompt check; static AST coverage proves the data path but not the rendered interaction."
  - id: D3
    description: "Concurrent inserts and stale conditional replacements leave one row and surface the current winner rather than silently overwriting it."
    requirement: AUTH-02
    verification:
      - kind: integration
        ref: "src/lib/db/salary-repository.test.ts#conditional insert/replacement race cases"
        status: unknown
    human_judgment: true
    rationale: "The test cases compile, but the configured Neon credential currently fails authentication before fixtures can be created."
  - id: D4
    description: "Two authenticated sessions converge after reload and stale cross-device confirmation re-prompts."
    requirement: AUTH-02
    verification: []
    human_judgment: true
    rationale: "Requires the two-real-browser UAT already tracked for AUTH-02."
duration: 20min
completed: 2026-08-29
status: complete
---

# Phase 1 Plan 11: Consent-Bound Salary Replacement Summary

**Salary overwrites now require a short-lived signed claim for the value the server disclosed, a database compare-and-swap, and the exact client snapshot shown in the prompt.**

## Accomplishments

- Added pure HMAC-SHA256 sign/verify helpers with a ten-minute TTL, malformed-input fail-closed behavior, and constant-time signature comparison.
- Replaced the Server Action's client-controlled boolean with conditional insert/CAS outcomes and fresh prompts for every invalid or stale state.
- Bound confirmation UI to stored snapshot+claim state, disclosed old and new amounts, and added a dedicated double-click guard.
- Added four live-database cases for successful CAS, stale expectation, sequential conflict disclosure, and concurrent insert arbitration.

## Task Commits

1. **Task 1:** `123582c` — signed claim, conditional repository primitives, and action state machine.
2. **Task 2:** `0622a36` — stored-snapshot confirmation UI and AST contract.
3. **Task 3:** `272b9be` — live-database conditional-write race coverage.

## Conditional SQL Contract

- Insert: `INSERT ... ON CONFLICT (user_id, effective_from) DO NOTHING RETURNING ...`; an empty return triggers one ownership-scoped `findSalaryAt` read for the conflict outcome.
- Replacement: `INSERT ... ON CONFLICT (user_id, effective_from) DO UPDATE SET ... WHERE salary_history.gross_amount_kopecks = $expected RETURNING ...`; `setWhere` references the stored table column, not `excluded`, so a stale expectation cannot win.
- The existing unconditional `replaceSalaryAt` remains byte-compatible as an explicit seeding/internal primitive; the Server Action no longer references it. No schema or migration changed.

## Action Outcome Table

| Input/state | Outcome |
|---|---|
| No valid claim, date absent | Conditional insert, success, three path revalidations |
| No/invalid/foreign/expired claim, date present | Fresh signed prompt; no replacement |
| Valid claim, disclosed amount unchanged | Conditional replacement, success, revalidation |
| Valid claim, disclosed amount stale | Fresh prompt for newly observed row; no insert |
| Row vanished during valid confirmation | One conditional insert attempt; raced conflict re-prompts |
| Repository failure or unresolved conflict-with-null | Generic Russian field error; no detail leak |

## Verification

- 199/199 non-database tests pass (11 files).
- Focused token/action/component suites pass.
- `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass.
- All plan invariant greps pass; package manifests and `src/lib/db/schema.ts` are unchanged.
- Live Neon suite cannot reach assertions: every database test fails at fixture creation with `password authentication failed for user 'on-hands_owner'`. The four new tests remain pending until that external credential is restored.
- Browser snapshot-edit and two-session AUTH-02 checks remain pending for end-of-phase UAT.

## Deviations from Plan

None in product scope. Live database execution was unavailable due to the pre-existing external credential failure, so coverage was authored and statically validated but honestly classified as pending rather than passed.

## Self-Check: PASSED

All key files and three task commits exist; production code, focused tests, typecheck, lint, build, and invariant probes pass. External DB/browser gates are explicitly carried forward as human/integration verification debt.

---
*Phase: 01-core-payroll-loop*
*Completed: 2026-08-29*
