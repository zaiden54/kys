---
phase: 02
slug: bonuses-one-off-payments
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-30
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.11 (Phase 1 established) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- --run src/domain/` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~30 seconds (Phase 1 baseline; not yet measured with Phase 2 additions) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run src/domain/`
- **After every plan wave:** Run `npm test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green + manual UAT on bonus create/edit/delete/forecast flow
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | BON-01 | — | User can add a one-off bonus tied to a date | Integration | `npm test -- bonus.test.ts -t "saveBonusAction"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | BON-02 | — | Bonus taxed through cumulative НДФЛ; affects take-home for that payment and subsequent payments | Unit + Integration | `npm test -- calculate-ndfl.test.ts -t "bonus"` + `npm test -- salary-repository.test.ts -t "bonus"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | HOME-01 (amended for bonuses) | — | If bonus lands on next payment, next-payment display reflects it (with breakdown per D-B09) | Integration | `npm test -- forecast.test.ts -t "nextPayment.*bonus"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task ID/Plan/Wave columns are filled in by the planner once PLAN.md tasks exist for each requirement.*

---

## Wave 0 Requirements

- [ ] `src/lib/db/salary-repository.test.ts` — extend existing `getCumulativeIncomeBeforeDate` tests to cover bonus events summed into cumulative income (PLAN 02-01 keeps `accruedGrossBetween` unchanged and sums bonus income directly in the repository query instead)
- [ ] `src/lib/db/bonus-repository.test.ts` — new; CRUD operations, deletion guard, ownership scope
- [ ] `src/app/actions/bonus.test.ts` — new; saveBonusAction validation and persistence, deleteBonusAction guard
- [ ] `src/app/actions/forecast.test.ts` — extend existing next-payment tests to cover bonus-only dates, mixed dates, breakdown generation
- [ ] `src/lib/validation/bonus.test.ts` — new; bonusInputSchema validation (amount > 0, valid ISO date, optional note)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full bonus create/edit/delete/forecast UX flow (visual breakdown, home screen reflection) | BON-01, BON-02 | UI rendering and cross-device visual correctness are not covered by unit/integration assertions | Add a bonus for the next upcoming payment date; confirm the home screen's next-payment amount and breakdown update correctly. Edit and delete the bonus; confirm the display reverts. |

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

*Phase: 02-bonuses-one-off-payments*
*Derived from: 02-RESEARCH.md § Validation Architecture*
