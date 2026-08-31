---
phase: 1
slug: core-payroll-loop
status: validated
nyquist_compliant: false
wave_0_complete: true
created: 2026-08-28
updated: 2026-08-31
---

# Phase 1 — Validation Strategy

> Retroactive Nyquist audit of Phase 1 verification coverage.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.11; jsdom + Testing Library for render tests |
| **Config file** | `vitest.config.ts` |
| **Phase subset** | `npm run test -- <15 Phase 1 test files>` |
| **Full suite** | `npm run test` |
| **Audit result** | 15 files passed, 258 tests passed on 2026-08-31 |

## Requirement Coverage

| Requirement | Behavior | Automated Evidence | Status |
|-------------|----------|--------------------|--------|
| AUTH-01 | Registration, login, fail-closed auth configuration, and protected navigation | `auth-secret.test.ts`, login/register render tests, session/auth source verification | manual-only remainder |
| AUTH-02 | Session-derived ownership and shared persisted state | repository ownership/isolation and concurrency tests; signed replacement-claim tests | manual-only remainder |
| SAL-01 | Positive salary input, valid dates, schedule resolution, persistence boundary | `salary.test.ts`, `salary-repository.test.ts`, `resolve-payment-date.test.ts`, `pay-gap.test.ts`, `schema.test.ts` | covered |
| SAL-02 | Effective-dated salary history and safe exact-date replacement | `salary-repository.test.ts`, `salary-confirmation-token.test.ts`, `salary.test.ts`, `pay-setup-forms.test.ts` | covered |
| SAL-03 | Optional YTD baseline, estimated-zero skip, persistent forecast state | `salary.test.ts`, `salary-repository.test.ts`, `forecast.test.ts`, `schema.test.ts` | covered |
| TAX-01 | Progressive cumulative NDFL brackets, marginal delta tax, rounding, and year bounds | `calculate-ndfl.test.ts`, `ndfl-brackets.test.ts`, `payment-accrual.test.ts`, `forecast.test.ts` | covered |
| TAX-02 | Advance and salary as ordered independent taxable events | `calculate-ndfl.test.ts`, `resolve-payment-date.test.ts`, `payment-accrual.test.ts`, `forecast.test.ts` | covered |
| HOME-01 | Configured/not-configured forecast, date, gross, tax, net, and estimated baseline | `forecast.test.ts` | covered |

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Evidence |
|----------|-------------|------------|----------|
| Complete registration → login → protected home flow with a real cookie session | AUTH-01 | The repository has no browser E2E runner; render tests mock the auth client/router boundary. | `01-UAT.md` complete; authentication flow accepted during Phase 1 UAT. |
| Sign in to the same account in two independent browser profiles and verify salary, schedule, YTD, and forecast convergence | AUTH-02 | Requires two real authenticated browser storage contexts against the shared database. | `01-UAT.md` Test 1 passed. |

These are intentional manual-only checks, not missing unit/integration tests. User selected **Keep manual-only** during the 2026-08-31 audit.

## Validation Sign-Off

- [x] Every Phase 1 requirement has automated unit/integration coverage where technically meaningful
- [x] Phase subset passes: 15 files, 258 tests
- [x] Database ownership, isolation, and concurrency behaviors are automated
- [x] Browser-only authentication and cross-device behaviors are explicitly tracked as manual-only
- [x] Manual UAT evidence exists and is complete
- [x] No watch-mode commands
- [x] Wave 0 test infrastructure and files exist
- [ ] Fully Nyquist-compliant (blocked only by two intentional manual browser checks)

**Approval:** validated (partial) 2026-08-31

## Validation Audit 2026-08-31

| Metric | Count |
|--------|-------|
| Requirements audited | 8 |
| Fully automated | 6 |
| Automated with manual-only remainder | 2 |
| Missing automated tests | 0 |
| Failing tests | 0 |
| Tests passed | 258 |
