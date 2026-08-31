---
phase: 04-annual-overview-pwa-installability
reviewed: 2026-08-31T14:18:51Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - src/app/actions/annual-summary.ts
  - src/app/actions/annual-summary.test.ts
  - src/components/annual-pie-chart.tsx
  - src/components/annual-pie-chart.render.test.tsx
  - src/app/(app)/error.tsx
  - src/app/(app)/error.render.test.tsx
  - src/domain/pay/payment-accrual.ts
  - src/lib/db/salary-repository.ts
  - src/app/(app)/page.tsx
  - package.json
  - src/lib/pwa-icon.tsx
  - src/app/apple-icon.tsx
  - src/app/api/pwa-icon/route.ts
  - src/app/api/pwa-icon/route.test.ts
  - src/app/manifest.ts
  - src/app/manifest.test.ts
  - src/app/sw.ts
  - src/lib/use-standalone.ts
  - src/components/install-banner.tsx
  - src/components/install-banner.render.test.tsx
  - src/app/(auth)/login/page.render.test.tsx
  - next.config.ts
  - src/app/layout.tsx
  - src/app/(auth)/login/page.tsx
  - vitest.config.ts
findings:
  critical: 1
  warning: 2
  info: 3
  total: 6
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-08-31T14:18:51Z
**Depth:** standard
**Files Reviewed:** 25 (`.gitignore` reviewed but yielded no findings and is omitted from the list above)
**Status:** issues_found

## Summary

Reviewed the annual-summary aggregation engine (`computeAnnualSummary`), its pie-chart presentation, the app-level error boundary, and the full PWA-installability surface (manifest, icon routes, service worker, standalone-mode detection, install banner, login re-login hint).

