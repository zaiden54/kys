---
phase: 01-core-payroll-loop
plan: 05
subsystem: payroll
tags: [nextjs, server-components, forecast, ndfl, vitest]

# Dependency graph
requires:
  - phase: 01-core-payroll-loop (Plan 03)
    provides: "src/domain/tax/calculate-ndfl.ts (calculateNdfl, UnsupportedTaxYearError) and src/domain/schedule/resolve-payment-date.ts (nextPaymentOnOrAfter)"
  - phase: 01-core-payroll-loop (Plan 04)
    provides: "src/lib/db/salary-repository.ts (getActiveSalaryAt, getSchedule, getYtdBaseline, getCumulativeIncomeBeforeDate), requireUserId()"
provides:
  - "src/app/actions/forecast.ts: forecastNextPayment(userId) — the single orchestration site folding the schedule and tax domain engines over a user's own rows into a NextPaymentForecast or a precise not-configured result"
  - "src/components/next-payment-card.tsx and src/components/ytd-estimate-banner.tsx: server components rendering the computed forecast and the D-11 persistent estimated-baseline warning"
  - "src/app/(app)/page.tsx: the home screen, now the phase's vertical-slice payoff — next payment date + take-home amount for a configured user, missing-config prompt otherwise"
affects: [02, 03, 04]

# Actuals (#2632)
actuals:
  tokens: 4523
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-home split rule: halfSplitGross(monthlyGrossKopecks) is the one function implementing the Task 1 half-split decision — swappable for a configurable-percent model later without touching forecastNextPayment's orchestration"
    - "Not-configured is a distinct return branch, never a computed-against-zero forecast: forecastNextPayment returns { configured: false, missing: 'salary' | 'schedule' } rather than inventing a zero-salary result"
    - "server-only guard equivalent (window-check) continued into src/app/actions/forecast.ts, matching src/lib/session.ts and src/lib/db/salary-repository.ts — this module carries no \"use server\" directive since it is called directly from a server component's render, never as a client-invoked Server Action"

key-files:
  created:
    - src/app/actions/forecast.ts
    - src/app/actions/forecast.test.ts
    - src/components/next-payment-card.tsx
    - src/components/ytd-estimate-banner.tsx
  modified:
    - src/app/(app)/page.tsx

key-decisions:
  - "Task 1 (resumed from checkpoint): monthly gross oklad splits 50/50 across avans and salary — human-selected half-split option; no schema change, each payment taxed independently at its own date, annual total = oklad × 12"
  - "Task 1's decision implemented as a single named helper (halfSplitGross) rather than inlined arithmetic, per the plan's explicit instruction to keep the rule swappable"
  - "Task 3 human-check performed via an uncommitted ad hoc script (sign-up + direct SQL writes + fetch against the live dev server) rather than a real browser, matching the same no-browser-access limitation already documented in 01-02/01-03/01-04's summaries — see Next Phase Readiness"

patterns-established:
  - "Forecast orchestration returns a discriminated ForecastResult union ({configured:true,...}|{configured:false,missing}) consumed directly by the RSC — no client-side branching on raw nulls"

requirements-completed: [HOME-01, TAX-01, TAX-02, SAL-03]

coverage:
  - id: D1
    description: "forecastNextPayment(userId) folds getSchedule -> nextPaymentOnOrAfter -> getActiveSalaryAt(paymentDate) -> getCumulativeIncomeBeforeDate/getYtdBaseline -> calculateNdfl(taxYear = payment date's year) in that exact order, returning the configured forecast or precisely what is missing; UnsupportedTaxYearError propagates uncaught"
    requirement: "TAX-02"
    verification:
      - kind: integration
        ref: "src/app/actions/forecast.test.ts (6/6 tests: date/net match calculateNdfl+nextPaymentOnOrAfter, salary-missing, schedule-missing, estimated-baseline zero cumulative, non-zero baseline yields strictly more tax on identical gross, future-dated salary has no effect)"
        status: pass
      - kind: other
        ref: "Task 2 <verify> automated node assertion script (server-only guard, no console calls, all five domain/repository calls present, forecastNextPayment exported, UnsupportedTaxYearError not caught)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Home screen renders the correct state for each forecast outcome: not-configured prompt naming exactly what is missing (schedule checked first, then salary) with no money value at all, configured card with gross/withheld-НДФЛ/take-home, and the D-11 persistent banner appearing only while the baseline is estimated and disappearing once a confirmed baseline exists — no dismiss control anywhere"
    requirement: "HOME-01"
    verification:
      - kind: other
        ref: "Task 3 <verify> automated node assertion script (page/banner stay server components, no calculateNdfl/taxOnCumulative in presentation layer, banner carries no dismiss/localStorage/sessionStorage) + npm run build + npx tsc --noEmit + npx vitest run (58/58)"
        status: pass
      - kind: integration
        ref: "uncommitted ad hoc script: fresh sign-up, direct SQL writes to payment_schedule/salary_history/ytd_baseline, authenticated fetch against a live dev server — 5/5 assertions pass (schedule-missing prompt with no money value, salary-missing prompt, D-11 banner present with no salary baseline, banner gone once a confirmed baseline exists, no D-15 wording anywhere)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Full interactive human-verify flow: banner persists across a real page reload, the resolved date is correct against a real calendar for a weekend/holiday day (D-02), the card's wording genuinely reads as a non-official forecast, a future salary change produces no visible indicator anywhere (D-15, visual confirmation), and the AUTH-02 two-browser cross-device parity check"
    verification: []
    human_judgment: true
    rationale: "This execution sandbox has no browser available to the executor — the same limitation already documented in 01-02-SUMMARY.md (D4), 01-03-SUMMARY.md (D4), and 01-04-SUMMARY.md (D6). The Task 3 <human-check> block's 7 steps enumerate this manual verification plan explicitly. D2's automated/ad-hoc substitutes prove the structural and data-driven behavior; what remains is genuinely visual/interactive judgment."

