---
phase: 01-core-payroll-loop
reviewed: 2026-08-29T11:21:34Z
depth: standard
files_reviewed: 48
files_reviewed_list:
  - .env.example
  - .gitignore
  - README.md
  - drizzle.config.ts
  - package.json
  - scripts/verify-auth-flow.mjs
  - src/app/(app)/layout.tsx
  - src/app/(app)/onboarding/page.tsx
  - src/app/(app)/page.tsx
  - src/app/(app)/settings/salary/page.tsx
  - src/app/(auth)/login/page.tsx
  - src/app/(auth)/register/page.tsx
  - src/app/actions/forecast.test.ts
  - src/app/actions/forecast.ts
  - src/app/actions/salary.test.ts
  - src/app/actions/salary.ts
  - src/app/api/auth/[...all]/route.ts
  - src/app/layout.tsx
  - src/components/next-payment-card.tsx
  - src/components/pay-setup-forms.test.ts
  - src/components/pay-setup-forms.tsx
  - src/components/sign-out-button.tsx
  - src/components/ytd-estimate-banner.tsx
  - src/domain/money.ts
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
  - src/lib/auth-client.ts
  - src/lib/auth.ts
  - src/lib/db/auth-schema.ts
  - src/lib/db/index.ts
  - src/lib/db/salary-repository.test.ts
  - src/lib/db/salary-repository.ts
  - src/lib/db/schema.test.ts
  - src/lib/db/schema.ts
  - src/lib/session.ts
  - src/lib/validation/salary.test.ts
  - src/lib/validation/salary.ts
  - tsconfig.json
  - vitest.config.ts
findings:
  critical: 3
  warning: 3
  info: 0
  total: 6
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-08-29T11:21:34Z
**Depth:** standard
**Files Reviewed:** 48
**Status:** issues_found

## Summary

The Phase 01 implementation has three ship-blocking defects: the sample auth secret is a valid predictable production secret, salary overwrite confirmation is vulnerable to stale-state/TOCTOU replacement of an undisclosed value, and the shared date validator accepts impossible calendar dates. The new salary precision boundary and generic repository-error result are narrow and do not expose the caught database error, but adjacent mutation and authentication paths still leave rejected promises unhandled. The auth verification script also skips its promised cleanup on its normal assertion-failure path.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Copying the documented environment template installs a valid, predictable auth secret

**Classification:** BLOCKER  
**File:** `/home/zaiden/code/kys/.env.example:2`  
**Issue:** `BETTER_AUTH_SECRET=generate-with-openssl-rand-base64-32` is not merely a visibly invalid placeholder: it is longer than the `z.string().min(32)` check in `src/env.ts`, so an operator who copies `.env.example` and overlooks this one value gets a successfully starting deployment with a public, predictable authentication secret. Any Better Auth cryptographic protection derived from that secret then has no secrecy. The README asks the operator to replace it, but runtime validation currently certifies the unsafe value as valid.

**Fix:** Make the example value fail validation and explicitly reject known placeholders. For example:

```dotenv
BETTER_AUTH_SECRET=
```

```ts
BETTER_AUTH_SECRET: z
  .string()
  .min(32)
  .refine((value) => value !== "generate-with-openssl-rand-base64-32", {
    message: "BETTER_AUTH_SECRET must be randomly generated",
  }),
```

### CR-02: Salary confirmation can overwrite a value the user was never shown

**Classification:** BLOCKER  
**File:** `/home/zaiden/code/kys/src/app/actions/salary.ts:81-101`  
**Also affected:** `/home/zaiden/code/kys/src/components/pay-setup-forms.tsx:92-110`  
**Issue:** The one-way D-14 overwrite is authorized by a bare client-controlled `confirm=true`. The client keeps only the displayed date/amount, then `onConfirmReplace()` submits the form's *current* `getValues()` rather than the values that produced the prompt. A reproducible path is: request confirmation for date A, edit the still-live form to colliding date B, then click the old confirmation button; B is overwritten even though the prompt showed A. There is also a cross-device TOCTOU variant: after the prompt displays value A, another device can replace it with B, and the first device's confirmation overwrites B without ever disclosing B. Because the prior value has no audit trail, this is irreversible data loss. The confirmation button also bypasses `handleSubmit`, so React Hook Form's `isSubmitting` does not guard that request.

