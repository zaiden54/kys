---
phase: 1
slug: core-payroll-loop
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-28
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (locked in `.claude/CLAUDE.md`) |
| **Config file** | none yet — Wave 0 installs `vitest.config.ts` |
| **Quick run command** | `npx vitest run domain/tax domain/schedule` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds (pure-function unit tests only in Phase 1; no browser/e2e runner yet) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run domain/` (fast, pure-function subset)
- **After every plan wave:** Run `npx vitest run` (full suite, including any DB-touching integration tests)
- **Before `/gsd-verify-work`:** Full suite must be green; AUTH-02's manual second-device check must be explicitly performed and recorded (no automated coverage path exists for it)
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

*Task IDs are assigned by the planner — not yet known at this draft stage. Requirement-level mapping below (from 01-RESEARCH.md § Phase Requirements → Test Map) is the seed the planner must translate into `{N}-01-01`-style task IDs and `<verify>`/`<acceptance_criteria>` fields.*

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| TAX-01 | Bracket-boundary-straddling payment splits correctly across 2.4M/5M/20M/50M ₽ thresholds | unit | `npx vitest run domain/tax/calculate-ndfl.test.ts` | ❌ Wave 0 | ⬜ pending |
| TAX-01 | Rounding matches ст.52 НК РФ (< 50 kop drop, ≥ 50 kop round up) on cumulative tax, not per-payment | unit | `npx vitest run domain/tax/calculate-ndfl.test.ts` | ❌ Wave 0 | ⬜ pending |
| TAX-02 | Avans and salary each independently increase cumulative base and are each taxed via the delta method | unit | `npx vitest run domain/tax/calculate-ndfl.test.ts` | ❌ Wave 0 | ⬜ pending |
| SAL-01 | Day-of-month clamps to last valid day (D-03); e.g. day=31 in a 30-day month → 30th | unit | `npx vitest run domain/schedule/resolve-payment-date.test.ts` | ❌ Wave 0 | ⬜ pending |
| SAL-01 | Payment date shifts earlier off a weekend/RU holiday (D-02) | unit | `npx vitest run domain/schedule/resolve-payment-date.test.ts` | ❌ Wave 0 | ⬜ pending |
| SAL-02 | Backdated salary change with exact-date collision overwrites the prior row, no audit trail (D-14) | integration | `npx vitest run lib/db/salary-history.test.ts` (requires test DB or Neon branch) | ❌ Wave 0 | ⬜ pending |
| SAL-03 | Skipped YTD entry produces `is_estimated = true` and the forecast treats baseline as 0 | unit/integration | `npx vitest run domain/tax/ytd-baseline.test.ts` | ❌ Wave 0 | ⬜ pending |
| AUTH-01 | Register → login → session persists | e2e/manual | Manual click-through (Playwright deferred per STACK.md) | ❌ Wave 0 (manual acceptable) | ⬜ pending |
| AUTH-02 | Login from a second "device" (second browser/session) shows same salary/schedule data | manual | Manual UAT — no automated multi-session test infra exists yet | N/A — manual-only | ⬜ pending |
| HOME-01 | Home screen shows correct next-payment amount+date for a range of schedule/salary/YTD combinations | integration | `npx vitest run app/actions/forecast.test.ts` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — framework install/config, none exists yet (greenfield)
- [ ] `domain/tax/calculate-ndfl.test.ts` — covers TAX-01, TAX-02
- [ ] `domain/schedule/resolve-payment-date.test.ts` — covers SAL-01 (D-02, D-03)
- [ ] `lib/db/salary-history.test.ts` — covers SAL-02 (D-14 collision/overwrite); needs a test Postgres instance or a Neon branch per test run
- [ ] `domain/tax/ytd-baseline.test.ts` — covers SAL-03 (D-09/10/11)
- [ ] `app/actions/forecast.test.ts` — covers HOME-01 end-to-end orchestration
- [ ] Test-DB strategy decision: local Postgres 16.13 (available in this environment) vs. a per-test-run Neon branch — recommend local Postgres for fast unit/integration iteration, reserving Neon branches for CI/preview verification

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-device data sync | AUTH-02 | No automated multi-session/multi-device test infrastructure exists in-repo for Phase 1 | Log in from two different browsers/sessions with the same account; confirm salary, schedule, and YTD baseline are identical on both |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
