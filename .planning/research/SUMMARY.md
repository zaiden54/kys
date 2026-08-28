# Project Research Summary

**Project:** НаРуки (Russian salary/take-home-pay tracking PWA)
**Domain:** Personal finance forecasting tool — multi-user cloud-synced full-stack web app with legally-defined tax and labor-law calculation engines
**Researched:** 2026-08-28
**Confidence:** MEDIUM-HIGH

## Executive Summary

НаРуки is a small-team greenfield CRUD app whose difficulty is concentrated almost entirely in one place: getting the Russian progressive НДФЛ tax calculation and ст.139 ТК РФ vacation-pay (отпускные) formulas exactly right, not in infrastructure. Every research track converges on the same architectural conclusion — this should be built as a single full-stack Next.js app (App Router) on Vercel with Postgres (Neon) via Drizzle and Better Auth, with the tax and vacation-pay logic isolated into pure, framework-free TypeScript functions (a "functional core, imperative shell" design) that never touch the DB or HTTP directly. That isolation is the single highest-leverage decision in the whole research set: it is what makes the calculation engine exhaustively unit-testable against official worked examples, and it directly defends against the most severe pitfalls identified (marginal-vs-flat tax miscalculation, non-chronological cumulative processing, kopeck-rounding drift).

The recommended approach treats cumulative YTD income and cumulative tax withheld as **derived values**, never mutable running totals, computed by folding over an immutable, chronologically-ordered ledger of payment events (salary tranches, premii, vacation pay). This single pattern resolves three of the seven pitfalls simultaneously and should be treated as a non-negotiable constraint baked into the domain layer from day one, before any UI exists. Feature scope is well-bounded: table-stakes v1 (salary schedule input, progressive tax engine, salary history, bonus entry, otpusknye auto-calc, next-payment display, annual pie chart, cloud sync, PWA installability) is already fully captured in PROJECT.md's Active scope, and the anti-features list (deductions, multiple employers, regional coefficients, offline mode, payslip import, push notifications) is consistent and should stay explicitly out of v1.

The main risks are: (1) tax/vacation-pay correctness bugs that are easy to ship looking "done" (round-salary-only testing hides bracket-boundary and rounding bugs), (2) iOS PWA quirks around install prompts, storage-jar isolation across the Safari-tab → standalone-app boundary, and no `beforeinstallprompt`, and (3) a genuine, unresolved product-decision gap around mid-year onboarding (users with no recorded income for months already elapsed in the tax year). All three are addressable with disciplined engine isolation, real-device testing, and an explicit product decision surfaced during requirements/roadmap — none require a different stack or architecture.

## Key Findings

### Recommended Stack

Full details in [STACK.md](./STACK.md). The stack is chosen specifically because this app has real backend requirements (multi-user accounts, cross-device sync, a backend-owned calculation engine) but no offline requirement and no realtime-collaboration requirement — which rules out a separate SPA+API split or an offline-sync engine and points at one deployable, one database, TypeScript end-to-end.

**Core technologies:**
- **Next.js 16 (App Router) + React 19** — full-stack framework, Server Components for read-heavy screens, Server Actions/Route Handlers for mutations, avoids a separate API service for a small team
- **PostgreSQL via Neon + Drizzle ORM** — the domain is fundamentally relational and time-ordered (salary_history → bonuses → pay_dates), needs joins and window functions for YTD cumulative tax math; Neon adds branching and scale-to-zero cost efficiency
- **Better Auth** — self-hosted, no per-MAU billing, session model naturally supports the "same Postgres row is source of truth per user across devices" sync model
- **TypeScript 6.0.x (pinned, not 7.x)** — TS 7's native compiler lacks `typescript-eslint` support as of Aug 2026; re-check at each phase boundary
- **Vitest** for exhaustive pure-function testing of the tax/vacation engines; **date-fns** for all date math (no native `Date` mutation footguns); **Zod + drizzle-zod** for input validation at the Server Action boundary; **Serwist** (not the unmaintained `next-pwa`) for the minimal install-only service worker

### Expected Features

