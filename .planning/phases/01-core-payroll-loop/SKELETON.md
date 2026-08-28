# Walking Skeleton — НаРуки

**Phase:** 1
**Generated:** 2026-08-28

## Capability Proven End-to-End

A newly-registered user can enter a gross salary and an avans/salary day-of-month schedule, and see the date and correctly-taxed take-home amount of their next payment on the home screen — served by the deployed Next.js app, backed by a real Neon Postgres row, and computed by the real progressive НДФЛ engine (no stubbed tax figure at any point).

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16.3.3, App Router, Turbopack, `--src-dir`, import alias `@/*` | Locked in `.claude/CLAUDE.md`. Server Components read the forecast; Server Actions mutate. One deploy, no separate API service. |
| Language | TypeScript 6.0.3 (pinned; **not** 7.x) | `typescript-eslint` has no TS 7.x support; type-aware linting on financial code is worth staying a major behind. Re-check at each phase boundary. |
| Data layer | Neon Postgres + Drizzle ORM 0.45.2 via `drizzle-orm/neon-http`, migrations by `drizzle-kit push` | Relational, effective-dated, window-function friendly for the YTD cumulative math. `neon-http` is sufficient — Phase 1 needs no interactive multi-statement transactions. |
| Money representation | `bigint({ mode: "number" })` **kopecks** on every money column | A 32-bit int column tops out at ~21.47M ₽ in kopecks — inside this app's own 20M/50M ₽ tax brackets. Kopeck integers also avoid float drift. |
| Auth | Better Auth 1.7.2 + `@better-auth/drizzle-adapter` 1.7.2, email+password only, 30-day rolling session (D-05, D-06, D-07) | Self-hosted, no per-MAU billing, sessions live in our own Postgres so "cross-device sync" (AUTH-02) is just "same user row, two sessions". |
| Auth schema generation | `npx auth generate` (the `auth` package) | The older `@better-auth/cli` package is registry-deprecated. See `01-RESEARCH.md` § Common Pitfalls. |
| Domain isolation | `src/domain/**` is pure — zero imports from `@/lib/db`, `next/*`, or any I/O | "Functional core, imperative shell" (`.planning/research/ARCHITECTURE.md`). The tax and schedule engines are the highest-risk code in the product and must be exhaustively unit-testable without a database. |
| Tax execution site | Server-only. `calculateNdfl` is invoked from Server Actions / RSC, never shipped to or trusted from the client | A client-computed net figure is a tampering vector on a financial app (`01-RESEARCH.md` § Security Domain). |
| Cumulative income | Derived on read: `getCumulativeIncomeBeforeDate(userId, date)` = YTD baseline + sum of dated income events after `baseline.as_of_date`. Never a stored running counter. | Phase 1's event sum is currently always empty, but the *shape* is written now so Phase 2 (bonuses) and Phase 3 (отпускные) are additive, not a rewrite. |
| Payment-schedule model | Day-of-month integers (`avans_day`, `salary_day`), one current row per user, no schedule history (D-01) | REQUIREMENTS.md asks for salary history (SAL-02), never schedule history. Resolves `01-RESEARCH.md` Open Question 2. |
| Styling | Tailwind CSS (create-next-app default) | Planner-recorded discretion — styling was not covered by any D-XX decision. Reversible: it is class-level, behind no contract. |
| Deployment target | Local full-stack dev run against the real Neon database: `npm run dev` with `DATABASE_URL` + `BETTER_AUTH_SECRET` in `.env.local`. Vercel deploy is deferred to Phase 4 (PWA-01). | The skeleton's "deployment" criterion is met by a documented command that exercises the whole stack against real cloud Postgres. |
| Directory layout | `src/domain/{tax,schedule}/`, `src/lib/{db,validation}/`, `src/app/(auth)/`, `src/app/(app)/`, `src/app/actions/`, `src/components/` | From `01-RESEARCH.md` § Recommended Project Structure. |

## Stack Touched in Phase 1

- [ ] Project scaffold — Next.js 16 + TypeScript 6.0.3 + ESLint + Tailwind + Vitest (Plan 01-01)
- [ ] Routing — `(auth)/register`, `(auth)/login`, `(app)/` home, `(app)/settings/salary`, `(app)/onboarding/ytd`, `api/auth/[...all]` (Plans 01-02, 01-04, 01-05)
- [ ] Database — real write (`user` row on register; `salary_history` / `payment_schedule` / `ytd_baseline` rows on save) AND real read (active salary + schedule + baseline on the home-screen forecast) (Plans 01-02, 01-04, 01-05)
- [ ] UI — register form, salary/schedule/YTD forms, home-screen next-payment card, all wired to Server Actions (Plans 01-02, 01-04, 01-05)
- [ ] Deployment — `npm run dev` runs the full stack against Neon; documented in the repo README (Plan 01-02)

## Out of Scope (Deferred to Later Slices)

- OAuth providers (Yandex ID / VK ID) — D-05 defers past v1 Phase 1
- Password reset / forgot-password flow — D-08 defers to v1.x
- Email verification — D-06 explicitly disables it
- Audit trail for salary-history corrections — D-14 chose overwrite; no history-of-corrections table
- "Upcoming salary change" home-screen indicator — D-15 keeps HOME-01 to amount + date only
- Bonuses / премии (Phase 2), отпускные (Phase 3), annual pie chart + PWA installability (Phase 4)
- Offline mode, tax deductions, multi-employer, районный коэффициент — out of scope for the whole v1 per REQUIREMENTS.md
- Playwright e2e — deferred per `.planning/research/STACK.md` ("add once core flows exist")

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- **Phase 2 — Bonuses:** adds a `bonus_entries` table and includes it in `getCumulativeIncomeBeforeDate`'s event sum. No change to `calculateNdfl`, no change to the schedule engine.
- **Phase 3 — Vacation pay:** adds a `vacation_entries` table plus a second pure domain module (`src/domain/vacation/`) that produces a dated income event, folded through the same cumulative engine.
- **Phase 4 — Annual overview + PWA:** adds a Recharts pie chart reading the same forecast/ledger functions, plus Serwist manifest + service worker on the existing App Router shell.
