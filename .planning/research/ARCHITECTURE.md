# Architecture Research

**Domain:** Personal salary/take-home-pay forecasting PWA with legally-defined tax and vacation-pay calculations (RU НДФЛ + ТК РФ)
**Researched:** 2026-08-28
**Confidence:** MEDIUM (general architecture patterns are well-established/cross-verified; project-specific application is original synthesis, not sourced from a comparable published system)

## Standard Architecture

### System Overview

This is a standard **thin-client PWA + API + relational DB** shape, with one non-standard twist: two pieces of business logic (tax, vacation pay) are legally defined, versioned-by-year formulas that must be independently auditable. That drives the one architectural decision that matters most here — **calculation logic is pulled out of the API/CRUD layer into its own pure, dependency-free domain module**, tested in complete isolation from HTTP and the database.

```
┌───────────────────────────────────────────────────────────────────┐
│                      CLIENT — PWA (installed, iOS home screen)      │
│  ┌────────────┐  ┌───────────────┐  ┌─────────────┐  ┌──────────┐  │
│  │ Auth screens│  │ Salary/Sched. │  │ Next-payment │  │ Annual   │  │
│  │             │  │ /Bonus/Vac.   │  │ home screen  │  │ pie-chart│  │
│  │             │  │ input forms   │  │              │  │ summary  │  │
│  └──────┬─────┘  └───────┬───────┘  └──────┬───────┘  └────┬─────┘  │
│         │                │                  │                │      │
│         └────────────────┴────────HTTP──────┴────────────────┘      │
├───────────────────────────────────────────────────────────────────┤
│                          API (imperative shell)                     │
│  ┌─────────┐  ┌────────────────────┐  ┌───────────────────────┐    │
│  │  Auth    │  │  CRUD endpoints    │  │  Forecast endpoint     │    │
│  │  (JWT/   │  │  (salary history,  │  │  (orchestrates domain  │    │
│  │  session)│  │  schedule, bonus,  │  │  engines, returns      │    │
│  │          │  │  vacation)         │  │  computed payments)    │    │
│  └─────────┘  └─────────┬──────────┘  └───────────┬────────────┘    │
├─────────────────────────┼──────────────────────────┼────────────────┤
│                DOMAIN LAYER — pure, framework-free  ↓  (functional core)│
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐   │
│  │   Tax Calculation Engine     │  │   Vacation Pay Engine        │   │
│  │   (НДФЛ, cumulative YTD,     │  │   (avg. daily earning,       │   │
│  │   versioned bracket table)   │  │   12-month lookback, ТК РФ)  │   │
│  └───────────────┬─────────────┘  └───────────────┬─────────────┘   │
│                  └───────────┬──────────────────────┘                │
│                     ┌────────▼─────────┐                             │
│                     │ Payment Forecast  │                             │
│                     │ Engine (composes  │                             │
│                     │ the two above)    │                             │
│                     └───────────────────┘                             │
├───────────────────────────────────────────────────────────────────┤
│                         DATA LAYER (Postgres)                       │
│  ┌──────────┐ ┌──────────────┐ ┌───────────┐ ┌───────────────────┐  │
│  │ users    │ │ salary_history│ │ pay_      │ │ bonus_entries      │  │
│  │          │ │ (effective-   │ │ schedule  │ │ vacation_entries   │  │
│  │          │ │  dated)       │ │           │ │                    │  │
│  └──────────┘ └──────────────┘ └───────────┘ └───────────────────┘  │
│  ┌───────────────────────────┐                                      │
│  │ tax_brackets (versioned by │                                      │
│  │ tax_year — immutable rows) │                                      │
│  └───────────────────────────┘                                      │
└───────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| PWA client | Auth UI, data-entry forms (salary/schedule/bonus/vacation), display of next payment + annual pie chart, install manifest for iOS | React/Vue/Svelte SPA, Vite/Next build, `manifest.json` + `apple-touch-icon` |
| Auth | Register/login, session/JWT issuance, per-user data isolation | Framework auth module or BaaS auth (see Integration Points) |
| CRUD endpoints | Validate and persist salary changes, schedule, bonuses, vacation requests as effective-dated / date-stamped rows | REST or RPC handlers, thin — no calculation logic here |
| Forecast endpoint | Given a user + date range, load the relevant historical/future records and call the domain engines to produce a payment-by-payment forecast | Orchestration only; delegates all math to domain layer |
| Tax Calculation Engine | Pure function(s) implementing 2025 5-bracket progressive НДФЛ on a cumulative annual basis | Isolated module/package, zero DB or HTTP imports, takes `tax_year` as an explicit parameter |
| Vacation Pay Engine | Pure function(s) implementing ТК РФ average-daily-earnings-over-12-months formula | Isolated module/package, takes a list of dated gross-income entries as input, no DB access |
| Payment Forecast Engine | Composes tax + vacation engines against a timeline of scheduled/one-off payments to produce net amounts | Pure orchestration function; still framework-free |
| Data layer | Stores immutable, dated facts (salary changes, bonuses, vacation requests) — never a mutable running total | Postgres; relational schema, no NoSQL needed (data is small, relational, and correctness-critical) |

## Recommended Project Structure

```
src/
├── domain/                        # Pure business logic — the "functional core"
│   ├── tax/
│   │   ├── ndfl-brackets.ts        # Versioned bracket tables (2025: 13/15/18/20/22%), keyed by tax_year
│   │   ├── calculate-ndfl.ts       # calculateNdfl(cumulativeBefore, paymentGross, taxYear) -> {tax, net, newCumulative}
│   │   └── calculate-ndfl.test.ts  # Table-driven tests against official ФНС worked examples
│   ├── vacation/
│   │   ├── average-daily-earning.ts # calcAvgDailyEarning(salaryHistory, vacationStart) per ТК РФ / ПП РФ №922
│   │   ├── calculate-vacation-pay.ts
│   │   └── calculate-vacation-pay.test.ts
│   └── forecast/
│       ├── build-payment-timeline.ts  # merges schedule + bonuses + vacation into ordered payment events
│       └── forecast-net-payments.ts   # composes tax + vacation engines over the timeline
├── api/                            # Imperative shell — HTTP, auth, DB access
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── salary.ts               # CRUD on salary_history (effective-dated writes)
│   │   ├── schedule.ts
│   │   ├── bonuses.ts
│   │   ├── vacations.ts
│   │   └── forecast.ts             # calls domain/forecast, returns JSON to client
│   └── db/
│       ├── schema.ts               # Postgres schema (Drizzle/Prisma/knex — see STACK.md)
│       └── repositories/           # thin data-access functions, no business logic
├── client/                         # PWA frontend
│   ├── screens/
│   │   ├── NextPayment.tsx
│   │   ├── AnnualSummary.tsx       # pie chart: gross / tax / net
│   │   └── SalaryEditor.tsx
│   ├── manifest.webmanifest
│   └── icons/                      # incl. apple-touch-icon.png (see Integration Points)
└── shared/
    └── types.ts                    # Shared DTOs between domain, api, client
