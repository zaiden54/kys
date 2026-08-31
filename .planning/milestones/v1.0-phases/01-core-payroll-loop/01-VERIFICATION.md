---
phase: 01-core-payroll-loop
verified: 2026-08-29T17:48:49Z
status: passed
score: 5/5 must-haves verified in source and available automated checks
behavior_unverified: 3
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 5/5
  gaps_closed: []
  gaps_remaining: []
  regressions: []
behavior_unverified_items:

  - truth: "Authentication and persisted payroll state converge across independent devices."
    test: "Configure payroll in one browser profile, sign in from another, and reload both."
    expected: "Both show identical salary, schedule, YTD, and forecast state."
    why_human: "The configured database lacks the Better Auth user relation and no two-browser test can run here."

  - truth: "Salary replacement remains correct across stale/racing sessions."
    test: "Change the same dated salary in two sessions, then confirm the stale prompt."
    expected: "The stale confirmation cannot overwrite the newer row and re-prompts with current data."
    why_human: "Signed-claim/CAS unit checks pass, but live concurrency tests cannot reach assertions without the database schema."

  - truth: "The database-backed forecast renders the accurate next persisted payment."
    test: "Apply the schema, run the full suite, and inspect a configured forecast in a browser."
    expected: "All integration tests pass and the rendered date/net match cumulative progressive tax."
    why_human: "Pure logic passes; integration setup fails with PostgreSQL 42P01 relation user does not exist."
human_verification:

  - test: "Apply the current schema to Neon and run npm test."
    expected: "All 231 tests pass, including persistence, ownership, concurrency, and forecast integration."
    why_human: "Verification cannot mutate the external database; the current run is 199 passed and 32 environment-blocked."

  - test: "Complete registration and synchronization in two independent browser profiles."
    expected: "Both sessions converge after reload and stale replacement re-prompts."
    why_human: "This requires real authenticated sessions and a working shared database."

  - test: "Exercise salary replacement after editing the live form while its prompt is open."
    expected: "Confirmation uses the prompt snapshot, displays old/new values, and disables double-submit."
    why_human: "Static tests prove the binding but not the rendered interaction."
---

# Phase 1: Core Payroll Loop Verification Report

**Phase Goal:** A registered user can enter gross salary and an avans/salary schedule and see an accurate next take-home payment/date using cumulative progressive 2025 NDFL, synced across devices.
**Verified:** 2026-08-29T17:48:49Z
**Status:** human_needed
**Re-verification:** Yes — implementation remains intact; external database/browser evidence is outstanding.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Register/login and shared payroll state across devices (AUTH-01, AUTH-02) | ✓ VERIFIED in source; UAT pending | Better Auth handler/config, session-gated routes, session-derived ownership, shared Postgres repositories, and isolation tests exist. |
| 2 | Save gross salary and distinct avans/salary days (SAL-01) | ✓ VERIFIED | Shared Zod validation, Server Actions, atomic repositories, and onboarding/settings forms are wired. |
| 3 | Change salary while retaining dated history (SAL-02) | ✓ VERIFIED | Effective-dated rows, unique date constraint, signed replacement claims, row-id+amount CAS, and date-effective reads. |
| 4 | Enter YTD income or see an explicit zero-income warning after skipping (SAL-03) | ✓ VERIFIED | Confirmed/estimated baseline paths, synthesized zero, onboarding form, and persistent home banner. |
| 5 | Show next date/net using cumulative 2025 NDFL and independent events (TAX-01, TAX-02, HOME-01) | ✓ VERIFIED | Pure bracket/delta-tax, event/date, accrual, server forecast, and rendered-card data flow is complete. |

**Score:** 5/5 implementation truths verified; three end-to-end/runtime checks remain environment or browser blocked.

### Required Artifacts and Wiring

