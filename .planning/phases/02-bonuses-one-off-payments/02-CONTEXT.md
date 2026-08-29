# Phase 2: Bonuses & One-off Payments - Context

**Gathered:** 2026-08-30
**Status:** Ready for planning

<domain>
## Phase Boundary

A user attaches a one-off premium or compensation to a specific payment date. The bonus is taxed through the same cumulative НДФЛ engine as regular salary (BON-02), correctly affecting the take-home amount for that payment and every subsequent payment in the calendar year. If the bonus lands on or creates the next upcoming payment event, the home screen's next-payment display reflects it.

Covers: BON-01, BON-02.

Excludes (belongs in later phases): vacation pay (Phase 3), annual pie chart and PWA installability (Phase 4). Tax-exempt compensation categories (e.g. statutory non-taxable compensation types under НК РФ) are out of scope — every one-off payment is taxed uniformly through the same progressive mechanism, per BON-02's explicit wording.

</domain>

<decisions>
## Implementation Decisions

### Binding to a Payment Date
- **D-B01:** A bonus can be attached to ANY date the user picks — it is not restricted to existing avans/salary schedule dates. If the date doesn't match the regular schedule, the bonus creates its own standalone one-off payment event. — **Reversibility:** costly — restricting to schedule-only dates later would require migrating any standalone bonus-only payment events into the schedule model.
- **D-B02:** Backdating is allowed — a bonus can be entered with an effective date in the past, consistent with D-13 (salary backdating) from Phase 1.
- **D-B03:** Multiple bonuses can be added to the same payment date. They are summed and taxed together as a single increment to cumulative year-to-date income for that date (not taxed as separate events).

### Editing & Deletion
- **D-B04:** A saved bonus (amount and/or date) can be fully edited at any time, including bonuses whose payment date is already in the past — editing a past bonus recomputes cumulative income and re-taxes every later payment forward, consistent with D-10's "cumulative income as a derived value" design.
- **D-B05:** A full list/history of all bonuses (past and future) is shown to the user — not just the one affecting the next payment.
- **D-B06:** Deletion of a bonus whose payment date is already in the past is forbidden — only current/future bonuses can be deleted. This is the one asymmetry vs. editing: edit is always allowed (with forward recompute), delete is blocked once the payment date has passed. Rationale: deleting a past bonus would silently rewrite what was actually paid out; editing a wrong amount/date is a correction, deleting erases a real historical event.

### Bonus Input Form
- **D-B07:** No category/type selection (premium vs. compensation vs. other) — one universal "one-off payment" type. Per BON-02, all types are taxed identically, so a category field would add UI complexity with no effect on the calculation. Free to reconsider in a later milestone if reporting/filtering by type becomes a need.
- **D-B08:** An optional free-text note field is included (e.g. "13-я зарплата", "бонус за проект") so the user can remember what a bonus was for — purely descriptive, not used in tax calculation.

### Home Screen Display
- **D-B09:** When a bonus lands on the next payment, the home screen shows a breakdown (base salary + bonus shown separately), not just a combined total — so the user isn't surprised by an unexpectedly large number without knowing why.
- **D-B10:** The "next payment" concept is unified across payment types: whichever payment event (regular avans/salary OR a standalone bonus-only date) is soonest becomes "the next payment" shown on the home screen. There is no separate "next bonus" block — one next-payment slot, populated by whichever event wins on date.

