---
phase: 01-core-payroll-loop
plan: 10
subsystem: tax
tags: [ndfl, cumulative-income, accrual, ytd-baseline, vitest, drizzle]

# Dependency graph
requires:
  - phase: 01-core-payroll-loop
    provides: "01-03 progressive НДФЛ engine (calculateNdfl/taxOnCumulative), 01-05/01-06 forecastNextPayment orchestration and Moscow-time anchoring, 01-08 halfSplitGross kind-aware split, 01-09 salary precision validation"
provides:
  - "A pure, exhaustively-tested accrual engine (accruedGrossBetween) that derives real prior-payment income from a user's schedule and salary history"
  - "getCumulativeIncomeBeforeDate composing the applicable YTD baseline with the real accrued event sum, with a calendar-year reset and an explicit third payment-kind parameter"
  - "A frozen-clock, database-backed proof that the next-payment tax crosses a bracket and is strictly higher than the stale-baseline-only answer would have been"
  - "YtdForm's as-of default bound to the accrual boundary (today in Moscow for an unconfirmed baseline, the real stored date for a confirmed one)"
affects: [phase-02-bonuses, phase-03-vacation-pay, phase-04-annual-overview]

actuals:
  tokens: 11846
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Pure accrual engine (functional core) composed by the repository (imperative shell): src/domain/pay/payment-accrual.ts reads no clock, performs no I/O, and enumerates candidate events through the existing resolve-payment-date.ts calendar resolver rather than re-deriving calendar rules."
    - "Single source of the avans-before-salary tie-break: PAYMENT_KIND_RANK exported from resolve-payment-date.ts, consumed by both generatePaymentEvents and payment-accrual.ts."
    - "Symmetric enumeration-span safety margin (one month before the window bound, one month after the target) with inclusion defined by a strict date/rank filter, not the span itself -- correctly handles a payday that shifts backwards across a month or calendar-year boundary (e.g. a January-nominal salary payment resolving into the preceding December)."

key-files:
  created:
    - src/domain/pay/payment-accrual.ts
    - src/domain/pay/payment-accrual.test.ts
  modified:
    - src/domain/schedule/resolve-payment-date.ts
    - src/lib/db/salary-repository.ts
    - src/lib/db/salary-repository.test.ts
    - src/app/actions/forecast.ts
    - src/app/actions/forecast.test.ts
    - src/components/pay-setup-forms.tsx

key-decisions:
  - "getCumulativeIncomeBeforeDate gained an optional third `kind: PaymentKind` parameter defaulting to \"avans\" (the lowest PAYMENT_KIND_RANK), preserving the pre-01-10 two-argument call meaning of \"everything strictly before this date\" for any caller that does not yet pass a kind."
  - "YtdForm's as-of default is conditioned on isEstimated rather than literally following the plan's \"supplied defaultAsOfDate when present\" wording verbatim: both onboarding/page.tsx and settings/salary/page.tsx always pass a defined defaultAsOfDate (getYtdBaseline never returns null, so the prop is never actually absent), and that value is a synthesized/skipped 1-January date whenever isEstimated is true. A literal present/absent fallback would therefore never surface today's date for exactly the case the SAL-03 truth targets (a user without a real baseline). Implemented as: use the caller's defaultAsOfDate only when isEstimated is explicitly false (a real, previously-confirmed baseline); otherwise default to todayIsoInMoscow()."
  - "The New Year cross-year-boundary test schedule (avans=20/salary=5) and the twelve-month/monotonicity/mid-window-raise test schedule (avans=15/salary=28) were chosen after confirming their real resolved dates for 2026-2027 via a throwaway Node script against the installed date-holidays@3.36.0 RU calendar data, per the plan's explicit instruction -- not hand-guessed."

requirements-completed: [TAX-01, TAX-02, HOME-01, SAL-03]

