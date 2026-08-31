---
phase: 01-core-payroll-loop
reviewed: 2026-08-29T17:50:00Z
depth: standard
files_reviewed: 45
files_reviewed_list:
  - .env.example
  - .gitignore
  - README.md
  - drizzle.config.ts
  - package.json
  - src/app/(app)/onboarding/page.tsx
  - src/app/(app)/page.tsx
  - src/app/(app)/settings/salary/page.tsx
  - src/app/(auth)/register/page.tsx
  - src/app/actions/forecast.test.ts
  - src/app/actions/forecast.ts
  - src/app/actions/salary.test.ts
  - src/app/actions/salary.ts
  - src/app/layout.tsx
  - src/components/next-payment-card.tsx
  - src/components/pay-setup-forms.test.ts
  - src/components/pay-setup-forms.tsx
  - src/components/ytd-estimate-banner.tsx
  - src/domain/money.ts
  - src/domain/pay/payment-accrual.test.ts
  - src/domain/pay/payment-accrual.ts
  - src/domain/schedule/pay-gap.test.ts
  - src/domain/schedule/pay-gap.ts
  - src/domain/schedule/resolve-payment-date.test.ts
  - src/domain/schedule/resolve-payment-date.ts
  - src/domain/tax/calculate-ndfl.test.ts
  - src/domain/tax/calculate-ndfl.ts
  - src/domain/tax/ndfl-brackets.test.ts
  - src/domain/tax/ndfl-brackets.ts
  - src/domain/time.test.ts
  - src/domain/time.ts
  - src/env.ts
  - src/lib/auth.ts
  - src/lib/db/auth-schema.ts
  - src/lib/db/index.ts
  - src/lib/db/salary-repository.test.ts
  - src/lib/db/salary-repository.ts
  - src/lib/db/schema.test.ts
  - src/lib/db/schema.ts
  - src/lib/validation/auth-secret.test.ts
  - src/lib/validation/auth-secret.ts
  - src/lib/validation/salary.test.ts
  - src/lib/validation/salary.ts
  - tsconfig.json
  - vitest.config.ts
findings:
  critical: 0
  warning: 2
  info: 0
  total: 2
critical: 0
warnings: 2
info: 0
total: 2
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-08-29T17:50:00Z
**Depth:** standard
**Files Reviewed:** 45
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

The Phase 01 payroll, tax, scheduling, ownership, and salary-replacement paths were reviewed at standard depth. No authentication bypass, cross-user data access, secret disclosure, or proven monetary-calculation defect was found. Two robustness defects remain: rejected schedule/YTD mutations are not surfaced to the user, and the database permits a schedule state that the input layer declares invalid.

The previously resolved salary-replacement CAS issue remains fixed: `replaceSalaryIfUnchanged` constrains replacement by both the signed row id and signed prior amount.

## Warnings

### WR-01: Schedule and YTD forms leave rejected Server Actions unhandled

**Classification:** WARNING

**File:** `src/components/pay-setup-forms.tsx:214-224,313-333`

**Issue:** `ScheduleForm.onSubmit`, `YtdForm.onSubmit`, and `YtdForm.onSkip` await Server Actions without a `catch`. A database outage, expired/deployment-rotated action id, network failure, or other rejected action therefore escapes as an unhandled promise rejection. Unlike `SalaryForm`, these forms never set their existing `serverError` state, so the user receives no actionable failure message and may believe the click was ignored. `onSkip` resets its spinner in `finally`, but still exposes no error.

**Fix:** Wrap each action call in `try/catch`, clear stale success/warning state before the call, and set a generic non-sensitive `serverError` message in the catch path. Extracting a small shared mutation-error helper would keep all three forms consistent with `SalaryForm.submit`.

### WR-02: The database does not enforce distinct salary and advance days

**Classification:** WARNING

**File:** `src/lib/db/schema.ts:44-57`

**Issue:** `scheduleInputSchema` rejects equal `avansDay` and `salaryDay`, but `payment_schedule` only has independent range checks. The exported repository accepts raw numeric arguments, so a non-form caller, maintenance script, or future regression can persist equal days. Downstream event generation then produces two different payment kinds on the same date even though the product model explicitly says a one-day schedule is invalid. The database currently protects the range invariant but not this equally important cross-field invariant.

**Fix:** Add a Drizzle/PostgreSQL check such as `check("payment_days_distinct", sql\`${table.avansDay} <> ${table.salaryDay}\`)`, apply the schema migration, and extend `schema.test.ts` to prove equal days are rejected.

## Verification Notes

- `npm run lint -- --max-warnings=0`: passed.
- `npm test`: 199 tests passed; 32 database-backed tests failed because the configured database has no `user` relation. This environment/schema failure prevents treating the integration suite as passing, but it did not establish an additional source-code defect in the reviewed scope.
- Relevant bundled Next.js 16.3.3 Server Action and `revalidatePath` guides were consulted before assessing framework behavior.

---

_Reviewed: 2026-08-29T17:50:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
