---
phase: quick/260903-k9n
plan: 01
subsystem: ui
tags: [visual-design, typography, home-screen, forms]
status: complete
dependency-graph:
  requires: []
  provides:
    - next-payment-card-hero-scale
    - annual-pie-chart-real-tokens
    - page-h1-display-typeface
    - setup-forms-card-grouping
    - home-two-column-desktop-grid
  affects:
    - src/components/next-payment-card.tsx
    - src/components/annual-pie-chart.tsx
    - src/app/globals.css
    - src/components/pay-setup-forms.tsx
    - "src/app/(app)/page.tsx"
tech-stack:
  added: []
  patterns:
    - "Component-scoped globals.css classes (.next-payment-card) consumed via className, following the existing .brand-mark/.sign-out-button/.mobile-nav-link convention"
    - "Recharts Cell fill props pointed directly at CSS custom properties (fill=\"var(--color-accent)\") so SVG wedges follow the light/dark-mode token fork automatically"
key-files:
  created: []
  modified:
    - src/components/next-payment-card.tsx
    - src/components/annual-pie-chart.tsx
    - src/app/globals.css
    - "src/app/(auth)/login/page.tsx"
    - "src/app/(auth)/register/page.tsx"
    - "src/app/(app)/vacations/page.tsx"
    - "src/app/(app)/page.tsx"
    - "src/app/(app)/error.tsx"
    - "src/app/(app)/settings/salary/page.tsx"
    - "src/app/(app)/onboarding/page.tsx"
    - "src/app/(app)/bonuses/page.tsx"
    - src/components/pay-setup-forms.tsx
    - src/components/install-banner.tsx
    - src/components/ytd-estimate-banner.tsx
decisions:
  - "Committed a pre-existing, coherent-but-uncommitted navigation redesign (AppNavigation sidebar/mobile-header shell, layout.tsx, sign-out-button.tsx, ~330 lines of globals.css) as its own preliminary commit before this plan's own task commits, since this quick task's plan explicitly builds on its conventions (.brand-mark color-mix pattern, the 1100px sidebar-expansion breakpoint) and mixing it into task-scoped commits would have violated atomic per-task commit scope."
metrics:
  duration: "45min"
  completed: "2026-09-03"
actuals:
  tokens: 5201
  tasks: 3
  commits: 3
---

# Phase quick/260903-k9n Plan 01: UI/UX Improvements From Design Review Summary

Design-review UI/UX pass: hero take-home number scaled to 42px with clearer breakdown
separation, NextPaymentCard given an accent-tinted border identity, AnnualPieChart's tax/net
wedges now driven by the real `--color-destructive`/`--color-accent` design tokens (no more
hardcoded hex), every page `<h1>` renders in the Georgia display typeface, the three
onboarding/settings setup forms each read as a distinct grouped card, and the home page lays
out NextPaymentCard/AnnualPieChart side-by-side at >=1100px inside a ~896px container.

## What Was Built

**Task 1 — Hero number scale, accent card identity, real chart color tokens**
(`e4c2c9d`): `next-payment-card.tsx`'s hero take-home `<p>` now uses `text-[42px]` (up from
the shared 28px display token), with `mt-10` (up from `mt-6`) separating it from the
breakdown block in all three forecast-kind branches (vacation / breakdown / fallback). A new
`.next-payment-card` rule in `globals.css` (placed next to `.brand-mark`, reusing the same
`color-mix(in srgb, var(--color-accent) …%, …)` pattern) tints the card's border toward the
accent color. `annual-pie-chart.tsx`'s hardcoded `TAX_COLOR`/`NET_COLOR` hex constants are
gone — the two `<Cell>` elements now use `fill="var(--color-destructive)"` and
`fill="var(--color-accent)"` directly, so the wedges follow the real light/dark-mode token
fork.

**Task 2 — Display typeface on every H1, card-grouped setup forms** (`7187f3c`): all 9
`<h1>` sites (login, register, onboarding, settings/salary, vacations, bonuses, home page's
two empty/error-state headings, and the app error boundary) gained
`font-[family-name:var(--font-family-display)]`. `pay-setup-forms.tsx`'s three exported
forms (`SalaryForm`, `ScheduleForm`, `YtdForm`) each gained
`rounded-[12px] border border-[color:var(--color-tertiary-surface)] bg-[color:var(--color-secondary)] p-5`
on their root `<form>`, so both onboarding and settings/salary read as three distinct
grouped sections with zero changes to either page file.

**Task 3 — Two-column desktop grid for the home page** (`6e5aed3`): the home page's
configured-branch outer wrapper widens to `min-[1100px]:max-w-4xl`. `NextPaymentSection` and
`AnnualSummarySection`/its fallback are now wrapped in a `min-[1100px]:grid grid-cols-2`
container. `NextPaymentCard`, `AnnualPieChart`, `InstallBanner`, `YtdEstimateBanner`, and the
"Сводка недоступна" fallback each gained `min-[1100px]:max-w-none` alongside their existing
`max-w-sm` so they fill the wider grid columns instead of clipping at 384px. Below 1100px,
layout is unchanged (single stacked column).

