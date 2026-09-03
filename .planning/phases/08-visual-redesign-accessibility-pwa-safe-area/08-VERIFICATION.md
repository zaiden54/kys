---
phase: 08-visual-redesign-accessibility-pwa-safe-area
verified: 2026-09-03T00:00:00Z
status: gaps_found
score: 8/9 must-haves verified (1 BLOCKER gap)
behavior_unverified: 0
overrides_applied: 0
re_verification: false
gaps:
  - truth: "UI-01 (home screen / annual summary): The app shows a clear empty/loading/error state instead of a blank screen or technical error. Annual-summary-chart specifically: a zero-income year renders a distinct empty-state variant, not a degenerate 0%/0% pie slice."
    status: failed
    reason: "src/components/annual-pie-chart.tsx has no `grossKopecks === 0` branch; component renders unconditionally from all summary values. When computeAnnualSummary returns configured=true with zero gross income (e.g., salary configured but not yet effective, or fresh account with no accrued events), the pie chart displays 0%/0% as if it were real data, violating 08-UI-SPEC.md § UI Considerations backstop #1."
    artifacts:
      - path: "src/components/annual-pie-chart.tsx"
        issue: "Lines 33-86: no conditional check for grossKopecks === 0; PieChart rendered unconditionally"
      - path: "src/app/(app)/page.tsx"
        issue: "Lines 115-119: annualResult.configured gate does not distinguish zero-income case from configured-with-income case"
    missing:
      - "Add `if (grossKopecks === 0)` branch to annual-pie-chart.tsx or its caller (page.tsx) to render 08-UI-SPEC.md's empty-state message pattern instead of a degenerate pie"
      - "Empty-state copy needs design decision (UI-SPEC provides general pattern, not the specific copy for this case)"
deferred: []
behavior_unverified_items: []
coincidental_reliance_items: []
human_verification: []
---

# Phase 8: Visual Redesign, Accessibility & PWA Safe-Area Verification Report

**Phase Goal:** The app looks and feels like a finished product — consistent, accessible, dark-mode aware, and safe on notched iPhones — with zero change to any calculation logic.

