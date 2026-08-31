# Phase 1: Core Payroll Loop - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning

<domain>
## Phase Boundary

A registered user enters their gross ("грязными") salary and avans/salary payment schedule (2x/month) and sees an accurate amount and date for their next take-home payment, computed via the progressive 2025 НДФЛ scale (13/15/18/20/22%) applied cumulatively from the start of the calendar year — with data synced across their devices via cloud account.

Covers: AUTH-01, AUTH-02, SAL-01, SAL-02, SAL-03, TAX-01, TAX-02, HOME-01.

Excludes (belongs in later phases): bonuses (Phase 2), vacation pay (Phase 3), annual pie chart and PWA installability (Phase 4).

</domain>

<decisions>
## Implementation Decisions

### Payment Schedule Input
- **D-01:** Avans/salary dates are entered as day-of-month numbers (e.g. "avans on 20th, salary on 5th"), not exact recurring calendar dates. — **Reversibility:** costly — switching to an exact-date model later requires a schema change to the payment-schedule table and rework of the date-generation logic.
- **D-02:** If a computed payment day falls on a weekend or RU public holiday, the effective payment date shifts earlier (matches RU labor-law employer practice). Implementation needs an RU public-holiday calendar as a dependency — flag for research.
- **D-03:** Day-of-month values that don't exist in a given month (e.g. 31st) clamp to the last valid day of that month (28th/29th/30th).
- **D-04:** Warn (non-blocking) if the gap between avans day and salary day exceeds 15 days (ТК РФ compliance signal), but still allow the user to save the schedule as entered.

### Registration & Login
- **D-05:** v1 auth is email + password only, via Better Auth. OAuth providers (e.g. Yandex ID/VK ID — Google OAuth is awkward for a RU audience) are explicitly deferred to a later phase. — **Reversibility:** reversible — Better Auth supports adding providers later without breaking existing accounts.
- **D-06:** No email verification required before the user can use the app.
- **D-07:** Sessions are long-lived (30+ days, refreshed on use) — minimizes re-login friction, especially relevant for the iOS home-screen PWA case (Phase 4).
- **D-08:** Password reset flow is deferred to v1.x — not built in Phase 1.

### Mid-year YTD Onboarding (SAL-03)
- **D-09:** The YTD (year-to-date accumulated income) question is always shown at signup, regardless of signup date — no conditional skip for January signups. Simpler, no date-branching logic.
- **D-10:** YTD income is editable anytime after signup (e.g. from settings/profile). Editing it recomputes the cumulative tax chain forward from that point — consistent with the "cumulative income as a derived value, never a mutable running counter" engine design from `research/ARCHITECTURE.md`.
- **D-11:** If the user skips YTD entry, a **persistent banner** (not a one-time dismissible notice) stays on the home screen warning that the forecast assumes zero income since Jan 1, until the user fills it in.

### Salary Change Effective Date (SAL-02)
- **D-12:** The user picks an explicit effective date for a salary change — it does not always apply immediately to the next payment.
- **D-13:** Backdating is allowed — the user can set an effective date in the past to correct a mis-entered value or record an already-happened raise they forgot to log.
- **D-14:** If a backdated change collides with an existing `salary_history` record for that period, the new entry **overwrites/replaces** it — no audit trail of corrections is kept. — **Reversibility:** one-way — dropping the prior value at write time means it isn't recoverable later without adding an audit-log migration.
- **D-15:** Future-dated salary changes are **not** explicitly surfaced on the home screen (no "upcoming raise on [date]" banner). The forecast engine simply uses whichever salary is effective on a given payment's date — HOME-01 stays minimal (next payment amount + date only), matching what the requirement actually asks for.

### Claude's Discretion
None — every gray area discussed resolved to a concrete choice; no "you decide" deferrals in this session.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — AUTH-01/02, SAL-01/02/03, TAX-01/02, HOME-01 (this phase's requirement IDs)
- `.planning/ROADMAP.md` §"Phase 1: Core Payroll Loop" — goal, success criteria, mode (mvp)
- `.planning/PROJECT.md` — core value, out-of-scope list (no deductions, no multi-employer, no offline, no payslip reconciliation)

### Tax & Labor-Law Correctness (non-negotiable engine constraints)
- `.planning/research/PITFALLS.md` — Pitfalls 1, 2, 3, 7 apply directly to Phase 1: marginal-vs-flat tax calculation, avans as an independent taxable event (2023 rule), chronological cumulative folding, integer-kopeck money math with ст.52 rounding
- `.planning/research/SUMMARY.md` §"Critical Pitfalls" and §"Gaps to Address" — confirms mid-year onboarding was an unresolved gap prior to this discussion (now resolved via D-09/D-10/D-11); flags exact 2025 bracket thresholds/29.3 divisor need a final check against primary НК РФ/ТК РФ text before implementation

### Stack & Architecture
- `.claude/CLAUDE.md` §"Technology Stack" — locked stack: Next.js 16 (App Router), React 19, PostgreSQL via Neon + Drizzle, Better Auth, TypeScript 6.0.x (not 7.x yet), Zod, date-fns, Vitest
- `.planning/research/STACK.md` — full stack rationale and version-compatibility table
- `.planning/research/ARCHITECTURE.md` — "functional core, imperative shell" pattern: tax/vacation engines as pure functions isolated from DB/HTTP; cumulative YTD income is a derived value from an ordered ledger, never a mutable running counter (directly informs D-10)

</canonical_refs>

<code_context>
## Existing Code Insights

Repository is greenfield — no application code exists yet (only `.planning/` and `.claude/` directories). There are no reusable components, established patterns, or integration points to inventory.

### Reusable Assets
None yet — this is the first implementation phase.

### Established Patterns
None yet — Phase 1 sets the initial patterns (auth wiring, Drizzle schema conventions, domain/ module isolation) that later phases will follow.

### Integration Points
N/A — first phase.

</code_context>

<specifics>
## Specific Ideas

- RU labor-law specifics confirmed applicable in this discussion: max 15-day gap between avans and salary (soft warning, not hard block), and the "pay early if payday lands on a weekend/holiday" rule (hard behavior, D-02) — both sourced from domain knowledge in `research/PITFALLS.md`, now locked as product decisions rather than left as open questions.
- The YTD-income onboarding field is a single "cumulative gross income since Jan 1" number. The tax engine derives "tax already withheld this year" from that figure via the same `taxOnCumulative()` formula used for every other payment (per Pitfall 1's design) — it does not need a separate "tax withheld" input from the user. This is a Claude-discretion implementation detail, not something asked of the user, but worth stating explicitly here so downstream agents don't re-litigate it.

</specifics>

<deferred>
## Deferred Ideas

- **OAuth login (Yandex ID / VK ID)** — deferred past v1 Phase 1; email+password ships first (D-05).
- **Password reset flow** — deferred to v1.x (D-08); Phase 1 ships without it.
- **Audit trail for salary-history corrections** — not built in Phase 1 (D-14 chose overwrite); could become a v1.x/v2 item if backdating corrections turn out to be a frequent, trust-sensitive operation.
- **"Upcoming salary change" home-screen indicator** — explicitly out of Phase 1 scope (D-15); HOME-01 stays minimal per requirement text.

### Reviewed Todos (not folded)
None — no pending todos existed to cross-reference for this phase.

</deferred>

---

*Phase: 1-core-payroll-loop*
*Context gathered: 2026-08-28*
