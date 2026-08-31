# Phase 3: Vacation Pay - Context

**Gathered:** 2026-08-30
**Status:** Ready for planning

<domain>
## Phase Boundary

A user records a vacation date range. The system automatically computes отпускные using the average-daily-earnings formula (trailing 12 calendar months ÷ 29.3, ст.139 ТК РФ), accounting for salary changes across that window, taxes the result through the same cumulative НДФЛ mechanism as any other payment, and clearly discloses that the v1 calculation is a simplified estimate (no excludable-periods handling, per VAC-03).

Covers: VAC-01, VAC-02, VAC-03.

Excludes (belongs in later phases): annual pie chart and PWA installability (Phase 4). Excludable periods (sick leave, prior vacation, business trips, downtime) are explicitly out of scope per VAC-03/REQUIREMENTS.md — the calculation assumes none occurred in the trailing 12 months. Regional coefficient / northern allowance is out of scope per REQUIREMENTS.md's Out of Scope table.

</domain>

<decisions>
## Implementation Decisions

### Earnings Base for the 12-Month Average
- **D-V01:** The average-daily-earnings base includes gross salary **plus bonuses typed as "premium"** (performance-related). Bonuses typed as **"compensation"** (e.g. мат. помощь к отпуску) are excluded from the base — matches ст.139 ТК РФ's included/excluded earnings categories (FEATURES.md).
- **D-V02:** Reverses Phase 2's D-B07 ("no category field on bonuses"). Adds a **required** `type` field to the bonus schema/form: `"premium" | "compensation"`, defaulting to `"premium"` in the form (user can switch, does not block save). — **Reversibility:** costly — touches the `bonuses` table schema, `bonusInputSchema`, and the bonus form/row UI from Phase 2; a later removal would need a migration and UI rework.
- **D-V03:** Pre-existing bonus rows saved before this phase (no `type` value) are treated as `"premium"` by default when read for the vacation-base calculation — no forced backfill prompt or migration UI is shown to the user.

### Salary Change Handling
- **D-V04:** Average daily earnings is computed via **month-by-month recomputation against `salary_history`** — for each of the trailing 12 calendar months, the salary actually effective during that month is used, with day-level proration if a salary change occurs mid-month. No ПП №922 indexation-coefficient scaling is implemented (that rule only applies to specific company-wide-raise timing edge cases and is out of scope for this simplified v1 engine).
- **D-V05:** If a user has fewer than 12 months of `salary_history` when a vacation-pay calculation runs, the calculation uses whatever months are actually available — divides by N months and N × 29.3 instead of the full 12 × 29.3 — rather than blocking the calculation or refusing to compute.

### Vacation Pay's Payment/Tax Date
- **D-V06:** Vacation pay's payment date (and therefore its tax event date) is **auto-computed as vacation start date − 3 calendar days** (Ст.136 ТК РФ) — not the vacation start date itself, and not user-editable.
- **D-V07:** If the computed −3-day date falls on a weekend or RU public holiday, it **shifts earlier**, reusing the exact same holiday-calendar logic (D-02, `date-holidays`) already applied to avans/salary payment dates.
- **D-V08:** Vacation pay participates in the **same unified "next payment" slot** on the home screen as avans/salary/bonus — extends D-B10 (Phase 2) to a third payment-event type. There is no separate "next vacation" block; whichever dated event (schedule, bonus, or vacation-derived) is soonest wins the slot.

### Vacation Entry & Editing
- **D-V09:** Vacation is entered as a **date range** (start date + end date), not start-date-plus-day-count. Total vacation days (used in the отпускные formula) is derived automatically from the range, inclusive of both endpoints.
- **D-V10:** Editing/deletion mirrors the Phase 2 bonus pattern exactly: editing is **always allowed**, including a vacation whose payment date is already in the past, and recomputes cumulative income forward (matches D-B04/D-10). Deletion is **forbidden** once the computed payment date (start − 3 days, holiday-shifted) has already passed (matches D-B06).
- **D-V11:** Overlapping vacation date ranges are **rejected at save time** — validation blocks saving a new/edited range that overlaps an existing vacation range for the same user.
- **D-V12:** VAC-03's "this is a simplified calculation" disclosure is rendered as an **inline caption directly next to the calculated отпускные amount** — not a persistent dismissible/non-dismissible banner like D-11's YTD warning. Always visible alongside the result, non-intrusive.

