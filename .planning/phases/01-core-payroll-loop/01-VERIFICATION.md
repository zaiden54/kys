---
phase: 01-core-payroll-loop
verified: 2026-08-29T11:28:11Z
status: gaps_found
score: 2/5 must-haves verified
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/5
  gaps_closed:
    - "The 01-09 SAL-01 gap is closed: values that round to zero kopecks are rejected before repository access, repository rejection is serialized as a generic field error, and SalaryForm catches a rejected Server Action promise."
  gaps_remaining:
    - "The deployed forecast does not add prior scheduled salary payments after the YTD baseline, so cumulative income can remain stale and the next-payment tax can be wrong."
    - "D-14 confirmation is not bound to the displayed row or submitted snapshot, allowing an undisclosed value to be overwritten."
    - "The shared ISO-date validator accepts impossible calendar dates."
    - "The documented auth-secret placeholder passes runtime validation as a valid secret."
  regressions: []
gaps:
  - truth: "The next payment is taxed against all cumulative salary income since the start of the calendar year (TAX-01, TAX-02, HOME-01)."
    status: failed
    reason: "getCumulativeIncomeBeforeDate returns the stored YTD baseline plus a hardcoded zero additional-income sum. It never derives prior avans/salary events between baseline.asOfDate and the forecast date. forecastNextPayment therefore taxes against a stale baseline; the passing forecast test explicitly expects a January-zero baseline still to be zero later in the year."
    artifacts:
      - path: "src/lib/db/salary-repository.ts"
        issue: "sumAdditionalIncomeEventsBetween returns 0 and getCumulativeIncomeBeforeDate does not include generated salary payment events."
      - path: "src/app/actions/forecast.test.ts"
        issue: "Tests use calculateNdfl(0, nextGross, ...) as the oracle for a January-zero baseline, encoding the missing cumulative-salary behavior."
    missing:
      - "Derive and sum every prior avans/salary taxable event between the baseline date and forecast date, using salary history and schedule changes as applicable."
      - "Add an integration test spanning multiple earlier payments and a bracket crossing, proving the displayed next-payment tax uses their cumulative gross."
  - truth: "An exact-date salary replacement only overwrites the value the user was shown and explicitly confirmed (D-14, SAL-02)."
    status: failed
    reason: "Confirmation is a client-controlled boolean. The client resubmits current getValues(), not the snapshot that produced the prompt, and the server performs no row-version/expected-value check. Editing the form after a prompt or a concurrent write from another device can overwrite a value never disclosed to the confirmer."
    artifacts:
      - path: "src/app/actions/salary.ts"
        issue: "saveSalaryAction accepts confirm=true without an expected row id/version/value and unconditionally upserts after a fresh advisory read."
      - path: "src/components/pay-setup-forms.tsx"
        issue: "onConfirmReplace calls submit(getValues(), true), so an old prompt can authorize different current form values."
    missing:
      - "Bind confirmation to the exact submitted snapshot and server-observed row version (or a signed opaque token)."
      - "Perform a conditional confirmed update; when the row changed, return a fresh prompt showing the new value."
      - "Add client-edit-after-prompt and cross-request stale-version regression tests."
  - truth: "Salary and YTD effective dates are validated as real calendar dates before persistence (SAL-01, SAL-02, SAL-03)."
    status: failed
    reason: "isoDateString only checks !Number.isNaN(new Date(value).getTime()). JavaScript normalizes 2026-02-29 to 2026-03-01 and 2026-02-31 to 2026-03-03, so impossible dates pass the shared schema."
    artifacts:
      - path: "src/lib/validation/salary.ts"
        issue: "The real-date refine checks parseability without round-tripping year/month/day components."
      - path: "src/lib/validation/salary.test.ts"
        issue: "Only money precision is covered; no leap-year or day-overflow cases exist."
    missing:
      - "Use a strict calendar-date round trip or strict parser for yyyy-MM-dd."
      - "Test valid leap day plus invalid non-leap day and month-day overflow for both effectiveFrom and asOfDate."
  - truth: "The documented environment setup cannot start authentication with a public predictable secret (AUTH-01)."
    status: failed
    reason: "The .env.example value generate-with-openssl-rand-base64-32 is 36 characters and therefore passes src/env.ts's sole min(32) rule. Copying the documented template can start Better Auth with a known secret."
    artifacts:
      - path: ".env.example"
        issue: "Contains a predictable placeholder that satisfies runtime validation."
      - path: "src/env.ts"
        issue: "BETTER_AUTH_SECRET validates length only and does not reject the known placeholder."
    missing:
      - "Make the example value fail closed and reject known placeholder values at boot."