# Metrics
duration: 12min
completed: 2026-08-28
status: complete
---

# Phase 1 Plan 5: Next-Payment Forecast and Home Screen Summary

**Server-rendered home screen showing the date and correctly-taxed take-home amount of the user's next payment, computed by `forecastNextPayment()` folding the progressive НДФЛ engine and the payment-date resolver over the user's own salary/schedule/YTD rows via a half-split avans/salary gross rule.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-28T20:46:00Z (resume point — Task 1 already resolved, no prior code)
- **Completed:** 2026-08-28T20:58:05Z
- **Tasks:** 3 (Task 1 was a `checkpoint:decision` resolved by the human before this execution resumed — no code; Tasks 2-3 committed)
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- `src/app/actions/forecast.ts` — `forecastNextPayment(userId)`, the phase's single orchestration site: schedule → next payment event → salary effective on that payment's own date (D-15) → half-split gross (Task 1) → cumulative-before + estimated flag → `calculateNdfl` keyed to the payment date's own tax year. Not-configured is a distinct branch naming what is missing, never a computed-against-zero forecast.
- `src/app/actions/forecast.test.ts` — 6 integration scenarios against the live Neon DB, including the bracket-straddling proof that a non-zero YTD baseline produces strictly more tax on identical gross than a zero baseline, and the D-15 proof that a future-dated salary row has no effect on an earlier payment.
- `src/components/next-payment-card.tsx` — server component showing date (ru-RU), avans/salary kind, gross, withheld НДФЛ, and take-home, worded explicitly as a forecast rather than an official/employer-confirmed figure.
- `src/components/ytd-estimate-banner.tsx` — persistent, non-dismissible D-11 banner with no browser-storage state, rendered by the home page only while `baselineIsEstimated` is true.
- `src/app/(app)/page.tsx` — replaced the Plan 01-02 walking-skeleton body with the real forecast render: not-configured prompt (no money value at all) or banner + card.
- All 58 project Vitest tests pass; `npm run build` and `npx tsc --noEmit` both exit 0; both tasks' automated grep/node assertion scripts pass; an uncommitted ad hoc script proved the render states against a live dev server (see Deviations).

## Task Commits

1. **Task 1: Decide the avans/salary gross split** — no commit (`checkpoint:decision`, resolved by the human as `half-split` before this execution resumed).
2. **Task 2: Server-side next-payment forecast orchestration** — `3225e61` (feat)
3. **Task 3: Home screen — next-payment card, D-11 banner, not-configured prompt** — `8b58959` (feat)

**Plan metadata:** committed immediately after this file.

## Files Created/Modified
- `src/app/actions/forecast.ts` - `forecastNextPayment`, `NextPaymentForecast`, `ForecastResult`, `halfSplitGross`
- `src/app/actions/forecast.test.ts` - 6-scenario integration suite
- `src/components/next-payment-card.tsx` - next-payment display card
- `src/components/ytd-estimate-banner.tsx` - persistent D-11 banner
- `src/app/(app)/page.tsx` - home screen, now calling `requireUserId()` → `forecastNextPayment`

