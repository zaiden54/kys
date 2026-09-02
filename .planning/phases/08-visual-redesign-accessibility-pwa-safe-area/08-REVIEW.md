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
  critical: 2
  warning: 4
  info: 4
  total: 10
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-09-03T00:00:00Z
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

Reviewed all 25 changed source files for the visual/CSS/accessibility redesign at standard depth.
Confirmed via `git diff`/`git log` that `src/domain/**`, `src/lib/db/**`, and `src/app/actions/**`
were untouched by this phase, and traced the four explicitly-flagged risk areas:

- **Salary-overwrite confirmation panel** (`pay-setup-forms.tsx`): diffed the phase-08 commit
  (`d35c1fc`) against the prior version — `submit`/`onConfirmReplace`, the `confirmationClaim`
  compare-and-swap payload, and all `SalaryActionResult`/`ScheduleActionResult`/
  `YtdBaselineActionResult` handling are byte-for-byte unchanged; only `className` values and JSX
  wrapping changed.
- **Phase 6 SEC-02 string** (`login/page.tsx`): diffed against the prior version (`7f21663`) —
  `setFormError("Неверный email или пароль")` and the surrounding `onSubmit` branch logic are
  byte-for-byte unchanged, confirmed by the commit's own message.
- **`window.confirm()` delete flows** (`bonus-row.tsx`, `vacation-row.tsx`): diffed both restyle
  commits (`b6a0c31`, `1e71bcf`) — confirm message text, `onDelete`/`onEdit` logic, and input
  `id`/`aria-label` attributes are unchanged; only `className` values changed.
- **Calculation logic scope**: `git diff` across the phase-08 commit range touches zero files under
  `src/domain/`, `src/lib/db/`, or `src/app/actions/`.