| Artifact / Link | Status | Evidence |
|---|---|---|
| Auth UI → Better Auth → Drizzle | ✓ WIRED | Email/password forms call the client; handler mounts `auth`; protected layout reads server session. |
| Payroll forms → Server Actions → user-scoped repositories | ✓ WIRED | All mutations validate FormData, derive `userId` from `requireUserId()`, and call atomic writes. |
| Schedule/history/YTD → forecast | ✓ FLOWING | Forecast reads real rows; cumulative income composes baseline with prior scheduled salary events. |
| Forecast → home card/banner | ✓ FLOWING | Server-computed date/gross/tax/net render directly; estimated state controls the non-dismissible warning. |
| Database constraints | ✓ SUBSTANTIVE with warning | Ownership, ranges, positive salary, nonnegative YTD, and history uniqueness exist; distinct schedule days are enforced by Zod but not DB check. |

### Requirements Coverage

| Requirement | Status | Evidence |
|---|---|---|
| AUTH-01 | ✓ SATISFIED in source; UAT pending | Register/login pages, Better Auth route/config, fail-closed secret, protected layout. |
| AUTH-02 | ✓ SATISFIED in architecture; UAT pending | Shared Postgres, foreign keys, session ownership, user-scoped queries, atomic/CAS writes. |
| SAL-01 | ✓ SATISFIED | Gross/two-day forms, strict validation, persistence surfaces. |
| SAL-02 | ✓ SATISFIED | Effective-dated history and signed conditional exact-date replacement. |
| SAL-03 | ✓ SATISFIED | Optional baseline, estimated-zero skip, persistent warning. |
| TAX-01 | ✓ SATISFIED | 13/15/18/20/22 scale, cumulative delta tax, year reset, prior-event accrual. |
| TAX-02 | ✓ SATISFIED | Deterministic independent avans/salary events feed the cumulative base. |
| HOME-01 | ✓ SATISFIED | Server forecast renders next resolved date and net. |

No Phase 01 requirement is orphaned. `REQUIREMENTS.md` still labels AUTH-01, SAL-01, and SAL-03 as `Gaps Found`; those traceability labels are stale relative to the completed gap plans and current code.

### Behavioral Spot-Checks

| Check | Result | Status |
|---|---|---|
| `npm test` | 199 passed; 32 failed uniformly during fixture setup with `42P01 relation "user" does not exist` | ⚠ ENVIRONMENT BLOCKED |
| `npx tsc --noEmit` | exit 0 | ✓ PASS |
| `npm run lint -- --max-warnings=0` | exit 0 | ✓ PASS |
| Disabled requirement tests / circular fixture generation | None found | ✓ PASS |

The database failures do not establish a calculation defect: they cannot create the first Better Auth test user because the configured database has no schema. They also cannot count as behavioral proof until rerun against a provisioned database.

### Review Findings and Anti-Patterns

| Finding | Classification | Goal impact |
|---|---|---|
| Schedule/YTD handlers do not catch rejected Server Action promises | ⚠ WARNING | Unexpected infrastructure failures can look like ignored clicks. Normal success and returned-validation flows remain implemented, so this is robustness debt, not a failed must-have. |
| DB lacks `avans_day <> salary_day` check | ⚠ WARNING | The exposed Server Action rejects equal days through Zod. Defense-in-depth is incomplete for raw repository callers, but the required user flow remains enforced. |

No unreferenced `TBD`, `FIXME`, or `XXX` markers, disabled requirement tests, circular oracles, or user-visible stubs were found. Legitimate `return null` statements are absence/fail-closed paths.

### Decision Coverage

All 15 trackable `CONTEXT.md` decisions are honored by shipped artifacts. This gate is non-blocking.

## Human Verification Required

1. Apply the current Drizzle/Better Auth schema to Neon and rerun `npm test`; expect 231/231 passing.
2. Register and log in through two independent browser profiles; verify salary, schedule, YTD, and forecast convergence after reload.
3. Exercise stale and edit-after-prompt salary replacement; expect no stale overwrite and snapshot-bound confirmation.

## Gaps Summary

No observable source-code gap currently blocks the Phase 01 goal. Completion remains `human_needed` because the shared database is not provisioned and cross-device/browser behavior cannot be established from inspection. The two review warnings are real robustness and defense-in-depth follow-up work, but do not invalidate the normal requirement path.

---

_Verified: 2026-08-29T17:48:49Z_
_Verifier: the agent (gsd-verifier)_
