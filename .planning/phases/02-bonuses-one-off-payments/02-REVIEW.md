---
phase: 02-bonuses-one-off-payments
reviewed: 2026-08-30T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - src/app/(app)/bonuses/bonus-form.test.ts
  - src/app/(app)/bonuses/bonus-form.tsx
  - src/app/(app)/bonuses/bonus-row.test.ts
  - src/app/(app)/bonuses/bonus-row.tsx
  - src/app/(app)/bonuses/page.tsx
  - src/app/(app)/layout.tsx
  - src/app/actions/bonus.test.ts
  - src/app/actions/bonus.ts
  - src/app/actions/forecast.test.ts
  - src/app/actions/forecast.ts
  - src/components/next-payment-card.tsx
  - src/lib/db/bonus-repository.test.ts
  - src/lib/db/bonus-repository.ts
  - src/lib/db/salary-repository.test.ts
  - src/lib/db/salary-repository.ts
  - src/lib/db/schema.ts
  - src/lib/validation/bonus.test.ts
  - src/lib/validation/bonus.ts
findings:
  critical: 1
  warning: 1
  info: 1
  total: 3
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-08-30T00:00:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

This is a re-review superseding the prior `02-REVIEW.md`. All three previously-open findings (WR-01 "ignored baseline marked confirmed", WR-02 "unhandled rejected save promise", WR-03 "silent sub-kopeck rounding") were verified as genuinely fixed, not just claimed: the applicability guard is duplicated correctly in `forecast.ts:149-151`, both `bonus-form.tsx` and `bonus-row.tsx` now wrap `saveBonusAction` in `try/catch` with a rendered generic error, and `bonus.ts` validation now rejects any amount carrying more than two decimal places. `npx tsc --noEmit` is clean and the full non-DB unit suite (validation, bonus/forecast unit tests, bonus-form/bonus-row AST contract tests) passes (17/17).

The cumulative-income/tax integration between bonuses and the НДФЛ engine (`getCumulativeIncomeBeforeDate`'s bonus window filter, `forecastNextPayment`'s same-date merge and bonus-vs-schedule tie-break) was traced in detail and is correct: bonus boundaries consistently match the accrual engine's "strictly after the window bound, strictly before the target" convention, ownership predicates are uniform, and no cross-user data leak was found.