### Claude's Discretion
None — every gray area discussed resolved to a concrete choice; no "you decide" deferrals in this session.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — VAC-01, VAC-02, VAC-03 (this phase's requirement IDs); Out of Scope table (excludable periods, regional coefficient)
- `.planning/ROADMAP.md` §"Phase 3: Vacation Pay" — goal, success criteria (4 items, all in scope), mode (mvp), depends on Phase 1, UI hint: yes
- `.planning/PROJECT.md` — core value, Key Decisions table (esp. the React Hook Form `values`+`reset()` pattern noted as reusable for Phase 3 edit forms)

### Tax & Vacation-Pay Domain (non-negotiable engine constraints)
- `.planning/research/FEATURES.md` §"Otpusknye (vacation pay) — ст. 139 ТК РФ" — the full formula, included/excluded earnings categories (D-V01's direct source), included/excluded day-count categories, 12-month lookback period definition
- `.planning/research/PITFALLS.md` — Pitfall 4: naive `totalEarnings / 12 / 29.3` without exclusions/proration is measurably wrong for anyone with a raise, under-12-months tenure, or excluded periods — directly informs D-V04/D-V05's scope boundary
- `.planning/research/ARCHITECTURE.md` line 201 — planned data flow: `salary_history` (+ other taxable payments) over trailing 12 months → `domain/vacation` average-daily-earnings function → inserted into payment timeline at its actual payment date (paid ~3 days before vacation starts, taxed on payment date not vacation date) — direct precedent for D-V06
- `.planning/research/ARCHITECTURE.md` line 281 — flags the exact bracket/29.3-divisor domain knowledge as needing confirmation against primary legal text during phase-specific research (not yet independently re-verified)

### Prior Phase Decisions Carried Forward
- `.planning/phases/01-core-payroll-loop/01-CONTEXT.md` — D-02/D-03 (weekend/holiday shift, day-of-month clamping) — direct precedent for D-V07; D-10 (cumulative income as a derived value, recompute-forward) — direct precedent for D-V10's edit-recompute behavior; D-13 (backdating allowed) — same precedent bonuses already followed
- `.planning/phases/02-bonuses-one-off-payments/02-CONTEXT.md` — D-B01 (a payment can create its own standalone dated event, not just top up schedule dates) — direct precedent for how a vacation-derived payment date plugs into next-payment resolution; D-B04/D-B06 (edit-anytime-with-recompute vs. delete-blocked-if-past asymmetry) — direct precedent for D-V10; D-B07 (no bonus category) — **reversed** by D-V02; D-B10 (unified next-payment slot across event types) — **extended** by D-V08

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getCumulativeIncomeBeforeDate`, `getActiveSalaryAt` (`src/lib/db/salary-repository.ts`) — the cumulative-income and point-in-time-salary reads a vacation-pay average-earnings function will need to call across each of the trailing 12 months
- `calculateNdfl` (`src/domain/tax/calculate-ndfl.ts`) — pure tax function, reused as-is; vacation pay taxes through the identical cumulative mechanism, no new tax path
- `resolve-payment-date.ts` (`src/domain/schedule/`) — the D-02/D-03 weekend/holiday-shift and clamping logic; reused directly for D-V07's −3-day-date shift
- Server Action + Zod validation pattern from `src/app/actions/bonus.ts` — direct template for a new `src/app/actions/vacation.ts`
- `bonus-row.tsx`'s `useForm` `values:`/`reset()` resync pattern (PROJECT.md Key Decisions) — must be reused verbatim for the vacation edit form to avoid CR-01's stale-data bug recurring

### Established Patterns
- Money as integer kopecks (`bigint({ mode: "number" })`), never floating point
- No logging of money values anywhere in domain/repository/action modules (T-01-04/T-02-04 convention)
- Postgres `check()` constraints as a second gate behind Zod validation
- `onConflictDoUpdate` / ownership-scoped (`eq(<table>.userId, userId)`) query conventions from `bonus-repository.ts` and `salary-repository.ts`
- Pure, framework-free domain functions under `src/domain/` (functional core, imperative shell) — a new `src/domain/vacation/` module for the average-daily-earnings calculation follows this convention

### Integration Points
- `bonuses` table (`src/lib/db/schema.ts`) needs a new `type` column (D-V02) — additive schema change, same migration pattern as Phase 2's Task 1
- New `vacations` table joins `salary_history` and `bonuses` (filtered by `type = 'premium'`) for the 12-month earnings query
- `src/app/actions/forecast.ts`'s next-payment resolution (already generalized in Phase 2 for bonus-derived dates per D-B10) needs to also consider vacation-derived payment dates (D-V08)
- Home screen component (`src/app/(app)/page.tsx` / `next-payment-card.tsx`) needs a breakdown/caption rendering path for vacation pay, including the D-V12 inline simplification disclaimer

</code_context>

<specifics>
## Specific Ideas

- The single most consequential decision in this phase is D-V01/D-V02: including "premium" bonuses (but not "compensation" bonuses) in the vacation-pay earnings base required reopening Phase 2's deliberate "no bonus category" decision (D-B07). Downstream agents should treat this as an intentional, user-confirmed reversal — not a mistake to "simplify away."
- D-V06/D-V07 (vacation pay is legally paid 3 calendar days before the vacation starts, and that date itself shifts for weekends/holidays like any other payment date) is a specific, non-obvious legal detail the user explicitly wants modeled precisely — not approximated as "paid on the vacation start date."

</specifics>

<deferred>
## Deferred Ideas

None — no scope-creep suggestions came up during this session; every discussion stayed within VAC-01/02/03's boundary.

### Reviewed Todos (not folded)
None — no pending todos existed to cross-reference for this phase (`gsd_run query todo.match-phase` returned zero matches).

</deferred>

---

*Phase: 3-vacation-pay*
*Context gathered: 2026-08-30*
