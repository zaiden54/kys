# Phase 1: Core Payroll Loop - Research

**Researched:** 2026-08-28
**Domain:** Greenfield full-stack Next.js payroll-forecasting app — RU progressive НДФЛ tax engine, effective-dated salary history, Better Auth + Drizzle + Neon scaffolding
**Confidence:** MEDIUM-HIGH (stack/scaffolding HIGH; tax/labor-law numeric constants MEDIUM-HIGH — cross-checked across 3 independent sources including the official FNS domain, but not read from the raw НК РФ/ТК РФ statute text directly in this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Payment Schedule Input**
- D-01: Avans/salary dates are entered as day-of-month numbers (e.g. "avans on 20th, salary on 5th"), not exact recurring calendar dates. — Reversibility: costly.
- D-02: If a computed payment day falls on a weekend or RU public holiday, the effective payment date shifts earlier (matches RU labor-law employer practice). Implementation needs an RU public-holiday calendar as a dependency — flagged for research (addressed below).
- D-03: Day-of-month values that don't exist in a given month (e.g. 31st) clamp to the last valid day of that month (28th/29th/30th).
- D-04: Warn (non-blocking) if the gap between avans day and salary day exceeds 15 days (ТК РФ compliance signal), but still allow the user to save the schedule as entered.

**Registration & Login**
- D-05: v1 auth is email + password only, via Better Auth. OAuth providers (Yandex ID/VK ID) explicitly deferred. — Reversibility: reversible.
- D-06: No email verification required before the user can use the app.
- D-07: Sessions are long-lived (30+ days, refreshed on use) — minimizes re-login friction, especially for the iOS home-screen PWA case (Phase 4).
- D-08: Password reset flow is deferred to v1.x — not built in Phase 1.

**Mid-year YTD Onboarding (SAL-03)**
- D-09: The YTD (year-to-date accumulated income) question is always shown at signup, regardless of signup date — no conditional skip for January signups.
- D-10: YTD income is editable anytime after signup (e.g. from settings/profile). Editing it recomputes the cumulative tax chain forward from that point.
- D-11: If the user skips YTD entry, a persistent banner (not a one-time dismissible notice) stays on the home screen warning that the forecast assumes zero income since Jan 1, until the user fills it in.

**Salary Change Effective Date (SAL-02)**
- D-12: The user picks an explicit effective date for a salary change — it does not always apply immediately to the next payment.
- D-13: Backdating is allowed — the user can set an effective date in the past.
- D-14: If a backdated change collides with an existing `salary_history` record for that period, the new entry overwrites/replaces it — no audit trail of corrections is kept. — Reversibility: one-way.
- D-15: Future-dated salary changes are not explicitly surfaced on the home screen (no "upcoming raise" banner). HOME-01 stays minimal (next payment amount + date only).

### Claude's Discretion
None — every gray area discussed resolved to a concrete choice; no "you decide" deferrals in this session.

### Deferred Ideas (OUT OF SCOPE)
- OAuth login (Yandex ID / VK ID) — deferred past v1 Phase 1; email+password ships first (D-05).
- Password reset flow — deferred to v1.x (D-08).
- Audit trail for salary-history corrections — not built in Phase 1 (D-14 chose overwrite).
- "Upcoming salary change" home-screen indicator — explicitly out of Phase 1 scope (D-15).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can register and log in | Better Auth 1.7.2 email+password setup, schema, session config — see "Better Auth Setup" below |
| AUTH-02 | Data syncs across devices via cloud | Postgres (Neon) as single source of truth + Better Auth session model — see "Better Auth Setup" and Architecture below |
| SAL-01 | User can enter gross salary + configure avans/salary dates (2x/month) | `salary_history` + `payment_schedule` schema, day-of-month clamping (D-03), holiday-shift (D-02) — see "Drizzle Schema Design" |
| SAL-02 | User can change salary; system retains dated history | Effective-dated `salary_history` with overwrite-on-collision (D-12/13/14) — see "Drizzle Schema Design" |
| SAL-03 | Optional YTD entry at first use, else explicit zero-income warning | YTD-as-baseline pattern (D-09/10/11) — see "Architecture: YTD Baseline Pattern" |
| TAX-01 | Progressive НДФЛ 2025 scale (13/15/18/20/22%) nарастающим итогом | Verified bracket thresholds + fixed-base formula — see "НДФЛ 2025 Bracket Correctness" |
| TAX-02 | Avans and salary independently taxed against cumulative YTD base | 2023 rule (263-ФЗ) confirmation + `taxOnCumulative(after) - taxOnCumulative(before)` pattern — see "Avans as Independent Taxable Event" |
| HOME-01 | Home screen shows next payment amount + date, correctly taxed | "Next Payment" derivation query pattern — see "Deriving 'Next Payment' (Not Stored)" |
</phase_requirements>

## Summary

Phase 1 is a from-scratch scaffold of the entire stack (Next.js 16 App Router, Drizzle, Neon, Better Auth) plus the single highest-risk piece of domain logic in the whole product: the cumulative, marginal НДФЛ calculation. This session re-confirmed the 2025 bracket thresholds (2.4M / 5M / 20M / 50M ₽ at 13/15/18/20/22%) and the fixed-base-plus-marginal-excess formula against two independent sources beyond the project-level PITFALLS.md research, including a Federal Tax Service (ФНС, nalog.gov.ru) regional page — this closes most, but not all, of the STATE.md-flagged concern about verifying against primary legal text (see Assumptions Log #A1). The 2023 avans-is-a-taxable-event rule (263-ФЗ) and ст.52 НК РФ rounding-to-ruble rule were both independently re-confirmed this session and match PITFALLS.md exactly.

For scaffolding: `@better-auth/drizzle-adapter` is now a **separate npm package** (split out of `better-auth` core recently — both published 2 days before this research date) rather than a `better-auth/adapters/drizzle` subpath import as some tutorials still show; the CLI for generating the Better Auth Drizzle schema has also moved from the now-**deprecated** `@better-auth/cli` to the new `auth` package (`npx auth generate`). Both of these are recent enough that the package-legitimacy gate flags them `SUS` on recency alone — the Package Legitimacy Audit below explains why they're kept despite the flag, and the planner should still gate their install behind a `checkpoint:human-verify` step per protocol.

The RU public-holiday requirement (D-02) has a real, non-hallucinated npm library (`date-holidays`) with static RU rule data — but it only carries the Russian government's *ad-hoc weekend-transfer* (перенос) exceptions through 2022 in its bundled data file, not annually. For fixed national holidays (New Year block, Feb 23, Mar 8, May 1, May 9, Jun 12, Nov 4) it is reliable; for the government's yearly workday-shifting decree it is not maintained. Treat this as a documented v1 limitation, not a blocker (see Common Pitfalls).

One architecturally important nuance not fully spelled out in the project-level ARCHITECTURE.md: because Phase 1 has **no pre-signup payment history** to replay, the user's declared YTD figure (SAL-03) must act as a **synthetic cumulative-income baseline**, not one entry in a from-Jan-1 event ledger. The "next payment" forecast for Phase 1 is `taxOnCumulative(YTD + nextGross) − taxOnCumulative(YTD)` — a single delta calculation, not a full-year fold. The full chronological fold-over-all-events pattern (needed once Phase 2 adds bonuses) should still be the *shape* of the `getCumulativeIncomeBeforeDate()` function's contract, so it doesn't need a rewrite later — but Phase 1's actual implementation only has one prior "event" (the YTD baseline) to fold over.

**Primary recommendation:** Scaffold Next.js 16 App Router with Drizzle + Neon + Better Auth exactly per the "Walking Skeleton Scaffolding Order" below, build the tax engine as an isolated pure module first (with the verified bracket table as versioned data, not inline conditionals), store all money as `bigint` (mode: `"number"`) kopecks (not `integer` — RUB amounts up to and beyond the 50M-₽ top bracket threshold overflow a 32-bit `integer` column when expressed in kopecks), and treat the YTD figure as the cumulative baseline the tax engine folds forward from, not a separate ledger row.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Register / login (AUTH-01) | API / Backend | Frontend Server (SSR) | Better Auth route handler (`/api/auth/[...all]`) + Postgres is the source of truth; SSR reads the session cookie to gate protected routes |
| Cross-device sync (AUTH-02) | Database / Storage | API / Backend | A single Postgres row per user is the sync mechanism — no separate sync protocol; API enforces per-user ownership on every read/write |
| Salary + schedule input (SAL-01, SAL-02) | API / Backend | Database / Storage | Server Actions validate (Zod) and write effective-dated rows; DB stores immutable dated facts |
| YTD onboarding (SAL-03) | API / Backend | Database / Storage | A single mutable "baseline" value per user, written via Server Action, read by the forecast engine |
| НДФЛ tax calculation (TAX-01, TAX-02) | API / Backend | — | Must run **only** server-side — a pure domain function with zero DB/HTTP imports, invoked from the forecast Server Action/Route Handler. Never trust a client-computed tax figure (PITFALLS.md Security Mistakes) |
| Next-payment display (HOME-01) | Frontend Server (SSR) | API / Backend | React Server Component fetches the forecast (calls the domain engine server-side) and renders it — no client-side calculation |

## Standard Stack

This phase does not deviate from `.claude/CLAUDE.md`'s locked stack table. The entries below are the versions re-confirmed or newly required specifically for Phase 1's scaffolding work.

### Core (already locked in CLAUDE.md — re-confirmed this session)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.3.3 | Full-stack framework | Locked in CLAUDE.md |
| react / react-dom | 19.2.8 | UI runtime | Locked in CLAUDE.md |
| drizzle-orm | 0.45.2 | Query builder | Locked in CLAUDE.md; `npm view drizzle-orm version` confirms currently-published `0.45.2`-line exists [VERIFIED: npm registry — OK verdict, official orm.drizzle.team docs] |
| drizzle-kit | 0.31.10 | Migrations CLI | Locked in CLAUDE.md [VERIFIED: npm registry — OK verdict] |
| better-auth | 1.7.2 | Auth | Locked in CLAUDE.md. Latest npm version at check time is `1.7.2`, published 2 days before this research session [CITED: better-auth.com/docs — SUS verdict on recency only, see Package Legitimacy Audit] |
| typescript | 6.0.3 (pinned) | Language | Locked in CLAUDE.md — do not bump to `^7` (typescript-eslint incompatibility) |

### Supporting — Phase 1-specific additions
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@better-auth/drizzle-adapter` | 1.7.2 | Drizzle adapter for Better Auth | **Correction to CLAUDE.md's installation list** — Better Auth split its ORM adapters into separate packages; `drizzleAdapter` is no longer exported from the `better-auth` root package. Install this package explicitly. [CITED: better-auth.com/docs/adapters/drizzle — SUS verdict on recency, see audit] |
| `auth` (Better Auth CLI) | latest | Generates the Better Auth Drizzle schema (`user`/`session`/`account`/`verification` tables) | Run `npx auth generate` once the `betterAuth()` config exists, to scaffold `auth-schema.ts`. **Do not use `@better-auth/cli`** — it is deprecated ("Package no longer supported") [VERIFIED: npm registry — deprecated flag confirmed via `npm view @better-auth/cli deprecated`] |
| `@neondatabase/serverless` | latest | Neon Postgres driver | Use with `drizzle-orm/neon-http` for Server Actions/Route Handlers on the Node.js runtime (this project has no stated Edge-runtime requirement) [VERIFIED: npm registry — OK verdict, official orm.drizzle.team docs] |
| `date-holidays` | 3.36.0 | RU public-holiday lookup for D-02's weekend/holiday payment-date shift | Built-in static data, no external API call at runtime (unlike `isdayoff`, which wraps a remote API — a runtime dependency this app should avoid). Has a known data-freshness gap — see Common Pitfalls. [CITED: github.com/commenthol/date-holidays — SUS verdict on recency only, see audit] |

**Do NOT use `isdayoff`** for the holiday calendar: it is a wrapper around the external `isdayoff.ru` API (an HTTP call per lookup), introducing a runtime network dependency and a third-party outage risk into every "what's the next payment date" computation — a poor fit for a server that should compute this deterministically. `date-holidays` ships the rule data in the package itself.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `date-holidays` (static RU data) | `isdayoff` (remote API wrapper) | Only if the team wants the RF government's *current-year* production calendar (including this year's perенос decree) with zero local maintenance — at the cost of a runtime network dependency and third-party availability risk on every date computation |
| `drizzle-orm/neon-http` | `drizzle-orm/neon-serverless` (WebSocket) | Only if Phase 1 needs multi-statement interactive transactions in a single Server Action; not required for Phase 1's CRUD + single-row salary-history writes |

**Installation (Phase 1 additions/corrections to CLAUDE.md's list):**
```bash
npm install better-auth @better-auth/drizzle-adapter
npm install @neondatabase/serverless drizzle-orm
npm install date-holidays
npm install -D drizzle-kit
# Better Auth schema generation (run after auth.ts config exists):
npx auth generate
```

**Version verification:** All versions above were checked via `npm view <pkg> version` against the live registry on 2026-08-28 (see Package Legitimacy Audit for full signal table).

## Package Legitimacy Audit

| Package | Registry | Age (latest publish) | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|----------------------|--------------|--------------|---------|-------------|
| better-auth | npm | 2 days | 7,425,560 | github.com/better-auth/better-auth | SUS (too-new) | Approved — flag heuristic is publish-recency only; download count and repo are established. Planner: add `checkpoint:human-verify` before install per protocol. |
| @better-auth/drizzle-adapter | npm | 2 days | 6,547,414 | github.com/better-auth/better-auth | SUS (too-new) | Approved — same org/repo as `better-auth` itself; recent split-out package, not a hallucination (confirmed on npm registry + official docs page). Planner: add `checkpoint:human-verify` before install. |
| auth (Better Auth CLI) | npm | 2 days | 248,251 | github.com/better-auth/better-auth | SUS (too-new) | Approved — replacement for deprecated `@better-auth/cli`, same org. Planner: add `checkpoint:human-verify` before install. |
| @better-auth/cli | npm | — | 319,052 | github.com/better-auth/better-auth | SUS (deprecated) | **REMOVED — do not install.** Registry-flagged `deprecated: true`, "Package no longer supported." Use `auth` instead. |
| date-holidays | npm | 3 days | 850,292 | github.com/commenthol/date-holidays | SUS (too-new) | Approved — package created 2016, high downloads, established maintainer; flag is recency-of-latest-patch only. Planner: add `checkpoint:human-verify` before install. |
| react-hook-form | npm | 7 days | 60,395,044 | github.com/react-hook-form/react-hook-form | SUS (too-new) | Approved — flag is recency-of-latest-patch only; already locked in CLAUDE.md. |
| @hookform/resolvers | npm | 11 days | 50,769,701 | github.com/react-hook-form/resolvers | SUS (too-new) | Approved — same reasoning. |
| next | npm | 3 days | 55,016,417 | github.com/vercel/next.js | SUS (too-new) | Approved — already locked in CLAUDE.md; flag is recency-of-latest-patch only. |
| vitest | npm | 10 days | 98,448,132 | github.com/vitest-dev/vitest | SUS (too-new) | Approved — already locked in CLAUDE.md; flag is recency-of-latest-patch only. |
| drizzle-orm, drizzle-kit, @neondatabase/serverless, postgres, date-fns, zod, drizzle-zod, @t3-oss/env-nextjs, react, react-dom, recharts, serwist, @serwist/next | npm | various | millions | all official repos | OK | Approved, no flags. |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `better-auth`, `@better-auth/drizzle-adapter`, `auth`, `date-holidays`, `react-hook-form`, `@hookform/resolvers`, `next`, `vitest` — all flagged **solely on the legitimacy tool's "too-new" heuristic** (latest version published within days of this research), not on download counts, missing repos, or deprecation. Cross-checked: every one of these has an established GitHub org/repo and download counts in the hundreds-of-thousands-to-hundreds-of-millions/week range — none show hallmarks of a hallucinated or squatted package. Per protocol, the planner must still insert a `checkpoint:human-verify` task before each install, but this is a low-risk gate, not a blocking concern.

**Note on `@better-auth/cli`:** this package name appears in several still-indexed tutorials (including one surfaced in this session's own web search) as the way to generate the Better Auth Drizzle schema. It is now deprecated on the registry itself. Do not let the planner or executor install it from an old tutorial's copy-pasted command — use `auth` (`npx auth generate`) instead.

## Architecture Patterns

Builds directly on `.planning/research/ARCHITECTURE.md`'s "functional core, imperative shell" pattern and effective-dated-facts pattern — both apply unchanged to Phase 1. The additions below are Phase-1-specific refinements those documents don't cover.

### System Architecture Diagram — Phase 1 request flow

```
Browser (PWA-shell-less for now — Phase 4 adds manifest/installability)
   │  HTTPS
   ▼
Next.js App Router (single deploy)
   │
   ├─ /api/auth/[...all]  ──────► Better Auth (email+password, session cookie)
   │                                   │
   ├─ Server Actions:                  │
   │   - registerSalary(gross, effectiveFrom)
   │   - saveSchedule(avansDay, salaryDay)
   │   - saveYtdBaseline(amount, asOfDate)
   │        │  Zod validation
   │        ▼
   │   Repository layer (Drizzle, ownership-scoped by session userId)
   │        │
   │        ▼
   │   Postgres (Neon) — users(BA), salary_history, payment_schedule, ytd_baseline
   │
   └─ RSC: HomeScreen
        │  calls forecastNextPayment(userId)  [Server Action / direct server call]
        ▼
      1. load: active salary (salary_history WHERE effective_from <= today ORDER BY DESC LIMIT 1)
      2. load: payment_schedule (avansDay, salaryDay)
      3. compute candidate payment dates (this/next month) → clamp (D-03) → shift-if-weekend/holiday (D-02)
      4. pick earliest candidate >= today  = "next payment"
      5. load: ytd_baseline (amount, asOfDate) — cumulativeBefore
      6. domain/tax/calculateNdfl(cumulativeBefore, nextPaymentGross, taxYear=2025)
      7. return {date, gross, tax, net} → RSC renders
```

### Recommended Project Structure (Phase 1 scope)
```
src/
├── domain/
│   └── tax/
│       ├── ndfl-brackets.ts        # 2025 versioned bracket table (verified thresholds below)
│       ├── calculate-ndfl.ts       # pure calculateNdfl(cumulativeBefore, gross, taxYear)
│       └── calculate-ndfl.test.ts  # boundary-straddling tests (Vitest)
├── domain/
│   └── schedule/
│       ├── resolve-payment-date.ts # day-of-month clamp (D-03) + weekend/holiday shift (D-02)
│       └── resolve-payment-date.test.ts
├── lib/
│   ├── auth.ts                     # betterAuth() config
│   ├── auth-client.ts              # authClient for client components
│   └── db/
│       ├── schema.ts                # Drizzle schema: salary_history, payment_schedule, ytd_baseline
│       ├── auth-schema.ts           # generated by `npx auth generate` — user/session/account/verification
│       └── index.ts                 # drizzle(neon(...)) client
├── app/
│   ├── api/auth/[...all]/route.ts  # Better Auth handler
│   ├── (auth)/register/page.tsx
│   ├── (auth)/login/page.tsx
│   ├── (app)/page.tsx              # HomeScreen — next payment (RSC)
│   ├── (app)/settings/salary/page.tsx  # salary + schedule + YTD forms
│   └── actions/
│       ├── salary.ts                # Server Actions, Zod-validated
│       └── forecast.ts              # forecastNextPayment()
└── env.ts                          # @t3-oss/env-nextjs
```

### НДФЛ 2025 Bracket Correctness (TAX-01)

**Verified this session** via two independent sources (garant.ru, nalog-nalog.ru) cross-checked against each other and against `.planning/research/PITFALLS.md`'s prior findings — all three agree exactly:

| Cumulative annual income (₽) | Rate | Fixed base for cumulative tax | Formula for `taxOnCumulative(income)` |
|---|---|---|---|
| 0 – 2,400,000 | 13% | 0 | `income × 0.13` |
| 2,400,000 – 5,000,000 | 15% | 312,000 | `312,000 + (income − 2,400,000) × 0.15` |
| 5,000,000 – 20,000,000 | 18% | 702,000 | `702,000 + (income − 5,000,000) × 0.18` |
| 20,000,000 – 50,000,000 | 20% | 3,402,000 | `3,402,000 + (income − 20,000,000) × 0.20` |
| over 50,000,000 | 22% | 9,402,000 | `9,402,000 + (income − 50,000,000) × 0.22` |

Legal basis: 5-bracket scale effective 01.01.2025 per Federal Law 176-ФЗ (12.07.2024), amending НК РФ ст. 224. [CITED: garant.ru/1c-wiseadvice/guide/progressivnaya-shkala-ndfl-s-2025-goda, nalog-nalog.ru/ndfl/progressivnaya-shkala-ndfl-s-2025-goda — cross-checked, MEDIUM-HIGH confidence]

Per-payment tax = `taxOnCumulative(cumulativeBefore + thisPaymentGross) − taxOnCumulative(cumulativeBefore)`, matching PITFALLS.md Pitfall 1 and ARCHITECTURE.md's `calculateNdfl` example exactly.

### Avans as Independent Taxable Event (TAX-02)

**Verified this session**, re-confirming PITFALLS.md Pitfall 2: since 263-ФЗ (14.07.2022), effective 01.01.2023, "дата фактического получения дохода" (date of income receipt) for wages = the actual payment date, for **every** tranche — avans included. НДФЛ must be computed and withheld at each payment event independently, not batched at month-end. [CITED: nalog.gov.ru (FNS regional pages), consultant.ru/law/podborki/statya_223 — cross-checked, MEDIUM-HIGH confidence]

Implication for Phase 1's schedule model: `payment_schedule` generates two independent payment events per month (avans day, salary day); each independently calls `calculateNdfl` against whatever cumulative income preceded it. There is no "untaxed avans" state to model — both `avansDay` and `salaryDay` payments go through the identical tax path.

### Deriving "Next Payment" (Not Stored)

Per ARCHITECTURE.md Pattern 2 (effective-dated facts, derived cumulative income), the "next payment" for HOME-01 is never a stored row — it's computed on read:

```typescript
// domain/schedule/resolve-payment-date.ts — pure, no DB/HTTP
import { lastDayOfMonth, isWeekend, setDate } from "date-fns";
import Holidays from "date-holidays";

const ruHolidays = new Holidays("RU");

export function resolvePaymentDate(year: number, month: number, dayOfMonth: number): Date {
  const clampedDay = Math.min(dayOfMonth, lastDayOfMonth(new Date(year, month)).getDate()); // D-03
  let date = setDate(new Date(year, month), clampedDay);
  while (isWeekend(date) || ruHolidays.isHoliday(date)) {
    date = new Date(date.getTime() - 86_400_000); // shift earlier, D-02
  }
  return date;
}
```

`forecastNextPayment(userId)` generates candidate dates for the current and next calendar month for both `avansDay` and `salaryDay`, filters to dates `>= today`, and picks the earliest — that's the "next payment." Its gross amount comes from whichever `salary_history` row is active (`effective_from <= paymentDate`, most recent) on that date.

### YTD Baseline Pattern (SAL-03) — Phase-1-specific refinement of ARCHITECTURE.md

ARCHITECTURE.md's "derived value, never mutable counter" pattern assumes a full chronological ledger of payment events since Jan 1 exists to fold over. **Phase 1 has no such ledger for the pre-signup period** — the app did not exist yet, so it cannot reconstruct what a user was actually paid in January–signup. D-09/D-10/D-11 resolve this by making the user's declared YTD figure the **opening balance** the engine folds forward from, not one row in an event table:

```typescript
// cumulativeBefore(paymentDate) for Phase 1 = ytdBaseline.amount
// (no other events exist yet between baseline.asOfDate and paymentDate in Phase 1's scope —
//  Phase 2 (bonuses) is what actually introduces the need to fold multiple events)
```

Store `ytd_baseline` as a single mutable row per user: `{ user_id, amount_kopecks, as_of_date, is_estimated }` (`is_estimated = true` when the user skipped entry — drives D-11's persistent banner). D-10 ("editing recomputes forward") is satisfied for free by this design: since nothing is cached/stored per-payment in Phase 1, editing `ytd_baseline` and re-requesting the forecast naturally produces the new number — there is no stale derived state to invalidate.

### Anti-Patterns to Avoid
- **Computing tax client-side and trusting it:** per PITFALLS.md Security Mistakes — `calculateNdfl` must run in a Server Action/Route Handler only. The client never sends a tax figure to persist.
- **Treating `ytd_baseline` as a second, competing source of "cumulative income" once Phase 2 adds bonus events:** design `getCumulativeIncomeBeforeDate()` from day one as "baseline + sum of all payment events after `baseline.as_of_date` and before the target date" so Phase 2 only adds rows to sum, not a rewritten function signature.
- **Storing money as `integer` kopecks:** a 32-bit Postgres `integer` maxes at 2,147,483,647 — equivalent to ~21.47M ₽ in kopecks. The top НДФЛ bracket starts at 20M ₽ and is unbounded above 50M ₽, so cumulative annual income for a high earner can overflow a 32-bit column well within the product's own defined tax scale. Use `bigint({ mode: "number" })` [CITED: orm.drizzle.team/docs/column-types/pg — safe up to 2^53].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Email+password auth, session cookies, multi-device sessions | Custom bcrypt + JWT/cookie session logic | Better Auth 1.7.2 + `@better-auth/drizzle-adapter` | Session refresh, cookie security flags, and the `user`/`session`/`account`/`verification` schema are all handled; hand-rolling this for a financial-data app multiplies the attack surface for no product benefit |
| RU public holiday lookup | A hand-maintained `if (date === '2025-01-01') ...` table | `date-holidays` (RU country data) | Covers the fixed federal holiday set out of the box; still needs a documented gap for yearly perенос updates (see Pitfalls) — but starting from a maintained base table beats hand-listing all ~14 non-working days per year from scratch |
| Money rounding to the ruble (ст.52 НК РФ) | Ad-hoc `Math.round()` calls scattered at display time | A single `roundToRuble(kopecks)` pure function applied once, at the point cumulative tax is computed (before taking the payment-level delta) | Rounding must happen on the *cumulative* tax value, not per-payment independently, or drift compounds across a year (PITFALLS.md Pitfall 7) — this is a correctness rule, not a style preference, so it belongs in one tested function, not repeated call sites |
| Schema/validation duplication between Drizzle tables and Server Action input | Hand-written Zod schemas that drift from the Drizzle table definition | `drizzle-zod` to derive Zod schemas from the Drizzle schema | Already locked in CLAUDE.md; prevents `salary_history`/`payment_schedule` shape drift between DB and validation layers |

**Key insight:** every "don't hand-roll" item above maps to a documented Pitfall from the project-level PITFALLS.md — this phase's job is to make sure the *scaffolding* choices don't silently reopen a pitfall that correctness-of-design already closed on paper.

## Common Pitfalls

### Pitfall: RU holiday library has a data-freshness gap for perенос (weekend-transfer) days
**What goes wrong:** `date-holidays`' bundled RU rule data reliably encodes the fixed annual holidays (New Year block, Defender of the Fatherland Day, Mar 8, May 1, May 9, Russia Day, Unity Day) but its explicit weekend-transfer overrides (`перенос выходных дней`, announced by RF government decree each year) are only populated through 2022 in the package's data file as of this research session.
**Why it happens:** The library is a generic worldwide-holidays package maintained by one person; RF's yearly perенос decree is a narrow, RU-specific update that isn't the maintainer's priority.
**How to avoid:** Ship Phase 1 with `date-holidays` as the baseline (closes D-02 for the ~8 fixed national holidays, which is the majority of the requirement). Document this as a known v1 limitation: the "shift earlier" rule may not catch every officially-transferred non-working day in a given year. Do not block Phase 1 on building a full perенос-tracking system — that is disproportionate to a next-payment forecast tool. Revisit if this proves user-visible in practice.
**Warning signs:** A payment date lands on a day the RF government declared a one-off non-working day (via a specific year's decree) that isn't in `date-holidays`' fixed rule set — the app will show that date as valid when the actual employer would pay earlier.

### Pitfall: `@better-auth/cli` (deprecated) copy-pasted from an older tutorial
**What goes wrong:** Several still-indexed tutorials (including sources surfaced by this session's own research) show `npx @better-auth/cli generate` — this package is now deprecated on the npm registry ("Package no longer supported").
**Why it happens:** The Better Auth CLI was renamed/moved to a standalone `auth` package; tutorial content predates the change and still ranks in search.
**How to avoid:** Use `npx auth generate` (and `npx auth migrate` if needed). Verify at execution time with `npm view auth version` that the package is current, since this is an actively-evolving young package split.
**Warning signs:** `npm install @better-auth/cli` succeeds but prints a deprecation warning, or `npx @better-auth/cli generate` fails silently against a current Better Auth config.

### Pitfall: 32-bit `integer` column for kopeck-denominated money
**What goes wrong:** A developer uses Drizzle's `integer()` (not `bigint()`) for gross salary / tax / cumulative-income columns, reasoning "salaries aren't that big." Cumulative annual income stored in kopecks overflows a 32-bit `integer` (max ~21.47M ₽) well within the product's own top tax bracket (which starts at 20M ₽ and is unbounded above 50M ₽).
**Why it happens:** Kopeck-scale numbers look "safely small" until you do the unit conversion mentally (₽ → kopecks is ×100) against the specific bracket thresholds this app itself implements.
**How to avoid:** Use `bigint({ mode: "number" })` for every money column from the start — `salary_history.gross_amount_kopecks`, `ytd_baseline.amount_kopecks`, and any future bonus/vacation-pay amount columns.
**Warning signs:** A Postgres constraint violation or silent wraparound on a high-earner test case near the 20M/50M ₽ boundaries.

### Pitfall: YTD baseline treated as a second "cumulative income" source once bonuses ship
**What goes wrong:** Phase 1 ships `getCumulativeIncomeBeforeDate()` as effectively "return ytdBaseline.amount" with no notion of summing additional events. Phase 2 then has to rewrite the function's internals (not just add to them) to fold in bonus events, risking a regression in the already-tested Phase 1 behavior.
**Why it happens:** It's tempting to hardcode the Phase-1-only truth ("there's only ever one input: the baseline") directly into the function rather than writing it as "baseline + sum(events after baseline.as_of_date)" even when that sum is currently always zero.
**How to avoid:** Write `getCumulativeIncomeBeforeDate()` with the summing shape from day one, even though the events table it sums over doesn't exist until Phase 2. A `bonus_entries`/`vacation_entries` UNION can be added later without touching this function's contract.
**Warning signs:** Phase 2 planning discovers the "cumulative income" function needs a full rewrite, not an additive change.

## Code Examples

### Pure НДФЛ calculation (verified bracket table)
```typescript
// domain/tax/ndfl-brackets.ts
export const NDFL_BRACKETS_2025 = [
  { from: 0,          rate: 0.13, base: 0 },
  { from: 2_400_000,  rate: 0.15, base: 312_000 },
  { from: 5_000_000,  rate: 0.18, base: 702_000 },
  { from: 20_000_000, rate: 0.20, base: 3_402_000 },
  { from: 50_000_000, rate: 0.22, base: 9_402_000 },
] as const; // amounts in whole rubles; convert kopecks -> rubles before lookup

// domain/tax/calculate-ndfl.ts
// Source: bracket thresholds cross-verified garant.ru + nalog-nalog.ru (see НДФЛ 2025 section above)
export function taxOnCumulative(cumulativeRub: number): number {
  const bracket = [...NDFL_BRACKETS_2025].reverse().find(b => cumulativeRub >= b.from)!;
  const raw = bracket.base + (cumulativeRub - bracket.from) * bracket.rate;
  return roundToRuble(raw); // ст.52 НК РФ: <50коп drop, >=50коп round up
}

export function calculateNdfl(cumulativeBeforeRub: number, paymentGrossRub: number) {
  const cumulativeAfter = cumulativeBeforeRub + paymentGrossRub;
  const taxOnThisPayment = taxOnCumulative(cumulativeAfter) - taxOnCumulative(cumulativeBeforeRub);
  return { taxOnThisPayment, net: paymentGrossRub - taxOnThisPayment, cumulativeAfter };
}

function roundToRuble(amount: number): number {
  return Math.floor(amount + 0.5); // .5 rounds up per ст.52 НК РФ
}
```

### Better Auth config (email+password, 30-day session)
```typescript
// lib/auth.ts
// Source: better-auth.com/docs/authentication/email-password, better-auth.com/docs/concepts/session-management
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "./db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true, requireEmailVerification: false }, // D-06
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days, D-07
    updateAge: 60 * 60 * 24 * 7,  // refresh weekly on use
  },
});
```

### Neon + Drizzle client (Node.js runtime, HTTP driver)
```typescript
// lib/db/index.ts
// Source: orm.drizzle.team/docs/connect-neon
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "@/env";