One new critical defect was found in `BonusRow`'s edit form: React Hook Form's `defaultValues` are captured once at mount from the `bonus` prop and are never resynchronized, so canceling an edit (or reopening edit mode after the row's data has since changed) redisplays stale, previously-typed values rather than the row's true current data — and resubmitting silently reverts a bonus to that stale value. This is a genuine data-loss risk for a phase whose entire premise is date/amount corrections to real money.

## Critical Issues

### CR-01: BonusRow's edit form never resyncs with updated bonus data — cancel and reopen silently reverts a saved edit

**File:** `src/app/(app)/bonuses/bonus-row.tsx:15-22` (root cause), `:67` (Cancel button), `:53-72` (editing-mode form)
**Issue:** `BonusRow` calls `useForm<BonusInput>({ ..., defaultValues: { id: bonus.id, amountRubles: kopecksToRubles(bonus.amountKopecks), date: bonus.date, note: bonus.note ?? "" } })`. React Hook Form's `defaultValues` object is evaluated exactly once, at the hook's first invocation (component mount), and is never re-read afterward — this is documented RHF behavior, not a corner case. Because `<BonusRow key={row.id} bonus={row} />` (`page.tsx:26`) keys only on `row.id`, the same component instance (and therefore the same `useForm` internal state) persists across every re-render of this row for as long as the bonus itself isn't deleted, regardless of how many times its `amountKopecks`/`date`/`note` change underneath it.

Two concrete, reproducible failure paths follow directly from this:

1. **Cancel does not discard changes.** The "Отмена" button (`bonus-row.tsx:67`) only calls `setMode("display")` — it never calls `reset()`. If a user opens edit mode, types a new amount, then clicks Cancel, the underlying RHF field state still holds the unsaved typed value. Reopening edit mode ("Изменить бонус") shows that stale, never-saved value instead of the bonus's real current amount — a user who edits the note only and resubmits will silently overwrite the amount with their earlier abandoned edit.
2. **A successful edit from elsewhere is invisible to a still-mounted row.** If this bonus is edited from another tab/device (a stated core scenario — the app's premise is cross-device cloud sync) and this page's cached data is subsequently revalidated/refreshed without a full remount, the `bonus` prop passed into this already-mounted `BonusRow` updates, but the RHF form fields do not: reopening edit mode still shows the value captured at first mount. Resubmitting without touching the amount field silently overwrites the concurrently-saved value with the stale one — a direct data-loss risk on financial data, which is exactly this phase's subject matter (D-B04 explicitly requires that "the edit persists and the next forecast read... reflects the corrected amount").

Neither `bonus-row.test.ts` nor any other test in the phase exercises actual form re-render/reset behavior (the existing test is a static AST check of the `try/catch` shape only), so this regressed silently.

**Fix:** Keep the form synchronized with the current prop instead of freezing it at mount. Either switch to RHF's `values` option (kept in sync with prop changes automatically, supported since `react-hook-form@7.24`, and this repo is on `^7.86.0`):

```tsx
const { register, handleSubmit, setError, formState: { errors, isSubmitting } } =
  useForm<BonusInput>({
    resolver: zodResolver(bonusInputSchema) as Resolver<BonusInput>,
    values: {
      id: bonus.id, amountRubles: kopecksToRubles(bonus.amountKopecks),
      date: bonus.date, note: bonus.note ?? "",
    },
  });
```

or explicitly call `reset()` both on Cancel and after a successful save:

```tsx
const { register, handleSubmit, reset, setError, formState } = useForm<BonusInput>({...});

function toDefaults(): BonusInput {
  return { id: bonus.id, amountRubles: kopecksToRubles(bonus.amountKopecks), date: bonus.date, note: bonus.note ?? "" };
}

// in onEdit's success branch:
if (result.success) { setMode("display"); reset(toDefaults()); return; }

// Cancel button:
<button type="button" onClick={() => { reset(toDefaults()); setMode("display"); }} ...>Отмена</button>
```

Add a render-based regression test (e.g. React Testing Library) that: opens edit mode, changes the amount, clicks Cancel, reopens edit mode, and asserts the input shows the original `bonus.amountKopecks`-derived value rather than the discarded edit.

## Warnings

### WR-01: `bonusInsertSchema` is a dead, unvalidated export that would silently bypass money-precision/positivity checks if ever wired up

**File:** `src/lib/validation/bonus.ts:5`
**Issue:** `export const bonusInsertSchema = createInsertSchema(bonuses);` is exported but has zero consumers anywhere in `src/` (confirmed via project-wide grep) and zero test coverage. Unlike `bonusInputSchema` — the schema actually used at the Server Action boundary — this Drizzle-derived schema carries none of the domain refinements (`.gt(0)`, the max-rubles cap, the sub-kopeck-precision rejection that WR-03 just added, the ISO-date calendar-validity check). It is a landmine: a future change that reaches for "the bonus schema" and picks this one by mistake (its name reads as the more "correct"/canonical one, being derived straight from the table) would silently reintroduce exactly the precision bug WR-03 just closed, with no test to catch it since nothing currently imports it.
**Fix:** Remove the unused export, or if it's meant to seed a future admin/import path, gate it behind the same refinements as `bonusInputSchema` (e.g. `bonusInsertSchema.extend({ amountKopecks: ... })` mirroring the precision guard) and add a regression test proving it rejects the same fixtures `bonus.test.ts` already covers. Prefer deleting it until there's an actual caller — dead validation code is worse than no code because it looks trustworthy.

## Info

### IN-01: Inconsistent money formatting between the delete-confirm dialog and the rest of the UI

**File:** `src/app/(app)/bonuses/bonus-row.tsx:43`
**Issue:** The delete confirmation message is built as `` `Удалить бонус на сумму ${kopecksToRubles(bonus.amountKopecks)} ₽ от ${bonus.date}?` `` — using the raw `kopecksToRubles` number (no thousands separator, no rounding policy) and the raw ISO date string, while every other money/date display in this phase goes through `formatKopecks` (ru-RU `Intl.NumberFormat`, whole-ruble rounding) and a locale-formatted date (`next-payment-card.tsx`'s `formatPaymentDate`). A bonus of e.g. 1,234,567.50 ₽ would show as "Удалить бонус на сумму 1234567.5 ₽ от 2026-09-15?" in the native `confirm()` dialog instead of a consistently formatted amount/date.
**Fix:** Reuse `formatKopecks(bonus.amountKopecks)` (drop the manual `₽` suffix, it already localizes the currency symbol) and a locale-formatted date for the confirm string, matching the display row directly above it in the same component.

---

_Reviewed: 2026-08-30T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