**Fix:** Bind confirmation to the exact server-observed row and submitted values. Return an expected row identifier/version (or a signed opaque confirmation token) with the prompt, preserve the submitted snapshot client-side, and perform a conditional confirmed update that succeeds only while the row version still matches. If it changed, return a fresh confirmation showing the new value. Do not call `getValues()` from an old prompt.

```ts
// Conceptual result shape
{
  success: false,
  needsConfirmation: true,
  expectedRowId: existing.id,
  expectedCreatedAt: existing.createdAt,
  submitted: { grossRubles, effectiveFrom },
}
```

### CR-03: The shared “real date” validator accepts impossible calendar dates

**Classification:** BLOCKER  
**File:** `/home/zaiden/code/kys/src/lib/validation/salary.ts:38-44`  
**Issue:** `new Date(value).getTime()` checks parseability, not calendar validity. JavaScript normalizes strings such as `2026-02-29` and `2026-02-31` into March, so both pass `isoDateString` despite the schema's explicit “real date” contract. Both `effectiveFrom` and `asOfDate` use this validator. A direct Server Action request can therefore pass validation and reach PostgreSQL with an impossible date. The salary action misreports the resulting database rejection as a save failure, while the YTD action throws an uncaught error. This also leaves behavior dependent on differences between JavaScript and PostgreSQL date parsing.

**Fix:** Parse the components and round-trip them, or use a strict calendar-date parser. Add leap-year and overflow tests for both schemas.

```ts
const isoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, { message: "Указана несуществующая дата" });
```

## Warnings

### WR-01: Schedule and YTD mutation failures become unhandled event-handler rejections

**Classification:** WARNING  
**File:** `/home/zaiden/code/kys/src/components/pay-setup-forms.tsx:202-212`  
**Also affected:** `/home/zaiden/code/kys/src/components/pay-setup-forms.tsx:288-308`, `/home/zaiden/code/kys/src/app/actions/salary.ts:112-170`  
**Issue:** Unlike the newly hardened salary form, `ScheduleForm`, YTD save, and YTD skip await Server Actions without a catch that updates visible error state. Their server actions also let repository failures escape. Next.js 16's installed error-handling guide explicitly notes that error boundaries do not catch errors in event handlers or asynchronous callbacks. A transient database/transport/deployment failure therefore produces an unhandled rejection and no actionable message; the skip path only resets its spinner in `finally`.

**Fix:** Return fixed, non-sensitive expected repository errors from each Server Action and wrap each client-side await in `try/catch`, setting the existing `serverError` state to a generic retry message. Keep cache revalidation on success only.

### WR-02: Login and registration do not handle rejected auth requests

**Classification:** WARNING  
**File:** `/home/zaiden/code/kys/src/app/(auth)/login/page.tsx:29-41`  
**Also affected:** `/home/zaiden/code/kys/src/app/(auth)/register/page.tsx:29-46`  
**Issue:** Both submit handlers destructure the result of `authClient` without catching a rejected promise. Network loss, a malformed auth response, or a deployment transition yields an unhandled event-handler rejection and leaves the form without an error message. They also render provider-supplied `error.message` directly, coupling user-visible output to upstream error wording and potentially exposing more detail than the UI intends.

**Fix:** Wrap each request in `try/catch`, map provider failures to a small allowlist of product messages, and use a fixed generic message for thrown/unknown errors. Never render an arbitrary upstream message directly.

### WR-03: Assertion failures bypass the auth verification script's cleanup

**Classification:** WARNING  
**File:** `/home/zaiden/code/kys/scripts/verify-auth-flow.mjs:19-22`  
**Also affected:** `/home/zaiden/code/kys/scripts/verify-auth-flow.mjs:125-139`  
**Issue:** `fail()` calls `process.exit(1)`, which terminates Node immediately and prevents the promise chain's `.finally()` cleanup from running. Any failure after a throwaway email is pushed into `createdEmails` leaves test accounts in the configured database, contradicting the script's cleanup guarantee and polluting subsequent verification runs.

**Fix:** Throw from `fail()` (or set `process.exitCode` and return control) so `.catch()` records the failure and `.finally()` always deletes created users. Set the final exit code only after cleanup has completed.

---

_Reviewed: 2026-08-29T11:21:34Z_  
_Reviewer: the agent (gsd-code-reviewer)_  
_Depth: standard_