const sql = neon(env.DATABASE_URL);
export const db = drizzle({ client: sql });
```

### Effective-dated salary_history with overwrite-on-collision (D-14)
```typescript
// Server Action — writes a new salary value, honoring D-12/13/14
export async function setSalary(userId: string, grossKopecks: number, effectiveFrom: Date) {
  return db.transaction(async (tx) => {
    // D-14: a backdated change colliding with an existing row for the same effective_from
    // overwrites it — no audit trail. "Collision" = exact effective_from match.
    await tx.delete(salaryHistory)
      .where(and(eq(salaryHistory.userId, userId), eq(salaryHistory.effectiveFrom, effectiveFrom)));
    await tx.insert(salaryHistory).values({ userId, grossKopecks, effectiveFrom });
  });
}
```

## Walking Skeleton Scaffolding Order

1. `npx create-next-app@16 . --typescript --eslint --app --src-dir --import-alias="@/*" --turbopack` (App Router, Turbopack, TS — matches CLAUDE.md's locked stack; `--tailwind` optional depending on UI approach, not researched here since it's UI-phase scope) [CITED: nextjs.org/docs/app/getting-started/installation]
2. `npm install drizzle-orm @neondatabase/serverless drizzle-zod zod date-fns date-holidays better-auth @better-auth/drizzle-adapter react-hook-form @hookform/resolvers @t3-oss/env-nextjs` + `npm install -D drizzle-kit typescript@6.0.3 vitest`
3. Create Neon project + database (external, via Neon dashboard/CLI — not scripted here); set `DATABASE_URL` in `.env.local`.
4. `lib/db/index.ts` — Drizzle client wired to Neon (`neon-http` driver).
5. `lib/db/schema.ts` — app-owned tables: `salary_history`, `payment_schedule`, `ytd_baseline` (Drizzle schema, `bigint` for money columns, `date` mode `"date"` for date-only columns).
6. `lib/auth.ts` — `betterAuth()` config (email+password, 30-day session) referencing `db`.
7. `npx auth generate` — generates `auth-schema.ts` (`user`/`session`/`account`/`verification` tables) from the `auth.ts` config. **Not `@better-auth/cli`** (deprecated).
8. `npx drizzle-kit push` (or `generate` + `migrate` once real data exists) — applies both `schema.ts` and `auth-schema.ts` to the Neon database.
9. `app/api/auth/[...all]/route.ts` — mounts the Better Auth handler.
10. `env.ts` (`@t3-oss/env-nextjs`) — validates `DATABASE_URL`, `BETTER_AUTH_SECRET` at boot.
11. Build the `domain/tax` module (pure, tested) before wiring any Server Action to it — this is the correctness-critical piece and should exist and pass unit tests independent of the DB/auth scaffolding above.
12. Build the `domain/schedule` module (`resolvePaymentDate`, pure, tested) next to it.
13. Server Actions: `salary.ts` (create/update salary + schedule + YTD, Zod-validated) → repository functions → DB.
14. `forecastNextPayment()` orchestration function, calling both domain modules server-side only.
15. Auth pages (`register`, `login` using `authClient.signUp.email` / `signIn.email`) + `HomeScreen` RSC rendering the forecast.

This order front-loads the two things Phase 1 cannot ship without being correct (auth wiring for AUTH-01/02, tax math for TAX-01/02) before any UI polish, matching the project-level roadmap's stated intent to prove the hardest logic against a real user-observable outcome from day one.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 2025 НДФЛ bracket thresholds (2.4M/5M/20M/50M ₽) and fixed-base amounts (312,000/702,000/3,402,000/9,402,000) are exactly correct | НДФЛ 2025 Bracket Correctness | HIGH — every net-pay figure in the app is wrong if these are off. Cross-checked across garant.ru + nalog-nalog.ru + PITFALLS.md's independent prior research (3 sources agree), including an official nalog.gov.ru regional FNS page, but this session did not read the raw НК РФ ст.224 statute text directly (a fetch of an official FNS PDF failed to parse). Recommend one more pass reading the statute text on pravo.gov.ru or consultant.ru's full-article view before the tax engine ships, per STATE.md's original flag — treat as high-value, low-effort final confirmation, not a blocker to starting implementation. |
| A2 | `date-holidays`' RU data is accurate for all *fixed* national holidays in 2025/2026 even though perенос-transfer data is stale post-2022 | Common Pitfalls | MEDIUM — a payment could land on an unlisted one-off non-working day and not shift, producing a date one business day later than an actual employer would pay. Documented as an accepted v1 limitation, not silently assumed correct. |
| A3 | `@better-auth/drizzle-adapter` and the `auth` CLI package are the current, intended replacements (not themselves about to be renamed again) | Standard Stack / Walking Skeleton | LOW-MEDIUM — both packages are very recently split out (2 days old at research time); Better Auth's adapter/CLI packaging has changed at least twice recently (per the `@better-auth/cli` deprecation found this session). Re-verify package names with `npm view` immediately before Phase 1 execution, not just at plan time. |
| A4 | "Collision" for D-14's overwrite rule means an exact `effective_from` date match (not an overlapping date range) | Drizzle Schema Design / Code Examples | LOW-MEDIUM — CONTEXT.md's D-14 says "collides with an existing salary_history record for that period" without defining "period" precisely. This research assumed exact-date collision (simplest, matches "day-of-month" precision elsewhere in the phase) rather than range-overlap. If the intended meaning is broader (e.g. any change effective within the same month as an existing row), the collision-detection query needs to change from an equality match to a range query. Flag for planner confirmation. |

## Open Questions

1. **Exact "period" granularity for D-14's salary-history collision rule**
   - What we know: D-14 says a backdated change "colliding with an existing salary_history record for that period" gets overwritten.
   - What's unclear: Whether "period" means the exact `effective_from` date, or any date falling within the date-range a single salary_history row currently covers (i.e., between its `effective_from` and the next row's `effective_from`).
   - Recommendation: Default to exact-date-match (Assumption A4) as the simpler, more predictable interpretation for solo-developer implementation; the planner should confirm this reading matches user intent before locking the schema/query, since it's flagged reversibility "one-way" in CONTEXT.md.

2. **Does `payment_schedule` need its own historization, or is "current schedule only" sufficient for Phase 1?**
   - What we know: SAL-02 requires salary *history*; the schedule-input decisions (D-01 through D-04) describe validation/shifting rules but never mention retaining prior schedules.
   - What's unclear: If a user changes their avans/salary day-of-month, should past forecasts remain reconstructable with the old schedule (mirroring the salary_history pattern), or is "one current schedule row per user, upsert on change" acceptable for v1?
   - Recommendation: Treat `payment_schedule` as a single current-row-per-user table (no historization) for Phase 1 — REQUIREMENTS.md and CONTEXT.md do not ask for schedule history, only salary-amount history (SAL-02). Revisit only if a later phase's annual reconciliation (Phase 4, HOME-02) turns out to need historical schedule reconstruction.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js 16 runtime (requires 20+) | ✓ | v26.8.1 | — |
| npm | Package management | ✓ | 11.19.0 | — |
| git | Version control | ✓ | 2.43.0 | — |
| Docker | Not required by this stack (Vercel doesn't accept custom containers) | ✓ (present, unused) | 28.3.3 | — |
| Local PostgreSQL | Not required — Neon is the target DB (cloud) | ✓ (present, unused) | 16.13 | Could serve as a local-dev fallback DB if Neon is unreachable during development, but the stack targets Neon directly |
| Neon account / project | AUTH-02, all data persistence | Not verified in this session — requires external account setup | — | None — this blocks all DB-backed work until a Neon project + `DATABASE_URL` exists. Planner should add an early setup task ("create Neon project, obtain connection string") before any schema/migration task. |
| Better Auth secret (`BETTER_AUTH_SECRET`) | AUTH-01 | Not yet generated | — | Generate via `openssl rand -base64 32` as part of scaffolding, validated through `@t3-oss/env-nextjs` |

**Missing dependencies with no fallback:**
- Neon project/connection string — must be provisioned (external, manual step) before any DB-touching task can run. Add as an explicit early plan task.

**Missing dependencies with fallback:**
- None beyond the above; local Postgres 16.13 is available as a dev-time fallback if Neon provisioning is delayed, but the target architecture (branching, scale-to-zero) assumes Neon specifically.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (locked in CLAUDE.md; no version pinned beyond "latest" at CLAUDE.md-authoring time) |
| Config file | none yet — Wave 0 must add `vitest.config.ts` |
| Quick run command | `npx vitest run domain/tax domain/schedule` (once scaffolded) |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TAX-01 | Bracket-boundary-straddling payment splits correctly across 2.4M/5M/20M/50M thresholds | unit | `npx vitest run domain/tax/calculate-ndfl.test.ts` | ❌ Wave 0 |
| TAX-01 | Rounding matches ст.52 НК РФ (< 50 kop drop, ≥ 50 kop round up) on cumulative tax, not per-payment | unit | `npx vitest run domain/tax/calculate-ndfl.test.ts` | ❌ Wave 0 |
| TAX-02 | Avans and salary each independently increase cumulative base and are each taxed via the delta method | unit | `npx vitest run domain/tax/calculate-ndfl.test.ts` | ❌ Wave 0 |
| SAL-01 | Day-of-month clamps to last valid day (D-03); e.g. day=31 in a 30-day month → 30th | unit | `npx vitest run domain/schedule/resolve-payment-date.test.ts` | ❌ Wave 0 |
| SAL-01 | Payment date shifts earlier off a weekend/RU holiday (D-02) | unit | `npx vitest run domain/schedule/resolve-payment-date.test.ts` | ❌ Wave 0 |
| SAL-02 | Backdated salary change with exact-date collision overwrites the prior row, no audit trail (D-14) | integration | `npx vitest run lib/db/salary-history.test.ts` (requires test DB or Neon branch) | ❌ Wave 0 |
| SAL-03 | Skipped YTD entry produces `is_estimated = true` and the forecast treats baseline as 0 | unit/integration | `npx vitest run domain/tax/ytd-baseline.test.ts` | ❌ Wave 0 |
| AUTH-01 | Register → login → session persists | e2e/manual | Playwright (deferred per STACK.md: "add once core flows exist") or manual click-through | ❌ Wave 0 (manual acceptable for Phase 1) |
| AUTH-02 | Login from a second "device" (second browser/session) shows same salary/schedule data | manual | Manual UAT — no automated multi-session test infra exists yet | N/A — manual-only, justified: this is fundamentally an integration/UAT-shaped check given no second-device automation exists in-repo |
| HOME-01 | Home screen shows correct next-payment amount+date for a range of schedule/salary/YTD combinations | integration | `npx vitest run app/actions/forecast.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run domain/` (fast, pure-function subset)
- **Per wave merge:** `npx vitest run` (full suite, including any DB-touching integration tests)
- **Phase gate:** Full suite green before `/gsd-verify-work`; AUTH-02's manual second-device check must be explicitly performed and recorded, not skipped, since it's the one requirement with no automated coverage path.

### Wave 0 Gaps
- [ ] `vitest.config.ts` — framework install/config, none exists yet (greenfield)
- [ ] `domain/tax/calculate-ndfl.test.ts` — covers TAX-01, TAX-02
- [ ] `domain/schedule/resolve-payment-date.test.ts` — covers SAL-01 (D-02, D-03)
- [ ] `lib/db/salary-history.test.ts` — covers SAL-02 (D-14 collision/overwrite); needs a test Postgres instance or a Neon branch per test run
- [ ] `domain/tax/ytd-baseline.test.ts` — covers SAL-03 (D-09/10/11)
- [ ] `app/actions/forecast.test.ts` — covers HOME-01 end-to-end orchestration
- [ ] Test-DB strategy decision: local Postgres 16.13 (available in this environment) vs. a per-test-run Neon branch — not resolved in this research; recommend local Postgres for fast unit/integration test iteration, reserving Neon branches for CI/preview-deployment verification (matches STACK.md's Neon-branching-for-previews guidance)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better Auth (scrypt-based password hashing by default, session token generation) — do not hand-roll password hashing |
| V3 Session Management | yes | Better Auth session cookies (`httpOnly`, `secure` in production); `expiresIn`/`updateAge` per D-07 |
| V4 Access Control | yes | Every Server Action / repository query scoped to `session.userId`; never trust a client-supplied user ID (per PITFALLS.md Security Mistakes) |
| V5 Input Validation | yes | Zod schemas (via `drizzle-zod`) at every Server Action boundary — gross salary must be positive, dates must be valid, day-of-month in [1,31] |
| V6 Cryptography | yes | Delegated entirely to Better Auth for password hashing/session tokens — never hand-roll |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR — user A reads/writes user B's salary_history via a manipulated request | Elevation of Privilege / Info Disclosure | Every repository function takes `userId` from the verified session, never from client input; add a `WHERE user_id = :sessionUserId` clause (or ownership check) to every query, no exceptions |
| Client-computed tax figure synced as if authoritative | Tampering | `calculateNdfl` runs server-side only, inside the Server Action that persists/returns the forecast; the client never submits a tax/net figure for storage |
| Session fixation / long-lived session token theft (relevant given D-07's 30-day sessions) | Spoofing | Better Auth's default cookie flags (`httpOnly`, `secure`, `sameSite`) plus HTTPS-only deployment (Vercel default); do not weaken `updateAge`/`expiresIn` defaults without explicit tradeoff review, since D-07 already extends the default 7-day window to 30 |
| Sensitive financial data (salary) at rest without care given 152-ФЗ (RU personal data law) | Information Disclosure | Neon Postgres encrypts at rest by default; avoid logging raw salary/tax figures in application logs; be mindful of Neon's data-residency region if 152-ФЗ compliance becomes a hard requirement (not scoped as a hard requirement in PROJECT.md, but flagged in PITFALLS.md as a risk area) |

## Sources

### Primary (HIGH confidence)
- npm registry direct queries (`npm view`, `npm view <pkg> deprecated`, `npm view <pkg> repository.url`) — 2026-08-28 — exact current versions, deprecation status, and repo URLs for all packages checked
- `gsd-tools query package-legitimacy check` — full signal table for 20 packages (drizzle-orm, drizzle-kit, better-auth, @better-auth/drizzle-adapter, @better-auth/cli, auth, date-holidays, @neondatabase/serverless, postgres, date-fns, zod, drizzle-zod, react-hook-form, @hookform/resolvers, @t3-oss/env-nextjs, next, react, react-dom, recharts, serwist, @serwist/next, vitest)
- orm.drizzle.team/docs/column-types/pg, orm.drizzle.team/docs/connect-neon — official Drizzle documentation, fetched directly

### Secondary (MEDIUM confidence)
- garant.ru/1c-wiseadvice/guide/progressivnaya-shkala-ndfl-s-2025-goda, nalog-nalog.ru/ndfl/progressivnaya-shkala-ndfl-s-2025-goda — cross-checked НДФЛ 2025 bracket thresholds/formula, agree exactly with each other and with PITFALLS.md's prior independent findings
- nalog.gov.ru (FNS regional pages), consultant.ru/law/podborki/statya_223 — 2023 avans-taxation rule (263-ФЗ)
- consultant.ru (ст.52 НК РФ rounding), kontur.ru/extern (ст.139 ТК РФ / ПП РФ №922 vacation-pay formula) — both cross-checked against PITFALLS.md
- better-auth.com/docs/adapters/drizzle, better-auth.com/docs/concepts/session-management, better-auth.com/docs/concepts/database, better-auth.com/docs/authentication/email-password — official Better Auth docs, fetched directly this session
- github.com/commenthol/date-holidays (RU.yaml data file) — fetched directly, confirms fixed-holiday coverage and the perенос-data gap
- nextjs.org/docs/app/getting-started/installation — create-next-app flags

### Tertiary (LOW confidence)
- General WebSearch result summaries (Medium/makerkit/PkgPulse tutorial content) for Better Auth/Drizzle/Neon integration patterns — used only to corroborate the official-docs findings above, never as the sole source for a claim in this document

## Metadata

**Confidence breakdown:**
- Standard stack / scaffolding: HIGH — npm registry directly queried for every package; official docs fetched for Better Auth, Drizzle, Neon
- Tax/labor-law numeric constants (TAX-01, TAX-02): MEDIUM-HIGH — cross-checked across 3 independent sources this session plus PITFALLS.md's prior independent research, but not read from the raw statute text (see Assumption A1)
- Architecture (YTD baseline pattern, next-payment derivation): MEDIUM — original synthesis extending ARCHITECTURE.md's general pattern to Phase 1's specific no-prior-ledger constraint; not sourced from a comparable published system
- Package legitimacy: MEDIUM — several core packages (better-auth, its Drizzle adapter, its CLI, date-holidays) are flagged SUS by the automated gate purely on publish recency; manually cross-checked against download counts and repo provenance to rule out hallucination, but planner must still gate installs behind `checkpoint:human-verify` per protocol

**Research date:** 2026-08-28
**Valid until:** 30 days for stack/scaffolding guidance (fast-moving — Better Auth's adapter/CLI packaging has already changed twice recently); re-verify tax bracket constants only if RU tax law changes (next expected review point: any 2026 legislative session affecting НК РФ ст.224, or before Phase 3's vacation-pay divisor work)

---
*Research for: Phase 1 - Core Payroll Loop (НаРуки)*
*Researched: 2026-08-28*
