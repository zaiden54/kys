---
phase: 03
slug: vacation-pay
status: validated
nyquist_compliant: false
wave_0_complete: true
created: 2026-08-30
updated: 2026-08-31
---

# Phase 03 — Validation Strategy

> Retroactive Nyquist audit of Phase 3 verification coverage.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.11; jsdom + Testing Library render tests |
| **Config file** | `vitest.config.ts` |
| **Full suite** | `npm run test` |
| **Type check** | `npx tsc --noEmit` |
| **Audit result** | Existing Phase 3 subset green; one new render test green; two new collision regressions expose implementation failures |

## Requirement Coverage

| Requirement | Behavior | Automated Evidence | Status |
|-------------|----------|--------------------|--------|
| VAC-01 | Validate, create, list, edit, delete, overlap-check, and ownership-scope vacation ranges | `vacation.test.ts`, `vacation-repository.test.ts`, `vacation-row.render.test.tsx` | covered |
| VAC-02 | Calculate average earnings/day count/payment date, persist vacations, fold prior vacation pay into cumulative tax, and forecast upcoming vacation pay | `calculate-average-daily-earnings.test.ts`, `resolve-payment-date.test.ts`, `salary-repository.test.ts`, `forecast.test.ts` | partial — same-date composition bug |
| VAC-03 | Render the exact non-dismissible simplified-calculation caption for a vacation forecast | `next-payment-card.render.test.tsx` | covered for vacation-only forecast; collision behavior blocked by VAC-02 gap |

## Verification Map

| Plan / Task Area | Requirement | Automated Evidence | Result |
|------------------|-------------|--------------------|--------|
| 03-01 vacation schema/domain engine | VAC-01, VAC-02 | domain, schedule, and schema/repository tests | green |
| 03-02 bonus type propagation | VAC-02 | validation, action, form, and repository tests | green |
| 03-03 vacation repository/cumulative chain | VAC-01, VAC-02 | vacation and salary repository tests | green |
| 03-04 vacation tracer and UI | VAC-01, VAC-02, VAC-03 | vacation action, forecast, row render, and card render tests | partial |

## Resolved Gap

| Gap | Requirement | Test | Result |
|-----|-------------|------|--------|
| Exact disclosure caption had no executable render coverage | VAC-03 | `src/components/next-payment-card.render.test.tsx` | 1/1 passed |

## Escalated Implementation Gaps

| Gap | Requirements | Regression | Current Failure |
|-----|--------------|------------|-----------------|
| Scheduled advance/salary and vacation share a payment date | VAC-02, VAC-03, TAX-01, TAX-02, HOME-01 | `forecast.test.ts` schedule+vacation composition case | Forecast returns only scheduled pay; vacation gross/id/disclosure are absent |
| Bonus and vacation share a payment date | VAC-02, VAC-03, TAX-01, TAX-02, HOME-01, BON-02 | `forecast.test.ts` bonus+vacation composition case | Forecast returns only bonus; vacation gross/id/disclosure are absent |

These failures confirm the blocker recorded in `v1.0-MILESTONE-AUDIT.md`. They require implementation work in the closure phase; the Nyquist auditor was intentionally forbidden from changing production code.

## Manual-Only Verifications

Visual placement and end-to-end browser interaction remain useful UAT checks, but they do not replace the two failing composition regressions above.

## Validation Sign-Off

- [x] Wave 0 test infrastructure and planned Phase 3 tests exist
- [x] VAC-01 is covered across validation, actions, persistence, ownership, and mounted edit UI
- [x] VAC-03 exact disclosure copy has executable render coverage
- [x] Existing Phase 3 subset is green
- [x] TypeScript type check passes
- [ ] VAC-02 same-date payment composition passes
- [ ] Full suite is green with the two new regressions
- [ ] `nyquist_compliant: true`

**Approval:** validated (partial) 2026-08-31

## Validation Audit 2026-08-31

| Metric | Count |
|--------|-------|
| Gaps found | 3 |
| Resolved | 1 |
| Escalated | 2 |
| New passing tests | 1 |
| New failing regressions | 2 |
