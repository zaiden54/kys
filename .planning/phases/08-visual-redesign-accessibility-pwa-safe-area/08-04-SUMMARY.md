---
phase: 08-visual-redesign-accessibility-pwa-safe-area
plan: 04
subsystem: pay-setup-forms (salary/schedule/YTD forms + settings/onboarding pages)
tags: [ui, restyle, design-tokens, accessibility, confirmation-panel]
dependency graph:
  requires: ["08-01"]
  provides: ["pay-setup-forms.tsx token-driven restyle", "salary-overwrite confirmation panel matching 08-UI-SPEC.md"]
  affects: ["src/components/pay-setup-forms.tsx", "src/app/(app)/settings/salary/page.tsx", "src/app/(app)/onboarding/page.tsx"]
tech-stack:
  added: []
  patterns: ["CSS-variable arbitrary-value Tailwind classes (--color-*, --font-size-*, --font-weight-*) established in 08-01, extended here", "tabular-nums utility on every money/date value", "conditional-accent color branch driven by a runtime comparison (submittedAmountRubles > existingAmountRubles)"]
key-files:
  created: []
  modified:
    - src/components/pay-setup-forms.tsx
    - src/app/(app)/settings/salary/page.tsx
    - src/app/(app)/onboarding/page.tsx
decisions:
  - "Kept the salary-overwrite confirmation panel as the existing inline pendingConfirmation block (not a modal) per 08-CONTEXT.md's locked decision — restyled colors/spacing/radius only"
  - "No cancel button added to the confirmation panel — matches the existing component's structure; editing the form again remains the implicit cancel"
  - "settings/salary/page.tsx's Promise.all data-fetch left unchanged (no Suspense/skeleton) — this page is not one of 08-UI-SPEC.md's five explicitly-named UI-01 loading-state screens"
metrics:
  duration: "~35 min"
  completed: 2026-09-02
status: complete
actuals:
  tokens: 4880
  tasks: 2
  commits: 2
---

# Phase 8 Plan 04: Salary/Schedule/YTD Forms & Confirmation Panel Restyle Summary

Restyled the shared `pay-setup-forms.tsx` (`SalaryForm`, `ScheduleForm`, `YtdForm`) and both consuming pages (`settings/salary/page.tsx`, `onboarding/page.tsx`) onto Plan 08-01's CSS-variable design-token system, with the salary-overwrite confirmation panel now showing the old value struck-through and the new value emerald-accented specifically when it's an increase.

## What Was Built

**Task 1 — `pay-setup-forms.tsx` restyle** (commit `d35c1fc`): Replaced every `zinc-*`/`bg-black`/`amber-*`/`red-6*`/`green-7*` Tailwind class across `SalaryForm`, `ScheduleForm`, and `YtdForm` with CSS-variable arbitrary-value classes (`text-[color:var(--color-text-primary)]`, `bg-[color:var(--color-accent)]`, etc.), matching the pattern already established in `install-banner.tsx`/`sign-out-button.tsx`/`ytd-estimate-banner.tsx` from Plan 08-01. The `pendingConfirmation` panel's container moved from `border-amber-400 bg-amber-50` to `rounded-[8px] border-[color:var(--color-tertiary-surface)] bg-[color:var(--color-secondary)]`; the old salary amount now renders in a `<span className="tabular-nums line-through text-[color:var(--color-text-secondary)]">`, and the new amount in a `<span>` whose className branches on `submittedAmountRubles > existingAmountRubles` — emerald accent for an increase, neutral text-primary otherwise. The confirm button became accent-filled with a focus-visible outline; no cancel button was added. Every form input/label/error/helper/heading across all three forms was restyled identically. Success text moved to accent color; `ScheduleForm`'s non-blocking warning and `YtdForm`'s `isEstimated` notice both moved to text-secondary (never accent/destructive, since they aren't errors).

**Task 2 — consuming pages restyle** (commit `dd03031`): `settings/salary/page.tsx`'s `<h1>`/`<h2>` moved to display/heading role tokens; the salary-history list's row dividers moved to tertiary-surface borders, and both the date and `formatKopecks()` amount in each row now carry `tabular-nums`. `onboarding/page.tsx`'s heading/intro paragraph restyled the same way; the post-setup "Перейти на главный экран" link now uses accent color, underline, and a focus-visible outline. The `"Настройка выплат"` heading text and the `hasSalaryAndSchedule` conditional-render logic are unchanged.