coverage:
  - id: D1
    description: "The cumulative-income figure handed to calculateNdfl equals the applicable YTD baseline plus the gross of every scheduled avans/salary event strictly after the baseline's as-of date and strictly before the forecast payment, in date-then-kind order; no constant-zero term remains (TAX-01)."
    requirement: "TAX-01"
    verification:
      - kind: unit
        ref: "src/domain/pay/payment-accrual.test.ts#accruedGrossBetween (window-bound, two-month accrual, pre-history)"
        status: pass
      - kind: integration
        ref: "src/app/actions/forecast.test.ts#(8) prior scheduled payments accrue into the cumulative base and cross a bracket"
        status: pass
      - kind: other
        ref: "grep -Ec '^\\s*return 0;' src/lib/db/salary-repository.ts (returns 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Avans and salary events are folded into cumulative income as separate taxable events, each contributing its own half-split share of the monthly oklad effective on that event's own resolved calendar date (TAX-02)."
    requirement: "TAX-02"
    verification:
      - kind: unit
        ref: "src/domain/pay/payment-accrual.test.ts#halfSplitGross, #accruedGrossBetween mid-window raise and backdated-correction cases"
        status: pass
    human_judgment: false
  - id: D3
    description: "A frozen-clock, database-backed forecast test proves the next-payment tax equals calculateNdfl applied to the accrued cumulative base, and is strictly greater than the answer the stale baseline alone produced, crossing the 2,400,000 rub bracket (HOME-01)."
    requirement: "HOME-01"
    verification:
      - kind: integration
        ref: "src/app/actions/forecast.test.ts#(8)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Cumulative income resets at the calendar-year boundary: a baseline whose as-of year differs from the payment date's year contributes zero, and the accrual window opens at 31 December of the preceding year (TAX-01)."
    requirement: "TAX-01"
    verification:
      - kind: unit
        ref: "src/domain/pay/payment-accrual.test.ts#'a New Year payday shifting backwards across 1 January...', #'a full twelve-month window totals exactly twelve whole monthly oklads'"
        status: pass
      - kind: integration
        ref: "src/lib/db/salary-repository.test.ts#'a target date in the following calendar year excludes the baseline entirely...'"
        status: pass
    human_judgment: false
  - id: D5
    description: "An event whose resolved date equals the forecast payment's date is counted only when it ranks earlier in the avans-before-salary ordering (TAX-02)."
    requirement: "TAX-02"
    verification:
      - kind: unit
        ref: "src/domain/pay/payment-accrual.test.ts#'same-resolved-date ordering' (Task 1 March example, Task 2 November collision example)"
        status: pass
    human_judgment: false
  - id: D6
    description: "A scheduled event dated before the user's earliest salary_history row contributes zero rather than borrowing a later entry's amount (TAX-01)."
    requirement: "TAX-01"
    verification:
      - kind: unit
        ref: "src/domain/pay/payment-accrual.test.ts#'an event dated before the earliest salary-history entry contributes zero...'"
        status: pass
    human_judgment: false
  - id: D7
    description: "The YTD entry form defaults its as-of date to today in Moscow for a user who has not yet entered a real baseline, so a mid-year amount is neither double-counted nor ignored by accrual (SAL-03)."
    requirement: "SAL-03"
    verification:
      - kind: other
        ref: "grep -n 'todayIsoInMoscow()' src/components/pay-setup-forms.tsx; grep -c -- '-01-01' src/components/pay-setup-forms.tsx (returns 0)"
        status: pass
    human_judgment: true
    rationale: "The plan's own <verify> block requires a human-check: opening the onboarding YTD step in a real browser to visually confirm the as-of field pre-fills with today's Moscow date and the helper copy reads correctly. No DOM test environment exists in this project (explicitly prohibited by this plan), and no browser was available in this execution sandbox, so this remains an open human-verification item alongside AUTH-02's two-browser check."
  - id: D8
    description: "getCumulativeIncomeBeforeDate stays ownership-scoped: schedule and salary history are read through the existing user-filtered repository functions, and a second user's rows never contribute to the first user's cumulative base."
    verification:
      - kind: integration
        ref: "src/lib/db/salary-repository.test.ts#'a second user's schedule, salary rows and baseline never change the first user's cumulative figure'"
        status: pass
    human_judgment: false
  - id: D9
    description: "The accrued next-payment figure is identical after reload in an independent authenticated session on a second device (AUTH-02)."
    verification: []
    human_judgment: true
    rationale: "Authored as a flat-scalar backstop truth per the plan's spec-less probe fallback. No two-browser session exists in this sandbox to exercise it; remains open exactly as tracked in .planning/STATE.md's Blockers/Concerns and 01-VERIFICATION.md's behavior_unverified_items prior to this plan."

duration: 40min
completed: 2026-08-29
status: complete
---

# Phase 1 Plan 10: Accrue Prior Payments into Cumulative Income Summary

