# Technology Stack

**Project:** НаРуки (take-home salary tracker PWA, Russia)
**Researched:** 2026-08-28
**Confidence:** MEDIUM-HIGH (package versions verified directly against npm registry = HIGH; architecture/library-choice recommendations cross-checked across multiple 2026 sources = MEDIUM)

## Executive Summary

This is a small-team greenfield CRUD app with real backend requirements (multi-user accounts, cross-device cloud sync, a backend-owned progressive-tax calculation engine) but **no offline requirement and no realtime-collaboration requirement**. That combination points straight at a single full-stack framework rather than a separate SPA + API service: **Next.js (App Router) on Vercel, Postgres (Neon) via Drizzle ORM, and Better Auth for accounts** — one deployable, one database, minimal glue code, all TypeScript end-to-end so the tax/vacation-pay math has one source of truth shared (or at least type-shared) between server and client.

The single highest-leverage architectural decision, orthogonal to any package pick: **the tax/vacation-pay calculation logic must be pure, framework-free TypeScript functions with zero DB or HTTP dependencies**, run only on the server. This directly serves the two hardest requirements in PROJECT.md — cumulative YTD progressive НДФЛ brackets and 12-month average-earnings отпускные — both of which are pure functions of (dates, amounts) and should be unit-tested exhaustively before any UI is built. This is a stack-adjacent decision, but it dictates supporting-library choices below (Vitest for fast pure-function testing, date-fns for date math).

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.3.3 (App Router) | Full-stack framework — UI + API in one deploy | Current stable as of Aug 2026 (verified via npm registry). App Router gives Server Components for read-heavy screens (next payment, pie chart) and Server Actions/Route Handlers for mutations (add bonus, change salary), avoiding a separate Express/Fastify API layer for a small team. Turbopack is the default bundler in v16, React Compiler is stable. |
| React | 19.2.8 | UI runtime | Ships with Next.js 16 as the baseline; React Compiler (stable in Next 16) removes most manual `useMemo`/`useCallback` need for the dashboard/chart screens. |
| TypeScript | **6.0.3** (not 7.0.x yet) | Language / type safety | TypeScript 7.0 (native Go compiler, ~10x faster builds) shipped stable in July 2026, but it ships **without a stable programmatic API** — `typescript-eslint` cannot support it yet (issue closed "not planned," fix targeted for TS 7.1, "several months away" per Microsoft as of Aug 2026). For a project that wants type-aware linting on financial calculation code, stay on the 6.0.x line now and upgrade once `typescript-eslint` ships 7.x support. Re-check this at each phase boundary — it may resolve mid-project. |
| PostgreSQL (via Neon) | Postgres 17-class, Neon serverless | Primary database | Relational model fits this domain precisely: users → salary_history (effective-dated) → bonuses → pay_dates, all needing joins and window functions (`SUM() OVER (PARTITION BY user_id, year ORDER BY pay_date)`) to compute YTD cumulative income for the progressive tax brackets. Neon adds branching (safe migrations testing), scale-to-zero (near-zero cost at low usage), and is Vercel's native Marketplace Postgres integration (Vercel Postgres itself was retired Dec 2024, auto-migrated to Neon). |
| Drizzle ORM + drizzle-kit | 0.45.2 / 0.31.10 | Type-safe SQL query builder + migrations | Code-first TS schema (no separate `.prisma` file/generation step), stays close to SQL so the cumulative-sum/window-function queries needed for YTD tax calculation are easy to express directly, tiny bundle, edge/serverless-friendly cold starts. Drizzle Kit handles migrations, which matter here because `salary_history`/`bonus` schemas will evolve. |
| Better Auth | 1.7.2 | Authentication, multi-device sessions | Self-hosted TS-native auth library that stores users/sessions in your own Postgres (via the Drizzle adapter) — no per-MAU billing, which matters for a personal-finance side project with unpredictable user count. Session cookies work naturally across devices once the user logs in on each; "sync" here just means the same Postgres row is the source of truth per user, which Better Auth's session model supports out of the box. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Recharts | 3.10.1 | Pie/donut chart (gross/tax/net annual summary) | Default choice: declarative JSX matches React/Next.js idioms, good TypeScript types, most common React dashboard chart library in 2026 comparisons. For a single chart, bundle-size differences vs. Chart.js/Nivo are marginal — pick for DX, not KB. |
| Serwist (`@serwist/next`, `serwist`) | 9.5.12 | Web app manifest + minimal service worker for "Add to Home Screen" | `next-pwa` (the old default) has been archived/unmaintained since Aug 2023 — do not use it. Serwist is its actively maintained successor and is what current Next.js PWA guides point to. Since v1 has **no offline requirement** (per PROJECT.md), configure Serwist with an empty/near-empty precache — the service worker only needs to exist and be "active" to satisfy install-ability heuristics and to leave a clean path to add real offline caching later. Pair with explicit `apple-touch-icon` and `apple-mobile-web-app-*` meta tags — iOS Safari's manual "Add to Home Screen" flow reads the manifest + those meta tags directly and does not require Chrome-style install-prompt criteria. |
| date-fns | 4.4.0 | Date math for pay dates, YTD windows, 12-month отпускные averaging window | Tree-shakeable, immutable, no timezone footguns like native `Date` mutation bugs. All pay-date and average-earnings-window logic should route through this rather than hand-rolled `Date` arithmetic. |
| Zod | 4.4.3 | Runtime validation for salary/bonus/vacation input, and API boundary schemas | Validate all money and date inputs at the Server Action boundary (gross salary must be positive, pay dates must be valid calendar days, etc.) before they ever reach the tax engine. |
| `drizzle-zod` | latest matching Drizzle | Derive Zod schemas from Drizzle table definitions | Keeps DB schema and input-validation schema from drifting apart as `salary_history`/`bonus` tables evolve. |
| React Hook Form | latest | Form state for salary/bonus/vacation entry forms | Standard pairing with Zod (`@hookform/resolvers`) for the multi-field forms this app needs (salary amount + effective date, bonus amount + pay date, vacation start/end). |
| Vitest | 4.1.11 | Unit testing for the tax/vacation-pay calculation engine | The НДФЛ progressive-bracket function and the отпускные average-earnings function are pure, deterministic, and the highest-risk code in this app (get them wrong and every number on screen is wrong) — they need fast, exhaustive unit tests. Vitest is the natural fit for a Vite/Next-adjacent TS project and runs fast enough for TDD on this kind of pure logic. |
| Playwright | 1.62.1 | End-to-end smoke tests (login → enter salary → see next payment) | Add once core flows exist; not needed on day one. |
| `@t3-oss/env-nextjs` | 0.13.11 | Typed, validated environment variables | Cheap insurance against a missing `DATABASE_URL`/`BETTER_AUTH_SECRET` reaching production silently. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vercel CLI + Vercel dashboard | Deploy target, preview deployments per PR | Zero-config for Next.js; Vercel's own build system does not accept Docker, which is fine here since nothing in this stack needs a custom container. |
| Neon branching | Per-PR/preview database branches | Pairs with Vercel preview deployments so schema changes and tax-logic changes can be tested against a real (copy-on-write) Postgres branch before merging. |
| Drizzle Studio | Local/hosted DB browser | Useful for manually inspecting salary_history rows during development of the YTD calculation logic. |