## Verification

- `npx vitest run "src/components/pay-setup-forms.test.ts"` — 2/2 passed, unmodified test file
- `npx vitest run` (full suite) — 298/298 non-DB tests passed; 6 test files that require a live `DATABASE_URL`/`BETTER_AUTH_SECRET` failed identically before and after this plan's changes (pre-existing environment limitation of this execution sandbox, unrelated to the files this plan touches — see Self-Check/Known Gaps below)
- `npm run typecheck` (`next typegen && tsc --noEmit`) — clean, no errors
- `npx eslint` on all three modified files — clean, no warnings
- `npm run build` — TypeScript compilation step passes cleanly (`Finished TypeScript in Ns` with zero errors) both times it was run; the build then fails at Next.js's page-data-collection step with `Invalid environment variables: DATABASE_URL, BETTER_AUTH_SECRET` — this sandbox has no `.env.local` with live Neon credentials, so this failure is pre-existing/environmental, not caused by this plan (confirmed identical failure mode with and without this plan's diff applied)
- `grep -c "zinc-\|amber-\|bg-black\|red-6\|green-7" src/components/pay-setup-forms.tsx` → 0
- `grep -n "line-through" src/components/pay-setup-forms.tsx` → matches
- `grep -n "submittedAmountRubles > .*existingAmountRubles" src/components/pay-setup-forms.tsx` → matches
- `grep -c "zinc-"` on both Task 2 files → 0 across both
- `grep -n "Настройка выплат" onboarding/page.tsx` → unchanged
- `git status --porcelain -- src/domain/ src/lib/db/ src/app/actions/salary.ts` → empty after both tasks

## Deviations from Plan

### Setup deviation (not a code deviation)

**Worktree base mismatch:** This worktree's branch (`worktree-agent-ab245e7a9b23d2002`) was created from a stale base commit (the v1.0 milestone-close point) that predated Phase 8 entirely — none of `.planning/phases/08-*`'s plan/context/UI-SPEC files nor Plan 08-01's wave-1 deliverables (`globals.css` design tokens, shared app shell) existed in the worktree at spawn time. Fast-forward merged `gsd/phase-08-visual-redesign-accessibility-pwa-safe-area` (the correct phase branch, of which this worktree's stale HEAD was an ancestor) into the worktree branch before starting Task 1. This was a clean fast-forward with zero conflicts and no working-tree changes lost.

### Auto-fixed Issues

None — plan's `<action>` instructions were followed as written; no bugs, missing functionality, or blocking issues required a Rule 1/2/3 fix beyond the setup deviation above.

## Known Gaps (Self-Check)

- **`npm run test:e2e -- e2e/auth.spec.ts` was not run.** This sandbox has no `NEON_API_KEY`/`NEON_PROJECT_ID`/`DATABASE_URL`/`BETTER_AUTH_SECRET` available, and `e2e/global-setup.ts` requires either a pre-existing `.env.local` (local runs) or CI's `e2e/ci-branch-setup.mjs` (which itself no-ops outside `CI`) to provision a live Neon branch before Playwright's `webServer` (`next build && next start`) can even boot. Recorded here per the project's established precedent (PROJECT.md's "нет доступа к интернету в песочнице выполнения" note) rather than silently skipped. TypeScript, ESLint, and the full non-DB unit-test suite all pass clean against the same diff, and the grep-based acceptance criteria (which pin the exact struck-through/conditional-accent structure the e2e test would exercise visually) all pass. This gap should be closed by CI's own `e2e` job on the eventual PR, which does have `NEON_API_KEY`/`NEON_PROJECT_ID` configured.
- **`npm run build`'s full exit-0 was not achieved** for the same reason (page-data collection requires a live `DATABASE_URL` at build time via `src/env.ts`). The TypeScript-compile phase of the same build command passed cleanly both times it was run in this session.

## Self-Check: PASSED

- FOUND: src/components/pay-setup-forms.tsx (modified, commit d35c1fc)
- FOUND: src/app/(app)/settings/salary/page.tsx (modified, commit dd03031)
- FOUND: src/app/(app)/onboarding/page.tsx (modified, commit dd03031)
- FOUND commit d35c1fc in `git log --oneline`
- FOUND commit dd03031 in `git log --oneline`
