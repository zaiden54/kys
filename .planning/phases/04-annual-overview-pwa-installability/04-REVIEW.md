---
phase: 04-annual-overview-pwa-installability
reviewed: 2026-08-31T18:55:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - .gitignore
  - next.config.ts
  - package.json
  - src/app/actions/annual-summary.test.ts
  - src/app/actions/annual-summary.ts
  - src/app/api/pwa-icon/route.test.ts
  - src/app/api/pwa-icon/route.ts
  - src/app/(app)/error.render.test.tsx
  - src/app/(app)/error.tsx
  - src/app/apple-icon.tsx
  - src/app/(app)/page.tsx
  - src/app/(auth)/login/page.render.test.tsx
  - src/app/(auth)/login/page.tsx
  - src/app/(auth)/register/page.render.test.tsx
  - src/app/(auth)/register/page.tsx
  - src/app/layout.tsx
  - src/app/manifest.test.ts
  - src/app/manifest.ts
  - src/app/sw.ts
  - src/components/annual-pie-chart.render.test.tsx
  - src/components/annual-pie-chart.tsx
  - src/components/install-banner.render.test.tsx
  - src/components/install-banner.tsx
  - src/domain/pay/payment-accrual.ts
  - src/lib/db/salary-repository.ts
  - src/lib/pwa-icon.tsx
  - src/lib/use-standalone.ts
  - vitest.config.ts
findings:
  critical: 1
  warning: 1
  info: 3
  total: 5
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-08-31T18:55:00Z
**Depth:** standard
**Files Reviewed:** 27 (`vitest.config.ts` reviewed but yielded no findings)
**Status:** issues_found

## Summary