## Decisions Made
- Task 1 (resumed): the monthly gross oklad splits **50/50** across the avans and salary payments — the human-selected `half-split` option. No schema change; each payment is taxed independently at its own date; the annual total across twelve months is exactly `oklad × 12`.
- The split rule is implemented as a single named helper (`halfSplitGross`), not inlined, so it stays the one place the rule lives and can be swapped for a configurable-percent model later without touching the surrounding orchestration.
- `forecastNextPayment` checks the schedule before the salary (matching the plan's explicit ordering), so a user with neither configured sees the schedule-missing prompt first.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A doc comment in `page.tsx` accidentally violated its own D-15 grep assertion**
- **Found during:** Task 3, running the plan's own `<verify>` node assertion script
- **Issue:** An explanatory comment describing why no "upcoming raise" indicator exists literally contained the words "upcoming" and "raise", which the plan's own acceptance-criteria grep (`grep -rn "upcoming\|повышени\|raise" ...`) is designed to catch regardless of whether the match is in code or a comment.
- **Fix:** Reworded the comment to describe the same D-15 behavior without using the flagged substrings.
- **Files modified:** `src/app/(app)/page.tsx`
- **Verification:** `grep -rn "upcoming\|повышени\|raise" "src/app/(app)/page.tsx" src/components/next-payment-card.tsx` returns no matches; full verify chain (build/tsc/vitest/node assertion) re-run and passed
- **Committed in:** `8b58959` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — a self-inflicted grep false-positive in a comment, not a logic bug)
**Impact on plan:** No scope creep, no architectural change, no behavior change — comment wording only.

## Issues Encountered
- The Task 3 `<human-check>` block (7 interactive steps: not-configured prompt visual check, D-11 banner display + no-dismiss + reload persistence, YTD entry lowering the amount, card wording read, D-15 no-raise-indicator visual check, D-02 weekend/holiday date cross-check, and the AUTH-02 two-browser parity check) could not be performed by a human in this session — this execution sandbox has no browser, the same limitation already documented in 01-02/01-03/01-04's summaries. As partial substitute confidence, an uncommitted ad hoc script (fresh sign-up, direct SQL writes to `payment_schedule`/`salary_history`/`ytd_baseline`, authenticated `fetch` against the already-running live dev server) proved 5/5 assertions: schedule-missing prompt with no money value, salary-missing prompt, D-11 banner present with an estimated baseline, banner gone once a confirmed baseline exists, and no D-15 wording anywhere in the rendered output. The genuinely visual/interactive parts remain flagged in `coverage.D3` with `human_judgment: true`.
- This execution ran sequentially (no worktree isolation) alongside a concurrent `next dev` server already bound to port 3000 from another session, per this execution's `<sequential_execution>` context (pre-approved). The ad hoc verification script targeted that existing server rather than starting a duplicate; a redundant instance this executor briefly started on port 3001 was killed immediately.

## User Setup Required

None - no external service configuration required for this plan's scope.

## Next Phase Readiness
- Phase 1 (Core Payroll Loop)'s full vertical slice is now complete: registration/login (01-02) → salary/schedule/YTD input (01-04) → this plan's server-computed next-payment forecast on the home screen (01-05), all sitting on the pure tax/schedule domain engines from 01-03.
- **This is the final plan in Phase 01 — all five plans (01-01 through 01-05) now have SUMMARY.md files. Phase 01 execution is complete.**
- **Carried-forward blockers (unchanged from 01-02/01-03/01-04, not addressed by this plan):**
  - Two-browser AUTH-02 cross-device check (all four prior plans + this one) — no browser access in any execution session so far.
  - D-06/D-08 visual confirmation (01-02).
  - НДФЛ bracket primary-statute confirmation against ст.224 НК РФ text (01-03) — `curl` to consultant.ru/pravo.gov.ru unreachable from every sandbox used so far.
  - Task 3 `<human-check>` in this plan (D-11 reload persistence, D-02 real-calendar date check, D-15 visual confirmation, card wording read) — automated/ad-hoc substitutes performed and passed, but no human has yet looked at a real browser.
  - Recommend a single human UAT session covering all of the above before `/gsd-verify-work` on this phase — they overlap heavily (same account, same browser session could cover several at once).
- No other blockers identified. Phase 02 can proceed once this phase's UAT session (or an explicit decision to defer it) is resolved.

---
*Phase: 01-core-payroll-loop*
*Completed: 2026-08-28*

## Self-Check: PASSED

- All 4 created files (`src/app/actions/forecast.ts`, `src/app/actions/forecast.test.ts`, `src/components/next-payment-card.tsx`, `src/components/ytd-estimate-banner.tsx`) and the 1 modified file (`src/app/(app)/page.tsx`) verified present on disk with `[ -f ]`.
- Both task commit hashes (`3225e61`, `8b58959`) verified present via `git log --oneline --all`.
- Plan-level `<verification>` re-run: `npx vitest run` — 58/58 pass; `npm run build` and `npx tsc --noEmit` both exit 0; the presentation-layer assertion (no `calculateNdfl`/`taxOnCumulative` in `page.tsx`/`next-payment-card.tsx`) passes; the D-11 assertion (banner is a server component, no dismiss control, no browser-storage call) passes.
- Task 3 `<human-check>` NOT performed by a human in this session (no browser access) — recorded as `human_judgment: true` in `coverage.D3` and in "Next Phase Readiness," not silently marked complete. An uncommitted ad-hoc read-path substitute (`coverage.D2`) was run and passed 5/5.
