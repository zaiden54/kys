---
phase: 03-vacation-pay
reviewed: 2026-08-31T01:30:00Z
depth: standard
files_reviewed: 30
files_reviewed_list:
  - src/app/actions/bonus.test.ts
  - src/app/actions/bonus.ts
  - src/app/actions/forecast.test.ts
  - src/app/actions/forecast.ts
  - src/app/actions/vacation.test.ts
  - src/app/actions/vacation.ts
  - src/app/(app)/bonuses/bonus-form.tsx
  - src/app/(app)/bonuses/bonus-row.render.test.tsx
  - src/app/(app)/bonuses/bonus-row.tsx
  - src/app/(app)/layout.tsx
  - src/app/(app)/vacations/page.tsx
  - src/app/(app)/vacations/vacation-form.tsx
  - src/app/(app)/vacations/vacation-row.tsx
  - src/app/(app)/vacations/vacation-row.render.test.tsx
  - src/components/next-payment-card.tsx
  - src/domain/schedule/resolve-payment-date.test.ts
  - src/domain/schedule/resolve-payment-date.ts
  - src/domain/vacation/calculate-average-daily-earnings.test.ts
  - src/domain/vacation/calculate-average-daily-earnings.ts
  - src/lib/db/bonus-repository.test.ts
  - src/lib/db/bonus-repository.ts
  - src/lib/db/salary-repository.test.ts
  - src/lib/db/salary-repository.ts
  - src/lib/db/schema.ts
  - src/lib/db/vacation-repository.test.ts
  - src/lib/db/vacation-repository.ts
  - src/lib/validation/bonus.test.ts
  - src/lib/validation/bonus.ts
  - src/lib/validation/vacation.test.ts
  - src/lib/validation/vacation.ts
  - src/domain/time.ts
  - src/lib/pluralize-ru.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-08-31T01:30:00Z
**Depth:** standard
**Files Reviewed:** 32
**Status:** issues_found (info only — no blocking defects)

## Summary

