---
phase: 08-visual-redesign-accessibility-pwa-safe-area
reviewed: 2026-09-03T00:00:00Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - src/app/(app)/bonuses/bonus-form.tsx
  - src/app/(app)/bonuses/bonus-row.tsx
  - src/app/(app)/bonuses/page.tsx
  - src/app/(app)/error.tsx
  - src/app/(app)/layout.tsx
  - src/app/(app)/onboarding/page.tsx
  - src/app/(app)/page.tsx
  - src/app/(app)/settings/salary/page.tsx
  - src/app/(app)/vacations/page.tsx
  - src/app/(app)/vacations/vacation-form.tsx
  - src/app/(app)/vacations/vacation-row.tsx
  - src/app/(auth)/login/page.tsx
  - src/app/(auth)/register/page.tsx
  - src/app/globals.css
  - src/app/layout.tsx
  - src/app/manifest.test.ts
  - src/app/manifest.ts
  - src/components/annual-pie-chart.tsx
  - src/components/install-banner.tsx
  - src/components/next-payment-card.tsx
  - src/components/pay-setup-forms.tsx
  - src/components/sign-out-button.tsx
  - src/components/skeleton-loader.render.test.tsx
  - src/components/skeleton-loader.tsx
  - src/components/ytd-estimate-banner.tsx
findings:
  critical: 0
  warning: 0
  info: 5
  total: 5
status: clean
---

# Phase 08: Code Review Report (iteration 2)

**Reviewed:** 2026-09-03T00:00:00Z
**Depth:** standard
**Files Reviewed:** 25
**Status:** clean

## Summary

This is iteration 2 of the review/fix loop. Re-read all 25 in-scope files from scratch (not a diff-only
pass) and independently re-derived every finding rather than trusting the iteration-1 report or the
08-REVIEW-FIX.md summary.

**Contrast math re-verification (CR-01/CR-02).** Recomputed WCAG 2.1 relative-luminance contrast by
hand for every token pairing the fix touched:

- `--color-accent-button` (`#047857`) vs. white button text: **5.48:1** — passes 4.5:1 for normal text
  in both color schemes (the token is declared once, unforked, and correctly so — the value is
  identical either way).
