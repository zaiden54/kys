---
phase: 03-vacation-pay
reviewed: 2026-08-31T00:00:00Z
depth: standard
files_reviewed: 28
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
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-08-31T00:00:00Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

Reviewed the Phase 3 отпускные (vacation pay) implementation: the pure `calculate-average-daily-earnings`
domain engine, `resolve-payment-date`'s reused weekend/holiday shift, the `vacation-repository`/`bonus-repository`
persistence layer, the `forecast.ts` orchestration that folds vacation events into the next-payment
forecast, and the corresponding Server Actions, forms, and row components.

The domain math (month-by-month proration, day-count, 29.3-divisor averaging, ст.136 3-calendar-day
payment-date rule) is careful and well-tested — the off-by-one and precision pitfalls called out in
03-RESEARCH.md are correctly handled, and rounding-once discipline is respected throughout.

The most serious defect is in the orchestration layer, not the domain engine: `forecastNextPayment`
skips the "salary must be configured" guard for a vacation-only resolved event, so a user who records a
vacation before ever entering a salary gets a `configured: true` forecast showing a real ₽0 payment
instead of the "not configured" state the module's own doc comment says must never happen for zero/absent
inputs. Beyond that, findings are lower-severity: a documented-but-unmitigated overlap race in vacation
create/update, no sanity bound on vacation date-range length, and duplicated date-formatting/validation
logic across three-plus files.

## Critical Issues

### CR-01: Vacation-only forecast silently reports a fabricated ₽0 payment instead of "not configured" when the user has no salary history

