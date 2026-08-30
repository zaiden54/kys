---
gsd_state_version: 1.0
current_phase: 3
current_phase_name: Vacation Pay
status: planning
stopped_at: Phase 02 complete, ready to plan Phase 3
last_updated: "2026-08-30T16:39:10.676Z"
last_activity: 2026-08-30
last_activity_desc: Phase 02 complete, transitioned to Phase 3
state_head: 9971967b86857e6ff0f2acffeb00824a5c7c50dd
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 16
  completed_plans: 16
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-30)

**Core value:** Пользователь может заранее и точно спланировать бюджет, зная сумму и дату ближайшей выплаты зарплаты на руки.
**Current focus:** Phase 3 — Vacation Pay

## Current Position

Phase: 3 — Vacation Pay
Plan: Not started
Status: Ready to plan
Last activity: 2026-08-30 — Phase 02 complete, transitioned to Phase 3

Progress: [█████░░░░░] 50%

## Performance Metrics

**Velocity:**

- Total plans completed: 16
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 12 | - | - |
| 02 | 4 | - | - |

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

### Pending Todos

None yet.

### Blockers/Concerns

- Research flag (Phase 1): confirm exact 2025 НДФЛ bracket thresholds and the ст.139 ТК РФ 29.3 divisor against primary НК РФ/ТК РФ legal text before implementing the tax/vacation engines — see research/PITFALLS.md and research/SUMMARY.md
- Research flag (Phase 1): unresolved product decision on mid-year onboarding UX (SAL-03) — no authoritative source, needs explicit design during plan-phase
- Research flag (Phase 4): iOS PWA install/storage-jar behavior must be verified on a real iPhone device, not emulator, before considered done
- [Phase 1, resolved 2026-08-29] Manual UAT for cross-device convergence and confirmation-prompt snapshot behavior completed via 01-UAT.md — 3/3 passed.
- [Phase 1] Statute verification still outstanding: 2025 НДФЛ bracket thresholds (НК РФ ст.224) have not been confirmed against primary legal text — no live web access in this execution sandbox (curl to consultant.ru and pravo.gov.ru both failed to connect). NDFL_SCALES ordering/values are code-verified but not statute-cross-checked (see T-01-08-04 in 01-SECURITY.md). Confirm before relying on exact bracket numbers in production.
- [Phase 2, low severity] BonusRow's `keepDirtyValues: true` (WR-01 fix) narrows but does not fully close the possibility of submitting a value based on a premise that changed underneath the user during a concurrent cross-device edit — no inline conflict notice was added; this was a deliberate scope choice (02-REVIEW-FIX.md), not an oversight. Revisit if concurrent multi-device editing of the same bonus turns out to be a real usage pattern.

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-08-30T16:41:26.000Z
Stopped at: Phase 02 complete (gap-closure 02-04 + CR-01 re-review/fix cycle), ready to plan Phase 3
Resume file: None