Full details in [FEATURES.md](./FEATURES.md). PROJECT.md's Active scope already matches the researched MVP definition closely — this is confirmation, not course-correction.

**Must have (table stakes) — all already in v1 scope:**
- Avans + основная (2x/month) payment schedule input, editable per user
- Progressive НДФЛ calculation, cumulative YTD, recalculated per payment event (not per month)
- Next-payment amount + date on home screen
- Salary change history (correctness dependency for both tax and vacation-pay calc, not just a display feature)
- Gross/tax/net breakdown, annual pie chart
- One-off bonus/premiya entry, taxed through the same engine as salary
- Automatic отпускные (vacation pay) calculation
- Account + cloud sync across devices
- Installable PWA for iPhone home screen

**Should have (differentiators, v1.x candidates):**
- Bracket-crossing awareness ("approaching next НДФЛ threshold") — near-zero marginal cost once the cumulative engine exists
- Vacation "what-if" date planner — UI layer on top of existing computation
- Per-payment (not just annual) gross/tax/net breakdown

**Defer (v2+, explicitly out of scope per PROJECT.md and confirmed correct by research):**
- Tax deductions (вычеты) — architect the tax function to accept a post-deduction "taxable base" parameter now, even though not built, so this slots in later without a rewrite
- Multiple employers/income sources — cumulative base merging across sources is materially harder
- Regional coefficient/northern allowance (районный коэффициент) — as of 2025 this is a **separate parallel tax base**, not a parameter tweak; add explicitly to Out of Scope so affected users aren't silently given wrong numbers
- Offline mode, payslip reconciliation, push notifications, multi-user household view

### Architecture Approach

Full details in [ARCHITECTURE.md](./ARCHITECTURE.md). Standard thin-client PWA + API + relational DB shape, with one deliberate deviation: the tax and vacation-pay calculation logic is pulled into an isolated, pure, dependency-free `domain/` module tested completely apart from HTTP and the database ("functional core, imperative shell").

**Major components:**
1. **PWA client** — auth screens, salary/schedule/bonus/vacation input forms, next-payment home screen, annual pie chart; install manifest + `apple-touch-icon` for iOS
2. **API (imperative shell)** — thin CRUD route handlers (salary, schedule, bonuses, vacations) plus one forecast endpoint that orchestrates the domain engines; no calculation logic ever lives here
3. **Domain layer (functional core)** — three pure modules: Tax Calculation Engine (versioned bracket table keyed by `tax_year`), Vacation Pay Engine (12-month lookback average), and a Payment Forecast Engine that composes both over an ordered timeline of payment events
4. **Data layer (Postgres)** — immutable, effective-dated facts only (`salary_history` with `effective_from`/`effective_to`, append-only `bonus_entries`/`vacation_entries`); cumulative YTD income is **never** stored as a running counter, always derived by summing the ordered ledger on read (cached only as an invalidate-on-write optimization, never as source of truth)