However, the design-token contrast/accessibility check surfaced a real, measurable problem: the
redesign's single `--color-accent` (`#10b981`) and `--color-destructive` (`#ef4444`) tokens are
used simultaneously as (a) white-text-on-colored-background for every primary CTA button, and (b)
colored-text-on-background for the app's most important number (the hero take-home-pay figure) and
for delete/error text — but unlike `--color-dominant`/`--color-secondary`/`--color-text-primary`/
`--color-text-secondary`/`--color-tertiary-surface`, these two tokens are **not** forked between
the dark-mode `:root` block and the `@media (prefers-color-scheme: light)` override. Computed WCAG
2.1 contrast ratios (verified with a standalone relative-luminance script, not eyeballed) show this
fails AA in both roles. In at least one case (`error.tsx`'s "Повторить" button) this is a literal
regression introduced by this phase: the pre-redesign button was `bg-zinc-900` (near-black,
~19:1 contrast with white text) and is now `bg-[color:var(--color-accent)]` (~2.5:1).

Also found: `SkeletonLoader`'s new `mounted`-gating causes it to render `null` during real SSR
streaming (not just the homepage's already-resolved-data case), and it carries no accessible
loading indicator for screen readers — both directly relevant to the "loading-state accessibility"
check requested for this review. Design-token spacing/line-height variables are only partially
adopted, producing one visible spacing inconsistency across otherwise-identical form fields.

The already-known `annual-pie-chart.tsx` zero-income empty-state gap and the `.planning/research/`
Tailwind wildcard build-warning are out of scope per this review's instructions and are not
re-flagged below.

## Critical Issues

### CR-01: `--color-accent` fails WCAG AA contrast as white-button-text background across nearly every primary CTA — and is a contrast regression in `error.tsx`

**File:** `src/app/globals.css:13` (token definition), consumed at e.g.
`src/app/(auth)/login/page.tsx:106`, `src/app/(auth)/register/page.tsx:96`,
`src/app/(app)/bonuses/bonus-form.tsx:88`, `src/app/(app)/bonuses/bonus-row.tsx:104`,
`src/app/(app)/vacations/vacation-form.tsx:102`, `src/app/(app)/vacations/vacation-row.tsx:114`,
`src/app/(app)/error.tsx:27`, `src/app/(app)/page.tsx:78,97,131`,
`src/components/pay-setup-forms.tsx:193,204,304,441`

**Issue:** Every primary-action button in the app uses
`bg-[color:var(--color-accent)] ... text-white` (accent = `#10b981`, emerald-500) at `text-sm`
(14px) or smaller. Computed contrast of white (`#ffffff`) on `#10b981` is **2.54:1**, well below
the WCAG 2.1 AA threshold of 4.5:1 for normal text (14px semibold does not qualify as "large text,"
which requires ~18.7px bold or 24px regular). This affects, at minimum: "Войти", "Зарегистрироваться",
"Сохранить бонус/отпуск/оклад/график", "Подтвердить и заменить", "Повторить", "Обновить страницу",
"Перейти к настройке", "Настроить оклад", "Добавить бонус", "Добавить отпуск" — i.e. essentially
every button a user taps to accomplish anything in the app.

This is not merely pre-existing: `git show c321fae -- src/app/(app)/error.tsx` shows the
"Повторить" button changed from `bg-zinc-900` (near-black, ~19:1 contrast with white text — passes
AAA) to `bg-[color:var(--color-accent)]` (~2.5:1) as part of this phase's restyle. The redesign
replaced an accessible button with an inaccessible one.

**Fix:** Either darken the token used for button backgrounds (e.g. introduce a
`--color-accent-on-dark`/button-specific shade closer to `#047857`/emerald-700, which reaches
~4.6:1 with white text) or switch button text to a dark color when the background is the current
accent value. Verify every button background/text pair against the WCAG contrast formula (or a
tool like `wcag-contrast`) before shipping, not just visually.

### CR-02: `--color-accent`/`--color-destructive` also fail WCAG AA as text color against light-mode backgrounds — including the app's hero take-home-pay figure

**File:** `src/app/globals.css:13-14,56-57`; consumed at
`src/components/next-payment-card.tsx:36` (hero net-pay amount),
`src/app/(app)/bonuses/bonus-row.tsx:139` / `src/app/(app)/vacations/vacation-row.tsx:162`
("Удалить …" links), and every inline field-error `<p>` using `--color-destructive` as text color.

**Issue:** `--color-accent` (`#10b981`) and `--color-destructive` (`#ef4444`) are declared once in
`:root` and then **redundantly re-declared with the identical value** inside the
`@media (prefers-color-scheme: light)` block (`globals.css:56-57`) — i.e. they were never actually
forked per color scheme, unlike `--color-dominant`/`--color-secondary`/`--color-text-primary`/
`--color-text-secondary`/`--color-tertiary-surface`, which all do change between modes. Both colors
were evidently tuned to read well against the **dark** surfaces (`#10b981` on `#1a1a1a` is 6.86:1;
`#ef4444` on `#1a1a1a` is 4.62:1 — both pass AA), but against the **light**-mode surfaces they fail:

- `#10b981` text on light-mode `#ffffff`/`#f9fafb`: **2.43–2.54:1** (fails AA's 3:1 even for the
  large-text hero figure in `next-payment-card.tsx`, which is the single most important number in
  the product — the take-home amount the whole app exists to surface).
- `#ef4444` text on light-mode `#ffffff`/`#f9fafb`: **3.60–3.76:1** (fails AA's 4.5:1 for the
  normal-size "Удалить бонус"/"Удалить отпуск" links and inline field-error text).

Contrast ratios computed with the standard WCAG relative-luminance formula, not estimated.

**Fix:** Give `--color-accent` and `--color-destructive` real light-mode overrides in the
`@media (prefers-color-scheme: light)` block (e.g. a darker emerald/red shade tuned for light
backgrounds), the same way the neutral tokens already are, rather than reusing the dark-mode-tuned
value in both schemes.

## Warnings

### WR-01: `SkeletonLoader`'s `mounted`-gate returns `null` during real SSR/Suspense streaming, defeating its own stated purpose for the bonuses/vacations pages

**File:** `src/components/skeleton-loader.tsx:26-34`
**Issue:** The component's docstring says it exists to "match the final layout's shape exactly …
never a layout shift," but the implementation returns `null` until a `useEffect` flips `mounted`
to `true` on the client. `src/app/(app)/page.tsx`'s own comment correctly notes this never matters
there because its data is already resolved before the Suspense boundary renders — but
`src/app/(app)/bonuses/page.tsx` and `src/app/(app)/vacations/page.tsx` wrap **real** async work
(`listBonuses`/`listVacations` DB queries) in `<Suspense fallback={<SkeletonLoader .../>}>`. For
those two pages, on a slow connection/query, the server streams the fallback's SSR output — which
is empty (`null`, since `mounted` starts `false` and `useEffect` never runs on the server) — so
users see a blank gap where the skeleton should be until client hydration completes and pops the
skeleton in, then the real content replaces it. There's no non-deterministic value here (no
`Date.now()`, no `Math.random()`) that would actually cause a hydration mismatch, so the gate
appears unnecessary and, for these two pages, actively counter-productive.
**Fix:** Remove the `mounted` gate (render the skeleton markup unconditionally) unless a concrete
hydration-mismatch was observed and can be cited; if one exists, gate only the specific
mismatching piece rather than the whole component.

### WR-02: `SkeletonLoader` has no accessible loading indicator — purely visual/animation-only signaling

**File:** `src/components/skeleton-loader.tsx:36-76`
**Issue:** The loading placeholder has no `role="status"`, `aria-busy`, `aria-live` region, or
visually-hidden "Загрузка…" text. Sighted users see a pulsing tertiary-surface block; screen-reader
users get nothing announced while content loads (combined with WR-01, literally nothing is even in
the DOM for the SSR-streamed window on the bonuses/vacations pages). Contrast with
`ytd-estimate-banner.tsx:19`, which correctly uses `role="status"` for its own persistent message.
**Fix:** Add `role="status" aria-live="polite"` to the outer wrapper, plus a visually-hidden label,
e.g. `<span className="sr-only">Загрузка…</span>`.

### WR-03: Error states render with no `role="alert"`/`aria-live`, unlike the banner pattern already used elsewhere in this phase

**File:** `src/app/(app)/error.tsx:19-32`, `src/app/(app)/page.tsx:67-84`
**Issue:** Both the route-level error boundary (`AppError`) and the home page's caught-fetch-failure
fallback render their "Не удалось загрузить…" messaging as plain `<div>`/`<p>` with no
`role="alert"` or `aria-live` region, so assistive technology is not proactively notified when
either fires. `ytd-estimate-banner.tsx` in this same phase already established the correct pattern
(`role="status"`) for a persistent informational message; these two error surfaces should use the
equivalent assertive pattern (`role="alert"`) since they represent failures, not routine status.
**Fix:**
```tsx
<div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
```

### WR-04: Incomplete/inconsistent adoption of the `--spacing-*` token scale produces a visible spacing mismatch between otherwise-identical form field groups

**File:** `src/app/(app)/vacations/vacation-form.tsx:70,81` vs.
`src/app/(app)/bonuses/bonus-form.tsx:58,64,71`, `src/components/pay-setup-forms.tsx` (all label/
input/caption stacks)
**Issue:** `vacation-form.tsx` is the only file in the reviewed set that uses
`className="flex flex-col gap-[var(--spacing-sm)]"` (8px) for its label→input→caption field
groups. Every other form with the identical structural pattern (`bonus-form.tsx`, and all three
forms in `pay-setup-forms.tsx`) uses Tailwind's literal `gap-1` (4px) for the same visual role.
The result: the vacation form's fields are visibly more loosely spaced than the bonus/salary/
schedule/YTD forms, despite no apparent design intent to differentiate them. Confirmed via grep
that `--spacing-xs/-md/-lg/-xl/-2xl/-3xl` are defined in `globals.css` but never referenced by any
component in the reviewed set — `--spacing-sm` is the only spacing token actually consumed, and
only in this one file.
**Fix:** Either standardize all field-group stacks on `gap-[var(--spacing-sm)]` (and update
`bonus-form.tsx`/`pay-setup-forms.tsx` to match), or revert `vacation-form.tsx` back to `gap-1` to
match its siblings — pick one and apply it consistently.

## Info

### IN-01: `globals.css` redundantly re-declares `--color-accent`/`--color-destructive` with identical values inside the light-mode media block

**File:** `src/app/globals.css:56-57`
**Issue:** These two lines set `--color-accent: #10b981` and `--color-destructive: #ef4444` inside
`@media (prefers-color-scheme: light)`, exactly matching the `:root` values three lines above the
media block — i.e. they have no effect and are dead duplication. (See CR-02: the fix for that
finding should replace these two lines with genuinely different light-mode-tuned values rather than
just deleting them.)
**Fix:** Once CR-02 is addressed, this duplication resolves itself; if CR-02 is deferred, delete
the two redundant lines to avoid implying an intentional fork that doesn't exist.

### IN-02: Several typography design tokens are defined in `globals.css` but never consumed anywhere in the reviewed component set

**File:** `src/app/globals.css:20,24,29,36-37`
**Issue:** `--font-weight-body`, `--line-height-body`, `--line-height-label`, `--line-height-heading`,
`--font-weight-caption`, and `--line-height-caption` are all defined but grep across every reviewed
`.tsx` file finds zero usages. (`--line-height-display` is used exactly once, in
`next-payment-card.tsx:36`.) Not a functional bug, but suggests the typography token scale was
speced more completely than it was wired up — worth a pass to either apply the tokens where the
06/08 UI spec intended them (e.g. `line-height` alongside every `font-size`/`font-weight` triple
currently missing it) or trim the unused ones.
**Fix:** Cross-check against `08-UI-SPEC.md`'s typography table and either apply the missing
`leading-[var(--line-height-*)]` classes alongside existing `font-size`/`font-weight` usages, or
remove the tokens that were never meant to be applied per-element.

### IN-03: `AnnualPieChart`'s Recharts SVG has no `aria-hidden`/accessible-name treatment despite an adjacent text equivalent already existing

**File:** `src/components/annual-pie-chart.tsx:57-63`
**Issue:** The `<PieChart>`/`<Pie>`/`<Cell>` SVG renders with no `role="img"`, `aria-label`, or
`aria-hidden="true"`. The component does already provide an accessible textual equivalent via the
`<dl>` below it (lines 70-83, listing Грязными/Налог/На руки with amounts and percentages), so this
is not a total accessibility gap, but without `aria-hidden="true"` on the chart wrapper, screen
readers may still attempt to traverse the raw, unlabeled SVG path/sector elements Recharts emits,
adding noise before reaching the actually-useful `<dl>` content.
**Fix:** Wrap the `<div className="mt-4 flex justify-center">` chart container with
`aria-hidden="true"` since the `<dl>` already serves as the accessible equivalent.

### IN-04: Duplicated long Tailwind arbitrary-value class strings across sibling form files, inconsistently extracted

**File:** `src/app/(app)/vacations/vacation-form.tsx:75,86` and every input in
`src/components/pay-setup-forms.tsx`, contrasted with `src/app/(app)/bonuses/bonus-form.tsx:50-53`
**Issue:** `bonus-form.tsx` extracts its repeated input/label class strings into local
`inputClassName`/`labelClassName` consts to avoid restating the ~200-character arbitrary-value
string per field. `vacation-form.tsx` and all three forms in `pay-setup-forms.tsx` instead inline
the same (or near-identical) long string on every single `<input>`/`<label>`, several times over —
functionally identical output, but inconsistent pattern across near-identical sibling files and
more surface area to drift out of sync on a future token rename.
**Fix:** Apply the same `inputClassName`/`labelClassName` (or a shared exported constant/helper)
pattern consistently across all four form files.

---

_Reviewed: 2026-09-03T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
