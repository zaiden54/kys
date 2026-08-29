---
phase: 01-core-payroll-loop
verified: 2026-08-29T16:45:00Z
status: human_needed
score: 5/5 automated must-haves verified
behavior_unverified: 3
re_verification:
  previous_status: gaps_found
  previous_score: 2/5
  gaps_closed:
    - "Prior scheduled avans/salary events now accrue into cumulative income through payment-accrual.ts and getCumulativeIncomeBeforeDate."
    - "D-14 consent is bound to a signed row-id/amount claim, a conditional database update, and the exact submitted client snapshot."
    - "Both dated inputs reject impossible calendar dates through one shared UTC round-trip validator."
    - "The environment template fails closed and BETTER_AUTH_SECRET rejects placeholders and low-diversity values."
  gaps_remaining: []
  regressions: []
human_verification:
  - description: "Restore the Neon credential and run the full database-backed test suite."
    expected: "All schema, repository, forecast, conditional insert, stale-CAS, and concurrency tests pass; no password-authentication error occurs."
  - description: "Confirm the salary replacement snapshot in a real browser."
    expected: "After a prompt appears, editing the live form and clicking confirm writes the prompt's original date/new amount, not the edited values; old and new amounts are visible and double-click is disabled."
  - description: "Run the two-independent-browser AUTH-02 flow."
    expected: "Both sessions show the same salary, schedule, YTD and forecast after reload; a stale replacement in one session re-prompts after the other changes the row."
---

# Phase 1: Core Payroll Loop Verification Report

**Phase goal:** A registered user can enter salary and payment schedule data and see the accurate next take-home payment, taxed cumulatively, with shared persisted state across devices.

## Automated Goal Verification

| Truth | Status | Evidence |
|---|---|---|
| Authentication configuration is fail-closed and ownership is session-derived | ✓ VERIFIED | `betterAuthSecretSchema`, empty `.env.example`, protected routes/actions, focused auth-secret tests |
| Salary/schedule/YTD inputs are strict and persistence-safe | ✓ VERIFIED | calendar round-trip tables, kopeck precision, DB constraints, ownership-scoped repositories |
| Salary history replacement requires disclosed bound consent | ✓ VERIFIED | signed ten-minute HMAC claim, row-id+amount CAS predicate, action tests, snapshot AST contract |
| Next payment uses real cumulative salary events and progressive НДФЛ | ✓ VERIFIED | pure accrual coverage, repository composition, frozen-clock forecast integration coverage from 01-10 |
| Production code builds under the installed Next.js version | ✓ VERIFIED | Next.js 16.3.3 production build, TypeScript, and lint pass |

**Automated score: 5/5.** All four gaps recorded by the previous verification are closed in source and focused automated coverage.

## Verification Commands

- 199/199 non-database tests pass across 11 test files.
- Focused `01-11` token/action/component suites: 18/18 pass after review fix `a9b9392`.
- `npx tsc --noEmit`: pass.
- `npm run lint`: pass.
- `npm run build`: pass; all eight routes generated.
- Full suite: blocked before live assertions because Neon rejects the configured `on-hands_owner` password. This is environment verification debt, not counted as a product-code pass.

## Review

`01-REVIEW.md` is clean after fixing the only review finding: the conditional replacement now compares both the stored row id and amount carried by the verified claim.

## Human Verification Required

The phase is not marked complete yet. Restore database access and run the three UAT items persisted in `01-UAT.md`. This preserves the existing AUTH-02 requirement for two genuinely independent browser sessions and the plan-authored edit-after-prompt check.