Key pattern: tax brackets are a versioned data table (`{from, to, rate}` per `tax_year`), never inline conditionals — this is what lets the 2025 rates (and any future year's rates) be added without touching calculation logic, and keeps old calculations reproducible against the law that actually applied.

### Critical Pitfalls

Full details in [PITFALLS.md](./PITFALLS.md). Ranked by severity/likelihood of silently shipping wrong numbers:

1. **Treating progressive НДФЛ as flat-rate-per-bracket instead of marginal/cumulative** — a payment that straddles 2.4M/5M/10M/23.7M ₽ thresholds must be taxed via `taxOnCumulative(after) - taxAlreadyWithheldYTD`, never a single rate applied to the whole payment. Avoid by testing every payment against the 4 boundary values with boundary-straddling cases.
2. **Ignoring the 2023 rule that both avans and salary are separate taxable "income receipt" events** — pre-2023 payroll guides describe month-end-only tax withholding; the app must treat every payment (avans, salary, premium, vacation pay) as an independent cumulative-base update at its actual payment date, in date order — never batched by month.
3. **Computing each payment's tax in isolation rather than folding chronologically over the full year's events** — editing/backdating a past event (retroactive bonus, changed vacation date) must recompute the cumulative chain forward from that point; never memoize a payment's tax independent of its position in the year's sequence.
4. **Naive otpusknye averaging** (`totalEarnings / 12 / 29.3` with no exclusions/proration) — wrong for anyone with under 12 months tenure, sick leave, other paid leave, or a mid-period raise. v1 should explicitly decide and disclose scope here (documented approximation vs. full exclusion modeling) rather than silently computing an inexact number as exact.
5. **Kopeck-level rounding drift** — money must be integer minor units internally with ст.52 rounding (round to nearest ruble, .5 rounds up) applied to *cumulative* tax before taking the delta, never floats rounded only for display; add a reconciliation test that annual sums match exactly.
6. **iOS PWA install/session assumptions that don't hold** — no `beforeinstallprompt` on iOS Safari, manual "Share → Add to Home Screen" only, and the standalone app gets a *separate* WKWebView storage jar from the Safari tab it was installed from — a user who logs in in-tab then installs will appear logged out in the standalone app unless this is designed for explicitly.

## Implications for Roadmap

Based on combined research, the natural phase structure follows the dependency chain: correctness-critical pure calculation logic first (fully decoupled from UI/DB), then the data layer and CRUD that feeds it, then the composed forecast/display layer, then PWA/installability polish, with cloud sync and auth threaded in early enough that nothing else is built against fake/local-only data.

### Phase 1: Tax & Vacation-Pay Calculation Engine (domain core)
**Rationale:** This is the highest-risk, highest-leverage code in the entire product — everything else displays or feeds this engine's output. Building it first, in complete isolation from DB/HTTP, per the functional-core pattern, means it can be exhaustively unit-tested against official ФНС/ТК РФ worked examples before any UI exists, and before technical debt from other layers can leak into it.
**Delivers:** Pure `calculateNdfl(cumulativeBefore, paymentGross, taxYear)`, versioned bracket table (2025: 13/15/18/20/22%), pure vacation-pay average-daily-earnings function, integer-kopeck money math, reconciliation tests.
**Addresses:** Progressive НДФЛ calculation (table stakes), automatic отпускные calculation (table stakes) — the two hardest correctness requirements in PROJECT.md.
**Avoids:** Pitfalls 1 (marginal-vs-flat), 2 (avans/2023 rule), 3 (non-chronological processing), 4 (naive otpusknye averaging), 7 (rounding drift) — five of seven pitfalls are engine-scope, not later-phase scope.

### Phase 2: Data Layer & Auth (persistence, effective-dated schema, multi-device accounts)
**Rationale:** Once the engine's input/output shape is proven with unit tests, the schema that will feed it (effective-dated `salary_history`, append-only `bonus_entries`/`vacation_entries`, `users`) can be designed to match exactly what the engine needs, avoiding a later schema rewrite. Auth must exist before any CRUD is meaningfully multi-user.
**Delivers:** Postgres schema via Drizzle, Better Auth wired to Drizzle adapter, per-user ownership enforcement on every table.
**Uses:** Neon Postgres, Drizzle ORM, Better Auth (STACK.md).
**Implements:** Data layer component — immutable, dated facts only, no mutable running totals (ARCHITECTURE.md Pattern 2).

### Phase 3: CRUD + Forecast Orchestration (API surface)
**Rationale:** With engine and schema both proven, the API layer is thin glue: validate input, call repository, call domain engine, persist/return. This phase is low-risk relative to Phase 1 precisely because the hard logic was already isolated and tested.
**Delivers:** Salary/schedule/bonus/vacation CRUD routes, one forecast endpoint that builds the payment timeline and calls Phase 1's engines.
**Addresses:** Salary + payment schedule input, salary history, bonus entry (table stakes).
**Avoids:** Pitfall — mixing calculation logic into route handlers (Anti-Pattern 3 in ARCHITECTURE.md); route handlers must stay thin by construction now that the engine already exists separately.

### Phase 4: Client UI — Next Payment, History, Forms
**Rationale:** Now that a working forecast endpoint exists, the client is primarily a rendering/forms layer over already-correct data — the highest-risk work is behind this phase, not inside it.
**Delivers:** Next-payment home screen, salary/bonus/vacation entry forms (React Hook Form + Zod), salary history view.
**Addresses:** Next-payment display, editable/correctable inputs (table stakes).

### Phase 5: Annual Summary & Differentiators
**Rationale:** The annual pie chart and any v1.x differentiators (bracket-crossing awareness, per-payment breakdown) are aggregations/UI over the same forecast data already computed in Phase 3 — no new calculation logic, just new views.
**Delivers:** Annual gross/tax/net pie chart (Recharts), optionally bracket-crossing indicator if time allows.
**Addresses:** Annual pie chart (table stakes), bracket-crossing awareness (differentiator).
**Avoids:** Pitfall 7 residue — must include a reconciliation test verifying the pie chart total matches the sum of individual payment breakdowns to the ruble.

### Phase 6: PWA Installability & iOS Hardening
**Rationale:** Deliberately last — it is UI/config polish layered on a working, correct, cloud-synced app, and its pitfalls (storage-jar isolation, no install prompt, in-app-browser detection) require real-device testing that is wasted effort if run against a still-changing app.
**Delivers:** Web manifest, `apple-touch-icon` + iOS meta tags, standalone-mode detection, manual "Add to Home Screen" instructional UI, service worker (Serwist, install-only precache), re-auth flow that tolerates the Safari-tab → standalone storage-jar split.
**Addresses:** Installable PWA (table stakes).
**Avoids:** Pitfalls 5 (iOS install/detection assumptions) and 6 (session/storage-jar assumptions) — both explicitly require on-device iPhone testing, not emulator testing, before being considered done.

### Phase Ordering Rationale

- Calculation correctness is front-loaded because every other phase's output is only as trustworthy as this engine — building UI or CRUD against an unverified engine risks discovering fundamental bugs after significant downstream work is built on top of wrong assumptions.
- Data layer comes second (not first) because its effective-dated schema design should be driven by what the engine actually needs as input, avoiding designing storage before knowing the exact shape of "cumulative income before this payment."
- Auth is folded into Phase 2 rather than given its own phase because cloud sync is a hard prerequisite for every other feature (per FEATURES.md dependency graph: "no feature works meaningfully without persisted, synced state") and Better Auth's setup is small enough not to warrant a standalone phase.
- PWA/iOS work is last because its pitfalls only surface on real devices and are cheap to defer without blocking other work — testing it early against a still-changing app wastes the on-device testing effort.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Tax & Vacation-Pay Engine):** Confirm exact current-year bracket thresholds/29.3 divisor against primary НК РФ/ТК РФ legal text before implementation (ARCHITECTURE.md and PITFALLS.md both flag this as needing a final check, not just secondary-source confirmation). Also needs an explicit product decision on mid-year onboarding (no recorded YTD income for months already elapsed) — flagged as an unresolved gap with no authoritative source found.
- **Phase 6 (PWA/iOS):** iOS PWA behavior (storage jars, install detection, push gating) is well-documented across MEDIUM-confidence sources but must be verified via actual on-device testing, not just implemented from docs — treat the "Looks Done But Isn't" checklist in PITFALLS.md as required verification steps, not optional QA.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Data Layer/Auth):** Drizzle + Better Auth + Neon is a well-documented, standard integration path (STACK.md version-compatibility table is current as of Aug 2026).
- **Phase 3 (CRUD/Forecast API):** Standard thin-route-handler pattern over Next.js Server Actions/Route Handlers — no novel integration risk.
- **Phase 4 (Client UI):** Standard React Hook Form + Zod form patterns, well-established.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Package versions verified directly against npm registry (HIGH); architecture/library-choice recommendations cross-checked across multiple 2026 sources (MEDIUM) |
| Features | MEDIUM-HIGH | Domain/tax mechanics HIGH (cross-verified across 3+ independent Russian tax-content sources); competitive/feature-landscape framing MEDIUM (no single authoritative primary source, e.g. full ФНС/ГАРАНТ text, fetched directly) |
| Architecture | MEDIUM | General architecture patterns (functional core/imperative shell, effective-dated facts, versioned rule tables) are well-established and cross-verified; project-specific application is original synthesis, not sourced from a directly comparable published system |
| Pitfalls | MEDIUM | Tax/labor-law rules cross-verified across ConsultantPlus, Garant, nalog.gov.ru, Klerk; iOS PWA behavior cross-verified across MagicBell, Pushpad, Apple Developer Forums — no single source is a primary spec, exact numeric constants need a final check against current-year НК РФ/ТК РФ text before shipping tax code |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Mid-year onboarding with no prior income history:** No authoritative source addresses what happens when a user starts using the app partway through a tax year with unrecorded Jan-to-date income. FEATURES.md proposes two approaches (ask user for actual YTD cumulative income at onboarding, vs. assume zero and disclose the assumption) — this must be resolved as an explicit product decision during requirements/roadmap, not left implicit in Phase 1 implementation.
- **Exact current-year bracket thresholds and the 29.3 divisor:** Cross-verified across multiple secondary sources (nalog-nalog.ru, garant.ru, astral.ru, Контур.Экстерн) but not fetched from primary НК РФ/ТК РФ legal text directly in this research pass — confirm against current legal text before writing the Phase 1 bracket table and vacation-pay divisor.
- **Otpusknye exclusion/indexation scope decision:** PITFALLS.md and FEATURES.md agree v1 will likely ship отпускные as a documented approximation (no sick-leave/leave-of-absence exclusion tracking, no indexation coefficient) — this scope boundary should be made explicit and disclosed in-product (per UX Pitfalls in PITFALLS.md), not silently assumed.
- **Regional coefficient (районный коэффициент) exclusion:** Not currently named in PROJECT.md's Out of Scope list despite being flagged by research as materially affecting a minority of users if silently unsupported — recommend adding to Out of Scope explicitly during requirements definition.
- **TypeScript 7.0 migration timing:** `typescript-eslint` support for TS 7's native compiler is targeted for 7.1, "several months away" as of Aug 2026 — re-check at each phase boundary before allowing a version bump.