behavior_unverified_items:
  - truth: "Logging in from a second independent device/session shows the same salary, schedule, YTD, and forecast data (AUTH-02)."
    test: "Use two independent browser profiles signed into the same account; edit data in one and reload the other."
    expected: "Both sessions show the same persisted salary history, schedule, YTD baseline, and forecast."
    why_human: "The shared Postgres/user-scoped architecture is present, but no committed browser test exercises two independent authenticated sessions end to end."
decision_coverage:
  honored: 15
  total: 15
  not_honored: []
---

# Phase 1: Core Payroll Loop Verification Report

**Phase Goal:** A registered user can enter their gross salary and avans/salary payment schedule and see an accurate amount and date for their next take-home payment, computed via the progressive 2025 НДФЛ scale applied cumulatively from the start of the calendar year, with data synced across their devices.

**Verified:** 2026-08-29T11:28:11Z
**Status:** gaps_found
**Re-verification:** Yes — after plan 01-09

## Goal Achievement

### Observable Truths

| # | Roadmap truth | Status | Evidence |
|---|---|---|---|
| 1 | User can register/log in and see the same data on a second device (AUTH-01, AUTH-02) | ✗ FAILED | Auth routes, session ownership, and shared Postgres are wired, but `.env.example` supplies a predictable secret that passes validation. The second-device behavior also remains unexercised; see `behavior_unverified_items`. |
| 2 | User can enter gross salary and configure avans/salary days (SAL-01) | ✓ VERIFIED | Plan 01-09 closes the sub-kopeck failure. `salaryInputSchema`, `saveSalaryAction`, `SalaryForm`, `scheduleInputSchema`, and the ownership-scoped repository are wired; focused and full tests pass. |
| 3 | User can change salary and retain dated history (SAL-02) | ✗ FAILED | Dated rows and atomic upserts work, but the one-way D-14 replacement can overwrite a row/value the user never saw because confirmation is not snapshot/version-bound. |
| 4 | User can enter YTD or sees an explicit zero-since-January warning (SAL-03) | ✓ VERIFIED | YTD is always offered; skip stores zero with `isEstimated=true`; settings can edit it; the persistent banner is wired. Impossible-date validation remains a separate failed plan contract. |
| 5 | Home shows an accurate next amount/date using cumulative progressive tax and independent events (TAX-01, TAX-02, HOME-01) | ✗ FAILED | Date resolution, bracket math, event split, and rendering are present, but the production cumulative-before value omits all prior salary payments after the baseline. The displayed tax can therefore be materially wrong. |

**Score:** 2/5 roadmap truths verified (1 additional cross-device behavior remains unverified)

### Plan Must-Have Audit

All nine PLAN frontmatter blocks were checked against current source and tests. Counts below cover positive `truths`; failed/flagged prohibitions are called out separately.

