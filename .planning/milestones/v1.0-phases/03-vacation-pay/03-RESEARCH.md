# Phase 3: Vacation Pay - Research

**Researched:** 2026-08-30
**Domain:** Automatic vacation pay (отпускные) calculation engine, 12-month rolling average with progressive tax integration
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Earnings Base for the 12-Month Average (D-V01/D-V02/D-V03)**
- Bonuses typed as `"premium"` (performance-related) are **included** in the vacation-pay base per ст.139 ТК РФ.
- Bonuses typed as `"compensation"` (e.g., мат. помощь к отпуску) are **excluded**.
- Pre-existing bonus rows without a `type` value default to `"premium"` when read for vacation calculations (no backfill prompt).
- Reversibility: **D-V02 is costly** — touches the `bonuses` schema, input schema, and bonus form UI from Phase 2.

**Salary Change Handling (D-V04/D-V05)**
- Average daily earnings computed via **month-by-month lookup against `salary_history`** — for each of the trailing 12 calendar months, the salary effective during that month is used, with day-level proration if a salary change occurs mid-month.
- ПП №922 indexation-coefficient scaling is **out of scope** — v1 simplified engine.
- If a user has fewer than 12 months of `salary_history`, the calculation uses whatever months are available — divides by N months and N × 29.3 instead of the full 12 × 29.3 (D-V05).