## Installation

```bash
# Core
npm install next@16.3.3 react@19.2.8 react-dom@19.2.8

# Data layer
npm install drizzle-orm postgres better-auth drizzle-zod zod
npm install -D drizzle-kit

# UI / forms / dates
npm install recharts date-fns react-hook-form @hookform/resolvers
npm install serwist @serwist/next

# Env safety
npm install @t3-oss/env-nextjs

# Dev dependencies
npm install -D typescript@6.0.3 vitest playwright @playwright/test
```

Pin `typescript` explicitly to the 6.0.x line in `package.json` (not `^7`) until `typescript-eslint` ships native-compiler support — otherwise a routine `npm update` can silently pull in TS 7 and break lint tooling.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Neon (Postgres-only) + Better Auth | Supabase (Postgres + bundled Auth + Realtime) | If the team wants one fewer moving part and is willing to accept Supabase's bundled auth model and slightly more black-box platform. Reasonable choice, but this app doesn't need Supabase's realtime subscriptions (no live multi-user collaboration on the same data — each user only ever syncs their own rows across their own devices), so the extra bundling buys less than it costs in flexibility. |
| Better Auth | Clerk | If shipping speed and a polished hosted login UI matter more than owning the auth data model and avoiding per-MRU billing. Clerk is free to 50k MRU, then ~$0.02/MRU — fine for a side project that stays small, expensive if it doesn't. |
| Drizzle ORM | Prisma (v7, TS/Wasm engine) | If the team strongly prefers Prisma's schema-first DX and mature Prisma Studio, and is fine with an extra generation step. Prisma 7's rewritten engine (~600KB gzipped) closed most of the historical serverless cold-start gap, so this is a legitimate, not just "worse," alternative. |
| Recharts | Chart.js (via `react-chartjs-2`) | If bundle size is under real scrutiny (smallest gzip footprint among the three compared) and the canvas-based, less-React-idiomatic API is an acceptable tradeoff for one chart. |
| Vercel | Railway | If the team wants one dashboard/bill for app + Postgres + background jobs and is less concerned with Vercel-specific Next.js optimizations (ISR edge caching, image optimization). Railway's managed Postgres is pricier at scale than Fly.io's, but this app's Postgres footprint will be tiny. |
| Vercel | Fly.io | Only if the team anticipates needing persistent VM-level control or non-serverless background workers later — not indicated by v1 scope. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `next-pwa` | Archived/unmaintained since August 2023; will accumulate compatibility issues with current Next.js/Turbopack | `serwist` / `@serwist/next` |
| TypeScript 7.0.x (right now) | Ships without a stable programmatic API; `typescript-eslint` support was explicitly closed as "not planned" until TS 7.1 lands (still months out as of Aug 2026) — type-aware ESLint rules will break | TypeScript 6.0.x until `typescript-eslint` confirms 7.x support, then upgrade |
| PlanetScale | MySQL/Vitess-based (not Postgres — loses window-function ergonomics this app leans on for YTD cumulative tax math), free tier removed, $39/mo minimum | Neon (Postgres, generous free tier, scale-to-zero) |
| Firebase/Firestore or MongoDB for the primary store | This domain is fundamentally relational and time-ordered — salary changes, bonuses, and pay dates need joins and cumulative window-function aggregation for the progressive tax calculation; document/NoSQL stores make that logic much harder to express and verify correctly | PostgreSQL (via Neon) |
| A dedicated time-series DB (TimescaleDB, InfluxDB) | Massive overkill — each user generates a handful of rows per month, not high-frequency time-series data; adds operational complexity for zero benefit at this scale | Plain PostgreSQL tables with `valid_from`/`valid_to`-style effective-dated columns and indexes |
| Client-side-only storage / offline-first sync engines (RxDB, WatermelonDB, IndexedDB-based sync) | PROJECT.md explicitly scopes offline out of v1; building an offline-first sync layer now is speculative complexity the requirements don't ask for | Standard server-authoritative Postgres + Server Actions; revisit only if a future milestone adds offline scope |
| NextAuth.js v4 (callback-based Auth.js) | Legacy pattern; the ecosystem's 2026 guidance is to migrate new projects toward Better Auth | Better Auth |