**Replaced the hardcoded-zero additional-income term in `getCumulativeIncomeBeforeDate` with a real, pure accrual engine that sums every prior scheduled avans/salary payment since the YTD baseline, closing the phase's deepest verification blocker.**

## Performance

- **Duration:** 40 min
- **Tasks:** 3 completed
- **Files modified:** 8 (2 created, 6 modified)
- **Commits:** 6 task commits + this metadata commit

## Accomplishments

- `src/domain/pay/payment-accrual.ts`: a pure, clock-free, I/O-free `accruedGrossBetween` engine that enumerates candidate events through the existing `generatePaymentEvents`/`resolvePaymentDate` calendar resolver (so D-02 weekend/holiday shifting and D-03 month-length clamping apply identically to historical and forecast events), applies whichever salary-history entry is effective on each event's own resolved date, and reconciles avans+salary via the relocated `halfSplitGross`.
- `src/lib/db/salary-repository.ts`: `getCumulativeIncomeBeforeDate` now composes the applicable YTD baseline (year-matched, not-after-payment-date) with the real accrued event sum, implementing the calendar-year reset TAX-01 requires; the inert always-zero helper is deleted entirely. The function gains an optional third `kind` parameter.
- `src/app/actions/forecast.ts`: imports `halfSplitGross` from the domain module and passes the resolved payment event's own kind into `getCumulativeIncomeBeforeDate`, so a same-day avans sits inside a same-day salary payment's cumulative base.
- A frozen-clock, database-backed integration test (`forecast.test.ts` test 8) proves the displayed next-payment tax crosses the 2,400,000 rub bracket threshold because of two months of accrued prior payments, and is strictly higher than the answer the stale baseline alone would have produced -- the assertion that genuinely failed against the pre-fix implementation.
- `YtdForm`'s as-of date now defaults to today in Moscow whenever the baseline is still an unconfirmed estimate, binding the boundary a user confirms to the exact boundary the engine accrues from (SAL-03).

## Task Commits

Each task was committed atomically (Task 1 and the two extension tasks each split into a RED test commit and, where a code change was actually needed, a GREEN implementation commit):