**File:** `src/app/actions/forecast.ts:161-191`
**Issue:**
`forecastNextPayment`'s module doc explicitly states the forecast contract: *"There is no zero/placeholder
forecast for a not-configured user — SAL-03's empty-input contract is 'compute nothing,' not 'compute
against zero.'"* This is enforced for the schedule+salary path (line 164: `if (!isBonusOnly &&
!isVacationOnly && !activeSalary) return { configured: false, missing: "salary" }`), but the vacation-only
branch has no equivalent guard.

When `isVacationOnly` is true, `activeSalary` is forced to `null` and the "missing salary" check is
explicitly skipped (line 161-164: `isBonusOnly || isVacationOnly ? null : ...`). The vacation's gross is
then computed from `salaryHistoryRows` (line 177-189) via `calculateVacationPayGross`. If a user has
recorded a vacation but has **never entered any salary at all** (`salaryHistoryRows` is `[]` — a
plausible sequence for a new user who visits `/vacations` before `/` /salary setup, since nothing in the
UI prevents it), `calculateAverageDailyEarnings` correctly returns `{ averageDailyKopecks: 0, monthCount:
0 }` per its own contract (domain-level "no data → zero, never NaN" is correct there), which propagates to
`vacationGrossKopecks = 0`.

The result: `forecastNextPayment` returns `{ configured: true, forecast: { grossKopecks: 0, taxKopecks: 0,
netKopecks: 0, kind: "vacation", ... } }` — a fully "configured" forecast telling the user their next
payment is confirmed at ₽0, when the actual situation is "not enough information to compute this." This
directly contradicts the module's own stated contract and will render via `NextPaymentCard` as a
legitimate (if odd-looking) ₽0 vacation payment rather than the "add your salary" empty state the rest of
the app shows for an unconfigured user. This is untested — `forecast.test.ts` test (15) (the only
vacation-only-no-schedule case) always seeds `replaceSalaryAt` first, so this gap has no regression
coverage.

**Fix:** Guard the vacation-only branch the same way the schedule branch is guarded — treat "no salary
history at all" as "missing salary" for a vacation-only resolved event:
```ts
const isVacationOnly = resolvedEvent.kind === "vacation";
// ...
if (isVacationOnly && salaryHistoryRows.length === 0) {
  return { configured: false, missing: "salary" };
}
```
placed before the `vacationGrossKopecks` computation block (before line 173). Add a regression test
mirroring test (15) but with no `replaceSalaryAt` call, asserting `configured: false, missing: "salary"`.

## Warnings

### WR-01: TOCTOU race between `checkOverlapVacations` and `createVacation`/`updateVacation` can persist overlapping vacations

**File:** `src/app/actions/vacation.ts:34-56`, `src/lib/db/vacation-repository.ts:66-85`
**Issue:** `saveVacationAction` performs `checkOverlapVacations` then, in a separate statement,
`createVacation`/`updateVacation` — there is no transaction, advisory lock, or DB-level exclusion
constraint (e.g. a Postgres `EXCLUDE USING gist` range constraint) tying the two together. The
`vacations` table's own comment (`schema.ts:109-113`) explicitly acknowledges overlap is enforced only
"at the application/repository layer," and the repository doc comment says `checkOverlapVacations` is
"the single enforcement point every caller must invoke" — but nothing prevents two concurrent
submissions (double-click, two open tabs/devices) from both passing the overlap check before either
insert lands, producing two overlapping vacation rows. Unlike `deleteVacationIfFuture`'s narrow
read-then-write race, which is explicitly called out and accepted (T-03-08) in the code comments, this
create/update race is not documented as an accepted risk anywhere in the reviewed files or
03-04-PLAN.md's "Design decisions."

Overlapping vacation rows are not merely a UI nuisance — they feed directly into
`getCumulativeIncomeBeforeDate`'s `vacationAccruedKopecks` term and the vacations-history page, both of
which would then double-count отпускные for the overlapping date range, producing incorrect tax figures.

**Fix:** Either add a lightweight application-level lock (e.g. `pg_advisory_xact_lock` keyed on `userId`)
around the check-then-write sequence, or accept and document the race explicitly (matching the delete
path's documented acceptance) if the risk is judged acceptable for v1. Silently leaving it undocumented
is the actual defect here.

### WR-02: `formatPaymentDate` is duplicated verbatim across three components

**File:** `src/app/(app)/bonuses/bonus-row.tsx:18-26`, `src/app/(app)/vacations/vacation-row.tsx:16-24`, `src/components/next-payment-card.tsx:22-30`
**Issue:** All three files define an identical function:
```ts
function formatPaymentDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(date);
}
```
Any future fix (locale change, timezone edge case, format tweak) must be applied in three places, and it's
easy for one copy to drift from the others.
**Fix:** Extract to a shared helper, e.g. `src/domain/time.ts` (`formatIsoDateRu(isoDate: string): string`),
and import it from all three call sites.

### WR-03: No sanity bound on vacation date-range length

**File:** `src/lib/validation/vacation.ts:12-19`
**Issue:** `vacationInputSchema` validates date shape/existence and `endDate >= startDate`, but places no
upper bound on the range (unlike `bonusInputSchema`'s `MAX_RUBLES = 100_000_000` cap on amount). A
mistyped year (e.g. `startDate: "2026-01-01"`, `endDate: "2036-01-01"`) or a malicious client bypassing
the client-side form (Server Actions are directly callable) would compute and persist a decade-long
"vacation," and `calculateVacationPayGross` would return a correspondingly enormous gross figure with no
rejection anywhere in the stack.
**Fix:** Add a `.refine` capping vacation length to a generous but bounded value (e.g. 366 days), returning
a clear Russian validation message, mirroring the amount cap's pattern in `bonus.ts`.

## Info

### IN-01: `ISO_DATE_SHAPE` + date-validity `refine` logic duplicated byte-for-byte between validation schemas

**File:** `src/lib/validation/vacation.ts:3-10`, `src/lib/validation/bonus.ts:7-14`
**Issue:** The regex and the `.refine` callback that rejects impossible calendar dates (e.g. `2026-02-30`)
are identical in both files.
**Fix:** Extract a shared `isoDateString` Zod schema (e.g. `src/lib/validation/shared.ts`) and import it
from both `bonus.ts` and `vacation.ts`.

### IN-02: `ISO_DATE_SHAPE` duplicated a third time in `vacation-form.tsx`

**File:** `src/app/(app)/vacations/vacation-form.tsx:11`
**Issue:** The client component re-declares the same regex (`/^\d{4}-\d{2}-\d{2}$/`) purely to gate the
live "N дней отпуска" day-count display, compounding the duplication noted in IN-01.
**Fix:** Once IN-01's shared module exists, export the regex itself (or a small `isValidIsoDateShape`
helper) from there for the client component to reuse.

---

_Reviewed: 2026-08-31T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