This is the final confirming re-review after three fix iterations (the auto-fix loop's cap has been reached). All five findings carried into iteration 3 (`CR-01`, `WR-01`, `WR-02`, `WR-03`, `WR-04`) were independently re-verified against the current source, not just trusted from the fix report:

- **CR-01** (fabricated ₽0 payout for users with no salary history on `/vacations`) — confirmed fixed. `src/app/(app)/vacations/page.tsx:31-43` now gates every row's `grossKopecks` on `hasSalaryHistory = salaryHistoryEntries.length > 0`, passing `null` instead of a computed zero. `VacationRow` (`src/app/(app)/vacations/vacation-row.tsx:19-23,110-116`) widened its prop to `Kopecks | null` and renders "Укажите оклад, чтобы увидеть сумму" for the null case. `forecast.ts` carries the equivalent, pre-existing guard for the home-screen card (`src/app/actions/forecast.ts:173-182`). Both surfaces now agree.
- **WR-01** (duplicate five-way DB read between `forecastNextPayment` and `getCumulativeIncomeBeforeDate`) — confirmed fixed. The pure computation was extracted into `computeCumulativeIncome` (`src/lib/db/salary-repository.ts:342-402`), which takes already-fetched rows; `forecastNextPayment` fetches all five rows (including `ytdBaseline`) exactly once via a single `Promise.all` (`src/app/actions/forecast.ts:120-126`) and calls `computeCumulativeIncome` directly (line 213-217), while `getCumulativeIncomeBeforeDate` (line 411-425) still does its own single fetch for standalone callers. Traced the extracted function body against the original inline logic — it is behavior-preserving, and `getCumulativeIncomeBeforeDate`'s own test suite (`salary-repository.test.ts`) still exercises it end-to-end.
- **WR-02** (premium-bonus filter copy-pasted in three places) — confirmed fixed. `toPremiumBonusEntries<T extends BonusLike>` is now the single definition (`src/domain/vacation/calculate-average-daily-earnings.ts:56-77`), using a structural `BonusLike` interface to respect the module's "no `@/lib` import" restriction, and is called from `forecast.ts:199`, `salary-repository.ts:366`, and `vacations/page.tsx:26` — no remaining inline copies of the filter/map found by grep across the reviewed file set.
- **WR-03** (vacation form's live day-count preview could show 0/negative during mid-edit) — confirmed fixed. `vacation-form.tsx:39-44` now requires `endDate >= startDate` (in addition to the ISO-shape checks) before computing `dayCount`, rendering nothing otherwise.
- **WR-04** (hardcoded "дней" ignoring Russian pluralization) — confirmed fixed. New `src/lib/pluralize-ru.ts` implements the standard last-digit/last-two-digit rule correctly (11–14 exception checked before the last-digit branches, `Math.trunc`/`Math.abs` guard against fractional/negative input), and `vacation-form.tsx:85` uses it with the correct `["день", "дня", "дней"]` triple.

I also independently traced adjacent areas that the fix commits touched or that a refactor of this shape commonly breaks, specifically to catch any regression the fix passes might have introduced rather than re-trusting the fix report's own narrative:
- `computeCumulativeIncome`'s vacation-accrual term (`salary-repository.ts:372-388`) correctly reuses the caller-supplied `salaryHistoryEntries`/`premiumBonusEntries` built once, not the raw rows, and applies the identical strict-inequality window (`paymentDateIso > windowBoundIso && paymentDateIso < isoDate`) the bonus term already used pre-refactor.
- `vacation-row.render.test.tsx`'s three edit-session/resync tests still exercise `VacationRow` with a concrete non-null `grossKopecks`, which remains valid after the prop-type widening (a `Kopecks | null` prop is satisfied by a `Kopecks` value) — no test breakage from the CR-01 change.
- The two ownership-scoped repositories (`vacation-repository.ts`, `bonus-repository.ts`) both still carry `eq(*.userId, userId)` on every read/write, including the `checkOverlapVacations` self-exclusion path — no regression in the ownership-predicate discipline from any of the four fix commits touching these files.
- Verified the plan's own scope statement (`03-04-PLAN.md:52`: "saveVacationAction (create+edit, overlap-checked) and deleteVacationAction (payment-date-guarded)") to confirm `updateVacation` intentionally has no D-V10 future-date guard — editing a past vacation's dates is allowed by design, only deletion is date-guarded. Not a bug.

No new Critical or Warning-level defects were found in this pass. The two Info-level items below (`IN-01`, `IN-02`) are the same items carried forward from the prior review — they were explicitly out of the fix loop's scope (`fix_scope: critical_warning`, per `03-REVIEW-FIX.md`) and remain unaddressed. They are non-blocking and listed here only for completeness/traceability, not as new findings.

## Info

### IN-01: Vacation edit-mode date inputs have no associated label

**File:** `src/app/(app)/vacations/vacation-row.tsx:90-92`
**Issue:** The edit-mode `startDate`/`endDate` `<input type="date">` elements still have no `<label>` or `aria-label`, unlike the create form (`vacation-form.tsx`) which labels both fields properly, and unlike the edit-mode `type` select in `bonus-row.tsx` (`aria-label="Тип выплаты"`). Carried forward unchanged from the prior review — out of the last fix iteration's scope.
**Fix:** Add `aria-label="Дата начала отпуска"` / `aria-label="Дата окончания отпуска"` to the two edit-mode inputs.

### IN-02: `calculateVacationDays` recomputed independently in `VacationRow` instead of passed down

**File:** `src/app/(app)/vacations/vacation-row.tsx:109`
**Issue:** `page.tsx` already computes `days` for every vacation it renders via `calculateVacationPayGross(...).days` (when `hasSalaryHistory`), but discards it — only `grossKopecks` is threaded through `rows`. `VacationRow` recomputes `calculateVacationDays(vacation.startDate, vacation.endDate)` itself. Harmless (same pure function, same inputs) but a small duplication of derived state. Carried forward unchanged from the prior review — out of the last fix iteration's scope.
**Fix:** Optional — pass a `days` prop down from `page.tsx` alongside `grossKopecks` (note `page.tsx` currently only computes `days` when `hasSalaryHistory` is true, so this would need its own null-safe threading, not a direct reuse of the CR-01 guard's `rows` shape).

---

_Reviewed: 2026-08-31T01:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
