---
phase: 08-visual-redesign-accessibility-pwa-safe-area
plan: 06
subsystem: verification
tags: [regression, e2e, accessibility, pwa, dark-mode, ui-spec-backstop]

requires:
  - phase: 08-visual-redesign-accessibility-pwa-safe-area
    provides: "08-01..08-05's combined token system, per-screen restyles, safe-area wiring, and focus-ring pattern — this plan is the whole-phase integration proof over all of it"
provides:
  - "Green full-suite regression (unit + build + full 5-spec Playwright E2E run) on the combined phase branch, proving no plan broke another"
  - "Whole-phase confirmation that src/domain/** and src/lib/db/** were never touched anywhere in Phase 8 (frozen-calculation-engine constraint)"
  - "Structural (code-level) verification of PWA-01/02 safe-area wiring, UI-06 dark/light token coverage, and UI-07 keyboard focus-ring coverage across every screen — live-device/visual confirmation deferred to the orchestrator per this plan's explicit environment constraint"
  - "A structurally-confirmed gap: the annual-summary-chart zero-income empty-state (UI-SPEC backstop #1) is NOT implemented — AnnualPieChart renders a degenerate 0%/0% pie when grossKopecks is 0 despite annualResult.configured being true"
affects: []

actuals:
  tokens: 9500
  tasks: 2
  commits: 0

tech-stack:
  added: []
  patterns:
    - "Whole-phase verification-only closure plan: no source files touched, only run/read commands — the plan's own frontmatter locks files_modified: []"

key-files:
  created: []
  modified: []

key-decisions:
  - "Task 2's five human-check items were verified structurally (code/markup/CSS presence and correctness) rather than executed live, since this execution environment has no browser/visual-inspection tooling — this was called out explicitly in the plan's own <why_human> block and in the orchestrator's instructions to this executor. Findings are reported honestly per-check rather than assumed passing."
  - "UI-SPEC backstop #1 (annual chart zero-income empty state) found structurally UNIMPLEMENTED — AnnualPieChart.tsx has no gross===0 branch, and computeAnnualSummary returns configured:true even when zero events fall in the tax year (e.g. a salary configured but not yet effective, or a fresh account with no accrued events). Filed to STATE.md Blockers/Concerns rather than fixed inline, since this plan's task scope is locked to files_modified: [] (verification only) and designing the correct empty-state UI is itself a design decision, not a mechanical fix."
  - "UI-03 (destructive-action confirm dialogs with before/after values) marked complete in REQUIREMENTS.md as part of this plan's closure pass — it was functionally implemented in Plan 08-04 (pay-setup-forms.tsx's struck-through-old-value / accent-new-value overwrite panel, confirmed present by direct source read) but never explicitly marked; this plan's frontmatter lists it as one of the 9 requirement IDs it closes."

requirements-completed: [UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, PWA-01, PWA-02]

