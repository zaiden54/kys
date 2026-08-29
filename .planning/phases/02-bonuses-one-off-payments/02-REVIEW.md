---
phase: 02-bonuses-one-off-payments
reviewed: 2026-08-29T23:34:05Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - src/lib/db/schema.ts
  - src/lib/db/bonus-repository.ts
  - src/lib/db/bonus-repository.test.ts
  - src/lib/db/salary-repository.ts
  - src/lib/db/salary-repository.test.ts
  - src/lib/validation/bonus.ts
  - src/lib/validation/bonus.test.ts
  - src/app/actions/bonus.ts
  - src/app/actions/bonus.test.ts
  - src/app/actions/forecast.ts
  - src/app/actions/forecast.test.ts
  - src/components/next-payment-card.tsx
  - src/app/(app)/bonuses/bonus-form.tsx
  - src/app/(app)/bonuses/bonus-row.tsx
  - src/app/(app)/bonuses/page.tsx
  - src/app/(app)/layout.tsx
findings:
  critical: 0
  warning: 3
  info: 0
  total: 3
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-08-29T23:34:05Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

The Phase 02 persistence, validation, Server Actions, forecast integration, and bonus UI were reviewed at standard depth. Ownership predicates are consistently applied, and no injection or cross-user authorization defect was found. Three correctness/robustness issues remain: forecast confidence can describe an ignored baseline as confirmed, rejected save calls leave both mutation forms without feedback, and server validation silently changes monetary inputs with more than two decimals.

Validation performed during review: `npx tsc --noEmit`, `npm run lint`, and the focused validation/action tests all passed.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Forecast marks an ignored baseline as confirmed

**Severity:** WARNING
**File:** `/home/zaiden/code/kys/src/app/actions/forecast.ts:127-151`
**Issue:** `getCumulativeIncomeBeforeDate` deliberately ignores a stored baseline when its `asOfDate` is in a different year or is after the forecast date, but `forecastNextPayment` independently copies `ytdBaseline.isEstimated` into the response. A confirmed 2026 baseline used while forecasting a 2027 payment therefore contributes zero while the UI receives `baselineIsEstimated: false`. The same false confidence occurs for a future-dated confirmed baseline. This misrepresents the reliability of the tax forecast precisely when the calculation fell back to an implicit zero baseline.
**Fix:** Derive applicability once and expose it with the cumulative result, or apply the same boundary rule before setting the flag. For example:

```ts
const baselineApplies =
  ytdBaseline.asOfDate.slice(0, 4) === paymentDateIso.slice(0, 4) &&
  ytdBaseline.asOfDate <= paymentDateIso;

baselineIsEstimated: !baselineApplies || ytdBaseline.isEstimated,
```

Add regression cases for prior-year and future-dated confirmed baselines.

### WR-02: Rejected save actions produce unhandled promises and no error feedback

**Severity:** WARNING
**Files:** `/home/zaiden/code/kys/src/app/(app)/bonuses/bonus-form.tsx:27-40`; `/home/zaiden/code/kys/src/app/(app)/bonuses/bonus-row.tsx:24-34`
**Issue:** Both create and edit handlers directly await `saveBonusAction` without a `try/catch`. The action converts repository failures into result objects, but failures outside that narrow block—session lookup errors, `revalidatePath` failures, an interrupted request, or transport/runtime rejection—still reject. React Hook Form then receives a rejected async submit handler, leaving the user with neither the required generic error nor a reliable retry state. The delete handler already handles this boundary correctly, making the save behavior inconsistent.
**Fix:** Catch rejected action calls in both handlers and surface the generic save message through a form/root error. For example:

```ts
try {
  const result = await saveBonusAction(data);
  // existing result handling
} catch {
  setError("root", {
    message: "Не удалось сохранить бонус. Попробуйте ещё раз.",
  });
}
```

Render `errors.root?.message` and add component-level tests with a rejected `saveBonusAction` mock.

### WR-03: Server validation silently rounds unsupported monetary precision

**Severity:** WARNING
**File:** `/home/zaiden/code/kys/src/lib/validation/bonus.ts:18-23`
**Issue:** The schema verifies only that rounding produces at least one kopeck; it does not reject values with more than two decimal places. A caller that bypasses the browser's `step="0.01"` can submit values such as `1.005`, which the Server Action accepts and silently changes through `Math.round(value * 100)`. Financial input should not be mutated without validation feedback, and binary floating-point makes half-kopeck cases especially surprising.
**Fix:** Reject sub-kopeck precision before conversion, preferably by validating the original decimal string or with a tolerance-aware integer check. For example:

```ts
.refine((value) => Number.isInteger(Math.round(value * 100_000_000) / 1_000_000), {
  message: "Укажите сумму с точностью не более двух знаков после запятой",
})
```

A string/decimal parser is safer than floating-point arithmetic. Add tests for `1.001`, `1.005`, and valid `1.01`.

---

_Reviewed: 2026-08-29T23:34:05Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
