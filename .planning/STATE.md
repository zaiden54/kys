---
gsd_state_version: 1.0
current_phase: 04
current_phase_name: Annual Overview & PWA Installability
status: executing
stopped_at: Completed 04-01-PLAN.md
last_updated: "2026-08-31T07:41:09.250Z"
last_activity: 2026-08-31
last_activity_desc: Phase 04 execution started
state_head: 419b1466e1e796e49015146cd8d4508d17e283a7
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 22
  completed_plans: 21
  percent: 75
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-31)

**Core value:** Пользователь может заранее и точно спланировать бюджет, зная сумму и дату ближайшей выплаты зарплаты на руки.
**Current focus:** Phase 04 — Annual Overview & PWA Installability

## Current Position

Phase: 04 (Annual Overview & PWA Installability) — EXECUTING
Plan: 2 of 2
Status: Ready to execute
Last activity: 2026-08-31 — Phase 04 execution started

Progress: [████████░░] 75%

## Performance Metrics

**Velocity:**

- Total plans completed: 20
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 12 | - | - |
| 02 | 4 | - | - |
| 03 | 4 | - | - |

**Recent Trend:**

- Last 5 plans: none yet
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 40 min | 2 tasks | 30 files |
| Phase 01 P02 | 35 min | 3 tasks | 11 files |
| Phase 01-core-payroll-loop P03 | 35min | 2 tasks | 8 files |
| Phase 01-core-payroll-loop P04 | 45min | 3 tasks | 9 files |
| Phase 01 P05 | 12min | 3 tasks | 5 files |
| Phase 01 P06 | 20min | 2 tasks | 9 files |
| Phase 01 P07 | 15min | 2 tasks | 3 files |
| Phase 01 P08 | 15min | 3 tasks | 7 files |
| Phase 01 P09 | 18min | 2 tasks | 6 files |
| Phase 01 P10 | 40min | 3 tasks | 8 files |
| Phase 01 P12 | 7min | 2 tasks | 6 files |
| Phase 01 P11 | 20min | 3 tasks | 8 files |
| Phase 02 P01 | 10min | 3 tasks | 13 files |
| Phase 02 P02 | 5min | 2 tasks | 8 files |
| Phase 02 P03 | 15min | 3 tasks | 8 files |
| Phase 02 P04 | 28min | 3 tasks | 5 files |
| Phase 03 P01 | 25min | 2 tasks | 6 files |
| Phase 03 P02 | 20min | 2 tasks | 11 files |
| Phase 03 P03 | 20min | 2 tasks | 6 files |
| Phase 03 P04 | 45min | 2 tasks | 9 files |
| Phase 04 P01 | 20min | 2 tasks | 10 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Progressive НДФЛ engine and vacation-pay engine must be built correctness-first (pure, isolated, heavily unit-tested) but delivered as part of end-to-end vertical slices (Vertical MVP mode) rather than as a standalone horizontal "engine phase"
- Roadmap: Annual overview (HOME-02) deferred to Phase 4 since it requires the full income picture (salary + bonuses + vacation) from Phases 1-3 to reconcile correctly
- [Phase 01]: Pinned typescript to exact 6.0.3 (no caret) and used --legacy-peer-deps for a benign @hookform/resolvers/@typeschema optional-peer conflict with zod 4 — Matches CLAUDE.md's locked stack and typescript-eslint compatibility constraint; the peer conflict was on an unused optional adapter path, not a real incompatibility
- [Phase 01]: Amended .gitignore's blanket .env* pattern with !.env.example so the placeholder env file stays trackable — create-next-app's default .gitignore silently excluded .env.example, contradicting the plan's explicit intent to commit it
- [Phase 01]: [Phase 01-02]: No new npm packages installed — server-only guard implemented as a runtime window-check equivalent, avoiding a package-legitimacy checkpoint — Matches the plan's explicit "server-only guard or an equivalent" language; any new package install requires a human-verify checkpoint per executor deviation rules
- [Phase 01]: [Phase 01-02]: Deleted create-next-app's default src/app/page.tsx — Collided with the new src/app/(app)/page.tsx route for '/' since route groups add no URL segment
- [Phase 01]: [Phase 01-02]: verify-auth-flow.mjs sends an explicit Origin header on POST /api/auth/* — Better Auth's CSRF check rejects requests without an Origin header, which Node's fetch does not send automatically like a browser does
- [Phase 01]: Corrected two plan-authored test expectations in resolve-payment-date.test.ts to match the actually-installed date-holidays@3.36.0 RU calendar data (2026-02-28 Feb clamp case is a real Saturday requiring an extra D-02 shift; the New Year holiday chain example was moved from dayOfMonth=10 to dayOfMonth=3 since Jan 9 2026 is a genuine working Friday in the library's fixed rule set) — no implementation logic changed, only the test's asserted dates — Verified directly by inspecting date-holidays.isHoliday() output day-by-day; ensures the domain engine's test suite reflects real library behavior rather than an unverified illustrative example
- [Phase 01]: Phase 01: Monthly gross oklad splits 50/50 across avans and salary payments (Task 1, resumed checkpoint) — no schema change, each payment taxed independently at its own date
- [Phase 01]: Phase 01-05: forecastNextPayment returns a distinct not-configured branch naming exactly what is missing (salary or schedule), never a computed-against-zero forecast
- [Phase 01]: [Phase 01-06]: Corrected 01-PATTERNS.md's nowInMoscow() sketch from UTC-accessor to local-accessor shape before implementation — the sketch was only correct on a UTC host and silently wrong on any other host timezone, including an MSK dev machine
- [Phase 01]: [Phase 01-06]: Found and fixed a seventh CR-01 call site beyond 01-VERIFICATION.md's five-site artifact list (pay-setup-forms.tsx YtdForm currentYearStart)
- [Phase 01]: [Phase 01-07]: replaceSalaryAt/upsertSchedule/upsertYtdBaseline rewritten as single onConflictDoUpdate statements — Closes CR-02/SAL-02 and WR-01: removes the non-atomic delete-then-insert/select-then-branch race windows; proven under live Promise.all concurrency tests against the real Neon database; zero new dependencies
- [Phase 01]: [Phase 01-08]: MAX_VERIFIED_TAX_YEAR left at 2026 while correcting the false statute-verification comment -- lowering it would be a live outage, not a fix; the primary НК РФ ст.224 confirmation remains an open human_verification item
- [Phase 01]: [Phase 01-08]: halfSplitGross rewritten as kind-aware floor/remainder split so avans+salary always reconcile to the monthly gross, closing a one-kopeck drift on odd-kopeck amounts (WR-02)
- [Phase 01]: [Phase 01-08]: Added live database check() constraints (salary_gross_amount_positive, ytd_amount_nonnegative) as a second gate behind Zod; applied via drizzle-kit push after confirming zero pre-existing violating rows and a statement list containing only the two expected ADD CONSTRAINT statements
- [Phase 01]: Phase 01-09: validate salary at persisted precision with Math.round(value * 100) > 0, preserving exact 0.005 rubles as valid
- [Phase 01]: Phase 01-09: repository and client action failures use fixed generic Russian retry messages without inspecting or exposing caught details
- [Phase 01]: Phase 01-10: getCumulativeIncomeBeforeDate gained an optional third kind parameter defaulting to "avans", preserving pre-01-10 two-argument call semantics while composing the applicable YTD baseline with a real accrued-event sum from the new pure payment-accrual engine
- [Phase 01]: Phase 01-10: YtdForm's as-of default is conditioned on isEstimated (today in Moscow for an unconfirmed baseline, the stored date for a confirmed one) rather than literally following the plan's present/absent wording, since both real call sites always pass a defined but stale 1-January defaultAsOfDate for unconfirmed baselines
- [Phase 02]: Phase 2 ROADMAP.md Goal line required no edit — already committed in valid user-story format by a prior session (79a253d); Task 1 verification-only.
- [Phase 02]: WR-01 regression test uses a 2025/2026 year pair (not 2026/2027) since 2027 exceeds MAX_VERIFIED_TAX_YEAR.
- [Phase 02]: [02-04] CR-01 (BonusRow edit-form silently resubmitting stale data) closed via React Hook Form `values: toDefaults(bonus)` + explicit `reset()` on Cancel and onEdit success; added jsdom + @testing-library/react as new devDependencies (first render-based test infra in this project) to prove it with real DOM behavior, not AST pattern-matching.
- [Phase 02]: [re-review] The 02-04 fix reintroduced CR-01 in a new spot (`onEdit` success path resetting to the stale pre-save `bonus` prop instead of the just-submitted `values`) — caught by a second, independent code review after gap-closure, not by the phase verifier (whose must_haves only covered the two originally-reported failure paths). Fixed via `gsd-code-fixer` (`reset(values)`, `resetOptions: { keepDirtyValues: true }` for WR-01, an `editSessionRef` guard for WR-02). Lesson: a bug-class fix on a form-resync pattern deserves a full re-review, not just a check against the original repro steps.
- [Phase 03]: [Phase 03][03-01]: 12-month vacation-pay lookback window excludes the vacation's own start month (corrects an off-by-one in 03-RESEARCH.md's pseudocode)
- [Phase 03]: [Phase 03][03-01]: Mid-month salary-change proration weights each segment by its real share of the month's actual calendar days, not a flat 29.3-day segment count — departs from 03-RESEARCH.md's literal pseudocode since that formula cannot reproduce the plan's own locked exact-value test targets
- [Phase 03]: [Phase 03][03-02]: saveBonusAction's type parse uses formData.get("type") || undefined (not the raw null) so Zod's .default("premium") actually applies when the field is absent, matching the existing id-field pattern
- [Phase 03]: [Phase 03][03-02]: bonus-row.tsx's edit-mode type selector uses aria-label (no visible label), matching that form's existing unlabeled-input convention; bonus-form.tsx's create-mode selector uses a visible label, matching its own pattern
- [Phase 03]: [Phase 03][03-03]: Vacations carry no note field — dropped from every repository/validation signature per the plan's own resolved design decision
- [Phase 03]: [Phase 03][03-03]: checkOverlapVacations uses inclusive-boundary overlap semantics — a shared boundary day counts as an overlap (D-V11)
- [Phase 03]: [Phase 03][03-03]: vacationAccruedKopecks is always recomputed live in getCumulativeIncomeBeforeDate, never stored, so a later salary/bonus edit automatically updates every affected forecast
- [Phase 03]: [Phase 03][03-04]: selectNextPaymentEvent's three-way tie-break (schedule beats bonus beats vacation) implemented via fixed push order + stable sort, not an explicit comparator chain
- [Phase 03]: [Phase 03][03-04]: A vacation-only forecast event never populates breakdown or combines with a same-date bonus — by construction of the tie-break rule this never loses real data
- [Phase 03]: [Phase 03][03-04]: Task 1's vacation.ts/vacations/page.tsx written and isolation-verified in genuine create-only form before Task 2 extended them, preserving per-task commit atomicity despite both tasks touching the same two files
- [Phase 04]: [Phase 04][04-01]: resolveBaselineWindow extracted from computeCumulativeIncome (pure refactor) so computeAnnualSummary's whole-year walk and forecastNextPayment's single-event path share one baseline-applicability formula, never independently drift apart.
- [Phase 04]: [Phase 04][04-01]: AnnualPieChart renders exactly 2 Recharts Cell slices (Налог/На руки, not a third Грязными wedge) since a gross wedge would double-count the total and push displayed percentages to 200% -- corrects a bug 04-RESEARCH.md's own illustrative example had introduced.

### Pending Todos

None yet.

### Blockers/Concerns

- Research flag (Phase 1): confirm exact 2025 НДФЛ bracket thresholds and the ст.139 ТК РФ 29.3 divisor against primary НК РФ/ТК РФ legal text before implementing the tax/vacation engines — see research/PITFALLS.md and research/SUMMARY.md
- Research flag (Phase 1): unresolved product decision on mid-year onboarding UX (SAL-03) — no authoritative source, needs explicit design during plan-phase
- Research flag (Phase 4): iOS PWA install/storage-jar behavior must be verified on a real iPhone device, not emulator, before considered done
- [Phase 1, resolved 2026-08-29] Manual UAT for cross-device convergence and confirmation-prompt snapshot behavior completed via 01-UAT.md — 3/3 passed.
- [Phase 1] Statute verification still outstanding: 2025 НДФЛ bracket thresholds (НК РФ ст.224) have not been confirmed against primary legal text — no live web access in this execution sandbox (curl to consultant.ru and pravo.gov.ru both failed to connect). NDFL_SCALES ordering/values are code-verified but not statute-cross-checked (see T-01-08-04 in 01-SECURITY.md). Confirm before relying on exact bracket numbers in production.
- [Phase 2, low severity] BonusRow's `keepDirtyValues: true` (WR-01 fix) narrows but does not fully close the possibility of submitting a value based on a premise that changed underneath the user during a concurrent cross-device edit — no inline conflict notice was added; this was a deliberate scope choice (02-REVIEW-FIX.md), not an oversight. Revisit if concurrent multi-device editing of the same bonus turns out to be a real usage pattern.
- [Phase 3, 03-04] Browser-based manual UAT (03-VALIDATION.md Manual-Only Verifications row) not click-through-performed in this autonomous session — recorded as an open unrun-verify entry in .planning/WINDOWS.md; substituted with npm run build + full 315-test automated suite. A human should complete the walkthrough before considering Phase 3 UAT fully closed.
- [Phase 4, 04-01] AnnualPieChart's real-browser rendering (donut proportions/colors/legibility) not click-through-verified in this autonomous session -- recorded as open unrun-verify entry #2 in .planning/WINDOWS.md; substituted with jsdom render tests, a Cell-count structural check, and npm run build. A human should visually confirm the chart before phase close-out.

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-08-31T07:40:56.671Z
Stopped at: Completed 04-01-PLAN.md
Resume file: None