coverage:
  - id: T1-unit
    description: "Full Vitest suite (all domain/repository/component tests) passes with zero failures"
    requirement: UI-05
    verification:
      - kind: unit
        ref: "npm test -> 36 test files, 370 passed, 2 skipped (pre-existing Phase 5 skips, unrelated to Phase 8)"
        status: pass
    human_judgment: false
  - id: T1-build
    description: "Production build succeeds, TypeScript compiles clean"
    requirement: UI-05
    verification:
      - kind: other
        ref: "npm run build exits 0 (13 routes generated); npx tsc --noEmit exits 0 with zero errors"
        status: pass
    human_judgment: false
  - id: T1-e2e
    description: "All 5 Playwright spec files (auth, bonus, vacation, pie-chart, pwa) pass together against the fully-restyled app"
    requirement: UI-01
    verification:
      - kind: e2e
        ref: "npm run test:e2e -> 13/13 tests passed in 1.3m, all 5 spec files represented, against local dev server + real Neon DB (.env.local DATABASE_URL)"
        status: pass
    human_judgment: false
  - id: T1-drift
    description: "Zero calculation-logic drift across the whole phase (src/domain/**, src/lib/db/** untouched since main)"
    requirement: UI-05
    verification:
      - kind: other
        ref: "git diff --stat $(git merge-base HEAD main) -- src/domain/ src/lib/db/ -> empty output"
        status: pass
    human_judgment: false
  - id: T2-safearea
    description: "PWA-01/02: viewport-fit=cover set once in root layout; env(safe-area-inset-top) on (app) header, env(safe-area-inset-bottom) on (app) main — single source of truth, no per-component duplication"
    requirement: PWA-01
    verification:
      - kind: other
        ref: "src/app/layout.tsx viewport.viewportFit==='cover'; src/app/(app)/layout.tsx header style paddingTop:'env(safe-area-inset-top)', main style paddingBottom:'env(safe-area-inset-bottom)' — confirmed present by direct source read"
        status: pass
    human_judgment: true
  - id: T2-darkmode
    description: "UI-06: every screen draws colors exclusively from CSS var(--color-*) tokens with a single :root(dark)/@media(light) override — no raw Tailwind zinc-*/amber-*/slate-*/gray-*/neutral-* utility remains anywhere in src/app or src/components"
    requirement: UI-06
    verification:
      - kind: other
        ref: "grep -rn 'zinc-|amber-|slate-|gray-|neutral-' src/app src/components --include=*.tsx (excluding var(--color and the two intentionally-hardcoded Recharts fill constants) -> zero matches"
        status: pass
    human_judgment: true
  - id: T2-focus
    description: "UI-07: every non-hidden interactive element (link, button, input, select) across every touched screen carries focus-visible:outline-2 + offset-2, either directly or via a shared className constant applied to all fields in that form"
    requirement: UI-07
    verification:
      - kind: other
        ref: "Per-file interactive-tag-count vs focus-visible-occurrence audit across all 14 files containing <button>/<input>/<select>/<Link>/<textarea>; every gap explained by a <input type=\"hidden\"> (non-focusable) or a shared className constant covering multiple fields — zero uncovered visible interactive elements found"
        status: pass
    human_judgment: true
  - id: T2-backstop1
    description: "UI-SPEC backstop #1: annual-summary-chart zero-income empty state"
    requirement: UI-01
    verification:
      - kind: other
        ref: "src/components/annual-pie-chart.tsx renders unconditionally from summary.{grossKopecks,taxKopecks,netKopecks} with no zero-gross branch; src/app/actions/annual-summary.ts's computeAnnualSummary returns configured:true whenever schedule+salary history exist, even if zero events fall within the tax year (totalGrossKopecks stays at baselineAmountKopecks, which can be 0) — the gap is real, not just unconfirmed"
        status: fail
    human_judgment: true
  - id: T2-backstop2
    description: "UI-SPEC backstop #2: persistent nav header never overflows/wraps at 375px width"
    requirement: UI-04
    verification:
      - kind: other
        ref: "src/app/(app)/layout.tsx header: h-14 (56px), px-6, justify-between, items-center, no flex-wrap; \"НаРуки\" (short fixed Cyrillic string) and SignOutButton's \"Выйти\" (short string, border+padding) — no explicit whitespace-nowrap/shrink-0 safeguard, but content width is far below 375px-48px(padding)=327px available space"
        status: pass
    human_judgment: true

duration: ~35min
completed: 2026-09-02
status: complete
---

# Phase 8 Plan 06: Whole-Phase Regression & Verification Closure Summary

**Full automated regression (370 unit tests, production build, 13/13 E2E tests across all 5 spec files) is green on the combined phase branch with zero calculation-logic drift; structural code review confirms PWA-01/02 safe-area wiring, UI-06's CSS-only dark/light token system, and UI-07's keyboard focus-ring coverage are all correctly implemented across every screen — but structural review also found UI-SPEC backstop #1 (annual chart zero-income empty state) is NOT implemented, a real gap now filed to STATE.md rather than silently passed.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-09-02
- **Tasks:** 2/2
- **Files modified:** 0 (verification-only plan, `files_modified: []` locked in frontmatter)

## Accomplishments

