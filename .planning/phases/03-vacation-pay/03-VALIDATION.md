---
phase: 03
slug: vacation-pay
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-30
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.11 (Phase 1–2 established) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- --run src/domain/vacation` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~30–40 seconds (Phase 1–2 baseline; not yet measured with Phase 3 additions) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run src/domain/vacation`
- **After every plan wave:** Run `npm test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green + manual UAT on vacation entry/edit/delete/forecast flow + VAC-03 disclaimer rendering check
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | VAC-01 | — | User can enter vacation start/end dates (inclusive range) | Integration | `npm test -- vacation-input.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VAC-02 | — | Average daily earnings computed correctly over trailing 12 months, accounting for salary changes, under-12-months tenure, and excluded (non-premium) bonuses | Unit | `npm test -- calculate-average-daily-earnings.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VAC-02 | — | Vacation payment date = start − 3 days, holiday-shifted (reuses Phase 1 `resolvePaymentDate`) | Unit | `npm test -- resolve-payment-date.test.ts` | ✅ (Phase 1) | ⬜ pending |
| TBD | TBD | TBD | VAC-02 | — | Calculated отпускные taxed through the same cumulative НДФЛ mechanism and appears as a distinct payment event in the forecast | Integration | `npm test -- forecast.test.ts -t "vacation"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task ID/Plan/Wave columns are filled in by the planner once PLAN.md tasks exist for each requirement.*
*VAC-03 (simplified-calculation disclosure) is UI text rendering — see Manual-Only Verifications below.*

---

## Wave 0 Requirements

- [ ] `src/domain/vacation/calculate-average-daily-earnings.test.ts` — new; constant salary, salary increase/decrease mid-period proration (D-V04), under-12-months tenure (D-V05), premium-vs-compensation bonus distinction (D-V01/D-V02), anniversary-of-hire edge case
- [ ] `src/lib/validation/vacation.test.ts` — new; date-range Zod schema (valid range accepted, end < start rejected, invalid format rejected)
- [ ] `src/lib/db/vacation-repository.test.ts` — new; CRUD completeness, overlap detection including boundary-touching ranges (D-V11), ownership scoping
- [ ] `src/app/actions/vacation.test.ts` — new; `saveVacationAction` validation/persistence, `deleteVacationAction` past-vacation guard (D-V10)
- [ ] `src/app/actions/forecast.test.ts` amendments — extend `selectNextPaymentEvent` coverage to sort vacation payment dates against scheduled/bonus dates and confirm cumulative-tax parity with bonuses

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Inline simplified-calculation disclaimer renders next to the calculated отпускные amount whenever vacation pay is shown | VAC-03 | Textual UI disclosure and visual placement are not meaningfully covered by unit/integration assertions | Enter a vacation date range whose payment date is the next upcoming payment; confirm the home screen shows the отпускные amount with the disclaimer text ("Расчёт не учитывает исключаемые периоды...") immediately adjacent, non-dismissible, per D-V12 |
| Full vacation create/edit/delete/forecast UX flow (breakdown, home screen reflection) | VAC-01, VAC-02 | UI rendering and cross-device visual correctness are not covered by unit/integration assertions | Add a vacation whose payment date is the next upcoming payment; confirm the home screen's next-payment amount and breakdown update correctly. Edit and delete the vacation; confirm the display reverts. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---

*Phase: 03-vacation-pay*
*Derived from: 03-RESEARCH.md § Validation Architecture*
