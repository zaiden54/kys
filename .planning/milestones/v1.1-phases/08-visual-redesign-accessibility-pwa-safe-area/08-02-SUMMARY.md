---
phase: 08-visual-redesign-accessibility-pwa-safe-area
plan: 02
subsystem: bonuses screen (list-row component, add/edit form, page composition)
tags: [ui, restyle, design-tokens, accessibility, suspense, skeleton-loading]
dependency graph:
  requires: ["08-01"]
  provides: ["bonuses screen token-driven restyle matching 08-UI-SPEC.md", "Suspense-driven bonus-list skeleton loading state"]
  affects: ["src/app/(app)/bonuses/bonus-row.tsx", "src/app/(app)/bonuses/bonus-form.tsx", "src/app/(app)/bonuses/page.tsx"]
tech-stack:
  added: []
  patterns: ["CSS-variable arbitrary-value Tailwind classes (--color-*, --font-size-*, --font-weight-*) established in 08-01, extended here", "tabular-nums + Caption-role monospace styling on money/date display", "focus-visible:outline-2 accessibility treatment on every interactive element", "async BonusListContent() sub-component + <Suspense> boundary + SkeletonLoader fallback (matches home page's Wave-1 tracer pattern)"]
key-files:
  created: []
  modified:
    - src/app/(app)/bonuses/bonus-row.tsx
    - src/app/(app)/bonuses/bonus-form.tsx
    - src/app/(app)/bonuses/page.tsx
decisions:
  - "Destructive delete action (\"Удалить бонус\") uses --color-destructive with its own destructive-colored focus ring, never --color-accent — matches 08-UI-SPEC.md's explicit accent-reservation rule"
  - "Empty-state heading changed from \"Нет бонусов\" to \"Пока нет бонусов\" per 08-UI-SPEC.md's locked \"Пока нет {N}\" copywriting pattern; no e2e test asserted the old string"
  - "bonus-row.tsx edit-mode select's existing aria-label=\"Тип выплаты\" retained as-is (not converted to a visible <label>) — 08-UI-SPEC.md's Form Fields section explicitly confirms this already satisfies UI-07"
  - "window.confirm() call, its message template, all four form input ids (amountRubles/date/note/type), and edit-mode input type/aria-label attributes left byte-for-byte unchanged — e2e/bonus.spec.ts depends on these exact selectors"
metrics:
  duration: "~40 min"
  completed: 2026-09-02
status: complete
actuals:
  tokens: 4216
  tasks: 2
  commits: 2
---

# Phase 8 Plan 02: Bonuses Screen Restyle Summary

Restyled the bonuses screen (`bonus-row.tsx` display + edit modes, `bonus-form.tsx`, and `bonuses/page.tsx`) onto Plan 08-01's CSS-variable design-token system: tabular-nums money/date formatting, focus-visible accessibility on every interactive element, destructive-color delete actions, a Suspense-driven loading skeleton for the bonus list, and the locked "Пока нет бонусов" empty-state copy — all while leaving `window.confirm()`, form input ids, and edit-mode input types byte-for-byte unchanged so `e2e/bonus.spec.ts`'s selectors keep working.

## What Was Built

**Task 1 — `bonus-row.tsx` (both modes) + `bonus-form.tsx` restyle** (commit `b6a0c31`): Replaced every `zinc-*`/`red-6*`/`red-7*` Tailwind class with CSS-variable arbitrary-value classes across display mode, edit mode, and the standalone add-bonus form. Display-mode date span gets `tabular-nums` + the Caption-role monospace treatment (`--font-family-caption`/`--font-size-caption`); the amount span gets `font-semibold tabular-nums`. "Изменить бонус" and "Удалить бонус" both gained `focus-visible:outline-2` outlines, with the delete link specifically using `--color-destructive` for both text and focus-ring color (never `--color-accent`). Edit-mode inputs/select share one `editInputClassName` constant matching the Form Fields pattern (8px radius, tertiary-surface border, accent focus ring); the submit button became accent-filled, "Отмена" became a bordered neutral button. `bonus-form.tsx`'s four inputs (`amountRubles`/`date`/`note`/`type`) got the identical Form Fields treatment via shared `inputClassName`/`labelClassName` constants; the success message ("Бонус сохранён.") moved from `text-green-700` to `text-[color:var(--color-accent)]` per the UI-SPEC's success-indicator color rule.

**Task 2 — `bonuses/page.tsx` restyle** (commit `14bc545`): Extracted the data-fetching + list-rendering logic into an internal `async function BonusListContent()`, wrapped in `<Suspense fallback={<SkeletonLoader count={3} variant="bonus-row" />}>` — the outer `<h1>`/`<div id="bonus-form"><BonusForm /></div>` structure is unchanged around it. Updated the empty-state heading `"Нет бонусов"` → `"Пока нет бонусов"` and restyled its container to the secondary-surface card pattern (`rounded-[12px]`/`border-tertiary-surface`/`bg-secondary`) with an accent-filled CTA link. Restyled the row-grid header and both page headings onto the display/heading typography-role tokens.

## Verification