**Vacation Pay's Payment/Tax Date (D-V06/D-V07/D-V08)**
- Payment date auto-computed as **vacation start date − 3 calendar days** (Ст.136 ТК РФ) — not user-editable.
- If the −3-day date falls on a weekend or RU public holiday, it **shifts earlier** using the same `resolve-payment-date` logic already applied to avans/salary dates (D-02/D-03).
- Vacation pay participates in the **same unified "next payment" slot** as avans/salary/bonus (extends Phase 2's D-B10).

**Vacation Entry & Editing (D-V09/D-V10/D-V11/D-V12)**
- Vacation entered as **date range** (start + end), inclusive of both endpoints; vacation days derived automatically.
- Editing **always allowed** (including past-dated vacations), recomputes cumulative income forward.
- Deletion **blocked** once the computed payment date has passed.
- Overlapping vacation date ranges **rejected at save time** — validation blocks saving a range that overlaps existing vacation for the same user.
- VAC-03 simplification disclosure rendered as an **inline caption next to the calculated amount** — always visible, non-dismissible.

### Claude's Discretion
None — all decisions are locked per the CONTEXT.md session.

### Deferred Ideas (OUT OF SCOPE)
- Excludable periods handling (sick leave, prior vacation, downtime) — explicitly out of scope per VAC-03/REQUIREMENTS.md.
- Regional coefficient / northern allowance — out of scope per REQUIREMENTS.md Out of Scope table.
- Vacation "what-if" planner — deferred to v1.x/v2 (FEATURES.md).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VAC-01 | User can enter vacation dates | Date range input (start + end), inclusive; schema design below |
| VAC-02 | System automatically calculates отпускные using average daily earnings over preceding 12 months, accounting for salary changes | ст.139 ТК РФ formula confirmed; salary_history month-by-month lookup pattern; day-level proration logic — see "Otpusknye Calculation Engine" section |
| VAC-03 | Interface explicitly discloses simplified calculation (no excludable periods) | Inline caption pattern (D-V12) — see Architecture Patterns |

</phase_requirements>

## Summary

Phase 3 builds the vacation-pay (отпускные) calculation engine, the second major tax-domain feature in this app. Unlike Phase 1's per-payment progressive НДФЛ calculation (which flows forward cumulatively within a calendar year), vacation pay is a **one-time, backward-looking** computation: it reads the 12 calendar months preceding the vacation start date, sums all gross earnings (salary + "premium" bonuses, excluding "compensation" bonuses per ст.139 ТК РФ), divides by 12 × 29.3 to get average daily earnings, multiplies by vacation days, and taxes the result through the **same cumulative НДФЛ mechanism as any other payment**.

The key architectural decisions locked in CONTEXT.md are:

1. **Bonus categorization (D-V02)** — reverses Phase 2's "no category field" decision. Bonuses now have a required `type` field (`"premium" | "compensation"`), and only "premium" bonuses count toward the vacation-pay base.
2. **Month-by-month salary lookup (D-V04)** — the 12-month average must account for salary changes across the period via `salary_history` effective-date lookups, not just the current salary.
3. **Payment date = vacation_start − 3 days, holiday-shifted (D-V06/D-V07)** — reuses `resolve-payment-date` logic, a non-obvious legal detail (ст.136 ТК РФ).
4. **Inline simplification disclaimer (D-V12)** — VAC-03 disclosure appears as a caption next to the calculated amount, always visible.

The НДФЛ calculation itself reuses Phase 1's `calculateNdfl` function unchanged — vacation pay is just another income-receipt event to be taxed against the cumulative annual base.

**Primary recommendation:** Implement the average-daily-earnings calculation as a pure domain function (`src/domain/vacation/calculate-average-daily-earnings.ts`), heavily unit-tested with real salary-history scenarios (raises mid-period, under-12-months tenure, etc.). Mirror the Phase 2 bonus pattern for Server Actions (Zod validation, ownership-scoped repository layer) and React Hook Form (with the `values`/`reset()` pattern from PROJECT.md Key Decisions to avoid CR-01 regressions). Extend the next-payment forecast resolution to also consider vacation-derived payment dates.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Vacation date entry (VAC-01) | API / Backend | Database / Storage | Server Action validates date range + overlap rejection (Zod), writes to `vacations` table |
| 12-month earnings average calculation (VAC-02) | API / Backend | Database / Storage | Pure domain function (`calculate-average-daily-earnings`) reads from `salary_history` + bonuses filtered by type='premium', invoked during forecasting |
| Vacation pay taxation (TAX-02 extended) | API / Backend | — | Computed vacation-pay amount fed to existing `calculateNdfl` — no separate tax path |
| Payment date resolution for vacation (D-V06/D-V07) | API / Backend | — | Reuses existing `resolvePaymentDate` + holiday-shift logic, but applied to vacation_start − 3 days |
| Next payment selection with vacations (D-V08) | API / Backend | Frontend Server (SSR) | Extend `selectNextPaymentEvent` in forecast action to consider vacation-derived dates alongside scheduled avans/salary + bonus-derived dates |
| Vacation form & edit UI | Frontend Server (SSR) | API / Backend | React Hook Form (values/reset pattern) + Zod validation at boundary |

## Standard Stack

This phase does not introduce new external packages. All required libraries are already locked in CLAUDE.md and proven in Phases 1–2.

### Existing Stack (reused from prior phases)
| Library | Version | Purpose | Why Used in Phase 3 |
|---------|---------|---------|---------------------|
| Drizzle ORM | 0.45.2 | Database schema + migrations | New `vacations` table, add `type` column to `bonuses` — same pattern as Phase 1 salary_history |
| Zod | 4.4.3 | Input validation | Vacation date range validation, overlap rejection at schema boundary |
| React Hook Form | latest | Form state | Vacation entry/edit forms (reuse `values`/`reset()` pattern from Phase 2 bonus form) |
| date-fns | 4.4.0 | Date math | Vacation date range arithmetic, 12-month lookback window calculation, day counting |
| Better Auth | 1.7.2 | Auth / ownership scoping | Session-based userId for vacation ownership (no new auth requirements) |
| Next.js Server Actions | 16.3.3 | Mutation / backend boundary | `saveCacationAction`, `deleteVacationAction` pattern mirrors Phase 2 bonus actions |

### New Schema (Drizzle additions)

**1. Add `type` column to `bonuses` table:**
```sql
ALTER TABLE bonuses ADD COLUMN type text NOT NULL DEFAULT 'premium';
-- Type constraint: 'premium' | 'compensation'
```

**2. New `vacations` table:**
```sql
CREATE TABLE vacations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, start_date, end_date),
  CHECK (end_date >= start_date)
);
CREATE INDEX vacations_user_id_idx ON vacations(user_id);
```

**Note:** No explicit overlap-uniqueness constraint at the database level; overlap validation happens at the application/Zod boundary (D-V11) for clearer error messaging.

## Package Legitimacy Audit

**No new packages required for Phase 3.** All calculations and form patterns use existing stack:
- Domain function logic: pure TypeScript (no new dependencies)
- Average earnings calculation: uses existing `date-fns` and `salary_history` queries
- Bonus type categorization: Zod schema enhancement (no new package)
- Form handling: existing React Hook Form (no new package)
- Tax integration: existing `calculateNdfl` function (no new package)

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram — Phase 3 vacation-pay feature

```
Browser
   │  HTTPS
   ▼
Next.js App Router
   │
   ├─ Form: VacationEntryForm
   │      │  date range input (start, end)
   │      │  Zod client-side validation
   │      ▼
   │   Server Action: saveVacationAction(userId, startDate, endDate, note?)
   │      │  [re-validate with Zod]
   │      │  [check for overlaps against existing vacations for this user]
   │      ▼
   │   Repository: createVacation / updateVacation
   │      │
   │      ▼
   │   Postgres: vacations table
   │
   ├─ Forecast reconciliation (on home screen render)
   │      │  forecastNextPayment(userId)
   │      ├─ load: active schedule (avans/salary days)
   │      ├─ load: next scheduled payment date
   │      ├─ load: future bonuses
   │      ├─ load: active vacations  ◄──── NEW
   │      │
   │      ├─ for each future vacation:
   │      │      1. payment_date = vacation.startDate − 3 days
   │      │      2. shift_for_weekend/holiday (resolve-payment-date logic)
   │      │      3. calc average-daily-earnings from trailing 12 months
   │      │      4. otpusknye = avg × (vacation.endDate − vacation.startDate + 1)
   │      │      5. tax via calculateNdfl(cumulative + otpusknye)
   │      │
   │      └─ selectNextPaymentEvent(scheduleEvent, bonusEvents, vacationEvents)  ◄──── NEW SELECTION LOGIC
   │              → earliest event by date wins the "next payment" slot
   │
   └─ Display: NextPaymentCard
           │  shows: date, kind (avans/salary/bonus/vacation), gross, tax, net
           │  if kind='vacation', includes inline disclaimer caption
           └─ "Это упрощённый расчёт отпускных — не учитывает периоды нетрудоспособности и предыдущие отпуска."
```

### Recommended Project Structure (Phase 3 additions)

```
src/
├── domain/
│   └── vacation/
│       ├── calculate-average-daily-earnings.ts      # pure function
│       ├── calculate-average-daily-earnings.test.ts # Vitest — scenarios below
│       └── vacation-types.ts                        # type definitions
├── lib/
│   └── db/
│       ├── schema.ts  [amended]                     # add vacations table + bonuses.type column
│       └── vacation-repository.ts                   # createVacation, updateVacation, listVacations
├── app/
│   ├── actions/
│   │   └── vacation.ts                              # saveVacationAction, deleteVacationAction
│   └── (app)/
│       ├── vacations/
│       │   ├── page.tsx                             # vacation list
│       │   └── vacation-row.tsx                     # editable row (reuse Phase 2 form pattern)
│       └── (amended) page.tsx                       # home screen, extend next-payment resolution
```

### Pattern 1: Average Daily Earnings Calculation (ст.139 ТК РФ)

**What:** Pure, deterministic function that computes the average daily earnings from the preceding 12 calendar months, accounting for salary changes via `salary_history` effective-date lookups.

**When to use:** Every time a vacation is saved or the forecast is refreshed — this is the core non-tax math for the feature.

**Formula and Implementation Notes:**

```typescript
/**
 * Pure vacation-pay (отпускные) average daily earnings calculation per ст.139 ТК РФ.
 *
 * Given a vacation start date, computes the average daily earnings over the
 * 12 calendar months preceding that month:
 *   1. Identify the 12-month window: [vacation_start.month - 12, vacation_start.month)
 *   2. For each calendar month in that window:
 *      a. Load the salary effective at any point during that month from salary_history
 *      b. Prorate if the salary changed mid-month: sum = (days_at_rate_1 × rate_1) + (days_at_rate_2 × rate_2)
 *   3. Sum all gross earnings in the 12 months
 *   4. Add bonuses typed as 'premium' (exclude 'compensation', null defaults to 'premium')
 *   5. Divide by 12 × 29.3 = average daily earnings
 *   6. If fewer than 12 months of history exist, divide by actual month count × 29.3 per D-V05
 *
 * Never include excluded periods (sick leave, prior vacation) — v1 assumes none occurred (VAC-03).
 *
 * @param vacationStartDate — first day of vacation (used to identify the 12-month lookback period)
 * @param salaryRows — all salary_history rows for this user (unfiltered)
 * @param bonusRows — all bonus rows for this user, pre-filtered by type='premium' (no 'compensation')
 * @returns average daily earnings in kopecks
 */
export function calculateAverageDailyEarnings(
  vacationStartDate: Date,
  salaryRows: Array<{ effectiveFrom: Date; grossAmountKopecks: number }>,
  bonusRows: Array<{ dateKopecks: Date; amountKopecks: number }>
): Kopecks {
  // 12 months preceding vacation start month
  const vacationMonthIndex = vacationStartDate.getMonth();
  const vacationYear = vacationStartDate.getFullYear();
  
  let lookbackMonthCount = 0;
  let totalEarningsKopecks = 0;

  for (let i = 0; i < 12; i++) {
    const offset = 11 - i; // count backward
    const monthDate = new Date(vacationYear, vacationMonthIndex - offset, 1);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);

    // Salary for this month: find effective salary at the start of the month,
    // accounting for mid-month changes via day-level proration
    const salaryInMonth = calculateSalaryInMonth(monthStart, monthEnd, salaryRows);
    totalEarningsKopecks += salaryInMonth;

    // Bonuses in this month, type='premium' only (filtered by caller)
    const bonusesInMonth = bonusRows
      .filter(b => b.date >= monthStart && b.date <= monthEnd)
      .reduce((sum, b) => sum + b.amountKopecks, 0);
    totalEarningsKopecks += bonusesInMonth;

    if (salaryInMonth > 0 || bonusesInMonth > 0) {
      lookbackMonthCount++;
    }
  }

  // Per D-V05, use actual month count if < 12 months of history
  const monthCount = Math.max(lookbackMonthCount, 1);
  const averageDailyKopecks = Math.round(
    (totalEarningsKopecks / monthCount) / 29.3
  );
  
  return averageDailyKopecks;
}

/**
 * Helper: calculate total gross salary for a calendar month, accounting for
 * mid-month salary changes via day-level proration per D-V04.
 *
 * Example: salary changed from 300,000 on the 15th of a 30-day month.
 *   Days 1–14: 14 × (100,000 / 29.3) = 47,779
 *   Days 15–30: 16 × (200,000 / 29.3) = 109,214
 *   Total = 156,993
 */
function calculateSalaryInMonth(
  monthStart: Date,
  monthEnd: Date,
  salaryRows: Array<{ effectiveFrom: Date; grossAmountKopecks: number }>
): Kopecks {
  // Sort by effective_from
  const sorted = [...salaryRows].sort(
    (a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime()
  );

  // Find the salary record active at monthStart and any that change during the month
  const activeAtStart = sorted.filter(r => r.effectiveFrom <= monthStart).pop();
  if (!activeAtStart) return 0;

  let salaryTotal = 0;
  let currentRate = activeAtStart.grossAmountKopecks;
  let currentDate = monthStart;

  // Apply each rate for the days it was active in this month
  for (const record of sorted) {
    if (record.effectiveFrom > monthEnd) break;
    if (record.effectiveFrom > monthStart) {
      // Days from currentDate to record.effectiveFrom at currentRate
      const daysAtRate = differenceInDays(record.effectiveFrom, currentDate);
      const dailyRate = currentRate / 29.3;
      salaryTotal += Math.round(daysAtRate * dailyRate);
      currentDate = record.effectiveFrom;
      currentRate = record.grossAmountKopecks;
    }
  }

  // Remaining days in month at final rate
  const remainingDays = differenceInDays(monthEnd, currentDate) + 1;
  const dailyRate = currentRate / 29.3;
  salaryTotal += Math.round(remainingDays * dailyRate);

  return salaryTotal;
}
```

[CITED: ст.139 ТК РФ — verified via kontur.ru, garant.ru official domain sources in FEATURES.md research]
[VERIFIED: src/lib/db/schema.ts:20-40 — salary_history structure (id, userId, grossAmountKopecks, effectiveFrom)]

**Why not hand-roll:** The 12-month windowing, month-by-month salary lookup, and day-level proration for mid-month changes are easy to get subtly wrong (off-by-one month, wrong proration denominator, forgetting to include/exclude a bonus category). Isolating this as a pure, heavily unit-tested function makes it auditable and reusable if the logic ever needs to be explained to a user or adapted for exclusions later.

### Pattern 2: Vacation Entry & Edit Form (Reuse Phase 2 Bonus Pattern)

**What:** A date-range form (start + end) that validates for overlapping vacations and submits via a Server Action.

**When to use:** New vacation entry and editing of existing vacations.

**Key Pattern — React Hook Form `values` + `reset()`:**

```typescript
// vacation-row.tsx (client component)
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { vacationInputSchema } from "@/lib/validation/vacation";
import { saveVacationAction } from "@/app/actions/vacation";

export function VacationRow({ vacation }: { vacation?: Vacation }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm({
    resolver: zodResolver(vacationInputSchema),
    values: vacation
      ? {
          id: vacation.id,
          startDate: vacation.startDate,
          endDate: vacation.endDate,
        }
      : { id: undefined, startDate: "", endDate: "" },
  });

  const [isEditing, setIsEditing] = useState(false);

  const onSubmit = async (formData: z.infer<typeof vacationInputSchema>) => {
    const result = await saveVacationAction(formData);
    if (result.success) {
      reset(formData); // sync to submitted values, not original prop
      setIsEditing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("startDate")} type="date" />
      <input {...register("endDate")} type="date" />
      {errors.startDate && <p>{errors.startDate.message}</p>}
      {errors.endDate && <p>{errors.endDate.message}</p>}
      <button type="submit">Сохранить</button>
      <button
        type="button"
        onClick={() => {
          reset(); // revert to last-saved values
          setIsEditing(false);
        }}
      >
        Отмена
      </button>
    </form>
  );
}
```

[CITED: PROJECT.md Key Decisions — React Hook Form `values`/`reset()` pattern to avoid CR-01 stale-data bug; verified in Phase 2 BonusRow implementation]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|------------|-------------|-----|
| Overlapping vacation rejection | Custom date-range overlap detection | Zod schema with `.refine()` predicate + database query in the Server Action | Easy to get boundary cases wrong (inclusive vs. exclusive, same-day overlap, edge of month). Zod + query is the standard pattern and enforces correctness at the validation boundary. |
| 12-month salary lookback with mid-month changes | DIY salary history iteration | `calculateAverageDailyEarnings` pure function + `salary_history` Drizzle queries | Salary-change proration is prone to off-by-one errors (fence-post). The domain logic should be isolated, unit-tested, and auditable since tax calculations can be disputed. |
| Vacation payment date = start − 3 days, shifted for holidays | Custom date arithmetic | Reuse existing `resolvePaymentDate(year, monthIndex, dayOfMonth)` + apply to `vacation.startDate - 3 days` | The holiday/weekend shift logic already exists and is battle-tested in Phase 1. Don't duplicate it. |
| Tax on vacation pay | Separate "vacation tax" path | Feed calculated otpusknye amount to existing `calculateNdfl(cumulativeIncome + otpusknye, taxYear)` | Vacation pay taxes through the identical cumulative-НДФЛ mechanism as any other payment. A separate tax path is a correctness trap — it will quickly diverge from the main logic. |

**Key insight:** The average-daily-earnings calculation is the only genuinely new algorithmic challenge in this phase. Everything else (date shifting, tax, form patterns, ownership scoping) is reusing proven patterns from Phase 1–2.

## Common Pitfalls

### Pitfall 1: Forgetting to Account for Salary Changes in the 12-Month Lookback

**What goes wrong:**
A developer calculates otpusknye as `(salary_now × months_in_lookback) / 12 / 29.3`, not realizing that the user's salary may have changed during the 12-month period. If the user got a raise 6 months ago, the app calculates otpusknye as if they earned the current (higher) salary for the entire year, overstating the entitlement.

**Why it happens:**
The simple formula "12 months ÷ 29.3" is the one everyone quotes (ст.139 ТК РФ). The actual regulation requires using the **actual salary paid in each month**, not the current salary retro-applied. This is easy to miss if the lookup pattern isn't carefully designed.

**How to avoid:**
- Use the `calculateAverageDailyEarnings` function, which iterates month-by-month and looks up the salary **effective during each month** from `salary_history`.
- Unit test scenarios: salary constant (12 months same), salary increase mid-period, salary decrease mid-period, under-12-months tenure.
- Manually verify a worked example: if salary was 100K for months 1–6 and 120K for months 7–12, the 12-month total is (6 × 100K) + (6 × 120K) = 1.32M; average daily is 1.32M / 12 / 29.3 = 3,745. Do NOT compute 120K × 12 / 12 / 29.3 = 4,094.

**Warning signs:**
- Query loads only the current `salary_history` row, not the full history for the lookback period.
- No unit tests with salary-change scenarios.
- Off-by-one-month errors in the lookback window (using 11 months instead of 12).

**Phase to address:** Phase 3, before any vacation calculation reaches the UI.

---

### Pitfall 2: Including "Compensation" Bonuses in the Vacation-Pay Base

**What goes wrong:**
A developer assumes all bonuses count toward the vacation-pay base and includes both performance premiums (вознаграждение за результаты) and social assistance/one-time bonuses (мат. помощь, подарки) in the average-earnings calculation. Per ст.139 ТК РФ, only earnings are included — social assistance does not count. The app overstates otpusknye.

**Why it happens:**
Before Phase 3, the app has no concept of bonus types — all bonuses are just entries in a single `bonuses` table (Phase 2, D-B07). The revision to add a `type` field is a deliberate decision to capture this distinction, so it's easy to forget that the new field is **required** for correct vacation math.

**How to avoid:**
- The Zod validation schema for bonuses must include a required `type: 'premium' | 'compensation'` field, default to `'premium'` in the form (since performance bonuses are more common), but force a conscious choice.
- When querying bonuses for the vacation calculation, **always filter by `type = 'premium'`** — never sum all bonuses.
- Unit test: create a bonus with `type='compensation'` and verify it does NOT appear in the vacation-pay calculation.
- Inline comment at every call site: `bonusRows.filter(b => b.type === 'premium')` — do not allow `bonusRows` without the filter.

**Warning signs:**
- Bonus form has no `type` field, or has it but does not default/suggest "premium".
- Vacation calculation query does not filter bonuses.
- No test case with both bonus types.

**Phase to address:** Phase 3 Task 1 (schema/form update), before the calculation itself is built.

---

### Pitfall 3: Wrong Vacation-Day Count (Off-by-One on Inclusive Ranges)

**What goes wrong:**
A user enters vacation dates 2026-08-01 to 2026-08-10 (both inclusive), expecting 10 days. The app calculates `endDate - startDate = 9 days`, undercounting by one.

**Why it happens:**
Date range arithmetic is naturally end-exclusive (`[start, end)`) in many languages and libraries (e.g., `Date.getTime()` differences). Russian vacation notation is inclusive on both ends (`1–10 = 10 дней`).

**How to avoid:**
- Always compute vacation days as `(endDate - startDate).days + 1` (add one for the inclusive endpoint).
- Unit test: `startDate=2026-01-01, endDate=2026-01-01 → 1 day` (not zero).
- Comment in code: `// inclusive range: 10-01 to 10-10 is 10 days, not 9`.

**Warning signs:**
- No explicit `+1` in the day-count formula.
- Off-by-one regressions after a code refactor that touches date math.

**Phase to address:** Phase 3, during the otpusknye formula implementation.

---

### Pitfall 4: Confusing Vacation **Start Date** with Vacation **Payment Date** (D-V06)

**What goes wrong:**
A developer treats the vacation start date as the payment date, computing otpusknye as `average_daily × days` and taxing it on `vacation.startDate`. This doesn't match ст.136 ТК РФ, which requires payment 3 calendar days **before** the vacation starts. The app then shows the wrong "next payment" date, and the tax might be calculated against the wrong cumulative-income total if the payment date crosses a month/bracket boundary.

**Why it happens:**
It's intuitive that "vacation payment" and "vacation start" are the same thing. But Russian law explicitly requires payment in advance — the employer must pay otpusknye 3 days before the employee takes time off. This is not a quirk of the app; it's a law the app must follow.

**How to avoid:**
- Explicitly compute `paymentDate = vacationStartDate - 3 days` at the point where a vacation is saved or displayed.
- Apply `resolvePaymentDate(paymentDate.year, paymentDate.monthIndex, paymentDate.day)` to shift for weekends/holidays, exactly as Phase 1 does for salary.
- In the forecast, query vacations and **always convert to payment date before comparing with other payment events** (scheduled salary, bonuses).
- Unit test: vacation 2026-08-15 (Friday, no holiday) → payment 2026-08-12 (Tuesday). Vacation 2026-01-03 (Friday, New Year holidays) → payment must shift earlier to 2025-12-30.
- Comment in code: `// Per ст.136 ТК РФ, otpusknye is paid 3 days BEFORE the vacation starts, not on the start date.`

**Warning signs:**
- Vacation table has a `paymentDate` column that is user-editable, or is not set.
- Forecast logic treats `vacation.startDate` as a payment date without the −3 shift.
- Tests do not include holidays or weekends around the −3-day computation.

**Phase to address:** Phase 3, before vacation dates reach the UI or forecast.

---

### Pitfall 5: Not Handling Under-12-Months Tenure (D-V05)

**What goes wrong:**
A user signs up on 2026-05-01 and enters vacation dates on 2026-08-01. The 12-month lookback period `2025-08-01...2026-08-01` contains no salary history (user only has 3 months of records). A naive implementation divides by 12 × 29.3 anyway, resulting in a 4x underestimate of otpusknye.

**Why it happens:**
D-V05 explicitly says to use whatever months are available and divide by `actualMonthCount × 29.3`, not force-pad the 12. This is the correct legal interpretation (ст.139 ТК РФ, ПП №922), but easy to forget.

**How to avoid:**
- The `calculateAverageDailyEarnings` function must **count the actual months in the lookback period** and divide by that count, not hardcode 12.
- If salary history is shorter than 12 months, compute the lookback period from the **earliest salary_history record** to the vacation start date, not from "exactly 12 months ago."
- Unit test: new user with 3 months of history, vacation on month 4 → average should be `(3-month total) / 3 / 29.3`, not divided by 12.

**Warning signs:**
- Division by hardcoded `12` instead of `monthCount` variable in the earnings formula.
- No unit test with new-user scenarios.

**Phase to address:** Phase 3, in the `calculateAverageDailyEarnings` implementation.

## Code Examples

### Example 1: Vacation Zod Input Schema

[VERIFIED: src/lib/validation/bonus.ts structure — mirrors pattern with added fields for vacation]

```typescript
// src/lib/validation/vacation.ts
import { z } from "zod";

export const vacationInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    startDate: z.string().date("Start date must be YYYY-MM-DD"),
    endDate: z.string().date("End date must be YYYY-MM-DD"),
    note: z.string().optional(),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: "End date must be >= start date",
    path: ["endDate"],
  });

export type VacationInput = z.infer<typeof vacationInputSchema>;
```

### Example 2: Server Action for Saving Vacation

```typescript
// src/app/actions/vacation.ts
"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/session";
import { vacationInputSchema } from "@/lib/validation/vacation";
import { createVacation, updateVacation, checkOverlapVacations } from "@/lib/db/vacation-repository";

export type VacationActionResult =
  | { success: true }
  | { success: false; fieldErrors: Record<string, string[]> };

export async function saveVacationAction(
  formData: FormData | Record<string, any>
): Promise<VacationActionResult> {
  const userId = await requireUserId();

  const parsed = vacationInputSchema.safeParse(
    formData instanceof FormData
      ? {
          id: formData.get("id") || undefined,
          startDate: formData.get("startDate"),
          endDate: formData.get("endDate"),
          note: formData.get("note"),
        }
      : formData
  );

  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { startDate, endDate, id } = parsed.data;
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);

  // Check for overlaps with existing vacations
  const overlap = await checkOverlapVacations(userId, startDateObj, endDateObj, id);
  if (overlap) {
    return {
      success: false,
      fieldErrors: {
        startDate: [
          "Этот период пересекается с существующим отпуском. Отпуск может быть только один в один период.",
        ],
      },
    };
  }

  try {
    if (id) {
      await updateVacation(userId, id, startDateObj, endDateObj, parsed.data.note);
    } else {
      await createVacation(userId, startDateObj, endDateObj, parsed.data.note);
    }
  } catch {
    return {
      success: false,
      fieldErrors: {
        startDate: ["Не удалось сохранить отпуск. Попробуйте ещё раз."],
      },
    };
  }

  revalidatePath("/");
  revalidatePath("/vacations");
  return { success: true };
}

export async function deleteVacationAction(vacationId: string): Promise<VacationActionResult> {
  const userId = await requireUserId();
  
  // Parse & validate UUID
  const parsed = z.string().uuid().safeParse(vacationId);
  if (!parsed.success) {
    return { success: false, fieldErrors: { startDate: ["Отпуск не найден"] } };
  }

  try {
    const result = await deleteVacationIfFuture(userId, parsed.data);
    if (result.status === "blocked") {
      return {
        success: false,
        fieldErrors: {
          startDate: [
            "Нельзя удалять отпуска, которые уже начались. Вы можете изменить даты.",
          ],
        },
      };
    }
    if (result.status === "not-found") {
      return { success: false, fieldErrors: { startDate: ["Отпуск не найден"] } };
    }
  } catch {
    return {
      success: false,
      fieldErrors: {
        startDate: ["Не удалось удалить отпуск. Попробуйте ещё раз."],
      },
    };
  }

  revalidatePath("/");
  revalidatePath("/vacations");
  return { success: true };
}
```

### Example 3: Extending Next-Payment Forecast to Include Vacations

```typescript
// src/app/actions/forecast.ts — amendment to selectNextPaymentEvent

export function selectNextPaymentEvent(
  scheduleEvent: { dateIso: string; kind: PaymentKind } | null,
  futureBonusDatesAscending: readonly string[],
  futureVacationPaymentDatesAscending: readonly { dateIso: string; vacationId: string }[], // NEW
): { dateIso: string; kind: PaymentKind | "bonus" | "vacation"; vacationId?: string } | null {
  // Collect all candidate events
  const candidates = [];
  
  if (scheduleEvent) {
    candidates.push({ dateIso: scheduleEvent.dateIso, kind: scheduleEvent.kind as PaymentKind | "bonus" });
  }
  
  if (futureBonusDatesAscending[0]) {
    candidates.push({ dateIso: futureBonusDatesAscending[0], kind: "bonus" });
  }
  
  if (futureVacationPaymentDatesAscending[0]) {
    candidates.push({
      dateIso: futureVacationPaymentDatesAscending[0].dateIso,
      kind: "vacation",
      vacationId: futureVacationPaymentDatesAscending[0].vacationId,
    });
  }

  // Pick the earliest by dateIso
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => a.dateIso.localeCompare(b.dateIso))[0];
}
```

## Validation Architecture

[Included because `workflow.nyquist_validation` is true in .planning/config.json]

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.11 (proven in Phase 1–2) |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `npm run test -- src/domain/vacation` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VAC-01 | User can enter vacation dates (start + end, inclusive) | unit + integration | `npm run test -- vacation-input.test.ts` | ❌ Wave 0 |
| VAC-02 | Average daily earnings calculated correctly with salary changes, under-12-months tenure, excluded bonuses | unit | `npm run test -- calculate-average-daily-earnings.test.ts` | ❌ Wave 0 |
| VAC-02 | Vacation payment date = start − 3 days, holiday-shifted | unit | `npm run test -- resolve-vacation-payment-date.test.ts` (reuses resolve-payment-date logic) | ✅ (leverage Phase 1) |
| VAC-03 | Overlapping vacation rejection at form/API boundary | integration | `npm run test -- vacation-overlap.test.ts` | ❌ Wave 0 |
| VAC-02 | Vacation pay taxed through cumulative НДФЛ engine | integration | `npm run test -- forecast-with-vacation.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test -- src/domain/vacation` — core domain tests
- **Per wave merge:** `npm run test` — full test suite
- **Phase gate:** Full suite green + VAC-03 inline disclaimer rendering verified (manual or Playwright smoke test)

### Wave 0 Gaps

- [ ] `src/domain/vacation/calculate-average-daily-earnings.test.ts` — unit tests covering:
  - [ ] Constant salary over 12 months → correct average
  - [ ] Salary increase mid-period → correct proration per D-V04
  - [ ] Salary decrease mid-period → correct proration
  - [ ] Under-12-months tenure (new user) → divides by actual months per D-V05
  - [ ] Premium vs. compensation bonus distinction per D-V01/D-V02
  - [ ] Edge case: vacation on exact anniversary of hire date
- [ ] `src/lib/validation/vacation.test.ts` — Zod schema tests:
  - [ ] Valid date range accepted
  - [ ] End date < start date rejected
  - [ ] Invalid date format rejected
  - [ ] Overlap rejection at schema level (requires async refinement + database mock)
- [ ] `src/lib/db/vacation-repository.test.ts` — integration tests (with test database):
  - [ ] Overlap detection: two non-overlapping ranges accepted
  - [ ] Overlap detection: ranges with same start/end rejected
  - [ ] Overlap detection: ranges touching on boundary (2026-08-01 to 08-10 vs. 08-10 to 08-20) handled correctly per D-V11
  - [ ] Create vacation, read, update, delete (CRUD completeness)
  - [ ] Ownership scoping: one user's vacation not visible to another
- [ ] `src/app/actions/vacation.test.ts` — Server Action tests:
  - [ ] saveVacationAction accepts FormData or object (mirrors Phase 2 bonus pattern)
  - [ ] deleteVacationAction rejects deletion if payment date has passed (D-V10)
  - [ ] Revalidates correct paths on success
- [ ] `src/app/actions/forecast.test.ts` amendments:
  - [ ] selectNextPaymentEvent: vacation payment date sorts correctly vs. scheduled/bonus dates
  - [ ] Vacation's cumulative tax through calculateNdfl matches bonuses
  - [ ] Future vacation with no salary history (new user) computes otpusknye correctly (D-V05)
- [ ] Manual/Playwright smoke test:
  - [ ] User enters vacation date range → next-payment card shows vacation payment date, gross, tax, net
  - [ ] Inline disclaimer "Это упрощённый расчёт отпускных..." appears next to the amount (D-V12)

**Architecture:** Reuse Phase 1–2 test patterns (Vitest + jsdom for unit/integration, test database branch via Neon for repo tests, Playwright for smoke).

## Security Domain

[Required because `security_enforcement` is true in .planning/config.json]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Ownership scoped by session `userId` (Better Auth) — no new auth mechanism |
| V3 Session Management | no | Reuse Phase 1–2 session patterns |
| V4 Access Control | **yes** | Vacation CRUD operations must be ownership-scoped (`WHERE user_id = $1`) per D-01 pattern |
| V5 Input Validation | **yes** | Zod schema at Server Action boundary (date range, no negative days, overlap check) |
| V6 Cryptography | no | No new crypto; dates are not secrets |
| V7 Error Handling | **yes** | Generic retry messages (no details exposed) per Phase 1 T-01-09/T-02-04 |
| V8 Data Protection | no | No new data sensitivity (salary figures already in scope) |
| V9 Communication | no | HTTPS enforced by Next.js/Vercel |
| V10 Malicious Code | no | No third-party scripts or uploads |
| V11 Business Logic | **yes** | Overlap validation (two vacations cannot occupy the same user's time) |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection in vacation overlap check | Tampering | Use parameterized Drizzle queries (`.where(sql`...`)` syntax forbidden), not string concatenation. The vacation-repository overlap function must use safe Drizzle filtering. |
| Information disclosure: user A reads user B's vacation dates | Information Disclosure | Ownership scoping: every vacation query must include `.where(eq(vacations.userId, userId))`. No bulk read without filtering. Test: create two test users, verify one cannot see the other's vacations. |
| Timezone bugs in date arithmetic (e.g., −3 days computed in UTC, but user is in MSK) | Denial of Service / incorrect logic | Payment date = vacation.startDate − 3 days is calendar arithmetic, not timezone-aware (correct). But ensure all date columns use `DATE` type (not TIMESTAMP), and all comparisons are in the user's local timezone per Phase 1's `nowInMoscow()`/`todayIsoInMoscow()` pattern. [VERIFIED: src/domain/time/index.ts — confirms timezone handling already established] |
| CSRF on vacation deletion | Cross-Site Request Forgery | deleteVacationAction is a Server Action with `"use server"` directive — Next.js automatically includes CSRF token validation. No additional protection needed. |
| Business logic bypass: user manually crafts a vacation with overlapping dates via API | Tampering | Overlap validation must happen **both** at the Zod schema level (client-side rejection) and at the repository level (database-layer check). Do not rely on client validation alone. |

**No High-Risk Threats for this phase.** Vacation pay is additive to salary (no new tax-disclosure risk), dates are not sensitive, and all operations are already subject to ownership scoping (D-01 pattern proven in Phase 1–2).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | ст.139 ТК РФ vacation-pay formula (12-month average, 29.3 divisor, excluded-periods rule) is correctly sourced from FEATURES.md Phase 1 research. | Otpusknye Calculation Engine | High — incorrect formula undercounts/overcounts vacation entitlements, eroding user trust. User would notice discrepancy against real payslip. Mitigation: FEATURES.md already verified formula across 3+ independent sources (garant.ru, kontur.ru, secrets.tbank.ru). Recommend spot-checking the 29.3 divisor against a primary ТК РФ text during Phase 3 implementation if web access permits. |
| A2 | Phase 2 bonuses table structure (id, userId, amountKopecks, date, note) exists exactly as specified in `src/lib/db/schema.ts` lines 82–99. | Standard Stack, Package Legitimacy Audit | Low — schema mismatch would be caught at migration time. Verified by reading schema.ts line-by-line. |
| A3 | The `resolvePaymentDate` function from Phase 1 (domain/schedule/resolve-payment-date.ts) correctly applies weekend/holiday shift logic per D-02 and can be reused for vacation payment date computation without modification. | Architecture Patterns | Medium — if resolve-payment-date has a bug (e.g., off-by-one holiday boundary), vacation dates will be wrong for every user. Mitigation: Phase 1's resolve-payment-date.test.ts already has unit tests (verified in Phase 1 research). Recommend running those tests as-is during Phase 3 implementation. |
| A4 | React Hook Form `values`/`reset()` pattern from Phase 2 BonusRow (PROJECT.md Key Decisions) prevents CR-01 stale-data bug and can be directly transplanted to VacationRow without modification. | Code Examples | Low — form pattern is technology-standard; tested in Phase 2. Minor risk: if vacation row has a different UI structure (e.g., inline editing vs. modal), the form logic may need adaptation. |
| A5 | The `calculateNdfl` pure function from Phase 1 (domain/tax/calculate-ndfl.ts) can tax vacation pay without modification — otpusknye amount is fed as cumulative income, no separate tax path needed. | Code Examples, Security Domain | Low — calculateNdfl is pure and agnostic to payment type. Risk: if vacation is treated as a special case (e.g., different withholding rate), the existing function won't apply. Mitigation: ст.139 ТК РФ confirms vacation pay uses the same 5-step НДФЛ scale as salary; no special rate. |
| A6 | Vacation `type` field on bonuses (D-V02, `"premium" | "compensation"`) can default to `"premium"` in the form without confusing users. | Architecture Patterns | Medium — if "performance bonus" vs. "social assistance" distinction is unfamiliar to Russian users, they may mis-categorize bonuses. Mitigation: form should include a brief hint text ("Это средства за результаты работы, которые учитываются при расчёте отпускных") to clarify the category. |

**If this table is not empty:** All assumptions are flagged [ASSUMED] because they rely on existing decisions from earlier phases or on project-level research that was not re-verified in this session. The risk levels are LOW-MEDIUM — none block execution, but reconfirming #A1 (vacation formula) against primary ТК РФ text during implementation is recommended if feasible. |

## Open Questions (RESOLVED)

1. **Bonus-type UX clarity (D-V02)** — [RESOLVED: D-V02, 03-02-PLAN.md Task 2]
   - What we know: Zod schema will require a `type` field on bonuses; form must default to `"premium"`.
   - What's unclear: What label/hint text should be shown to clarify "performance bonus" vs. "compensation" for Russian users unfamiliar with the tax distinction?
   - Recommendation: Add a tooltip or help-text example during Phase 3 UI implementation (not research scope), and test with a real user if possible.
   - Resolution: 03-02-PLAN.md Task 2 specifies the exact Russian copy distinguishing the two bonus types on the form.

2. **Boundary case: vacation spanning two salary-change dates** — [RESOLVED: 03-01-PLAN.md Task 2]
   - What we know: Salary changes are effective-dated; vacation average must account for month-by-month lookups.
   - What's unclear: If a salary change happens on 2026-03-15 and another on 2026-03-20, both within the same lookback month, are both prorated, or is only the final one used?
   - Recommendation: Treat as "use the last-effective salary for that month" (simplification). If correctness demands all in-month changes be prorated, the `calculateSalaryInMonth` helper above shows how; this is a detailed implementation decision, not a research gap.
   - Resolution: 03-01-PLAN.md Task 2 implements month-by-month proration per the simplification above.

3. **UI for displaying vacation otpusknye breakdown (not VAC-03, but related)** — [RESOLVED: D-V08, 03-04-PLAN.md Task 1]
   - What we know: VAC-03 requires an inline disclaimer. D-V08 extends the next-payment card to show vacation events.
   - What's unclear: Should the card show a breakdown (gross otpusknye amount, tax, net) or just a total, and should it link to a detail view?
   - Recommendation: Treat as Phase 3 UI-spec decision. At minimum, show gross, tax, and net (matching salary/bonus card format). A detail view showing "average daily × days = otpusknye" could be deferred.
   - Resolution: 03-04-PLAN.md Task 1 renders the vacation-kind branch of the next-payment card with gross/tax/net breakdown and the D-V12 disclaimer.

## Environment Availability

[Skipped — Phase 3 is code/schema-only; no external tools or services beyond Neon (already verified in Phase 1) are required.]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bonus field: just `amountKopecks` (Phase 2) | Bonus field: add `type` ('premium' \| 'compensation') | D-V02, this phase | Enables correct vacation-pay calculation; no longer assume all bonuses count toward average |
| Next payment: avans/salary/bonus only | Next payment: also consider vacation-derived events | D-V08, this phase | Users see "next payment" as whichever event is soonest, including vacation pay |
| Vacation calculation: deferred | Vacation calculation: implemented as pure domain function | This phase | Resolves VAC-02, enables budget forecasting for vacation periods |

**Deprecated/outdated:**
- (none in Phase 3 scope)

## Sources

### Primary (HIGH confidence)
- `.planning/research/FEATURES.md` ст.139 ТК РФ vacation-pay formula section — income-base mechanics, excluded-period rules, 12-month window, 29.3 divisor (cross-verified against garant.ru, kontur.ru, secrets.tbank.ru sources cited)
- `.planning/research/PITFALLS.md` Pitfall 4 — vacation-pay calculation mistakes, salary-change proration requirement
- `src/domain/schedule/resolve-payment-date.ts` — existing holiday-shift logic for D-V07 reuse
- `src/domain/tax/calculate-ndfl.ts` — existing tax engine for vacation pay to route through
- CONTEXT.md Phase 3 decisions (D-V01 through D-V12) — user-locked implementation constraints

### Secondary (MEDIUM confidence)
- Phase 1 & 2 code patterns (repository, Server Actions, React Hook Form) — proven in working codebase, reusable without modification
- Phase 1 resolve-payment-date.test.ts — test patterns for date logic
- Phase 2 bonus-repository.ts / bonus.ts / bonus-row.tsx — CRUD and form patterns to mirror

### Tertiary (LOW confidence)
- Training knowledge of Russian tax law (no authoritative primary text fetched this session) — flagged #A1 for reconfirmation during implementation if feasible

---

**Confidence breakdown:**
- **Formula (ст.139 ТК РФ, 29.3 divisor, 12-month window):** HIGH — sourced from multi-source FEATURES.md research (Phase 1) with cross-check against garant.ru and kontur.ru
- **Architecture (reuse resolve-payment-date, calculateNdfl, repository patterns):** HIGH — all patterns proven in Phase 1–2 code
- **Bonus type categorization (premium vs. compensation per ст.139):** MEDIUM-HIGH — verified in FEATURES.md, not independently re-confirmed this session
- **Day-level proration for mid-month salary changes:** MEDIUM — described in PITFALLS.md and Phase 1 research, not independently validated against primary legal text

**Research valid until:** 30 days (stable domain, no recent tax-law changes flagged in Phase 1 research; revisit if Russian government announces 2027 НДФЛ/ТК РФ amendments).

---

*Phase 3 research complete: 2026-08-30*
*Ready for planning.*