### Claude's Discretion
None — every gray area discussed resolved to a concrete choice; no "you decide" deferrals in this session.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — BON-01, BON-02 (this phase's requirement IDs)
- `.planning/ROADMAP.md` §"Phase 2: Bonuses & One-off Payments" — goal, success criteria, mode (mvp), UI hint: yes
- `.planning/PROJECT.md` — core value, validated Phase 1 requirements, out-of-scope list

### Prior Phase Decisions Carried Forward
- `.planning/phases/01-core-payroll-loop/01-CONTEXT.md` — D-02/D-03 (weekend/holiday shift, clamping) apply identically to any payment event including bonus-only dates; D-10 (cumulative income as a derived value, recompute-forward pattern) is the direct model for D-B04's edit-recompute behavior; D-13 (backdating allowed for salary) is the direct precedent for D-B02

### Tax & Domain Engine (non-negotiable engine constraints)
- `.planning/research/PITFALLS.md` — Pitfalls 1, 2, 3, 7 (marginal-vs-flat tax, avans as independent taxable event, chronological cumulative folding, integer-kopeck rounding) apply identically to bonus payments — a bonus is just another dated income event folded into the same cumulative chain
- `.planning/research/ARCHITECTURE.md` — "functional core, imperative shell" pattern; cumulative YTD income as a derived value from an ordered ledger — bonuses become additional entries in that ledger, not a parallel calculation path

### Existing Implementation (Phase 1)
- `src/lib/db/schema.ts` — `salaryHistory`, `paymentSchedule`, `ytdBaseline` tables and their check-constraint/index conventions to follow for a new `bonuses` (or similarly named) table
- `src/lib/db/salary-repository.ts` — `getCumulativeIncomeBeforeDate`, `getActiveSalaryAt`, ownership-scoped query conventions (`eq(<table>.userId, userId)`) that a bonus repository must replicate
- `src/app/actions/forecast.ts` — next-payment forecast orchestration; D-B10 requires this module's "resolve next payment event" logic to also consider bonus-only dates, not just `nextPaymentOnOrAfter`'s avans/salary schedule output
- `src/domain/schedule/resolve-payment-date.ts`, `src/domain/pay/payment-accrual.ts` — D-02/D-03 weekend/holiday shift and clamping logic; needs to apply to bonus dates too if a bonus date itself falls on a weekend/holiday (research/planning question: does a bonus date also shift, or is it taken as entered? Flag for research.)
- `src/domain/tax/calculate-ndfl.ts` — the cumulative НДФЛ function bonuses tax through, unchanged

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getCumulativeIncomeBeforeDate` (salary-repository.ts) — the cumulative-income read a bonus repository will need to extend or compose with
- `calculateNdfl` (domain/tax) — pure tax function, reused as-is; bonuses don't need a new tax calculation path
- Server Action + Zod validation pattern from `src/app/actions/salary.ts` — direct template for a new `src/app/actions/bonus.ts`
- `requireUserId()` (src/lib/session.ts) — ownership boundary pattern to replicate for all new bonus mutations/reads

### Established Patterns
- Money as integer kopecks (`bigint({ mode: "number" })`), never floating point
- No logging of money values anywhere in domain/repository/action modules (T-01-04 convention)
- Postgres `check()` constraints as a second gate behind Zod validation (established in Plan 01-08)
- `onConflictDoUpdate` single-statement upserts for concurrent-write safety (established in Plan 01-07) — likely relevant if a bonus edit needs the same cross-device race protection as salary edits

### Integration Points
- New `bonuses` table joins into the same cumulative-income query path as `salaryHistory`
- `src/app/actions/forecast.ts`'s next-payment resolution is the integration point for D-B09/D-B10 (breakdown display + unified next-payment-event selection)
- Home screen component (`src/app/(app)/page.tsx` / `next-payment-card.tsx`) needs a breakdown rendering path for the salary+bonus case (D-B09)

</code_context>

<specifics>
## Specific Ideas

- The user explicitly wants bonuses to be able to create genuinely new, unscheduled payment dates — not just top-ups to existing avans/salary dates. This is the most consequential decision in this phase (D-B01): it means the "next payment" resolution logic from Phase 1 needs to be generalized to consider an arbitrary set of dated payment events (schedule-derived + bonus-derived), not just the two fixed monthly dates.
- Deletion vs. editing asymmetry (D-B04 allows editing a past bonus, D-B06 forbids deleting one) is a deliberate, specific choice — downstream agents should not "simplify" this into a single uniform rule.

</specifics>

<deferred>
## Deferred Ideas

- **Bonus type/category (premium vs. compensation vs. other) with possible tax-exempt categories** — deferred; v1 uses one universal taxed-uniformly type (D-B07). Could become a v1.x/v2 item if the user later wants reporting by category or if a tax-exempt compensation type needs modeling.

### Reviewed Todos (not folded)
None — no pending todos existed to cross-reference for this phase.

</deferred>

---

*Phase: 2-bonuses-one-off-payments*
*Context gathered: 2026-08-30*