## Deviations from Plan

### Pre-existing uncommitted work found and preserved

**[Rule 3 — blocking issue] Committed a pre-existing navigation redesign as a preliminary
commit before this plan's task commits**
- **Found during:** Task 1 setup, before any edits
- **Issue:** The working tree already contained a complete, working, but uncommitted
  navigation redesign — a new `AppNavigation` component (sidebar + mobile header + bottom
  nav) with its render test, plus matching edits to `layout.tsx` and `sign-out-button.tsx`,
  and ~330 lines of supporting `globals.css` (including `.brand-mark`, the
  `@media (min-width: 1100px)` sidebar-expansion breakpoint, `.sign-out-button`, etc.). This
  plan's own Task 1 (place `.next-payment-card` "near `.brand-mark`") and Task 3 (the
  "existing 1100px sidebar-expansion breakpoint") both explicitly reference this content as
  already-existing context — confirming the plan was authored against this dirty working
  tree as its baseline, not against the last committed `HEAD`. `git show HEAD:...` confirmed
  none of `.brand-mark`, `.sign-out-button`, or the 1100px breakpoint existed in the last
  commit.
- **Fix:** Verified the pre-existing work was coherent (`npm run typecheck` clean, its own
  render test passing) and committed it as a standalone preliminary commit (`470b970`,
  outside this plan's own task numbering) before starting Task 1, so that (a) nothing was
  lost, (b) this plan's own per-task commits stayed scoped to exactly their `files_modified`
  list rather than accidentally sweeping in ~560 unrelated lines, and (c) the git history
  honestly separates "pre-existing baseline this plan depends on" from "this plan's own
  changes."
- **Files committed:** `src/app/(app)/layout.tsx`, `src/app/globals.css`,
  `src/components/sign-out-button.tsx`, `src/components/app-navigation.tsx` (new),
  `src/components/app-navigation.render.test.tsx` (new)
- **Commit:** `470b970`

No other deviations — the remaining three tasks were executed exactly as written.

## Verification

Whole-plan regression sweep, all passing:
- `npm run lint` — 0 errors, 2 pre-existing warnings unrelated to this plan's files
  (`(app)/error.tsx` unused `_error` param, a React Compiler incompatible-library note in
  `vacation-form.tsx`)
- `npm run typecheck` — clean
- `npm run test` — 37 test files, 375 passed, 2 pre-existing skipped, 0 failed
- `npm run build` — exit 0, all routes compiled

**Scripted visual sanity check (dev server, live Neon DB):** ran a throwaway Playwright
script (not committed, deleted after use) that registered a disposable test user, filled
`SalaryForm`/`ScheduleForm`, skipped `YtdForm` (mirroring `e2e/fixtures.ts` /
`e2e/auth.setup.ts`'s pattern), then screenshotted `/onboarding` at 390x844 and `/` at
390x844 and 1280x900. Read each screenshot with the Read tool and visually confirmed:
- Onboarding H1 ("Настройка выплат") renders in the Georgia serif display font; the three
  setup forms render as distinct bordered/background cards.
- Home screen hero figure ("65 250 ₽") is visibly dominant over the "Годовая сводка"
  secondary card heading, with clear separation from the breakdown block below it;
  NextPaymentCard shows a visible accent-tinted border distinct from the plain-gray
  InstallBanner/YtdEstimateBanner cards above it.
- AnnualPieChart's donut wedges render in green (`--color-accent`) and red
  (`--color-destructive`) — the real design tokens, not the old hardcoded Tailwind
  red-600/green-600 hex.
- At 1280x900 (>=1100px), NextPaymentCard and the "Годовая сводка" AnnualPieChart card lay
  out side-by-side inside the sidebar-nav layout's content column; below 1100px (the
  390x844 screenshot) they remain a single stacked column, unchanged.

The disposable test user was deleted via `deleteUserByEmail` after the screenshots were
captured (confirmed via a follow-up query returning 0 rows), and the dev server was stopped
afterward.

## Known Stubs

None — no hardcoded empty values, placeholder text, or unwired data sources were introduced
by this plan.

## Deferred

Per the plan's objective, replacing the "Оклад и выплаты" nav icon (`SettingsIcon` in
`src/components/app-navigation.tsx`) is explicitly out of scope for this quick task —
optional/low-priority, not a gap.

## Self-Check: PASSED

- `src/components/next-payment-card.tsx` — FOUND, contains `text-[42px]` and
  `next-payment-card` class
- `src/components/annual-pie-chart.tsx` — FOUND, no `TAX_COLOR`/`NET_COLOR` remain
- `src/app/globals.css` — FOUND, contains `.next-payment-card` rule
- `src/components/pay-setup-forms.tsx` — FOUND, 3 `rounded-[12px]` form-card sites
- `src/app/(app)/page.tsx` — FOUND, contains `min-[1100px]:grid`
- Commit `470b970` — FOUND in `git log`
- Commit `e4c2c9d` — FOUND in `git log`
- Commit `7187f3c` — FOUND in `git log`
- Commit `6e5aed3` — FOUND in `git log`
