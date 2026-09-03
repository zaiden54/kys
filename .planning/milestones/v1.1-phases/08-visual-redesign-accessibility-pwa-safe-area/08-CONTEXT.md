# Phase 8: Visual Redesign, Accessibility & PWA Safe-Area - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning

<domain>
## Phase Boundary

The app looks and feels like a finished product — consistent, accessible, dark-mode aware, and safe on notched iPhones — with zero change to any calculation logic. Covers: empty/loading/error states across all screens (UI-01), consistent money formatting + before/after confirmation dialogs for destructive/overwrite actions (UI-02, UI-03), one-tap return to home from any screen (UI-04), a full visual redesign via the `frontend-design` skill with system dark/light theme support (UI-05, UI-06), basic accessibility (contrast, focus indicators, labeled form fields — UI-07), and PWA safe-area handling for notched iPhones (`viewport-fit=cover`, `env(safe-area-inset-*)` — PWA-01, PWA-02). Explicitly excludes any change to the НДФЛ/premium/vacation-pay calculation engines.

</domain>

<decisions>
## Implementation Decisions

### Empty/Loading/Error States (UI-01)
- Loading: skeleton placeholders matching the final layout shape, not spinners — avoids layout shift
- Empty states: friendly copy + explicit CTA (e.g. "Пока нет бонусов — добавить?"), reusing the existing zinc surface styling pattern
- Errors: never show raw exception text or stack traces — always a short Russian message, consistent with the existing generic-error convention established for auth in Phase 6
- Retry: offered on safely re-runnable actions (data fetch, form submit); not offered for validation errors

### Money Formatting & Confirmation Dialogs (UI-02, UI-03)
- `formatKopecks()` stays the single source of truth for money formatting — this phase verifies/applies tabular-nums consistently via one shared CSS class, no new formatting logic
- Bonus/vacation delete: native `window.confirm()` stays as-is (nothing to compare — no "after" value for a deletion); explicitly out of this phase's UI-03 restyle scope since Phase 7's E2E suite (07-CONTEXT.md) locked its test assumptions to `window.confirm()` behavior — changing this would break Phase 7's E2E coverage
- Salary overwrite: keeps its existing inline before/after confirmation panel (`pay-setup-forms.tsx`) rather than introducing a new modal component — UI-03 is already functionally satisfied here; this phase restyles it to match the new visual system
- Before/after display: old value shown struck-through or greyed, new value emphasized, both in the same currency format

### Visual Redesign System & Dark Mode (UI-05, UI-06)
- Aesthetic direction is NOT presupposed here — the `frontend-design` skill runs fresh during this phase per UI-05's explicit requirement, and owns the actual direction/palette/component decisions
- Dark mode: system-preference-only via Tailwind's media-based `dark:` variant (already partially in use in `install-banner.tsx`) — no manual light/dark toggle; matches the milestone's "polish-only, no new interaction surface" framing
- Typography: introduces a proper type scale as part of the redesign, replacing ad-hoc `text-sm`/`text-2xl` sprinkling — core to UI-05
- Components: stays hand-rolled Tailwind, no component-library dependency (e.g. shadcn/ui) — matches this project's existing minimal-dependency pattern and avoids a new package-legitimacy checkpoint mid polish-milestone

### Navigation, Accessibility & Safe-Area (UI-04, UI-07, PWA-01, PWA-02)
- Home navigation: persistent header with app name/logo as a tappable link to home, present on every `(app)` screen — simplest one-tap pattern for a 5-screen app, no bottom-tab-bar redesign
- Accessibility scope: WCAG 2.1 AA basics only — contrast ratios, focus-visible indicators, labeled form fields — matching UI-07's own "basic requirements" wording, not a full audit
- Focus indicators: visible focus ring (outline) on all interactive elements; no focus-trap/skip-link additions beyond what a small app needs
- Safe-area: `env(safe-area-inset-*)` applied once at the shared `(app)` layout's header/footer level, with `viewport-fit=cover` set in the root layout's viewport metadata — single source of truth, not per-component

### Claude's Discretion
- Exact skeleton-loading component structure per screen
- Specific Tailwind type-scale values (left to the frontend-design skill's output)
- Exact wording of empty-state copy per screen

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/domain/money.ts`'s `formatKopecks()` — existing locale-aware RUB formatter, single source of truth for all money display
- `src/components/install-banner.tsx` — already uses Tailwind's `dark:` variant (e.g. `dark:bg-zinc-800`), proving system dark mode is technically already wired at the Tailwind-config level; this is the closest existing "dark mode" precedent to extend consistently
- `src/components/pay-setup-forms.tsx` — existing inline before/after confirmation flow for salary overwrite (`confirmationClaim`, `pendingConfirmation` state, "Подтвердить и заменить" button) — UI-03's salary-overwrite case is functionally done, just needs restyling
- `src/app/(app)/bonuses/bonus-row.tsx` and `.../vacations/vacation-row.tsx` — existing `window.confirm()` delete pattern, explicitly locked by Phase 7's E2E tests (`e2e/bonus.spec.ts`, `e2e/vacation.spec.ts` both drive Playwright's native dialog handler against this exact `window.confirm()` call)

### Established Patterns
- Tailwind v4 utility classes throughout, zinc color palette, no design tokens/CSS variables layer yet
- Server Components for read-heavy screens (`NextPaymentCard`), Server Actions for mutations
- `src/app/globals.css` is minimal (26 lines) — no existing dark-mode CSS variable scaffolding beyond Tailwind's built-in `dark:` variant support

### Integration Points
- `src/app/(app)/layout.tsx` (shared layout for all authenticated screens) — the natural place for the persistent home-nav header and the safe-area `env()` wrapper
- `src/app/layout.tsx` (root layout) — where `viewport-fit=cover` needs to be set in the Next.js viewport export
- `src/app/manifest.ts` — existing PWA manifest, may need review for consistency with the visual redesign (icons/theme-color)

</code_context>

<specifics>
## Specific Ideas

No specific visual references collected here — the `frontend-design` skill run during planning/execution owns direction, palette, and component-level decisions. This phase's grey-area discussion focused on functional/structural decisions (state handling, confirmation flow scope, dark-mode mechanism, safe-area architecture) that constrain what the visual redesign can change.

</specifics>

<deferred>
## Deferred Ideas

- A manual light/dark toggle (beyond system-preference) — explicitly deferred; system-preference-only chosen for this polish milestone
- A component-library dependency (shadcn/ui or similar) — explicitly deferred in favor of continuing hand-rolled Tailwind
- Visual regression / screenshot-baseline testing — already deferred from Phase 7 to this phase per the existing STATE.md research flag (research/PITFALLS.md #6); still needs explicit design agreement before baselines are captured, tracked as an open blocker for this phase's execution

</deferred>