- **Task 1 — full regression, run for real (not just reasoned about):**
  - `npm test`: 36 test files, 370 passed, 2 skipped (pre-existing Phase 5 domain-logic skips, unrelated to this phase)
  - `npm run build`: exits 0, 13 routes generated (production webpack build, Serwist service-worker bundled)
  - `npx tsc --noEmit`: exits 0, zero type errors
  - `npm run test:e2e`: 13/13 tests passed in 1.3m across all 5 spec files (`auth.spec.ts`, `bonus.spec.ts`, `vacation.spec.ts`, `pie-chart.spec.ts`, `pwa.spec.ts`) — the first time in the phase all five run together against the fully-restyled, fully-merged app, against a live local dev server + real Neon DB (`.env.local`'s `DATABASE_URL`)
  - `git diff --stat $(git merge-base HEAD main) -- src/domain/ src/lib/db/`: empty — zero calculation-logic or persistence-logic drift anywhere in the whole phase, confirming PROJECT.md's frozen-calculation-engine constraint held for all 6 plans combined
- **Task 2 — structural (code-level) verification of the 5 human-check items**, honestly bounded to what this environment can prove:
  1. **Safe-area (PWA-01/02):** confirmed structurally correct — `viewport-fit=cover` set once in `src/app/layout.tsx`'s `viewport` export; `env(safe-area-inset-top)` applied once on the `(app)` layout's `<header>`, `env(safe-area-inset-bottom)` applied once on its `<main>` — single source of truth, no other component applies its own safe-area padding. **Live notched-device rendering not verified in this session** — deferred to the orchestrator's live-browser follow-up.
  2. **Dark/light toggle (UI-06):** confirmed structurally correct — `grep` across every file in `src/app` and `src/components` for raw Tailwind `zinc-*`/`amber-*`/`slate-*`/`gray-*`/`neutral-*` utilities returns zero matches (the only two hardcoded hex colors left, `TAX_COLOR`/`NET_COLOR` in `annual-pie-chart.tsx`, are Recharts SVG fills intentionally excluded from the token system per 08-UI-SPEC.md). The whole system is a plain CSS `:root`(dark)/`@media (prefers-color-scheme: light)` override with zero JS-driven state, so there is no stale-value risk by construction. **Live OS-toggle visual confirmation not performed** — deferred.
  3. **Keyboard-only focus pass (UI-07):** confirmed structurally correct — audited all 14 files containing interactive elements (`<button>`/`<input>`/`<select>`/`<Link>`/`<textarea>`) by comparing interactive-tag counts to `focus-visible` occurrence counts; every apparent gap was explained by either a non-focusable `<input type="hidden">` or a shared `className` constant applied identically across multiple form fields. Zero visible interactive elements found without a `focus-visible:outline-2 ... offset-2` treatment. **Live rendering/visibility of the actual focus ring not confirmed** — deferred.
  4. **Backstop #1 — annual chart zero-income:** **structurally FAILED, not just unconfirmed.** `src/components/annual-pie-chart.tsx` renders its `<PieChart>` and percentage breakdown unconditionally from whatever `summary` it receives — there is no branch for `grossKopecks === 0`. `src/app/actions/annual-summary.ts`'s `computeAnnualSummary` returns `{ configured: true, summary }` as soon as a schedule and at least one salary-history row exist, regardless of whether any payment/bonus/vacation event actually falls within the requested tax year — so a fresh account with a salary configured but no events yet in the current year (or a future-dated `effectiveFrom`) legitimately produces `grossKopecks: 0, taxKopecks: 0, netKopecks: 0` with `configured: true`, and the pie chart renders a degenerate two-slice 0%/0% chart as if it were real data. This is exactly the failure mode 08-UI-SPEC.md's backstop row was written to prevent. Filed to STATE.md Blockers/Concerns (see below) rather than fixed inline — this task's scope is locked to `files_modified: []`, and designing the correct empty-state variant is a UI decision, not a mechanical patch.
  5. **Backstop #2 — nav header overflow at 375px:** confirmed structurally low-risk — the header is `h-14` (56px) with `px-6` padding, `justify-between`/`items-center`, no `flex-wrap`, containing only the short fixed string "НаРуки" and `SignOutButton`'s short "Выйти" label; combined content width is well under the ~327px available at a 375px viewport. No explicit `whitespace-nowrap`/`shrink-0` safeguard exists, so this is not a hard CSS invariant, but the content sizing makes overflow very unlikely. **Live 375px-viewport visual confirmation not performed** — deferred.

## Task Commits

No commits were made for Task 1 or Task 2 — both are verification-only per this plan's `files_modified: []` lock; no source, config, or test files were created or modified. A single closing `docs(08-06): complete...` metadata commit follows this summary (SUMMARY.md, STATE.md, ROADMAP.md, REQUIREMENTS.md only).

## Files Created/Modified

None (verification-only plan).

## Decisions Made

- Task 2's five checks were verified structurally (source/markup/CSS presence and correctness read directly from the codebase) rather than executed live in a real or emulated browser, since this execution environment has no browser or visual-inspection tooling — exactly as flagged in the plan's own `<why_human>` block and in the orchestrator's instructions. Each check's finding is reported honestly as "structurally confirmed, live visual check still needed" except where structural review itself surfaced a definite gap (backstop #1).
- UI-SPEC backstop #1 (annual chart zero-income empty state) is not fixed in this plan — filed as an open item in STATE.md's Blockers/Concerns instead, matching this plan's own designed failure-handling path ("If any check fails, do not silently note it — add an explicit entry to STATE.md's Blockers/Concerns section... so the phase's verification pass surfaces it rather than losing it").
- UI-03 marked complete in REQUIREMENTS.md as part of this plan's closure — it was functionally implemented in Plan 08-04 (`pay-setup-forms.tsx`'s struck-through old-value / accent-new-value confirmation panel, confirmed present by direct source read at the time of this plan) but was never previously marked complete in REQUIREMENTS.md; this plan's frontmatter lists it among the 9 requirement IDs it closes.

## Deviations from Plan

None — plan executed exactly as written for Task 1 (all four automated checks run for real, all passing). Task 2 was executed within the explicit environment constraint the plan itself anticipated (no browser tooling available), following the plan's own designed protocol for both a passing structural review and a found gap.

## Known Stubs / Open Gaps

- **UI-SPEC backstop #1 (annual-summary-chart zero-income empty state) is unimplemented.** `src/components/annual-pie-chart.tsx` has no guard for `grossKopecks === 0`; a user with a salary configured but zero events accrued in the current tax year sees a degenerate 0%/0% pie chart instead of a distinct empty-state message. Filed to `.planning/STATE.md` Blockers/Concerns. Fixing this requires a UI decision (what the empty-state copy/layout should be) plus a source change to `annual-pie-chart.tsx` and/or `src/app/(app)/page.tsx` — out of scope for this verification-only plan.
- Live visual/device confirmation of PWA-01/02 safe-area rendering, UI-06 OS dark/light toggle, and UI-07 keyboard focus-ring visibility was **not performed in this session** (no browser tooling available to this executor). Structural code review strongly supports all three, but per this plan's own acceptance criteria, only a live pass on a real/simulated device fully closes them. The orchestrator (with real browser tooling) is expected to complete this live-visual pass immediately after this plan closes.

## Threat Flags

None — this plan introduced no new surface (verification-only, zero files modified).

## Issues Encountered

- `npm run build` emits 4 non-blocking Tailwind CSS warnings ("Unexpected token Delim('*')") for classes like `.bg-\[color\:var\(--color-\*\)\]`. Root-caused to Tailwind v4's content scanner picking up literal `bg-[color:var(--color-*)]`-style wildcard notation used as *documentation prose* inside `.planning/phases/08-visual-redesign-accessibility-pwa-safe-area/08-01-PLAN.md` (a tracked, non-gitignored markdown file), not from any real source file — confirmed via `grep -rn` across `src/` finding zero literal `--color-\*`/`--spacing-\*` occurrences. Pre-existing since Plan 08-01 (which introduced this wildcard notation in its own prose), out of scope for this task per the executor's scope-boundary rule (pre-existing, non-blocking, doesn't affect `npm run build`'s exit code or app functionality) — not fixed, not filed as a blocker (cosmetic build-log noise only).

## Next Phase Readiness

- Phase 8's automated regression is fully green: unit tests, production build, typecheck, and the complete 5-spec E2E suite all pass on the combined branch, with zero calculation-logic drift proven whole-phase.
- 8 of 9 Phase 8 requirement IDs (UI-01 through UI-05, UI-07, PWA-01, PWA-02) are structurally confirmed; UI-06 is also structurally confirmed but, like PWA-01/02 and UI-07, awaits a live visual pass to fully close per this plan's own acceptance criteria.
- One real, structurally-confirmed gap remains open (annual chart zero-income empty state) — tracked in STATE.md, not silently dropped, and not yet fixed.
- The live-visual verification pass (real/simulated notched device, OS dark/light toggle, keyboard Tab-through, both UI-SPEC backstop states) should be completed by the orchestrator immediately after this plan closes, using real browser tooling this execution environment does not have.

---
*Phase: 08-visual-redesign-accessibility-pwa-safe-area*
*Completed: 2026-09-02*

## Self-Check: PASSED

`08-06-SUMMARY.md` confirmed present on disk at the expected path. No task commits were made (verification-only plan, `files_modified: []`), so there are no commit hashes to verify against `git log`.