This run supersedes the prior 04-REVIEW.md after gap-closure plan 04-03 fixed UAT gap G-04-2 (missing `router.refresh()` before `router.push()` in `login/page.tsx` and `register/page.tsx`'s success paths). I verified the G-04-2 fix directly: both `onSubmit` handlers now call `router.refresh()` before `router.push()`, both have passing regression tests (`login/page.render.test.tsx`, the new `register/page.render.test.tsx`) that assert call order via `invocationCallOrder`, and I ran all six render-test files listed in scope (17 tests) — all pass. G-04-2 is correctly closed and I found no new defect introduced by that change.

However, reviewing the **full current state** of all in-scope files (not just the 04-03 diff) surfaces that the two most significant findings from the prior review pass were never addressed and remain live in the current code:

1. `useIsStandalone` (`src/lib/use-standalone.ts`) still seeds its React state by calling a `window`-dependent function directly in the `useState` initializer, which produces a genuine SSR/hydration mismatch specifically for the standalone-PWA launch scenario this phase exists to support. I independently reproduced the corroborating ESLint signal (`react-hooks/set-state-in-effect`) via `npx eslint`.
2. `computeAnnualSummary` (`src/app/actions/annual-summary.ts`) still folds the YTD baseline's gross into the total without ever taxing it, which overstates the displayed «На руки» (net) figure for any user with a non-zero applicable baseline — confirmed by tracing `calculateNdfl`'s cumulative-delta formula and cross-checking against `annual-summary.test.ts`'s own oracle, which encodes the same (baseline-untaxed) behavior as expected rather than independently verifying it.

Three lower-severity Info items (unused/discarded error object, a redundant type assertion, and an ESLint-unused-var warning) also remain unaddressed.

## Critical Issues

### CR-01: `useIsStandalone`'s initial render computes a browser-only value, causing an SSR/hydration mismatch for standalone-PWA users

**File:** `src/lib/use-standalone.ts:26-31` (consumed by `src/components/install-banner.tsx:16`, rendered from `src/app/(app)/page.tsx:41` and `:56`, and by `src/app/(auth)/login/page.tsx:22`)

**Issue:** `useIsStandalone` seeds its state with `useState(detectStandalone)`:

```ts
export function useIsStandalone(): boolean {
  const [isStandalone, setIsStandalone] = useState(detectStandalone);
  useEffect(() => {
    setIsStandalone(detectStandalone());
    ...
```

`detectStandalone()` guards against crashing during SSR (`typeof window !== "undefined"`), but that guard does not make the value *consistent* between the server-rendered HTML and the client's first (hydration) render:

- On the server, `window` is undefined → `detectStandalone()` returns `false` → the server HTML is generated as if the app is not standalone (`InstallBanner` renders its instructions block; `LoginPage`'s re-login hint is omitted).
- During hydration on the client, `window` **is already defined** by the time this component's render function executes for the first time — so for a genuinely standalone-launched PWA (this phase's target scenario), `detectStandalone()` synchronously returns `true` on that very first client render, before any effect runs.

This makes the client's initial render tree disagree with the server-rendered HTML it is hydrating against (banner/hint present vs. absent) — a classic React hydration mismatch. This affects every standalone-PWA launch of both the home page (`InstallBanner`, in both the not-configured and configured branches of `page.tsx`) and the login page's re-login hint.

Corroborating evidence: running `npx eslint src/lib/use-standalone.ts` independently flags the redundant `setIsStandalone(detectStandalone())` call inside the mount effect with `react-hooks/set-state-in-effect` — a symptom of the initializer already having gotten the client-render value wrong and needing correction.

None of the existing render tests catch this: `@testing-library/react`'s `render()` performs a pure client-side mount and never runs an SSR pass followed by hydration, so a server/client mismatch is invisible to `install-banner.render.test.tsx` and `login/page.render.test.tsx` regardless of how `matchMedia`/`navigator.standalone` are mocked.

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

This trades a one-effect-cycle "flash of not-standalone UI" (acceptable, and unavoidable without a server-side standalone signal) for a guaranteed-consistent SSR/hydration pass.

## Warnings

### WR-01: `computeAnnualSummary` never taxes the YTD-baseline portion of gross income, overstating the displayed "На руки" total

**File:** `src/app/actions/annual-summary.ts:161-179`

**Issue:** `totalGrossKopecks` and `cumulativeYtdKopecks` both seed from `baselineAmountKopecks` (line 161-162), but that seed amount is never itself passed through `calculateNdfl` — only the events strictly after the baseline's `windowBoundIso` are taxed (the loop at 164-169). For any user with a non-zero, applicable YTD baseline (e.g. someone who starts using the app mid-year and enters "I've earned X so far this year"), `taxKopecks` reflects tax only on income earned *after* the baseline date, while `grossKopecks` includes the full baseline + after-baseline total. Since `netKopecks = grossKopecks - taxKopecks` (line 176), the baseline segment's own real-world withheld tax is entirely missing from the subtraction, so the pie chart's «На руки» figure overstates actual annual take-home by exactly the tax that should apply to the baseline segment.

I verified this against `calculateNdfl`'s implementation (`src/domain/tax/calculate-ndfl.ts`): it computes tax as `taxOnCumulative(after) - taxOnCumulative(before)`, a pure function of cumulative income. Because of this telescoping property, the tax attributable to the baseline segment is exactly `calculateNdfl(0, baselineAmountKopecks, taxYear).taxKopecks`, independent of how that gross was actually earned across the months before the baseline date. `annual-summary.test.ts`'s test (4) deliberately constructs a scenario where the baseline (2,300,000₽) plus the year's schedule accrual crosses the first bracket's 2,400,000₽ ceiling, but its own oracle mirrors the implementation's baseline-untaxed assumption rather than independently confirming the baseline's own tax is correctly reported — so the test suite does not currently catch this gap.

**Fix:** Seed `totalTaxKopecks` with the baseline's own implied tax:

```ts
const baselineTaxKopecks = calculateNdfl(0, baselineAmountKopecks, taxYear).taxKopecks;

let cumulativeYtdKopecks = baselineAmountKopecks;
let totalGrossKopecks = baselineAmountKopecks;
let totalTaxKopecks = baselineTaxKopecks; // was: 0
```
(`calculateNdfl(0, 0, taxYear).taxKopecks` is `0`, so this is safe to apply unconditionally.) If the team judges the current behavior intentional for v1 (e.g. because the baseline is frequently just an *estimate*, and taxing an estimate compounds uncertainty into a displayed number), that is a defensible call — but it should be a conscious, documented product decision, and the `baselineIsEstimated` note in `annual-pie-chart.tsx` should say so explicitly rather than leaving users to infer it from a mismatched total.

## Info

### IN-01: `AppError` discards the caught error with no logging or reporting

**File:** `src/app/(app)/error.tsx:11-17`

**Issue:** The Next.js error boundary receives `error: Error & { digest?: string }` but immediately discards it via `error: _error` — nothing in this component logs the error message/stack or reports it anywhere. Any unexpected render-time throw in the `(app)` segment (including, per the module's own doc comment, an uncaught `UnsupportedTaxYearError` from `computeAnnualSummary`) becomes silently invisible to the team once shipped. This module's neighboring convention of never logging money values does not apply here — the boundary receives a JS `Error` object, not a monetary amount.

**Fix:**
```tsx
"use client";
import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  // ...
}
```

### IN-02: Redundant type assertion in `computeAnnualSummary`'s schedule-event loop

**File:** `src/app/actions/annual-summary.ts:128`

**Issue:** `halfSplitGross(entry.grossAmountKopecks, event.kind as PaymentKind)` casts `event.kind`, but `event` here is a `PaymentEvent` from `generatePaymentEvents` (`src/domain/schedule/resolve-payment-date.ts:38-40`), whose `kind` field is already typed `PaymentKind` — the assertion is a no-op that adds noise and, if the underlying type ever genuinely widens, would silently suppress a real type error instead of surfacing it.

**Fix:** Drop the assertion: `halfSplitGross(entry.grossAmountKopecks, event.kind)`.

### IN-03: `error.tsx`'s unused `_error` destructure still trips ESLint

**File:** `src/app/(app)/error.tsx:12`

**Issue:** `npx eslint "src/app/(app)/error.tsx"` reports `'_error' is defined but never used` (`@typescript-eslint/no-unused-vars`) — the project's flat ESLint config (`eslint.config.mjs`) does not set `argsIgnorePattern`/`varsIgnorePattern`, so the conventional leading-underscore "intentionally unused" signal is not actually recognized by the linter here.

**Fix:** Either configure the rule project-wide (`{ "argsIgnorePattern": "^_" }`), or resolve IN-01 by actually using `error` (e.g. `console.error(error)`), which removes the unused-var warning as a side effect.

---

_Reviewed: 2026-08-31T18:55:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