## Stack Patterns by Variant

**If the team wants to minimize infrastructure surface even further (single vendor for DB+Auth+hosting glue):**
- Use Supabase (Postgres + Auth) instead of Neon + Better Auth, deployed on Vercel
- Because it trades some architectural flexibility for one less account/bill/integration to manage — acceptable if the team is small enough that operational simplicity outweighs owning the auth data model

**If a future milestone adds offline support or multi-employer income tracking (both explicitly out of scope for v1 per PROJECT.md):**
- Revisit the "no client-side sync engine" decision above — that recommendation is scoped to v1's requirements, not a permanent architectural stance

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `next@16.3.3` | `react@19.2.x`, `typescript@6.0.x` | Next.js 16 requires Node.js 20+ as its minimum runtime. |
| `typescript@6.0.3` | `typescript-eslint@8.63.x` (peer range `>=4.8.4 <6.1.0`) | Do **not** bump to `typescript@^7` yet — breaks `typescript-eslint`/ESLint (`Can't read properties of undefined (reading 'Cjs')`) until TS 7.1's programmatic API ships. |
| `drizzle-orm@0.45.2` | `postgres@3.4.9` or `pg@8.23.0`, Neon serverless driver | Use the Neon-specific driver (`@neondatabase/serverless`) if deploying Route Handlers/Server Actions to the Vercel Edge runtime; plain `postgres`/`pg` is fine for Node.js runtime functions. |
| `better-auth@1.7.2` | `drizzle-orm` (via `better-auth`'s Drizzle adapter) | Confirm adapter version compatibility at install time — Better Auth ships frequent minor releases. |
| `serwist@9.5.12` | `next@16.3.3` (Turbopack) | Serwist's Next.js integration explicitly documents both Turbopack and webpack build paths. |

## Sources

- npm registry (`registry.npmjs.org`, direct queries, Aug 2026) — HIGH confidence — exact current versions for `next`, `react`, `drizzle-orm`, `better-auth`, `recharts`, `serwist`, `typescript`, `zod`, `date-fns`, `pg`, `postgres`, `vitest`, `playwright`
- nextjs.org/blog/next-16, nextjs.org/docs/app/guides/progressive-web-apps — MEDIUM confidence (web search, official domain)
- InfoQ, The Register, Visual Studio Magazine, typescript-eslint GitHub issue #12518 — MEDIUM confidence (cross-checked across multiple independent sources) — TypeScript 7.0 native-compiler status and `typescript-eslint` incompatibility
- Vercel changelog ("Neon now available on Vercel Marketplace"), neon.com/docs (Vercel-managed integration, Vercel Postgres transition guide) — MEDIUM confidence — Vercel Postgres → Neon migration history
- Bytebase, DEV Community, PkgPulse, MakerKit, TurboStarter comparison articles (Neon vs Supabase vs PlanetScale; Better Auth vs Clerk vs Supabase Auth vs NextAuth; Drizzle vs Prisma; Recharts vs Chart.js vs Nivo; Vercel vs Railway vs Fly.io) — MEDIUM confidence, cross-checked across 3+ independent 2026-dated sources per topic
- Red-Gate Simple Talk, kindatechnical.com — MEDIUM confidence — Postgres effective-dated/temporal table modeling pattern
- gomage.com, magicbell.com PWA/iOS guides — MEDIUM confidence — iOS Safari "Add to Home Screen" manifest + meta tag requirements

---
*Stack research for: Russian salary/take-home-pay tracking PWA (НаРуки)*
*Researched: 2026-08-28*