The annual-summary math itself is well-reasoned and exhaustively tested (`annual-summary.test.ts`'s independent-oracle reconciliation tests are genuinely strong coverage), and `payment-accrual.ts`/`salary-repository.ts`'s shared `resolveBaselineWindow` extraction is a clean, correct refactor that keeps the forecast and annual-summary code paths from drifting apart.

The standout defect is `useIsStandalone` (`src/lib/use-standalone.ts`): its `useState` initializer calls a `window`-dependent function directly during render, which produces a real SSR/hydration mismatch for the exact production scenario this phase exists to support — a user launching the installed standalone PWA. This is corroborated by ESLint's `react-hooks/set-state-in-effect` rule independently flagging the same file (and `install-banner.tsx`) for the redundant-`setState`-in-effect symptom of this anti-pattern. None of the render tests for `InstallBanner`/`LoginPage` catch it because React Testing Library's `render()` never exercises a real SSR→hydrate pass.

A second, lower-confidence but worth-surfacing item: `computeAnnualSummary` adds the YTD baseline's gross into the year's total but never taxes it (by explicit plan design — see 04-01-PLAN.md), which means the displayed "На руки" (net) figure can materially overstate real take-home for any user with a non-zero applicable baseline. This traces back to an intentional plan decision rather than an implementation slip, but it is a real, user-visible financial-correctness gap in a salary/tax app and is flagged for the team to consciously accept or revise.

## Critical Issues

### CR-01: `useIsStandalone`'s initial render computes a browser-only value, causing an SSR/hydration mismatch for standalone-PWA users

**File:** `src/lib/use-standalone.ts:13-31` (consumed by `src/components/install-banner.tsx:16` and `src/app/(auth)/login/page.tsx:22`)

**Issue:** `useIsStandalone` seeds its state with `useState(detectStandalone)`. `detectStandalone` guards against crashing on the server (`typeof window !== "undefined"`), but that guard does *not* make the value consistent between the server-rendered HTML and the client's first (hydration) render:

- On the server, `window` is undefined → `detectStandalone()` returns `false` → the server HTML is generated as if the app is *not* standalone (e.g. `InstallBanner` is rendered, the login re-login hint is omitted).
- On the client, during hydration, `window` **is** already defined by the time this component's render function runs for the first time — so if the app genuinely is running standalone (the whole point of this phase), `detectStandalone()` synchronously returns `true` on that very first client render, before any effect has run.

The result: the client's initial render tree disagrees with the server-rendered HTML it's hydrating against (banner/hint present vs. absent), which is a classic React hydration-mismatch bug — React logs a "Hydration failed" error and discards/re-renders the affected subtree on the client, producing a visible flash for every single standalone-PWA launch (`LoginPage`'s re-login hint, and `InstallBanner` wherever it's rendered — both the not-configured and configured branches of `src/app/(app)/page.tsx`).

This is corroborated by tooling: `npx eslint src/lib/use-standalone.ts` independently flags line 30 with `react-hooks/set-state-in-effect` ("Calling setState synchronously within an effect can trigger cascading renders") — the redundant `setIsStandalone(detectStandalone())` call inside the mount effect exists precisely because the initializer already got it wrong on the client and needs correcting, which is a symptom of this exact anti-pattern.

None of the existing render tests catch this because `@testing-library/react`'s `render()` performs a pure client-side mount — it never runs an SSR pass and then hydrates against it, so a server/client mismatch is invisible to `install-banner.render.test.tsx` and `login/page.render.test.tsx` regardless of how the mocks are set up.

**Fix:** Seed state with a fixed, SSR-safe value and only read the real browser state after mount:

```ts
export function useIsStandalone(): boolean {
  const [isStandalone, setIsStandalone] = useState(false); // matches server output

  useEffect(() => {
    setIsStandalone(detectStandalone());

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    function handleChange() {
      setIsStandalone(detectStandalone());
    }
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isStandalone;
}
```
This trades a one-effect-cycle "flash of not-standalone UI" (acceptable, and unavoidable without a server-side standalone signal) for a guaranteed-consistent SSR/hydration pass. Consider adding a Playwright/SSR-level smoke test (or at minimum a comment on the render tests) noting they cannot catch hydration mismatches, since RTL cannot exercise them.

## Warnings

### WR-01: `computeAnnualSummary` never taxes the YTD-baseline portion of gross income, overstating the displayed "На руки" total

**File:** `src/app/actions/annual-summary.ts:161-179`

**Issue:** `totalGrossKopecks` and `cumulativeYtdKopecks` both seed from `baselineAmountKopecks`, but that seed amount is never passed through `calculateNdfl` — only the events *after* the baseline's `windowBoundIso` are taxed (lines 164-168). This is explicit, documented behavior (see `04-01-PLAN.md` line 31/102: "never itself passed through calculateNdfl as a taxed event"), so it is not an implementation slip — but it is a real financial-correctness gap: for any user with a non-zero, applicable YTD baseline (e.g. someone who starts using the app mid-year and enters "I've earned X so far this year"), `taxKopecks` only reflects tax on income earned *after* the baseline date, while `grossKopecks` includes the full-year total (baseline + after). Since `netKopecks = grossKopecks - taxKopecks`, the baseline's own real-world withheld tax is entirely missing from the subtraction, so the pie chart's «На руки» figure overstates actual annual take-home by exactly the tax that should apply to the baseline segment.

Concretely, with `TAX_YEAR`-test-4's own numbers (baseline 2,300,000₽, confirmed, applicable): the true tax owed on that first 2,300,000₽ of cumulative income (crossing well past the first bracket's 2,400,000₽ ceiling once the year's events are added) is nontrivial and is currently reported as ₽0 tax on that portion.

Because progressive Russian НДФЛ is a pure function of cumulative income (`taxOnCumulative`), the "telescoping" property this module's own comments already rely on elsewhere guarantees that the tax attributable to the baseline segment is exactly `calculateNdfl(0, baselineAmountKopecks, taxYear).taxKopecks` — independent of how that gross was actually earned across the months before the baseline date.

**Fix:** Seed `totalTaxKopecks` with the baseline's own implied tax when the baseline applies:

```ts
const baselineTaxKopecks = calculateNdfl(0, baselineAmountKopecks, taxYear).taxKopecks;

let cumulativeYtdKopecks = baselineAmountKopecks;
let totalGrossKopecks = baselineAmountKopecks;
let totalTaxKopecks = baselineTaxKopecks; // was: 0
```
(`calculateNdfl(0, 0, taxYear).taxKopecks` is `0`, so this is safe to apply unconditionally, not just when `baselineApplies` is true.) If the team decides the current behavior is intentional for v1 (e.g. because the baseline is frequently an *estimate*, and estimated-tax-on-an-estimate compounds uncertainty), that's a defensible call — but it should be a conscious, documented product decision rather than an implicit side effect of "never tax the baseline," and the `baselineIsEstimated` banner/note should probably say so explicitly if kept.

## Info

### IN-01: `AppError` discards the caught error with no logging or reporting

**File:** `src/app/(app)/error.tsx:11-17`

**Issue:** The Next.js error-boundary receives `error: Error & { digest?: string }` but immediately discards it via `error: _error` — nothing in this component logs the error message/stack or reports it anywhere. Once shipped, any unexpected render-time throw in the `(app)` segment becomes silently invisible to the team; there is no diagnostic trail beyond whatever the user reports manually. This module intentionally avoids logging *money values* per this codebase's convention (see `annual-summary.ts`'s doc comment), but the error boundary receives a JS `Error` object, not a money value — logging `error.message`/`error.digest` would not violate that convention.

**Fix:** At minimum, log the error for local debugging, and leave a hook for a future reporting integration:
```tsx
useEffect(() => {
  console.error(error);
}, [error]);
```

### IN-02: Redundant type assertion in `computeAnnualSummary`'s schedule-event loop

**File:** `src/app/actions/annual-summary.ts:128`

**Issue:** `halfSplitGross(entry.grossAmountKopecks, event.kind as PaymentKind)` casts `event.kind`, but `event` here is a `PaymentEvent` from `generatePaymentEvents`, whose `kind` field is already typed `PaymentKind` — the assertion is a no-op that adds noise and, if the underlying type ever genuinely changes to something wider, would silently suppress a real type error instead of surfacing it.

**Fix:** Drop the assertion: `halfSplitGross(entry.grossAmountKopecks, event.kind)`.

### IN-03: `error.tsx`'s unused `_error` destructure still trips ESLint

**File:** `src/app/(app)/error.tsx:12`

**Issue:** `npx eslint` reports `'_error' is defined but never used` for this parameter — the project's flat ESLint config (`eslint.config.mjs`) doesn't set `argsIgnorePattern`/`varsIgnorePattern` for `@typescript-eslint/no-unused-vars`, so the conventional leading-underscore "intentionally unused" signal isn't actually recognized by the linter here.

**Fix:** Either configure the rule (`{ "argsIgnorePattern": "^_" }`) project-wide, or resolve IN-01 by actually using `error` (e.g. `console.error(error)`), which removes the unused-var warning as a side effect.

---

_Reviewed: 2026-08-31T14:18:51Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