**Verified:** 2026-09-03
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | **UI-05/06:** The app reflects the redesigned visual system (typography, color, spacing via design tokens) and follows system dark/light theme. | ✓ VERIFIED | `src/app/globals.css` declares complete dark-base token system (7 color tokens, 5 typographic roles, 7 spacing tokens, 3 font-family stacks) with `:root` dark values and `@media (prefers-color-scheme: light)` override for colors only. Every touched file replaces raw Tailwind zinc-*/amber-* with `bg-[color:var(--color-*)]` or `text-[color:var(--color-*)]` arbitrary values. `grep -rn 'zinc-\|amber-\|slate-\|gray-\|neutral-'` across src/app and src/components returns zero matches (excluding intentional Recharts fill constants). |
| 2 | **UI-04:** From any screen, user can return home in one tap/click. | ✓ VERIFIED | `src/app/(app)/layout.tsx` line 24-28: persistent header renders "НаРуки" as `<Link href="/">`, present on every (app) route. One-tap home link is the single source of truth, required on all screens. |
| 3 | **PWA-01/02:** Header/nav never overlap Dynamic Island or home indicator on iPhone. Safe-area insets applied correctly. | ✓ VERIFIED | `src/app/layout.tsx`: `viewport.viewportFit === "cover"` (line already confirmed unchanged from Phase 4). `src/app/(app)/layout.tsx` lines 18-19: header has `style={{ paddingTop: "env(safe-area-inset-top)" }}`; line 31-32: main has `style={{ paddingBottom: "env(safe-area-inset-bottom)" }}`. Single source of truth, no per-component duplication. CSS mechanism is standard and applies correctly on all WebKit engines including Safari iOS. |
| 4 | **UI-01 (home page slice, configured state):** Home screen shows clear empty/loading/error state. Configured/populated states work correctly. | ✓ VERIFIED | `src/app/(app)/page.tsx` lines 56-64: Promise.all wrapped in try/catch; fetch failure renders fixed copy never interpolating error.message (T-08-01 mitigated). Lines 89-106: not-configured state renders 08-UI-SPEC.md copy pattern. Lines 112-114, 115-119: Suspense boundaries with SkeletonLoader fallbacks structurally satisfy loading-state coverage. |
| 5 | **UI-02 (money/date formatting):** Every money amount uses tabular-nums formatting consistently. | ✓ VERIFIED | `src/app/globals.css` line 91-93: `.tabular-nums { font-variant-numeric: tabular-nums; }` utility class declared. `src/components/next-payment-card.tsx`, `src/components/annual-pie-chart.tsx`, `src/app/(app)/bonuses/bonus-row.tsx`, `src/app/(app)/vacations/vacation-row.tsx`, and `src/components/pay-setup-forms.tsx` all apply `tabular-nums` class to formatKopecks() and formatIsoDateRu() output. |
| 6 | **UI-07 (accessibility, home-screen slice):** Interactive elements carry visible focus indicators. | ✓ VERIFIED | All restyled links/buttons carry `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]` or destructive variant. `next-payment-card.tsx`, `sign-out-button.tsx`, `install-banner.tsx`, error-boundary retry button all have focus rings. Per-file audit across all 14 modified files shows zero uncovered interactive elements. |
| 7 | **UI-01 (bonuses/vacations screens):** Empty/loading states render instead of blank screens. Lists show SkeletonLoader on load. | ✓ VERIFIED | `src/app/(app)/bonuses/page.tsx` lines 51-54: BonusListContent wrapped in `<Suspense fallback={<SkeletonLoader count={3} variant="bonus-row" />}>`. Empty-state copy changed to "Пока нет бонусов" per 08-UI-SPEC.md pattern (lines 28-36). `src/app/(app)/vacations/page.tsx` mirrors identical pattern (lines 48-56, "Пока нет отпусков"). |
| 8 | **UI-03 (confirmation dialogs):** Destructive actions show before/after confirmation without a new modal. | ✓ VERIFIED | `src/components/pay-setup-forms.tsx` lines 158-174: SalaryForm's `pendingConfirmation` panel renders struck-through old value in text-secondary, new value conditional-accent (line 167: `${submittedAmountRubles > existingAmountRubles ? "text-[color:var(--color-accent)]" : ...}`), both with tabular-nums. Confirm button uses accent-filled style. Inline panel pattern (not a new modal) unchanged per 08-CONTEXT.md. Window.confirm() delete flows in bonus-row.tsx and vacation-row.tsx are byte-for-byte unchanged. |
| 9 | **UI-01 (login/register/settings screens):** Error states render without raw exception text. | ✓ VERIFIED | `src/app/(auth)/login/page.tsx` line 41: hardcoded "Неверный email или пароль" (Phase 6's SEC-02 fix, unchanged). `src/app/(auth)/register/page.tsx` line 32: error message rendered with token-driven color only, never mutated from the catch logic. `src/app/(app)/settings/salary/page.tsx` and `src/app/(app)/onboarding/page.tsx` both restyled, all form errors use `text-[color:var(--color-destructive)]` without interpolating caught errors. |
| 10 | **KNOWN GAP - UI-01 (home page, annual chart zero-income empty state):** A zero-income year renders distinct empty-state variant, never a degenerate 0%/0% pie slice. | ✗ FAILED | `src/components/annual-pie-chart.tsx` lines 36-39: data array unconditionally populated from grossKopecks/taxKopecks/netKopecks with no zero-gross branch. When `computeAnnualSummary` returns `configured: true` with `grossKopecks === 0` (e.g., salary effective-dated in future or zero events accrued in current year), lines 56-62 render a two-slice Recharts PieChart with both slices at 0%, visually presenting a degenerate state as if it were real data. 08-UI-SPEC.md § UI Considerations row "empty \| annual-summary-chart (media) \| 🧪 backstop" explicitly required this variant; the gap is confirmed by 08-06-SUMMARY.md's structural code review. **BLOCKER for phase goal achievement.** |

**Score:** 9/10 observable truths verified; 1 BLOCKER gap (annual chart zero-income empty state)

**Note:** Truth #10 above is the annual-summary-chart zero-income empty-state requirement from 08-UI-SPEC.md's backstop items. Truths #1-9 correspond to the 9 phase requirements (UI-01 through UI-07, PWA-01, PWA-02) distributed across the phase's screens. The phase goal itself ("consistent, accessible, dark-mode aware, safe on notched iPhones, zero calculation change") is substantially achieved except for the UI-01 requirement's coverage of this specific empty-state variant.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/globals.css` | Complete design-token system (dark-base/light-override) | ✓ VERIFIED | 7 color tokens, 5 typographic roles, 7 spacing tokens, 3 font-family stacks; `:root` dark, `@media (prefers-color-scheme: light)` color override; `.tabular-nums` and `.skeleton-pulse` utilities present |
| `src/app/layout.tsx` | `viewport.viewportFit: "cover"` confirmed; themeColor updated to #1a1a1a | ✓ VERIFIED | Unchanged from Phase 4 confirmation; themeColor aligned to new --color-dominant |
| `src/app/manifest.ts` | theme_color/background_color updated to #1a1a1a | ✓ VERIFIED | Both values match --color-dominant hex |
| `src/app/(app)/layout.tsx` | Persistent nav header with one-tap home link and safe-area insets | ✓ VERIFIED | Header: Link href="/", env(safe-area-inset-top) padding. Main: env(safe-area-inset-bottom) padding |
| `src/app/(app)/page.tsx` | Suspense-wrapped loading skeletons, caught-fetch-failure error state | ✓ VERIFIED | Promise.all + try/catch, two Suspense boundaries with SkeletonLoader fallbacks |
| `src/components/next-payment-card.tsx` | Hero amount in Display role Georgia serif, accent color, tabular-nums | ✓ VERIFIED | Lines 66-68: font-family-display, font-size-display, color-accent, tabular-nums applied |
| `src/components/skeleton-loader.tsx` | New reusable component with 4 variants, skeleton-pulse class | ✓ VERIFIED | Created in Task 1 (deviation from plan, Rule 3 blocking-issue fix); 4 variants (bonus-row, vacation-row, payment-card, chart) all present |
| `src/components/annual-pie-chart.tsx` | Card pattern restyle, tabular-nums on money/percent, chart colors unchanged | ✓ VERIFIED | Secondary-surface card pattern applied, tabular-nums applied, TAX_COLOR/NET_COLOR hardcoded values unchanged |
| `src/app/(app)/bonuses/bonus-row.tsx`, `bonus-form.tsx`, `page.tsx` | Token-driven restyle, Suspense-wrapped list, empty-state copy updated | ✓ VERIFIED | All files restyled to token system; "Пока нет бонусов" empty-state copy updated; Suspense + SkeletonLoader on list |
| `src/app/(app)/vacations/vacation-row.tsx`, `vacation-form.tsx`, `page.tsx` | Token-driven restyle, 5-span grid structure unchanged, Suspense-wrapped list | ✓ VERIFIED | All files restyled; display-mode 5-span grid preserved for e2e/vacation.spec.ts positional selectors; Suspense + SkeletonLoader |
| `src/components/pay-setup-forms.tsx` | SalaryForm confirmation panel struck-through old + conditional-accent new, all forms token-driven | ✓ VERIFIED | Confirmation panel pattern implemented (lines 158-174); conditional accent on salary increase (line 167) |
| `src/app/(app)/settings/salary/page.tsx`, `src/app/(app)/onboarding/page.tsx` | Token-driven restyle, tabular-nums on salary history list | ✓ VERIFIED | Both pages restyled with token system; salary history uses tabular-nums |
| `src/app/(auth)/login/page.tsx`, `register/page.tsx` | Token-driven restyle, SEC-02 hardcoded error unchanged, focus-visible on all inputs | ✓ VERIFIED | Forms fully restyled; SEC-02 hardcoded message unchanged (line 41 in login); all inputs have focus-visible outlines |
| `src/components/annual-pie-chart.tsx` | **ZERO-INCOME EMPTY STATE** | ✗ MISSING | No `if (grossKopecks === 0)` branch; component always renders pie chart regardless of income level |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `globals.css` token declarations | All Wave-2+ screens | Arbitrary-value Tailwind `bg-[color:var(--color-*)]` classes | ✓ WIRED | Every screen depends on token names compiling; no other plan has its own color definitions that would conflict |
| `(app)/layout.tsx` persistent header | Every (app)-route screen | Header rendered in layout, inherited by all children | ✓ WIRED | One-tap-home link present on home, bonuses, vacations, settings, onboarding screens |
| Safe-area inset CSS | iPhone notch/Dynamic Island | `env(safe-area-inset-top)` / `env(safe-area-inset-bottom)` in inline styles | ✓ WIRED | Mechanism is standard CSS, resolves on all WebKit engines; single source of truth in (app)/layout.tsx |
| `bonus-row.tsx` window.confirm() | e2e/bonus.spec.ts Playwright dialog handler | Native browser confirm(), unchanged message text | ✓ WIRED | Deletion flow exercised in e2e/bonus.spec.ts with pass result (full Playwright suite passes) |
| `vacation-row.tsx` 5-span grid structure | e2e/vacation.spec.ts positional selectors (`.nth(2)`, `.nth(3)`) | Exact `<span>` count and order preserved | ✓ WIRED | e2e/vacation.spec.ts exercises the grid and passes with full suite |
| Annual pie chart zero-income case | (app)/page.tsx caller | No wiring; gap detected | ✗ NOT WIRED | Caller (page.tsx lines 115-119) checks `annualResult.configured` but does not guard against zero gross; callee (annual-pie-chart.tsx) has no zero-income branch |

### Data-Flow Trace (Level 4)

| Component | Data Variable | Source | Produces Real Data | Status |
|-----------|---------------|--------|-------------------|--------|
| next-payment-card | forecast.netKopecks (hero amount) | `forecastNextPayment` server action | ✓ Real DB query | ✓ FLOWING |
| annual-pie-chart | summary.grossKopecks | `computeAnnualSummary` server action | ✓ Real DB query (aggregates salary/bonus/vacation) | ✓ FLOWING |
| bonus-row | bonus.amount | listBonuses DB query in BonusListContent | ✓ Real DB rows | ✓ FLOWING |
| vacation-row | vacation dates, grossAmount | listVacations + computeVacationPayGross | ✓ Real DB rows, calculated | ✓ FLOWING |
| pay-setup-forms | SalaryForm.existingAmountRubles | Display from saveSalaryAction's pendingConfirmation state | ✓ Real from user's previous salary | ✓ FLOWING |

All flowing data originates from real server actions or DB queries; no hardcoded stubs in rendered output.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full unit test suite | `npm test` | 370 passed, 2 skipped | ✓ PASS |
| Production build | `npm run build` | Exits 0, 13 routes generated | ✓ PASS |
| Full E2E suite (all 5 specs) | `npm run test:e2e` | 13/13 tests passed against live dev server + real Neon DB | ✓ PASS |
| TypeScript no-emit check | `npx tsc --noEmit` | Zero errors | ✓ PASS |
| Zero calculation-logic drift | `git diff --stat $(git merge-base HEAD main) -- src/domain/ src/lib/db/` | Empty output | ✓ PASS |
| Token system compiles | Arbitrary-value Tailwind classes in arbitrary values | `npm run build` succeeds (verified above) | ✓ PASS |
| Dark/light color coverage | `grep -rn 'zinc-\|amber-\|slate-\|gray-\|neutral-' src/app src/components` | Zero matches (excluding Recharts intentional fill constants) | ✓ PASS |

### Probe Execution

No probes defined for this phase (verification-only phase 08-06 ran the full automated regression; earlier phases 08-01..08-05 executed per-plan tasks with their own verification commands).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| UI-01 | 08-01, 08-02, 08-03, 08-04, 08-05 | Users see clear empty/loading/error states on home, bonuses, vacations, forms, login/register screens | ✓ SATISFIED (8/9) | All screens render appropriate states EXCEPT annual chart zero-income case (BLOCKER gap) |
| UI-02 | 08-01, 08-02, 08-03, 08-04 | All money amounts formatted identically with tabular figures | ✓ SATISFIED | .tabular-nums utility applied to all formatKopecks() and related money output across all screens |
| UI-03 | 08-04 | Destructive actions show before/after confirmation | ✓ SATISFIED | SalaryForm's pendingConfirmation panel, window.confirm() for bonus/vacation deletes, all with correct copy |
| UI-04 | 08-01 | One-tap home nav from any screen | ✓ SATISFIED | Persistent header Link href="/" on every (app) screen |
| UI-05 | 08-01, 08-02, 08-03, 08-04, 08-05 | Visual design system (typography, color, spacing, components) | ✓ SATISFIED | Complete dark-base/light-override token system in globals.css; all screens use token-driven arbitrary values; zero raw Tailwind color utilities remain |
| UI-06 | 08-01, 08-02, 08-03, 08-04, 08-05 | Dark mode support via system preference | ✓ SATISFIED | `@media (prefers-color-scheme: light)` override in globals.css; no JS state needed; mechanism is standard CSS |
| UI-07 | 08-01, 08-02, 08-03, 08-04, 08-05 | Accessibility basics (contrast, focus indicators, labeled inputs) | ✓ SATISFIED | All text pairs verified ≥4.5:1 body / ≥3:1 large text; every interactive element has focus-visible:outline-2 with offset; all form inputs carry `<label>` or `aria-label` |
| PWA-01 | 08-01 | Safe-area insets prevent content overlap with Dynamic Island | ✓ SATISFIED | `env(safe-area-inset-top)` on header, `env(safe-area-inset-bottom)` on main; single source of truth; mechanism applies correctly on WebKit |
| PWA-02 | 08-01 | Viewport configured with viewport-fit=cover | ✓ SATISFIED | Confirmed present and unchanged from Phase 4 in src/app/layout.tsx |

**Orphaned Requirements:** None. All phase requirements (UI-01 through UI-07, PWA-01, PWA-02) are mapped to one or more executing plans (08-01 through 08-05); 08-06 is verification-only.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/components/annual-pie-chart.tsx | 33-86 | No `if (grossKopecks === 0)` empty-state branch before rendering PieChart | 🛑 BLOCKER | Users with zero income see a meaningless 0%/0% pie chart instead of a clear empty-state message (UI-01 backstop #1 gap) |
| None | - | All other files scanned clean (no TBD/FIXME/XXX without issue references, no hardcoded empty returns, no placeholder copy) | - | Phase goal achievement not impacted by any other anti-pattern |

### Threat Model Verification

| Threat ID | Category | Status | Mitigation Verified |
|-----------|----------|--------|---------------------|
| T-08-01 | Information Disclosure (error-copy interpolation) | ✓ RESOLVED | `src/app/(app)/page.tsx` catch block (line 62) discards error entirely; fetch-error copy is fixed string never interpolated |
| T-08-02 | Tampering (calculation-logic drift) | ✓ RESOLVED | `git diff --stat` confirms zero changes to src/domain/ and src/lib/db/ whole-phase |
| T-08-03 | Denial of Service (accessibility regression) | ✓ RESOLVED | Every interactive element in touched files carries `focus-visible:outline-2` treatment; zero uncovered buttons/inputs/links found in audit |
| T-08-04 | Information Disclosure (contrast violation) | ✓ RESOLVED | Only pre-verified 08-UI-SPEC.md § Color hex pairs used; no ad-hoc color substitution |
| T-08-05 through T-08-16 | Various (bonus/vacation/form/auth flows) | ✓ RESOLVED | All window.confirm() deletes, form IDs, edit-mode input types, and SEC-02 hardcoded errors remain byte-for-byte unchanged; verified by e2e/bonus.spec.ts, e2e/vacation.spec.ts, e2e/auth.spec.ts pass results |
| T-08-17 | Tampering (whole-phase drift) | ✓ RESOLVED | Confirmed whole-phase via git diff --stat and e2e full-suite pass |

## Summary of Gaps

**1 BLOCKER Gap Identified:**

### Gap: Annual Chart Zero-Income Empty State (UI-01 / UI-SPEC Backstop #1)

**Truth:** UI-01 requires that "The app shows clear empty/loading/error states instead of blank screens or technical errors" — specifically, an annual-summary-chart rendering zero gross income must show a distinct empty-state variant, not a degenerate 0%/0% pie slice.

**Finding:** `src/components/annual-pie-chart.tsx` (lines 33-86) unconditionally renders a Recharts PieChart from whatever summary values it receives. When `computeAnnualSummary` returns `configured: true` with `grossKopecks: 0, taxKopecks: 0, netKopecks: 0` (legitimate case: salary configured but not yet effective, or zero events accrued in the current year, or fresh account before first payment), the component renders a two-slice 0%/0% pie as if it were real data.

**Evidence:**
- 08-06-SUMMARY.md § T2-backstop1 explicitly flags this as structurally FAILED
- STATE.md Blockers/Concerns documents the finding after 08-06's structural review
- Confirmation via direct source read: annual-pie-chart.tsx has zero branches for zero-gross case

**Impact on Phase Goal:** The phase goal requires "The app looks and feels like a finished product... with zero change to any calculation logic." This gap prevents the app from looking finished in the annual-summary card when a user has configured salary but not yet accrued income—a genuine edge case, not a hypothetical one. The gap violates the explicit UI-01 requirement for clear empty-state presentation.

**Status:** BLOCKER. Phase goal is not fully achieved until this gap is closed.

**Remediation:** Design and implement an empty-state variant on `annual-pie-chart.tsx` or its caller in `src/app/(app)/page.tsx` to render 08-UI-SPEC.md's empty-state pattern when `summary.grossKopecks === 0`. Exact copy/layout for this specific case requires a UI decision (the spec provides the pattern, not the specific copy for "zero annual income").

## Overall Assessment

**Status:** `gaps_found`

**Reasoning:** The phase produced a fully restyled, token-driven, accessible, dark-mode-aware application with zero calculation-logic drift and correct safe-area CSS wiring. Automated regression (unit suite, build, full E2E suite) is green. 8 of 9 observable requirements are fully satisfied. However, 1 BLOCKER gap exists: the annual-summary-chart does not handle the zero-income empty-state case as explicitly required by UI-01 and 08-UI-SPEC.md § UI Considerations backstop #1. This gap prevents phase closure until remediated.

**Deferred to Next Phase:** Annual chart zero-income empty-state implementation (requires gap-closure plan after phase verification).

**No human-verification items beyond the gap listed above:** PWA-01/02 safe-area, UI-06 dark/light toggle, and UI-07 keyboard focus-ring were structurally confirmed correct by 08-06's code review; live device/visual confirmation is complete per STATE.md end-of-phase note (orchestrator completed live-browser pass). Both UI-SPEC backstop items were assessed: #2 (nav header overflow at 375px) passed structurally; #1 (annual chart zero-income) failed structurally and is the BLOCKER gap.

---

*Verified: 2026-09-03*
*Verifier: Claude (gsd-verifier)*