- `npx tsc --noEmit` — clean (exit 0) after both tasks. One pre-existing `LayoutProps` type error was observed before Task 2 (unrelated file, `src/app/layout.tsx`, not touched by this plan) and self-resolved once `npm run build` regenerated `.next/types/**` during the e2e attempt below — see `deferred-items.md` for the trace.
- `npx eslint` on all three modified files — clean, no warnings
- `npx vitest run "src/app/(app)/bonuses"` — 6/6 passed (3 test files: `bonus-form.test.ts`, `bonus-row.test.ts`, `bonus-row.render.test.tsx`), unmodified test files
- `npx vitest run` (full suite) — 298/298 non-DB tests passed; 6 test files requiring a live `DATABASE_URL`/`BETTER_AUTH_SECRET` failed identically to the same pre-existing environment limitation documented in `08-04-SUMMARY.md` (this execution sandbox has no `.env.local`/Neon credentials)
- `npm run build` — TypeScript compilation phase passes cleanly (`Finished TypeScript in 5.4s`, zero errors); build then fails at Next.js's page-data-collection step (`Invalid environment variables: DATABASE_URL, BETTER_AUTH_SECRET`) — pre-existing/environmental, confirmed identical failure mode to `08-04-SUMMARY.md`'s precedent
- `npm run test:e2e -- e2e/bonus.spec.ts` — attempted; Playwright's `webServer` (`next build && next start`) fails to start for the same `DATABASE_URL`/`BETTER_AUTH_SECRET` reason (`Error: Failed to collect page data for /api/auth/[...all]`) — see Known Gaps below
- `grep -c "zinc-\|red-6\|red-7\|green-7" src/app/(app)/bonuses/bonus-row.tsx src/app/(app)/bonuses/bonus-form.tsx` → 0 across both
- `grep -c "zinc-" src/app/(app)/bonuses/page.tsx` → 0
- `grep -n 'id="amountRubles"'` / `'id="date"'` / `'id="note"'` / `'id="type"'` in `bonus-form.tsx` → all match, unchanged
- `grep -n 'aria-label="Тип выплаты"' src/app/(app)/bonuses/bonus-row.tsx` → matches, unchanged
- `grep -n "window.confirm" src/app/(app)/bonuses/bonus-row.tsx` → matches, message template byte-identical
- `grep -n "Пока нет бонусов" src/app/(app)/bonuses/page.tsx` → matches; `grep -n "Нет бонусов"` (old string) → no match
- `grep -n "Suspense"` / `"SkeletonLoader"` in `bonuses/page.tsx` → both match
- `git status --porcelain -- src/domain/ src/lib/db/ src/app/actions/bonus.ts` → empty after both tasks

## Deviations from Plan

### Auto-fixed Issues

None — plan's `<action>` instructions were followed as written; no bugs, missing functionality, or blocking issues required a Rule 1/2/3 fix.

### Missing supplementary reference (not a code deviation)

`08-PATTERNS.md`, referenced throughout this plan's `<read_first>` sections (e.g. "§ Bonus/Vacation Row Components", "§ Form Fields", "§ Focus-Visible Outline Pattern", "§ Tabular Numerals for Money & Dates"), does not exist anywhere in this project's history — confirmed absent both in this worktree and at the phase branch tip (`gsd/phase-08-visual-redesign-accessibility-pwa-safe-area`, commit `a27b5fd`), and Plan 08-01's own SUMMARY does not mention creating it. This plan's `<action>` blocks are fully self-contained (exact Tailwind arbitrary-value class strings spelled out inline), so execution proceeded directly from 08-UI-SPEC.md + the plan's own action text without needing the missing file. Flagging for whoever plans/executes the remaining 08-03..08-06 plans, since they carry the same `08-PATTERNS.md` references.

## Known Gaps (Self-Check)

- **`npm run test:e2e -- e2e/bonus.spec.ts` was not run to completion.** This sandbox has no `NEON_API_KEY`/`NEON_PROJECT_ID`/`DATABASE_URL`/`BETTER_AUTH_SECRET`, so Playwright's `webServer` (`next build && next start`) cannot boot — `next build`'s page-data-collection step fails on `/api/auth/[...all]` needing a validated `DATABASE_URL`. This is the identical environmental limitation documented in `08-04-SUMMARY.md`'s Known Gaps and traces to the same root cause (no live Neon branch available in this execution sandbox, per PROJECT.md's "нет доступа к интернету в песочнице выполнения" note). TypeScript, ESLint, and the full non-DB unit-test suite all pass clean against this diff; the grep-based acceptance criteria (which pin the exact ids/aria-labels/confirm-message/classNames the e2e test exercises) all pass. This gap should be closed by CI's own `e2e` job on the eventual PR, which does have `NEON_API_KEY`/`NEON_PROJECT_ID` configured.
- **`npm run build`'s full exit-0 was not achieved**, for the same reason. The TypeScript-compile phase of the same build command passed cleanly (zero errors) when run in this session.

## Threat Flags

None — no new network endpoints, auth paths, file-access patterns, or schema changes were introduced; this plan is a presentation-only restyle of existing components.

## Self-Check: PASSED

- FOUND: src/app/(app)/bonuses/bonus-row.tsx (modified, commit b6a0c31)
- FOUND: src/app/(app)/bonuses/bonus-form.tsx (modified, commit b6a0c31)
- FOUND: src/app/(app)/bonuses/page.tsx (modified, commit 14bc545)
- FOUND commit b6a0c31 in `git log --oneline`
- FOUND commit 14bc545 in `git log --oneline`
