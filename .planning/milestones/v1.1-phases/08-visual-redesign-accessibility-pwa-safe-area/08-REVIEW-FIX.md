---
phase: 08-visual-redesign-accessibility-pwa-safe-area
fixed_at: 2026-09-02T21:43:15Z
review_path: .planning/phases/08-visual-redesign-accessibility-pwa-safe-area/08-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 08: Code Review Fix Report

**Fixed at:** 2026-09-02T21:43:15Z
**Source review:** .planning/phases/08-visual-redesign-accessibility-pwa-safe-area/08-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (2 critical, 4 warning — `fix_scope: critical_warning`, Info findings not attempted)
- Fixed: 6
- Skipped: 0

**Verification environment note:** all edits were made and committed inside an isolated git
worktree (`.claude/worktrees/rf-08-*`) created for this run, which has no `node_modules` installed.
No `tsc`/`vitest`/automated WCAG-contrast tool was available there, so verification for every
finding used Tier 1 (re-read modified file, confirm fix intact) plus Tier 3 fallback (accept Tier 1
when no syntax checker is available). CR-01/CR-02's replacement contrast values were computed by
hand using the standard WCAG 2.1 relative-luminance formula (not eyeballed), but were not
cross-checked against an automated contrast tool in this run — re-verify with a tool such as
`wcag-contrast` (or the reviewer's own script) before shipping, matching how the original review's
values were confirmed.

## Fixed Issues

### CR-01: `--color-accent` fails WCAG AA contrast as white-button-text background across nearly every primary CTA

**Files modified:** `src/app/globals.css`, `src/app/(app)/page.tsx`, `src/app/(app)/bonuses/bonus-row.tsx`, `src/app/(app)/vacations/page.tsx`, `src/app/(auth)/register/page.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(app)/vacations/vacation-row.tsx`, `src/components/pay-setup-forms.tsx`, `src/app/(app)/error.tsx`, `src/app/(app)/vacations/vacation-form.tsx`, `src/app/(app)/bonuses/page.tsx`, `src/app/(app)/bonuses/bonus-form.tsx`
**Commit:** `3ceafad`
**Applied fix:** Introduced a new, button-dedicated token `--color-accent-button: #047857` (emerald-700) in `globals.css` — computed white-on-`#047857` contrast is ~5.49:1, clearing the 4.5:1 AA threshold for normal text (vs. ~2.54:1 for the original `#10b981`). Declared once in `:root` (not forked per color scheme) since the value is identical in both, matching every button's white-text usage regardless of theme. Replaced all 17 `bg-[color:var(--color-accent)]` button-background usages across the 11 consuming files with `bg-[color:var(--color-accent-button)]`; left every `text-[color:var(--color-accent)]`/`outline-[color:var(--color-accent)]` usage untouched (out of scope for this finding, addressed by CR-02).

### CR-02: `--color-accent`/`--color-destructive` also fail WCAG AA as text color against light-mode backgrounds

**Files modified:** `src/app/globals.css`, `.planning/phases/08-visual-redesign-accessibility-pwa-safe-area/08-UI-SPEC.md`
**Commits:** `cde2f97` (token fork), `0033f5d` (08-UI-SPEC.md palette table update)
**Applied fix:** Forked `--color-accent` and `--color-destructive` inside the `@media (prefers-color-scheme: light)` block to genuinely different, darker light-mode-tuned values instead of the dead duplicate they previously held: `--color-accent: #047857` (emerald-700, ~5.49:1 on white — clears both the 4.5:1 normal-text and 3:1 large-text thresholds) and `--color-destructive: #b91c1c` (red-700, ~6.47:1 on white — clears 4.5:1). Dark-mode values (`#10b981` on `#1a1a1a` = 6.86:1, `#ef4444` on `#1a1a1a` = 4.62:1) were left unchanged since the reviewer confirmed they already pass AA. This incidentally resolves IN-01's dead-duplication note (not separately counted as fixed since Info findings are out of scope for this run). Also updated `08-UI-SPEC.md`'s Color/Palette table and added a "Contrast correction" note documenting the CR-01/CR-02 token split and the computed ratios, so the design contract stays truthful.

### WR-01: `SkeletonLoader`'s `mounted`-gate returns `null` during real SSR/Suspense streaming

**Files modified:** `src/components/skeleton-loader.tsx`
**Commit:** `2c07693`
**Applied fix:** Removed the `useState`/`useEffect` `mounted` gate and the `if (!mounted) return null` early return; the component now renders its skeleton markup unconditionally (including during SSR). Updated the file's docstring to explain why no hydration-mismatch risk exists (no `Date.now()`/`Math.random()`) and to reference the two pages (`bonuses/page.tsx`, `vacations/page.tsx`) whose `<Suspense>` fallback depends on this rendering server-side. `"use client"` directive was left in place (component still needs no client-only APIs after this change, but changing that was out of scope for this finding). The existing `skeleton-loader.render.test.tsx` assertions (DOM shape via `render()`, which flushes effects synchronously) are unaffected by removing the gate.

### WR-02: `SkeletonLoader` has no accessible loading indicator

**Files modified:** `src/components/skeleton-loader.tsx`
**Commit:** `af6fdb2`
**Applied fix:** Added `role="status" aria-live="polite"` to the outer wrapper `<div>` and a `<span className="sr-only">Загрузка…</span>` as its first child, matching the `role="status"` pattern already used by `ytd-estimate-banner.tsx`. Verified the added `<span>` does not affect the existing render tests' `:scope > div > .skeleton-pulse` / `:scope > div > div` selectors, which only match `div` elements.

### WR-03: Error states render with no `role="alert"`/`aria-live`

**Files modified:** `src/app/(app)/error.tsx`, `src/app/(app)/page.tsx`
**Commit:** `67fd477`
**Applied fix:** Added `role="alert"` to the outer `<div>` of the route-level `AppError` boundary (`error.tsx`) and to the home page's fetch-failure fallback branch (`page.tsx`'s `fetchFailed || !result || !annualResult` branch only — the sibling `!result.configured` onboarding-prompt branch a few lines below is a different, non-error UI state and was left untouched, matching the finding's own file:line scope of `page.tsx:67-84`).

### WR-04: Incomplete/inconsistent adoption of the `--spacing-*` token scale

**Files modified:** `src/app/(app)/bonuses/bonus-form.tsx`, `src/components/pay-setup-forms.tsx`
**Commit:** `3baf309`
**Applied fix:** Standardized on `gap-[var(--spacing-sm)]` (8px) rather than reverting `vacation-form.tsx` to the literal `gap-1` (4px), because 08-UI-SPEC.md's own Spacing Scale table documents `sm` (8px) as "Compact element spacing" — the correct semantic role for label→input→caption field-group stacks — while `xs` (4px, matching `gap-1`) is documented for "Icon gaps, inline padding," a different role. Replaced all 4 `gap-1` field-group stacks in `bonus-form.tsx` and all 6 in `pay-setup-forms.tsx` (3 forms × 2 fields each) with `gap-[var(--spacing-sm)]`, matching `vacation-form.tsx`'s existing usage. All 10 field-group stacks across the reviewed form files are now consistent.

## Skipped Issues

None — all 6 in-scope findings were fixed.

---

_Fixed: 2026-09-02T21:43:15Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
