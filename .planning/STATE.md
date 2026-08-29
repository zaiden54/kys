---
gsd_state_version: 1.0
current_phase: 01
current_phase_name: Core Payroll Loop
status: executing
stopped_at: Completed 01-07-PLAN.md
last_updated: "2026-08-29T08:44:18.856Z"
last_activity: 2026-08-29
last_activity_desc: Phase 01 execution started
state_head: 3db934942b5095f904ed67f8653bdb6b63984a85
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 8
  completed_plans: 7
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-28)

**Core value:** Пользователь может заранее и точно спланировать бюджет, зная сумму и дату ближайшей выплаты зарплаты на руки.
**Current focus:** Phase 01 — Core Payroll Loop

## Current Position

Phase: 01 (Core Payroll Loop) — EXECUTING
Plan: 8 of 8
Status: Ready to execute
Last activity: 2026-08-29 — Completed 01-07-PLAN.md

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

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

### Pending Todos

None yet.

### Blockers/Concerns

- Research flag (Phase 1): confirm exact 2025 НДФЛ bracket thresholds and the ст.139 ТК РФ 29.3 divisor against primary НК РФ/ТК РФ legal text before implementing the tax/vacation engines — see research/PITFALLS.md and research/SUMMARY.md
- Research flag (Phase 1): unresolved product decision on mid-year onboarding UX (SAL-03) — no authoritative source, needs explicit design during plan-phase
- Research flag (Phase 4): iOS PWA install/storage-jar behavior must be verified on a real iPhone device, not emulator, before considered done
- Manual UAT pending for Plan 01-02 Task 3: two-real-browser cross-device check (AUTH-02) plus visual confirmation of D-06 (no verification step) and D-08 (no forgot-password link). Flagged in 01-02-SUMMARY.md coverage.D4 (human_judgment: true). Recommended before /gsd-verify-work on this phase.
- Task 1 human-check (confirming 2025 НДФЛ brackets against primary НК РФ ст.224 statute text) could not be performed — no live web access in this execution sandbox (curl to consultant.ru and pravo.gov.ru both failed to connect)

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-08-29T08:44:18.828Z
Stopped at: Completed 01-07-PLAN.md
Resume file: None