```

### Structure Rationale

- **`domain/` is isolated and framework-free by rule**, not by convention — no import of Express/DB/fetch is allowed inside it. This is what makes the tax and vacation formulas independently testable and auditable: a reviewer (or the developer, a year from now when rates change) can read and test `domain/tax` without spinning up a server or DB.
- **`domain/tax/ndfl-brackets.ts` is a data table, not inline conditionals** — each tax year is a separate immutable array of `{ from, to, rate }`. When rates change (they have changed before, and did in 2025), a new year's table is added; old years' calculations remain reproducible unchanged. This directly satisfies the "auditable, correct, changes year to year" requirement.
- **`api/routes/` stays thin** — validation + calling a repository + calling a domain function + returning the result. If a route handler contains an `if` on a tax bracket, that is a structural violation of the boundary.
- **`forecast/` is a third domain module**, separate from tax and vacation, because it has its own logic (ordering payments by date, deciding which engine applies to which entry) that also deserves isolated testing, without re-testing tax/vacation math each time.

## Architectural Patterns

### Pattern 1: Functional Core, Imperative Shell (for both calculation engines)

**What:** All НДФЛ and vacation-pay math lives in pure functions — same input always produces same output, no I/O, no hidden state, no calls to `Date.now()`, no DB reads inside the function. The API layer (imperative shell) is responsible for fetching the inputs (salary history rows, tax year, cumulative income so far) and handing them to the pure function, then persisting/returning the result.
**When to use:** Any time correctness of a formula must be independently verifiable and regression-proof — exactly the situation for legally-defined tax/labor-law math.
**Trade-offs:** Slightly more ceremony (explicit parameter passing instead of reading global/session state inside the calculation) — worth it here because the payoff is unit tests that run in milliseconds with zero mocking, and that can be checked directly against official worked examples from ФНС/ТК РФ documentation.

**Example:**
```typescript
// domain/tax/calculate-ndfl.ts — pure, no imports beyond the bracket table
export function calculateNdfl(
  cumulativeIncomeBeforeThisPayment: number,
  thisPaymentGross: number,
  taxYear: number
): { taxOnThisPayment: number; net: number; newCumulativeIncome: number } {
  const brackets = getBracketsForYear(taxYear); // pure lookup, throws if year unsupported
  const cumulativeAfter = cumulativeIncomeBeforeThisPayment + thisPaymentGross;
  const taxOnThisPayment =
    cumulativeTax(cumulativeAfter, brackets) - cumulativeTax(cumulativeIncomeBeforeThisPayment, brackets);
  return {
    taxOnThisPayment,
    net: thisPaymentGross - taxOnThisPayment,
    newCumulativeIncome: cumulativeAfter,
  };
}
```

### Pattern 2: Effective-Dated Facts, Not Mutable State (salary history + cumulative income)

**What:** Every change to salary is a new row with `effective_from` (and `effective_to` for the previous row, or compute it as "next row's `effective_from` minus 1 day"), never an `UPDATE` on the existing salary value. Cumulative year-to-date income for tax purposes is **never stored as a running counter** — it is derived on demand by summing all taxable payment events (regular pay + bonuses + vacation pay) for a user within the calendar year, ordered by `payment_date`, up to and including the payment being calculated.
**When to use:** Any time a "point in time" value must be reconstructable — required here for (a) "what was the salary that generated this past payment" and (b) "what was cumulative YTD income immediately before this payment, for the progressive tax calculation."
**Trade-offs:** More rows, more read-time aggregation vs. a mutable counter — but a mutable YTD-total column is a correctness trap: it silently drifts if a past bonus is edited/deleted, if a payment is recomputed, or under concurrent writes. A derived-on-read (or derived-and-cached) value stays correct by construction because it is always computed from the immutable ledger.

**Example:**
```sql
-- salary_history: effective-dated, append-only
CREATE TABLE salary_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  gross_amount NUMERIC(12,2) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,              -- NULL = currently active
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- YTD cumulative income before a given payment_date, computed not stored:
-- SUM of all taxable payment events for user WHERE payment_date < :target AND EXTRACT(year FROM payment_date) = :target_year
```

### Pattern 3: Versioned Rule Table for Legally-Defined Rates

**What:** The 5-bracket НДФЛ schedule is stored as data (either a DB table `tax_brackets(tax_year, bracket_order, threshold_from, threshold_to, rate)`, or a versioned in-code map keyed by year — either works given the "no offline" constraint means a deploy can update rates when the law changes). The engine takes `taxYear` as an explicit input and looks up the matching table; it never hardcodes "13%" inline in a branch.
**When to use:** Any rule that is defined by external authority (tax law, labor code) and known to change over time on a predictable cadence (calendar year).
**Trade-offs:** A DB-backed table is more auditable (can be inspected/changed without a deploy, and can be joined into the payment record for "which rule version produced this number") but adds a migration step each year; an in-code versioned map is simpler to test and review but requires a deploy to add a new year. For a small solo/small-team product, **in-code versioned map is the pragmatic default**; move to a DB table only if there's a need for non-developers to adjust rates.

## Data Flow

### Request Flow — "show me my upcoming payment"

```
Client requests /forecast?from=today&to=+90d
    ↓