## Sources

### Primary (HIGH confidence)
- npm registry direct queries (Aug 2026) — exact current package versions for next, react, drizzle-orm, better-auth, recharts, serwist, typescript, zod, date-fns, vitest, playwright
- Прогрессивная шкала НДФЛ с 2025 года — nalog-nalog.ru, garant.ru — bracket thresholds and worked example
- Расчет отпускных — Контур.Экстерн, secrets.tbank.ru — ст.139 ТК РФ formula and worked example
- Как удерживать НДФЛ с аванса — garant.ru — 2023 avans withholding rule change

### Secondary (MEDIUM confidence)
- InfoQ, The Register, Visual Studio Magazine, typescript-eslint GitHub issue #12518 — TypeScript 7.0 native-compiler / typescript-eslint incompatibility status
- Bytebase, DEV Community, PkgPulse, MakerKit, TurboStarter — Neon vs Supabase vs PlanetScale, Better Auth vs Clerk vs NextAuth, Drizzle vs Prisma, Recharts vs Chart.js, Vercel vs Railway vs Fly.io comparisons
- functional-architecture.org, MarsBased, javiercasas.com — Functional Core, Imperative Shell pattern
- MagicBell, Pushpad, Apple Developer Forums, Brainhub — iOS PWA install/storage/push limitations, cross-verified across independent sources
- КонсультантПлюс — округление НДФЛ, порядок расчета средней зарплаты (rounding rule, average earnings calc)
- ФНС (nalog.gov.ru) — 2023 income-receipt-date rule

### Tertiary (LOW confidence)
- Web search survey of RU salary calculator competitors (kontur-extern, calcman, zarplata.ru) and RU mobile apps (Gig, Мой расчёт ЗАРПЛАТЫ) — listing-level detail only, not deep product testing
- Web search survey of Western paycheck-forecast apps (PayCheck Budget, Koody, EveryTwo) — feature-pattern generalization, not RU-specific
- Regional coefficient/northern allowance rule details (saby.ru, 1c-wiseadvice.ru) — legislatively unstable area, 2026 rule change noted but not independently verified against primary legal text

---
*Research completed: 2026-08-28*
*Ready for roadmap: yes*
