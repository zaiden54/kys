# Milestones

## v1.1 Полировка MVP (Shipped: 2026-09-03)

**Phases completed:** 4 phases, 17 plans, 31 tasks

**Known verification overrides:** 3 newly acknowledged, 0 carried forward from a prior close (see STATE.md Deferred Items) — 1 unresolved debug session (`knowledge-base`) and 2 deferred items (both already documented, no-action-needed traceability notes from Phases 5 and 8).

**Key accomplishments:**

- Cleared 4 real react-hooks ESLint errors and 71 false-positive sw.js lint warnings, added `npm run typecheck`, and visibly tracked 2 unrelated pre-existing test failures — so Plan 05-03's CI gate starts from a genuinely green baseline instead of a permanently-red one.
- GitHub Actions CI (lint/typecheck/build/pure-domain-tests, DB-free) genuinely blocking merges on main via live branch protection, after discovering the neon-http driver cannot speak to a vanilla Postgres container
- Discovered an already-live Vercel↔Neon per-branch isolation integration, abandoned a redundant hand-built persistent staging environment in favor of it per user decision, and documented the real release procedure
- Login collapses every auth failure into one hardcoded generic message, a new verify-auth-security.mjs script empirically proves SEC-01/SEC-02/SEC-03 against a live dev server, and PR #3 is open with CI green awaiting the end-of-phase live HTTPS cookie/network check.
- Playwright 1.62.1 stood up end-to-end against real Next.js Server Actions, Better Auth session cookies, and Postgres, proving E2E-01's golden path (register → onboarding → forecast → logout → redirect) with a reusable storageState producer for later plans.
- Three Playwright tests (create/edit/delete) proving bonuses flow through the real /bonuses UI into the home screen's next-payment forecast, run against a live Next.js server and Neon Postgres database
- Four Playwright tests drive the real /vacations UI end-to-end (create, overlap-rejection, edit, delete), proving the отпускные (average-earnings vacation pay) figure shown on screen reflects the real domain engine's output for every mutation — not a hardcoded expectation.
- Playwright E2E coverage proving the annual pie chart's gross=tax+net invariant against real seeded bonus/vacation data, plus the served manifest.webmanifest and InstallBanner's localStorage-backed dismissal persistence.
- Playwright's `e2e` GitHub Actions job now runs every PR against a throwaway, isolated Neon branch and is a required (blocking) check on `main`, proven green on a real PR run; a committed `.mcp.json` also makes Playwright MCP available for interactive test authoring.
- Restyled vacation-row.tsx (display+edit), vacation-form.tsx, and vacations/page.tsx onto Plan 08-01's CSS-variable token system with a Suspense-driven skeleton loader, while leaving the window.confirm() delete flow and the e2e-indexed 5-span row structure byte-for-byte unchanged.
- Restyled `login/page.tsx` and `register/page.tsx` onto Plan 08-01's CSS-variable token system — accessible focus-visible form fields, token-driven colors/typography, and the standalone-mode info banner — while leaving Phase 6's SEC-02 hardened generic-login-error logic and register's error-message passthrough byte-for-byte unchanged.
- Full automated regression (370 unit tests, production build, 13/13 E2E tests across all 5 spec files) is green on the combined phase branch with zero calculation-logic drift; structural code review confirms PWA-01/02 safe-area wiring, UI-06's CSS-only dark/light token system, and UI-07's keyboard focus-ring coverage are all correctly implemented across every screen — but structural review also found UI-SPEC backstop #1 (annual chart zero-income empty state) is NOT implemented, a real gap now filed to STATE.md rather than silently passed.
- Gated `AnnualPieChart`'s PieChart+breakdown block behind a `grossKopecks === 0` ternary, replacing a degenerate 0%/0% Recharts donut with a distinct empty-state card, proven by a render test asserting `<svg>` presence/absence in both branches.

---

## v1.0 MVP (Shipped: 2026-08-31)

**Phases completed:** 4 phases, 23 plans, 53 tasks

**Key accomplishments:**