- Light-mode `--color-accent` (`#047857`) as text on light-mode `--color-dominant` (`#ffffff`):
  **5.48:1**; on `--color-secondary` (`#f9fafb`): **~5.23:1** — both clear 4.5:1 (and comfortably clear
  the 3:1 large-text threshold for `next-payment-card.tsx`'s hero take-home figure).
- Light-mode `--color-destructive` (`#b91c1c`) as text on `#ffffff`: **6.47:1** — clears 4.5:1 for the
  "Удалить …" links and inline field-error text.
- Dark-mode `--color-accent` (`#10b981`) as text on `--color-secondary` (`#242424`, used inside
  `pay-setup-forms.tsx`'s salary-replace confirmation panel): **~6.11:1** — also passes, confirming the
  fix didn't regress the pre-existing dark-mode-passing case.

All figures match (within rounding) the values asserted in `globals.css`'s own code comments and the
orchestrator's independent verification. **CR-01 and CR-02 are correctly and completely fixed.**

**Button-background audit.** Grepped the entire `src/` tree for any remaining
`bg-[color:var(--color-accent)]` (the pre-fix, contrast-failing token used as a button background).
Zero matches — every primary-action button across all 25 files (`bonus-form.tsx`, `bonus-row.tsx`,
`bonuses/page.tsx`'s empty-state CTA, `vacation-form.tsx`, `vacation-row.tsx`,
`vacations/page.tsx`'s empty-state CTA, `login/page.tsx`, `register/page.tsx`, `error.tsx`,
`page.tsx`'s three CTA links, `pay-setup-forms.tsx`'s four buttons) now uses
`bg-[color:var(--color-accent-button)]` exclusively. No missed call sites.

**WR-01 through WR-04 re-verification**, each confirmed by reading the current file content (not just
the diff):

- **WR-01** (`skeleton-loader.tsx`): the `mounted`/`useState`/`useEffect` gate is fully removed; the
  component renders its real markup unconditionally, including during SSR. Confirmed the component
  introduces no non-deterministic values (no `Date.now()`/`Math.random()`), so there is no
  hydration-mismatch risk from this change. `skeleton-loader.render.test.tsx`'s DOM-shape assertions
  (`:scope > div > .skeleton-pulse`, inner-rect counts) still pass structurally against the new markup
  (the added `<span className="sr-only">` is a non-`div` sibling before the mapped blocks, so it does
  not perturb either test's element-count queries).
- **WR-02**: `role="status" aria-live="polite"` plus a `<span className="sr-only">Загрузка…</span>` are
  present on the outer wrapper (`skeleton-loader.tsx:29-30`).
- **WR-03**: `role="alert"` is present on both `error.tsx`'s boundary wrapper (line 20) and
  `page.tsx`'s fetch-failure fallback wrapper (line 69). Confirmed the adjacent "not configured"
  branch in `page.tsx` (lines 90-106) deliberately does *not* carry `role="alert"`, correctly matching
  the original finding's intent (that branch is a normal state, not an error).
- **WR-04**: `bonus-form.tsx`, `vacation-form.tsx`, and all three forms in `pay-setup-forms.tsx` now
  uniformly use `gap-[var(--spacing-sm)]` for every label→input→caption field-group stack — confirmed
  via full-file re-read, not just grep. The mismatch called out in iteration 1 is gone.

**Diff hygiene check.** Diffed the fix commits (`3ceafad`..`3baf309`) against the prior review's
baseline commit and confirmed the changes are scoped exactly to what each finding required — no
unrelated logic, event-handler, or validation changes slipped in alongside the styling/token/markup
edits.

No new Critical or Warning findings surfaced during this fresh pass. Five Info-level items remain (see
below): three carried over from iteration 1 (unused typography tokens, chart SVG accessibility, and
duplicated Tailwind class-string extraction — none were in this fix pass's scope), one iteration-1 Info
item that is now resolved as a side effect of CR-02, and two newly-observed Info items from this
fresh review pass. Per this repo's established convention, 0 critical + 0 warning is sufficient for a
`clean` status even with Info-only findings outstanding.

## Info

### IN-01: Several typography design tokens remain defined in `globals.css` but unconsumed (carried over, still applies)

**File:** `src/app/globals.css:28-29,33,37,44-45`
**Issue:** `--font-weight-body`, `--line-height-body`, `--line-height-label`, `--line-height-heading`,
`--font-weight-caption`, and `--line-height-caption` are still defined but grep across every reviewed
`.tsx` file finds zero usages (`--line-height-display` remains the only line-height token actually
consumed, in `next-payment-card.tsx:36`). Additionally, of the seven `--spacing-*` tokens, only
`--spacing-sm` is now consumed anywhere (thanks to the WR-04 fix) — `--spacing-xs/-md/-lg/-xl/-2xl/-3xl`
remain unused. Not a functional bug; this fix pass wasn't scoped to cover it (`fix_scope:
critical_warning`).
**Fix:** Cross-check against `08-UI-SPEC.md`'s typography/spacing tables and either apply the missing
tokens where intended, or trim the ones that were never meant to be applied per-element.

### IN-02: `AnnualPieChart`'s Recharts SVG has no `aria-hidden`/accessible-name treatment (carried over, still applies)

**File:** `src/components/annual-pie-chart.tsx:56-63`
**Issue:** Unchanged since iteration 1. The `<PieChart>`/`<Pie>`/`<Cell>` SVG renders with no
`role="img"`, `aria-label`, or `aria-hidden="true"`, despite the adjacent `<dl>` (lines 70-83) already
providing a complete accessible textual equivalent (Грязными/Налог/На руки amounts and percentages).
Screen readers may still traverse the raw, unlabeled SVG sector elements Recharts emits before
reaching the useful `<dl>` content.
**Fix:** Wrap the `<div className="mt-4 flex justify-center">` chart container with
`aria-hidden="true"`.

### IN-03: Duplicated long Tailwind arbitrary-value class strings, inconsistently extracted (carried over, still applies)

**File:** `src/app/(app)/vacations/vacation-form.tsx:75,86`, `src/app/(app)/vacations/vacation-row.tsx:99,105`,
and every `<input>` in `src/components/pay-setup-forms.tsx` (e.g. lines 141, 160, 268, 289, 403, 422),
contrasted with `src/app/(app)/bonuses/bonus-form.tsx:50-53`
**Issue:** Unchanged since iteration 1. `bonus-form.tsx` extracts its repeated input/label class
strings into local `inputClassName`/`labelClassName` consts; `bonus-row.tsx` similarly extracts
`editInputClassName` (line 83). `vacation-form.tsx`, `vacation-row.tsx`, and all three forms in
`pay-setup-forms.tsx` instead inline the same long (~200-character) arbitrary-value string on every
single `<input>`/`<label>` — functionally identical, but inconsistent extraction pattern across
near-identical sibling files, more surface area to drift out of sync on a future token rename.
**Fix:** Apply the same `inputClassName`/`labelClassName` (or a shared exported helper) pattern
consistently across all form/row files.

### IN-04 (new): `login/page.tsx` and `register/page.tsx` still hardcode `gap-1` for field-group stacks, now the only files inconsistent with the WR-04 fix

**File:** `src/app/(auth)/login/page.tsx:66,84`, `src/app/(auth)/register/page.tsx:56,74`
**Issue:** WR-04's fix standardized every field-group stack in `bonus-form.tsx`, `vacation-form.tsx`,
and all three `pay-setup-forms.tsx` forms on `gap-[var(--spacing-sm)]` (8px). `login/page.tsx` and
`register/page.tsx` have the structurally identical label→input→error pattern
(`<div className="flex flex-col gap-1">` around each `Email`/`Пароль` field) but were out of WR-04's
original scope (which only compared `vacation-form.tsx` against `bonus-form.tsx`/
`pay-setup-forms.tsx`) and were left on the literal `gap-1` (4px) value. The result: after the fix,
the auth forms are now the only forms in the app still visually tighter than the rest.
**Fix:** Update both files' field-group `<div>` wrappers to `gap-[var(--spacing-sm)]` for full
consistency with the rest of the form set.

### IN-05 (new): `skeleton-loader.tsx` retains an unneeded `"use client"` directive after the WR-01 fix removed its only client-only logic

**File:** `src/components/skeleton-loader.tsx:1`
**Issue:** The WR-01 fix removed the component's `useState`/`useEffect` mounted-gate, leaving a purely
presentational component with no event handlers, hooks, or browser-only APIs. The `"use client"`
directive at the top of the file (line 1) is no longer necessary — the component could be a Server
Component, which would avoid shipping it (and its JSX-generation logic) to the client bundle when used
as a `<Suspense fallback>` inside server components (`bonuses/page.tsx`, `vacations/page.tsx`,
`page.tsx`). Not a correctness issue — a `"use client"` component works fine as a Suspense fallback —
but it's dead weight the fix pass didn't clean up.
**Fix:** Remove the `"use client"` directive from `skeleton-loader.tsx:1`; verify no client-only
behavior was relying on it (none currently is).

---

_Reviewed: 2026-09-03T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