| Plan | Truth result | Exceptions |
|---|---|---|
| 01-01 | 7/7 implementation truths present | Auth-secret safety was not a listed truth, but fresh review CR-01 is a phase blocker. |
| 01-02 | 7/7 implementation truths present | Concurrent-signup script exists; two-device AUTH-02 remains manual. |
| 01-03 | 9/9 implementation truths present | Primary-statute confirmation and judgment-tier prohibition remain human-review items. |
| 01-04 | 9 verified, 1 behavior-unverified | Cross-device persistence lacks two-session evidence. D-14's “must show and confirm the overwritten value” prohibition is FAILED. |
| 01-05 | 5/6 | The cumulative-YTD forecast truth is FAILED because prior salary events are not accumulated. |
| 01-06 | 7/7 | Moscow anchoring is present and tested. |
| 01-07 | 6/7 | The claim that atomic last-write-wins prevents silent D-14 confirmation bypass is FAILED; atomicity does not bind consent to a row version. |
| 01-08 | 6/6 | Gross split, bracket ordering, DB lower bounds, and metadata are present. |
| 01-09 | 4/4 | Salary precision and error containment are independently confirmed. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/lib/validation/salary.ts` | Strict salary/schedule/YTD validation | ⚠️ PARTIAL | Sub-kopeck salary guard is correct; impossible calendar dates still pass. |
| `src/app/actions/salary.ts` | Session-scoped serializable mutations | ⚠️ PARTIAL | 01-09 salary error contract works; D-14 confirmation is not version/snapshot-bound; schedule/YTD failures still escape. |
| `src/lib/db/salary-repository.ts` | Ownership-scoped history and cumulative income | ✗ HOLLOW for cumulative tax | Queries/upserts are real and user-scoped, but cumulative salary income terminates in a hardcoded zero-event sum. |
| `src/app/actions/forecast.ts` | Next-payment orchestration | ⚠️ PARTIAL | Correctly wires schedule/date/tax/render flow, but receives an incomplete cumulative-before value. |
| `src/domain/tax/*` | Progressive cumulative НДФЛ engine | ✓ VERIFIED | Pure value-level tests cover brackets, marginal deltas, rounding, and sequential events. |
| `src/domain/schedule/*`, `src/domain/time.ts` | Moscow-anchored payment-date resolution | ✓ VERIFIED | Clamp/holiday/order behavior and timezone boundary tests pass. |
| Auth route/pages/session/config | Register, login, session ownership | ⚠️ PARTIAL | Runtime wiring is substantive; environment template permits a known auth secret. |
| Home/onboarding/settings components | User-visible core loop | ✓ VERIFIED structurally | Real DB-backed values flow into server-rendered UI; visual UAT remains pending. |

`verify.artifacts` reported all 34 structured artifacts from plans 01-01 through 01-05 present/substantive. Plans 01-06 through 01-09 use string-form artifact declarations, so they were verified manually.

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Auth handler/layout/session | Better Auth + request cookie | `toNextJsHandler(auth)`, `getSessionUser()` | ✓ WIRED | Manual source inspection confirms the links despite false negatives from escaped patterns in the generic key-link query. |
| Salary forms | Server Actions | awaited action calls and serialized results | ⚠️ PARTIAL | Salary rejection is caught; schedule/YTD and auth-page promise rejections are not. |
| Salary actions | Session + validation + repository | `requireUserId`, `safeParse`, scoped repository calls | ✓ WIRED | Identity comes from the verified session, not FormData. |
| Forecast | Schedule/time/tax/repository | `nowInMoscow` → next event → salary/baseline → `calculateNdfl` | ⚠️ PARTIAL | Wiring exists, but cumulative-before omits earlier salary events. |
| Home page | Forecast + display components | server-component render | ✓ WIRED | No client-side tax recomputation. |

### Data-Flow Trace (Level 4)

| Rendered value | Source chain | Status |
|---|---|---|
| Next payment date | `payment_schedule` → `nextPaymentOnOrAfter(..., nowInMoscow())` → `forecast.date` → card | ✓ FLOWING |
| Payment gross | effective `salary_history` row → kind-aware half split → card | ✓ FLOWING |
| Cumulative-before / tax / net | `ytd_baseline` + hardcoded zero event sum → `calculateNdfl` → card | ✗ HOLLOW / INCOMPLETE |
| Salary history list | ownership-filtered `salary_history` query → settings list | ✓ FLOWING |
| YTD warning | persisted/synthesized `isEstimated` → home banner | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full automated suite | `npm test -- --run` | 11 files, 111/111 tests pass | ✓ PASS |
| Type checking | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Lint | `npm run lint` | exit 0 | ✓ PASS |
| Next.js 16 production build | `npm run build` | compiled; all 8 routes generated | ✓ PASS |
| Impossible-date normalization | Node check for `new Date('2026-02-29')` and `new Date('2026-02-31')` | normalized to March, while current refine accepts both | ✗ FAIL |
| Example secret validation | length check on `generate-with-openssl-rand-base64-32` | 36 characters; passes `min(32)` | ✗ FAIL |

### Probe Execution

No phase-declared or conventional `probe-*.sh` files exist. N/A.

### Requirements Coverage

| Requirement | Source plans | Status | Evidence |
|---|---|---|---|
| AUTH-01 | 01-01, 01-02 | ✗ BLOCKED | Auth works structurally, but documented setup accepts a public predictable secret. |
| AUTH-02 | 01-01, 01-02, 01-04 | ? NEEDS HUMAN | Shared cloud DB and ownership scoping are present; two independent sessions are untested. |
| SAL-01 | 01-01, 01-03, 01-04, 01-09 | ✓ SATISFIED | Valid salary/schedule flow works; 01-09 closes persisted-precision/error containment. |
| SAL-02 | 01-01, 01-04, 01-07 | ✗ BLOCKED | History/upsert behavior exists, but D-14 one-way replacement consent is stale/racy. |
| SAL-03 | 01-01, 01-04, 01-05, 01-06 | ⚠️ PARTIAL | Main entry/skip/banner flow works; shared validator accepts impossible `asOfDate`. |
| TAX-01 | 01-03, 01-05, 01-06, 01-08 | ✗ BLOCKED | Pure tax engine is correct; production cumulative input omits earlier salary payments. |
| TAX-02 | 01-03, 01-05, 01-06 | ✗ BLOCKED | Event math is correct in isolation, but production does not fold prior avans/salary events into cumulative income. |
| HOME-01 | 01-02, 01-05, 01-06, 01-08 | ✗ BLOCKED | Card/date render works, but the amount can be wrong due to incomplete cumulative income. |

No orphaned Phase 1 requirement IDs were found. None of the four blocker concerns is specifically deferred by a later roadmap phase; Phase 2/3 add other income types and assume Phase 1's salary cumulative base is already correct.

### Test Quality Audit

| Test surface | Linked requirements | Active / skipped | Assertion level | Verdict |
|---|---|---|---|---|
| `calculate-ndfl.test.ts` | TAX-01, TAX-02 | active / 0 | Value + property | Strong for the pure engine. |
| `forecast.test.ts` | TAX-01, TAX-02, HOME-01 | active / 0 | DB-backed value | 🛑 BLOCKER: the oracle uses a stale baseline and never exercises prior scheduled salary events. |
| `salary-repository.test.ts` | SAL-02, SAL-03, AUTH-02 | active / 0 | DB-backed behavior | Strong for atomicity/isolation; explicitly asserts cumulative income equals baseline only. |
| `salary.test.ts`, `pay-setup-forms.test.ts` | SAL-01 | active / 0 | Boundary + AST contract | Strong for plan 01-09; no strict date cases. |
| `verify-auth-flow.mjs` | AUTH-01 | standalone script | End-to-end HTTP/DB | Substantive, but not part of the 111-test Vitest run; cleanup failure remains WR-03. |

Disabled requirement-linked tests: 0. Circular expected-value generators: 0. The principal quality failure is a production-wiring blind spot: passing pure-engine tests cannot prove the cumulative input supplied by the repository is complete.

### Anti-Patterns and Review Findings

| Finding | Severity | Current verification |
|---|---|---|
| Cumulative salary events omitted from `getCumulativeIncomeBeforeDate` | 🛑 BLOCKER | Newly found by goal-backward data-flow tracing; directly breaks TAX-01/TAX-02/HOME-01. |
| Review CR-01: valid predictable auth placeholder | 🛑 BLOCKER | Confirmed at `.env.example:2` and `src/env.ts:7`. |
| Review CR-02: D-14 snapshot/TOCTOU race | 🛑 BLOCKER | Confirmed at `salary.ts:84-103` and `pay-setup-forms.tsx:73-110`. |
| Review CR-03: impossible dates accepted | 🛑 BLOCKER | Confirmed at `salary.ts:38-44` with direct normalization check. |
| Review WR-01: schedule/YTD rejected promises unhandled | ⚠️ WARNING | Confirmed; Next.js 16 documents expected Server Function errors as return values and async event-handler errors are not handled by render boundaries. |
| Review WR-02: auth request rejection/upstream messages | ⚠️ WARNING | Confirmed in login/register submit handlers. |
| Review WR-03: auth verification cleanup bypass | ⚠️ WARNING | Confirmed: `fail()` calls `process.exit(1)`, so `.finally()` cannot run. |

No `TBD`, `FIXME`, or `XXX` debt markers and no disabled tests were found in the checked source/test surface.

### Decision Coverage

All 15 trackable `01-CONTEXT.md` decisions are referenced by shipped artifacts (`check.decision-coverage-verify`: 15/15 honored). This non-blocking lexical gate does not override the behavioral D-14 failure above.

### Human Verification Required

The overall status remains `gaps_found`, but these checks must remain visible for the later UAT sink:

1. **AUTH-02 two-browser sync:** edit salary/schedule/YTD in one independent browser profile and verify the other shows identical data after reload.
2. **Primary-statute confirmation:** compare the 2025 thresholds, rates, and fixed bases in `ndfl-brackets.ts` with the primary НК РФ ст.224 text.
3. **Visual/interactive decisions:** confirm banner persistence, D-04 warning wording, history rendering, weekend/holiday date presentation, forecast wording, and absence of a future-raise indicator in a real browser.

### Gaps Summary

Plan 01-09 successfully closes its stated SAL-01 gap, and all automated quality commands pass. The phase goal is nevertheless not achieved. Three fresh review blockers remain, and goal-backward tracing found a more fundamental production-wiring defect: the pure tax engine is fed a stale YTD baseline because prior salary payments are never accumulated. This can produce a cleanly rendered but materially incorrect next-payment amount, which directly contradicts the phase's core outcome.

---

_Verified: 2026-08-29T11:28:11Z_
_Verifier: the agent (gsd-verifier)_