- Next.js 16 App Router scaffold with TypeScript pinned to 6.0.3, a boot-validated env module, a Neon-backed Drizzle client, the three app-owned money/schedule/YTD tables, and a generated Better Auth (email+password, 30-day session) schema — no live database push yet.
- Better Auth mounted on Next.js 16's App Router (Node runtime) with a `requireUserId()` server-only ownership anchor, register/login pages, and a protected home route — closing the Walking Skeleton with a real browser-to-Postgres round trip proven by `scripts/verify-auth-flow.mjs`.
- Pure, zero-I/O progressive НДФЛ engine (cumulative marginal calc across all five 2025 brackets, ст.52 ruble rounding) and payment-date resolver (D-03 month-length clamping, D-02 weekend/RU-holiday backward shifting, D-04 gap signal), built RED-then-GREEN with 45 passing Vitest tests.
- Zod-validated Server Actions writing through an ownership-scoped Drizzle repository into salary_history/payment_schedule/ytd_baseline, surfaced by a first-run onboarding flow and an always-available settings page — the first slice where a signed-in user can record and correct what they actually earn.
- Server-rendered home screen showing the date and correctly-taxed take-home amount of the user's next payment, computed by `forecastNextPayment()` folding the progressive НДФЛ engine and the payment-date resolver over the user's own salary/schedule/YTD rows via a half-split avans/salary gross rule.
- Introduced a pure `src/domain/time.ts` module (fixed UTC+3, no DST) and routed every "what is today" computation in the app through it, closing 01-VERIFICATION.md's CR-01 gap across seven call sites (one more than verification's own artifact list named).
- Collapsed `replaceSalaryAt`, `upsertSchedule`, and `upsertYtdBaseline` from non-atomic multi-statement writes into single `INSERT ... ON CONFLICT DO UPDATE` statements, each proven race-safe by a live `Promise.all` test against the real Neon database, closing 01-VERIFICATION.md gap 1 (CR-02/SAL-02) and 01-REVIEW.md's WR-01.
- Closed all five residual 01-VERIFICATION.md anti-pattern rows this phase's other gap-closure plans didn't touch: the avans/salary gross split now reconciles by construction on any kopeck parity, a mis-ordered future НДФЛ bracket scale fails loudly instead of under-taxing, two money columns are bounded at the live database layer behind a Zod-bypassing proof, a false statute-verification claim was removed from the tax module's header comment, and the app now identifies itself as НаРуки in Russian instead of shipping create-next-app's scaffold defaults.
- Salary setup now rejects values that cannot persist as a positive kopeck, serializes repository rejection as a safe field error, and renders a generic retry message when the client-side Server Action promise itself rejects.
- Replaced the hardcoded-zero additional-income term in `getCumulativeIncomeBeforeDate` with a real, pure accrual engine that sums every prior scheduled avans/salary payment since the YTD baseline, closing the phase's deepest verification blocker.
- Salary overwrites now require a short-lived signed claim for the value the server disclosed, a database compare-and-swap, and the exact client snapshot shown in the prompt.
- Both dated payroll inputs now reject impossible calendar days without normalisation, and deployments cannot boot from the committed example authentication secret configuration.
- Independent one-off bonuses now flow from a validated form through Neon persistence and the shared cumulative NDFL engine into one unified next-payment forecast.
- Ownership-safe edits and future-only deletion now complete the responsive bonus history workflow, including exact blocked-delete feedback and authenticated navigation.
- Locked in the already-valid Phase 2 user-story goal, gated `baselineIsEstimated` on the exact boundary `getCumulativeIncomeBeforeDate` honors, guarded both bonus save paths against unhandled rejections, and closed the sub-kopeck precision gap in `bonusInputSchema` — retiring all three open `02-REVIEW.md` warnings and the sole `02-VERIFICATION.md` gap.
- Fixed BonusRow's edit form to always resync to the bonus's real current data — via React Hook Form's `values` option plus explicit `reset(toDefaults(bonus))` on Cancel and save-success — closing CR-01's two data-loss paths (stale-typed-value-on-cancel, stale-value-on-cross-device-resync), proven by this codebase's first render-based (jsdom + Testing Library) regression test.
- Live `vacations` table + `bonuses.type` reclassification column in Neon, and a pure, exhaustively-unit-tested отпускные engine (month-by-month salary_history recomputation with real-calendar-day-weighted proration, under-12-months handling, inclusive day counting, and the ст.136 ТК РФ minus-3-days payment-date shift reusing the existing weekend/holiday-shift logic).
- createBonus/updateBonus, bonusInputSchema, saveBonusAction, and both bonus forms all carry an explicit, validated, user-settable "premium"/"compensation" bonus type — reversing Phase 2's D-B07 "no bonus category" decision on purpose, per 03-CONTEXT.md.
- Ownership-scoped vacation CRUD with inclusive-boundary overlap detection and a payment-date-aware delete guard, plus `getCumulativeIncomeBeforeDate` extended to fold a past vacation's recomputed отпускные gross into the same cumulative-income figure a bonus already contributes to — proven with an exact kopeck delta against the live database.
- A vacation saved through `/vacations` now flows end-to-end into the home screen's unified next-payment forecast — taxed through the same cumulative `calculateNdfl` engine as salary/bonus, with the always-visible D-V12 disclaimer — and `/vacations` gained the full create/edit/delete history list matching 03-UI-SPEC.md.
- computeAnnualSummary walks every avans/salary/bonus/vacation event across a calendar year through the existing НДФЛ engine, rendered as a 2-slice Recharts donut on the home screen, reconciling exactly (to the kopeck) with an independently-derived per-event oracle.
- Fixed missing `router.refresh()` before `router.push()` in both login and register `onSubmit` handlers, and rebuilt the router mocks in their tests from unreachable inline spies into real assertable `vi.hoisted()` spies — closing UAT gap G-04-2.

---
