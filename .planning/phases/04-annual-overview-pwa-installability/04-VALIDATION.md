---
phase: 4
slug: annual-overview-pwa-installability
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-31
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.11 (unit/domain), jsdom + @testing-library/react (component) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm run test -- <changed-file>.test.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- <changed-file>.test.ts`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | HOME-02 | TBD | N/A | unit | `npm run test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PWA-01 | TBD | N/A | manual | on-device iPhone UAT | ❌ W0 | ⬜ pending |

*Filled in by gsd-planner during task breakdown (per 04-RESEARCH.md's Validation Architecture: annual-summary reconciliation unit test, Recharts pie-chart render test, install-banner conditional-render test).*

---

## Wave 0 Requirements

- [ ] `src/domain/pay/annual-summary.test.ts` (or equivalent) — reconciliation test for the new whole-year aggregation function (HOME-02, success criterion #2: chart totals must equal the sum of individual payment breakdowns to the ruble)
- [ ] Component test for the Recharts pie chart's unconfigured/loading/error/populated states
- [ ] Component test for the install-banner's standalone-mode conditional visibility

*Existing test infrastructure (Vitest, jsdom + @testing-library/react from Phase 2) covers all other phase requirements — no new framework installs needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| iOS "Add to Home Screen" install flow, standalone launch, icon rendering | PWA-01 | iOS Safari manifest/icon quirks and storage-jar behavior cannot be reproduced in an emulator or automated test — per 04-CONTEXT.md and project PITFALLS.md Pitfall 5/6 | On a real iPhone: (1) open in Safari, confirm install banner shows; (2) Share → Add to Home Screen; (3) confirm icon and standalone launch; (4) confirm re-login hint appears and login works; (5) confirm banner is hidden once installed; (6) confirm data loads correctly after re-login |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