1. **Task 1 (tracer) — RED:** `test(01-10): add failing tests for cumulative-income accrual` — `42dc7f7`
2. **Task 1 (tracer) — GREEN:** `feat(01-10): accrue prior avans/salary payments into cumulative income` — `32863c9`
3. **Task 2 — tests (already green against Task 1's implementation):** `test(01-10): harden accrual across raises, backdating, New Year, and clamped/colliding paydays` — `52bf6d8`
4. **Task 3 — tests (already green against Task 1's implementation):** `test(01-10): extend salary-repository coverage for the accrued cumulative path` — `99b6e34`
5. **Task 3 — GREEN (form default):** `feat(01-10): bind the YTD form's as-of default to the accrual boundary` — `dc87d78`

Tracer feedback gate: Task 1's full `<verify>` command was re-run immediately after its GREEN commit (autonomous run) before starting Task 2's expansion work, and passed.

## Files Created/Modified

- `src/domain/pay/payment-accrual.ts` — new pure accrual engine (`accruedGrossBetween`, relocated `halfSplitGross`, `SalaryHistoryEntry`, `AccrualTarget`)
- `src/domain/pay/payment-accrual.test.ts` — new exhaustive pure test table (31 cases across Task 1 and Task 2)
- `src/domain/schedule/resolve-payment-date.ts` — private `KIND_RANK` became the exported `PAYMENT_KIND_RANK`; no other behavior changed
- `src/lib/db/salary-repository.ts` — `getCumulativeIncomeBeforeDate` rewritten to compose baseline + real accrual; inert helper deleted
- `src/lib/db/salary-repository.test.ts` — 4 new database-backed cases for the accrued cumulative path
- `src/app/actions/forecast.ts` — `halfSplitGross` import moved to the domain module; passes `paymentEvent.kind` into the cumulative-income read
- `src/app/actions/forecast.test.ts` — new frozen-clock bracket-crossing test; tests 1, 4, 5 repaired/narrowed as the plan specified
- `src/components/pay-setup-forms.tsx` — `YtdForm`'s as-of default now conditioned on `isEstimated`, reading `todayIsoInMoscow()` for an unconfirmed baseline; helper copy updated

## Accrual rules implemented (module header, `payment-accrual.ts`)

1. Returns zero immediately when the target date is not strictly after the window bound.
2. Candidate events are enumerated through `generatePaymentEvents` — no calendar rule is re-derived in this module (`grep -Ec 'isHoliday|Holidays|lastDayOfMonth' src/domain/pay/payment-accrual.ts` returns 0).
3. The enumeration span runs from one calendar month before the window bound's month through one calendar month after the target's month (a symmetric safety margin) — the filter, not the span, defines inclusion.
4. An event counts when its resolved date is strictly after the window bound AND either strictly before the target date, or exactly on the target date with a strictly lower `PAYMENT_KIND_RANK` than the target's kind.
5. Each counted event contributes `halfSplitGross(entry.grossAmountKopecks, event.kind)`, where `entry` is the salary-history row with the greatest `effectiveFrom` not exceeding the *event's own* resolved date (never the target's date, never array insertion order).
6. No clock read, no I/O; identical inputs always return identical output; the caller's `salaryHistory` array is never mutated or reordered.

## Frozen instants and hand-derived oracles used in tests

- **`forecast.test.ts` test (8) — the bracket-crossing proof:** clock frozen to `2026-09-01T09:00:00Z`. Schedule avans=20/salary=5, monthly oklad 600,000 rub effective 2026-01-01, baseline 1,000,000 rub as of 2026-06-30 (confirmed, not estimated). Confirmed via a throwaway Node check against the installed `date-holidays@3.36.0` that the earliest eligible payment on/after the frozen "today" resolves to **2026-09-04 (salary)**, and that July's and August's avans+salary events all fall strictly between the baseline's window bound and that target — making them fully "interior" months. Because `halfSplitGross`'s floor+remainder split always reconciles a fully-interior month's two events to exactly one monthly oklad regardless of which day within the month they land on, the hand-derived cumulative base (`1,000,000 + 600,000×2 = 2,200,000_00` kopecks) is robust to RU calendar specifics rather than dependent on a hardcoded date. The payment's own gross (300,000 rub, an even half-split) pushes cumulative income to 2,500,000 rub, crossing the 2,400,000 rub bracket threshold.
- **`forecast.test.ts` tests (1) and (5):** clock frozen to `2026-01-01T09:00:00Z`, with each baseline's own `asOfDate` also `2026-01-01`. Since the earliest eligible payment on/after the frozen "today" is by construction the earliest event strictly after the baseline's window bound too, zero prior events can accrue — the oracle `cumulativeBefore = 0` (test 1) or `cumulativeBefore = baseline amount alone` (test 5, comparative) follows from first principles, not a hand-picked resolved date.
- **`payment-accrual.test.ts`:** every real date asserted (September 2026's salary target, March/November 2026 avans/salary collisions, the 2025-12-31 New-Year-shifted salary payment, the February 2026 D-03 clamp, and the full 2026/early-2027 avans=15/salary=28 table) was confirmed via a throwaway Node script requiring the installed `date-holidays`/`date-fns` packages directly and replicating `resolvePaymentDate`'s exact logic, run from the project root before being written into the test file. No date resolved differently from what a first cross-check assumed, so no test's stated month count or hand-derived cumulative base needed correction after the check — the check confirmed the intended dates (notably surfacing that `avans=20/salary=5` in January 2026 shifts the salary payment back to 2025-12-31, which was then deliberately used for the New Year boundary test rather than avoided).

## Final verification results

- `npx vitest run` — 12 files, **130/130 tests pass** (including live-database integration tests, DATABASE_URL as configured).
- `npx vitest run src/domain/pay/payment-accrual.test.ts` — 24 pure tests pass, no database.
- `npx tsc --noEmit` — exit 0.
- `npm run lint` — exit 0.
- `npm run build` — Next.js 16 production build succeeds, all 8 routes generate.
- `git diff --exit-code package.json package-lock.json src/lib/db/schema.ts src/domain/tax` — clean: **the tax engine, bracket table, dependency manifest, and database schema were left byte-unchanged** by this plan.

## Decisions Made

See `key-decisions` in the frontmatter above (three decisions: the third `kind` parameter's default, the `isEstimated`-conditioned form default, and the throwaway-Node-check-first approach to every asserted calendar date).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `YtdForm`'s as-of default literally following "supplied `defaultAsOfDate` when present" would never surface today's date for the exact case SAL-03 targets**
- **Found during:** Task 3
- **Issue:** The plan's `<action>` text for Task 3 reads "Default the as-of value to the supplied `defaultAsOfDate` when present and otherwise to `todayIsoInMoscow()`." Both call sites (`onboarding/page.tsx`, `settings/salary/page.tsx`) always pass a defined `defaultAsOfDate` — `getYtdBaseline` never returns null, so a user without a real baseline still gets a synthesized row with `asOfDate` set to 1 January. A literal present/absent fallback would therefore leave the pre-fill at 1 January for exactly the mid-year-signup user the SAL-03 truth is about, never falling through to `todayIsoInMoscow()` in practice.
- **Fix:** Conditioned the default on the already-passed `isEstimated` prop instead: use the caller's `defaultAsOfDate` only when `isEstimated` is explicitly `false` (a real, previously-confirmed baseline); otherwise default to `todayIsoInMoscow()`. This satisfies the literal wording as a special case (when `isEstimated` is omitted by some future caller, the code falls back to the same "present ?? today" behavior the plan describes) while actually achieving the stated truth for the two real call sites.
- **Files modified:** `src/components/pay-setup-forms.tsx`
- **Verification:** `grep -n 'todayIsoInMoscow()'` and the absence of `-01-01` in the file (acceptance-criteria greps); full suite/typecheck/lint/build green.
- **Commit:** `dc87d78`

---

**Total deviations:** 1 auto-fixed (Rule 1 — correctness fix to match the plan's own stated truth over its own literal implementation wording).
**Impact on plan:** No scope creep; the fix is confined to the same single file and prop the plan already named, and does not touch `SalaryForm`, `ScheduleForm`, either Server Action, or the repository's synthesized default baseline, exactly as the plan required.

## Known Stubs

None. Every code path introduced or modified in this plan is wired to real data; no placeholder, hardcoded-empty, or "coming soon" value was added.

## Issues Encountered

None beyond the deviation documented above.

## Authentication Gates

None encountered — this plan touches no auth surface.

## Human Verification Required (carried forward, not resolved by this plan)

1. **SAL-03 visual confirmation (this plan's own `<verify>` human-check):** open the onboarding YTD step in a real browser and confirm the as-of field pre-fills with today's Moscow date, and the helper copy reads as income from 1 January through that date. No DOM test environment exists in this project (prohibited by this plan) and no browser was available in this execution sandbox.
2. **AUTH-02 two-browser cross-device confirmation:** unchanged from prior plans — edit salary/schedule/YTD in one independent browser profile and verify the other shows identical data after reload, including the now-accrual-aware forecast figure.
3. **01-REVIEW.md WR-01** (schedule and YTD Server Action rejections surface as unhandled event-handler rejections): confirmed still open — not in `01-VERIFICATION.md`'s `gaps` block and therefore explicitly out of scope for this gap-closure round, per the plan's own "Flagged assumptions" section. Recorded here so it is not silently lost.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

The phase's central correctness defect (stale cumulative-income baseline) is closed: `getCumulativeIncomeBeforeDate` now derives a real accrued figure from the user's own schedule and salary history, and a frozen-clock integration test proves the displayed tax responds to it. Phases 2 (bonuses) and 3 (vacation pay) can build on `src/domain/pay/payment-accrual.ts`'s established pattern (pure engine, composed by the repository) when they extend cumulative income with their own event types — matching `01-RESEARCH.md`'s "cumulative income as a derived value over an ordered ledger, never a mutable counter" guidance that this plan's prohibitions explicitly protected.

Three items remain open, unresolved by this plan (all pre-existing, all listed above): AUTH-02's two-browser check, this plan's own SAL-03 visual confirmation, and 01-REVIEW.md WR-01. None blocks re-running phase verification; a fresh `/gsd-verify-work` run should now find `TAX-01`, `TAX-02`, `HOME-01`, and `SAL-03` satisfied at the automated level.

## Self-Check: PASSED

- FOUND: `src/domain/pay/payment-accrual.ts`
- FOUND: `src/domain/pay/payment-accrual.test.ts`
- Commit `42dc7f7` — found in `git log --oneline --all`
- Commit `32863c9` — found in `git log --oneline --all`
- Commit `52bf6d8` — found in `git log --oneline --all`
- Commit `99b6e34` — found in `git log --oneline --all`
- Commit `dc87d78` — found in `git log --oneline --all`

---
*Phase: 01-core-payroll-loop*
*Completed: 2026-08-29*
