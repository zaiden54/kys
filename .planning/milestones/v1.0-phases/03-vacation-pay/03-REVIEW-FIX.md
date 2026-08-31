---
phase: 03-vacation-pay
fixed_at: 2026-08-30T22:04:38Z
review_path: .planning/phases/03-vacation-pay/03-REVIEW.md
iteration: 3
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-08-30T22:04:38Z
**Source review:** .planning/phases/03-vacation-pay/03-REVIEW.md
**Iteration:** 3

**Summary:**
- Findings in scope: 5 (fix_scope: critical_warning — CR-01, WR-01, WR-02, WR-03, WR-04; IN-01/IN-02 out of scope)
- Fixed: 5
- Skipped: 0

**Verification environment:** All edits were made and verified inside an isolated git worktree
(`.claude/worktrees/rf-03-1290734-1788126918`, branch `gsd-reviewfix/03-1290734`) created per
`workflow.use_worktrees: true`. Since the worktree has no `node_modules` by design, a plain symlink
to the main checkout's `node_modules` (not a Windows junction/reparse point — safe to remove without
following into the target) and a temporary copy of the gitignored `.env.local` were used to run the
project's real gates directly in the worktree. Both were removed before the cleanup tail. `tsc
--noEmit` was run after every individual fix (zero errors introduced in any touched file — the one
pre-existing `src/app/layout.tsx(20,50): Cannot find name 'LayoutProps'` error is unrelated to this
pass and present before any of these edits, caused by `.next/types` not being generated). After all
five fixes were committed, the full suite was also run once: **`npx vitest run` — 323/323 tests
passed** across 25 files, confirming no regression from the CR-01 UI-guard change or the WR-01
forecast/salary-repository read-path refactor. These results are reproducible in the main checkout
after the cleanup tail fast-forwards `gsd/phase-03-vacation-pay` to this branch.

## Fixed Issues

### CR-01: Vacations list page shows a fabricated ₽0 payout for users with no salary history

**Files modified:** `src/app/(app)/vacations/page.tsx`, `src/app/(app)/vacations/vacation-row.tsx`
**Commit:** 162bb24
**Applied fix:** Mirrored `forecast.ts`'s existing `{ configured: false, missing: "salary" }` guard.
`page.tsx` now computes `hasSalaryHistory = salaryHistoryEntries.length > 0` and passes
`grossKopecks: null` for every vacation row when there is no salary history, instead of unconditionally
calling `calculateVacationPayGross(...)` (which correctly, but misleadingly, returns `0` per its
documented "never NaN, never throws" contract). `VacationRow`'s `grossKopecks` prop widened to
`Kopecks | null`; when `null`, the amount cell renders "Укажите оклад, чтобы увидеть сумму" instead of
`formatKopecks(0)`. The existing render tests pass a concrete `Kopecks` value and needed no changes.

### WR-01: `forecastNextPayment` and `getCumulativeIncomeBeforeDate` independently re-fetch the same rows in the same request

**Files modified:** `src/lib/db/salary-repository.ts`, `src/app/actions/forecast.ts`
**Commit:** c4d4874
**Applied fix:** Extracted the pure computation body of `getCumulativeIncomeBeforeDate` into a new
exported `computeCumulativeIncome(inputs: CumulativeIncomeInputs, isoDate, kind)` that takes
already-fetched `baseline`/`schedule`/`history`/`bonusRows`/`vacationRows` rather than fetching them
itself. `getCumulativeIncomeBeforeDate` now fetches those five rows once and delegates to the pure
function (preserving its existing signature and behavior for other callers, including the test suite's
direct calls). `forecastNextPayment` now fetches `ytdBaseline` alongside its existing single
`Promise.all` (schedule/bonuses/vacations/salary history) and calls `computeCumulativeIncome` directly
with those already-fetched rows instead of a second independent five-way fetch — closing the
narrow inconsistency window a concurrent write could previously land in between the two reads. Traced
by hand that the extracted function body is byte-for-byte identical to the original inline logic (no
semantic change), and confirmed via the full test suite (323/323, including all
`getCumulativeIncomeBeforeDate` and `forecastNextPayment` integration tests) that behavior is
unchanged for every existing scenario.

### WR-02: Premium-bonus filtering logic is copy-pasted verbatim in three files

**Files modified:** `src/domain/vacation/calculate-average-daily-earnings.ts`,
`src/app/actions/forecast.ts`, `src/lib/db/salary-repository.ts`, `src/app/(app)/vacations/page.tsx`
**Commit:** 17997ba
**Applied fix:** Added an exported `toPremiumBonusEntries<T extends BonusLike>(bonusRows)` helper to
`calculate-average-daily-earnings.ts`, using a locally-defined structural `BonusLike` interface (not
importing the real `BonusRow` type from `@/lib/db/bonus-repository`) to respect the module's documented
"no `@/lib`, `next`, or React imports" restriction. Replaced the identical
`.filter((bonus) => bonus.type !== "compensation").map(...)` block at all three call sites
(`forecast.ts`, `salary-repository.ts`, `vacations/page.tsx`) with a call to the shared helper.

### WR-03: VacationForm's live day-count preview can show zero/negative values while the user is mid-edit

**Files modified:** `src/app/(app)/vacations/vacation-form.tsx`
**Commit:** c46c222
**Applied fix:** Applied the review's suggested guard verbatim — added `endDate >= startDate` to the
`dayCount` computation's condition, alongside the existing ISO-shape checks, so the preview shows
nothing (`null`) rather than a zero/negative count while the two date fields are in a transient
unordered state mid-edit.

### WR-04: Hardcoded "дней" ignores Russian pluralization rules

**Files modified:** `src/app/(app)/vacations/vacation-form.tsx`, `src/lib/pluralize-ru.ts` (new file)
**Commit:** 67d4b56
**Applied fix:** Added a small `pluralizeRu(count, [singular, few, many])` helper implementing the
standard last-digit/last-two-digit Russian pluralization rule, in a new `src/lib/pluralize-ru.ts`
module (this is presentation-copy logic, not domain financial math, so it was not placed under
`src/domain/`, which several modules in this phase document a restricted-import policy for). Used it
in `vacation-form.tsx`'s day-count caption: `{dayCount} {pluralizeRu(dayCount, ["день", "дня",
"дней"])} отпуска`.

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-08-30T22:04:38Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3_