API forecast route → loads: active salary_history rows, pay_schedule,
                             bonus_entries, vacation_entries for user
    ↓
domain/forecast: build-payment-timeline()
    → merges scheduled pay dates + one-off bonuses + vacation payouts
       into a single ordered list of {date, grossAmount, type}
    ↓
domain/forecast: forecast-net-payments()
    → walks the timeline in date order, maintaining cumulative YTD income
      in memory (NOT persisted) for that year
    → for each event, calls domain/tax/calculateNdfl(cumulativeSoFar, gross, taxYear)
    → for vacation events, first calls domain/vacation/calculate-vacation-pay()
      to derive gross vacation pay, THEN feeds that gross into calculateNdfl()
      like any other payment (vacation pay is taxable income, same scale)
    ↓
API returns JSON: [{date, gross, tax, net}, ...] — client renders next
    payment card + (aggregated) annual pie chart
```

### Key Data Flows

1. **Salary change:** User edits gross salary → API writes a new `salary_history` row with `effective_from = today` (or a future/past date if backdating), closes out the previous row's `effective_to`. No recalculation is triggered eagerly — forecasts are computed on read, always from current data.
2. **Cumulative tax basis:** Never stored. Computed each time by scanning that user's taxable payment events for the calendar year, in `payment_date` order, up to the point being calculated. This guarantees correctness even if bonuses/vacations are entered out of chronological order or edited after the fact.
3. **Vacation pay:** User enters vacation start/end dates → API queries `salary_history` (+ any other taxable payments) for the trailing 12 calendar months → `domain/vacation` computes average daily earning (ПП РФ №922: gross earnings over 12 months ÷ 12 ÷ 29.3, days-worked-adjusted for partial months) × vacation days → that gross amount is inserted into the payment timeline **at its actual payment date** (vacation pay is legally paid ~3 days before the vacation starts, and is taxed based on when it is *paid*, not the vacation period) before running it through the tax engine.
4. **Annual summary (pie chart):** Client requests forecast/actuals for the full calendar year → aggregates gross/tax/net across all payment events already computed by the forecast engine → no separate calculation path, same domain functions, just summed client- or server-side.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Single user / MVP | Monolith API + Postgres is more than sufficient; compute forecasts synchronously on every request |
| Up to ~10k users | Still a monolith; add a cache (materialize computed forecast per user, invalidate on any write to salary/schedule/bonus/vacation tables for that user) if forecast computation becomes a noticeable per-request cost |
| 100k+ users | Unlikely for this product shape, but if reached: read replicas for Postgres, move forecast computation to a background job triggered on data change rather than computed per-request |

### Scaling Priorities

1. **First (and likely only) bottleneck:** Recomputing the full-year payment timeline on every dashboard load. Mitigate early with a simple cache invalidated on write — not a distributed system, just "recompute and store the forecast row set when the user's underlying data changes."
2. **Second:** None realistically anticipated at this product's scale (personal finance tracker, not a transaction-processing system) — avoid designing for scale this product will not hit.

## Anti-Patterns

### Anti-Pattern 1: Storing YTD cumulative income as a mutable running total

**What people do:** Add a `cumulative_income_ytd` column to a user/payment row and `UPDATE ... SET cumulative = cumulative + new_amount` each time a payment is added.
**Why it's wrong:** Silently wrong the moment a past entry is edited, backdated, or deleted (bonus added retroactively, salary correction, vacation dates changed) — the running total drifts from the true chronological sum and nothing detects it. Also breaks if two payments are inserted concurrently.
**Do this instead:** Treat cumulative income as a *derived value*, always recomputed from the immutable ledger of dated payment events for that calendar year, ordered by date. Cache the result if performance requires it, but never treat the cache as the source of truth.

### Anti-Pattern 2: Hardcoding tax brackets inline in calculation code

**What people do:** `if (income < 2_400_000) return income * 0.13; else if (...) ...` written directly inside the calculation function or, worse, inside an API route handler.
**Why it's wrong:** When the law changes (as it did for 2025, and will again), this requires hunting down every inline conditional, and there is no way to reproduce or audit what rate applied to a calculation made under a prior year's law.
**Do this instead:** A versioned bracket table (in code or DB) keyed by `tax_year`, with the calculation function taking `taxYear` as an explicit parameter. Adding 2026 rates means adding a new table entry, not touching calculation logic — and old calculations remain reproducible against the year they actually used.

### Anti-Pattern 3: Mixing calculation logic into the API/route layer

**What people do:** Compute tax or vacation pay inline inside an Express/Fastify/Next.js route handler, next to the DB query and the response serialization.
**Why it's wrong:** Cannot unit-test the math without mocking HTTP and DB — the exact cases (official ФНС worked examples, edge cases at bracket boundaries, partial-month vacation averaging) that most need locked-down regression tests become the hardest ones to write tests for.
**Do this instead:** Route handler does: fetch inputs → call `domain/tax` or `domain/vacation` pure function → persist/return result. All the interesting logic is testable with plain input/output assertions, no server needed.

### Anti-Pattern 4: Treating vacation pay as untaxed or taxed by a separate ad-hoc path

**What people do:** Compute vacation pay gross amount and stop there, or apply a flat/simplified tax rate to it separately from regular income.
**Why it's wrong:** Vacation pay is taxable income under the same progressive НДФЛ scale as salary, and its tax must be computed in the context of the cumulative YTD income at the time it is *paid* — skipping this either under- or over-reports the take-home amount and can push later-year payments into the wrong bracket boundary.
**Do this instead:** Vacation pay gross (from `domain/vacation`) is inserted into the same payment timeline as any other payment event, at its actual disbursement date, and flows through the same `domain/tax` cumulative calculation as everything else.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Auth provider (build-your-own JWT, or a BaaS like Supabase Auth) | Session/JWT issued on login, verified on each API request | With "no offline requirement" and "multi-user cloud sync," a BaaS (e.g., Supabase: Postgres + Auth + row-level security) is a strong fit — it removes the need to hand-build auth, session storage, and per-user data isolation, while still giving a real Postgres DB suited to the effective-dated relational schema above. This is a stack decision (see STACK.md) but affects component boundaries: if chosen, "API" may partly become Postgres RLS policies + a thin serverless function layer for the domain calculation calls, rather than a full custom Express server. |
| Push/notification services | Not required for v1 (no offline/background requirement in scope) | Skip entirely for MVP |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| PWA client ↔ API | HTTPS/JSON (REST or RPC) | No offline requirement means no local-first sync engine needed — a straightforward client-server request/response model is sufficient and should not be over-engineered into a sync protocol |
| API routes ↔ domain engines | Direct function call, in-process | Domain engines are a library, not a separate service — no need for network calls between API and calculation logic at this scale; keep it a monolith internally, just with a strict import boundary (domain never imports api/db) |
| domain/tax ↔ domain/vacation ↔ domain/forecast | Pure function composition | `forecast` imports and calls `tax` and `vacation`; `tax` and `vacation` do not depend on each other or on `forecast` — keeps each engine independently testable |
| API ↔ Postgres | Repository/data-access functions, parameterized queries | Repositories return plain data (rows), never leak DB client objects into domain or route logic |

### iOS PWA-specific integration notes

- `display: standalone` (or `fullscreen`) must be set in the web manifest, and 192px/512px icons (plus a 512px maskable icon) included — but **iOS Safari ignores the manifest's icon list and instead requires a separate `<link rel="apple-touch-icon" href="...">` tag** in the HTML head. Both must be shipped; omitting the apple-touch-icon link is a common install-breaking mistake.
- iOS (16.4+) has no `beforeinstallprompt` API — there is no programmatic "install" button. The app must show its own in-UI instructions ("Share → Add to Home Screen") since Safari won't surface an automatic prompt.
- A missing or unreachable icon file blocks installability silently — verify icon URLs are resolvable at the exact paths referenced, not just present in the repo.

## Sources

- [Functional Core, Imperative Shell — functional-architecture.org](https://functional-architecture.org/functional_core_imperative_shell/)
- [Functional core, imperative shell — MarsBased](https://marsbased.com/blog/2020/01/20/functional-core-imperative-shell)
- [Patterns of Functional Programming: Functional Core - Imperative Shell](http://www.javiercasas.com/articles/functional-programming-patterns-functional-core-imperative-shell/)
- [Efficiently Managing SCD Type 2 — Medium](https://medium.com/@rahulgosavi.94/efficiently-managing-slowly-changing-dimensions-type-2-scd-type-2-using-sql-insert-merge-in-cc7bba359c85)
- [Types Of Slowly Changing Dimensions in Data Warehouses — Airbyte](https://airbyte.com/data-engineering-resources/scd-types-in-data-warehouse)
- [Master Slowly Changing Dimensions Type 2 — Analytics Engineering](https://www.analyticsengineering.com/resources/slowly-changing-dimensions-type-2-explained)
- [PWA on iOS - Current Status & Limitations for Users [2025] — Brainhub](https://brainhub.eu/library/pwa-on-ios)
- [PWA Icon Requirements: The Complete 2025 Checklist — DEV Community](https://dev.to/albert_nahas_cdc8469a6ae8/pwa-icon-requirements-the-complete-2025-checklist-i3g)
- [Making PWAs installable — MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
- [PWA iOS Limitations and Safari Support [2026] — MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- [Rule Engine Design Pattern: Architecture, Database Design Guide — Nected](https://www.nected.ai/blog/rules-engine-design-pattern)
- [5 Important Components of Rule Engine Architecture — Decisimo](https://decisimo.com/decision-engine/5-components-of-rule-engine-architecture.html)
- Domain knowledge (project context / general knowledge, not independently re-verified this session): RF НДФЛ 2025 5-bracket progressive scale on cumulative annual basis (13/15/18/20/22%); ТК РФ average-daily-earnings vacation pay formula per Постановление Правительства РФ №922 (12-month lookback ÷ 29.3 avg. calendar days/month) — confirm exact bracket thresholds and the 29.3 divisor against current legal text during phase-specific research before implementing the tax/vacation engines (flagged as a gap below).

---
*Architecture research for: Russian salary/take-home-pay PWA (НаРуки)*
*Researched: 2026-08-28*
