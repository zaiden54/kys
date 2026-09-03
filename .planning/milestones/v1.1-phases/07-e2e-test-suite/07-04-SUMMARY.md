---
phase: 07-e2e-test-suite
plan: 04
subsystem: testing
tags: [playwright, e2e, recharts, pwa, manifest, next.js]

requires:
  - phase: 07-e2e-test-suite
    provides: "Plan 07-01's playwright.config.ts (authenticated project + storageState), e2e/fixtures.ts, and production webServer so Serwist's service worker actually registers"
provides:
  - "e2e/pie-chart.spec.ts: seeds bonus+vacation via real UI, independently re-derives gross=tax+net from rendered <dl> figures, proving the annual pie chart's two-slice invariant"
  - "e2e/pwa.spec.ts: /manifest.webmanifest field verification + InstallBanner visibility/localStorage-dismissal-persistence coverage"
affects: [07-05-ci-isolation]

actuals:
  tokens: 1821
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Parsing a Recharts-adjacent <dl> figure back into a number: split on the ' · ' separator BEFORE stripping non-digit characters, since the sibling percent figure (e.g. '13,0%') also contains digits that would otherwise concatenate into the parsed ruble amount"
    - "CSS `dt:text-is('Label') + dd` locator pattern to scope an exact-text <dt> to its immediately-following <dd> sibling inside a <dl>, avoiding ambiguity with identical label text appearing elsewhere on the page (e.g. a standalone <p><span>Грязными</span></p> outside the <dl>)"

key-files:
  created:
    - e2e/pie-chart.spec.ts
    - e2e/pwa.spec.ts
  modified: []

key-decisions:
  - "Bonus dated 'today' and vacation dated +14/+17 days out — both fall within the current tax year and use a distinct, non-overlapping date range from Plan 07-03's vacation.spec.ts ranges (+30/+34, +60/+63 days), since all authenticated-project spec files share the same fixture user/session"
  - "Skipped the optional SVG structural check (page.locator('svg path.recharts-sector')) the plan's <read_first> flagged as 'if a structural check is wanted' — the rendered-DOM-text invariant (gross = tax + net) is the plan's actual acceptance criterion and doesn't depend on unstable Recharts internal class names"

patterns-established:
  - "e2e specs that read formatKopecks()-rendered figures from a shared <dl>/percent layout must split on the separator before stripping non-digit characters, not just regex-strip the whole cell text"

requirements-completed: [E2E-04]

coverage:
  - id: D1
    description: "A Playwright test navigates to the home screen after the authenticated fixture user has salary/bonus/vacation data and confirms the annual pie chart renders exactly two Recharts slices (Налог, На руки) with visible ruble/percent figures"
    requirement: "E2E-04"
    verification:
      - kind: e2e
        ref: "e2e/pie-chart.spec.ts#renders the annual pie chart with matching gross/tax/net figures"
        status: pass
    human_judgment: false
  - id: D2
    description: "A Playwright test fetches /manifest.webmanifest directly and confirms its JSON contains name/short_name, start_url '/', display 'standalone', and at least a 192x192 and a 512x512 icon entry"
    requirement: "E2E-04"
    verification:
      - kind: e2e
        ref: "e2e/pwa.spec.ts#manifest.webmanifest is served with the correct installability metadata"
        status: pass
    human_judgment: false
  - id: D3
    description: "A Playwright test confirms the InstallBanner is visible on first load and that dismissing it hides it and the dismissal persists across a reload"
    requirement: "E2E-04"
    verification:
      - kind: e2e
        ref: "e2e/pwa.spec.ts#install banner is visible and dismissal persists across reload"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-02
status: complete
---

# Phase 07 Plan 04: Pie-Chart Data Verification & PWA Installability Summary

**Playwright E2E coverage proving the annual pie chart's gross=tax+net invariant against real seeded bonus/vacation data, plus the served manifest.webmanifest and InstallBanner's localStorage-backed dismissal persistence.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-02T10:52:00+03:00 (approx)
- **Completed:** 2026-09-02T11:02:00+03:00
- **Tasks:** 2
- **Files modified:** 2 (both new)

## Accomplishments
- `e2e/pie-chart.spec.ts` seeds one bonus (dated today) and one vacation (+14/+17 days) for the authenticated fixture user through the real `/bonuses` and `/vacations` forms, then reads the home screen's "Годовая сводка" `<dl>` and independently re-parses the Грязными/Налог/На руки figures back into numbers, asserting Налог + На руки sums to Грязными within a 1-ruble rounding tolerance — a structural proof of the two-slice (no double-counting) invariant, not a trust of the component's own doc comment
- `e2e/pwa.spec.ts` fetches `/manifest.webmanifest` directly via `page.request.get` and asserts `name`/`short_name` are non-empty, `start_url === "/"`, `display === "standalone"`, and icon entries exist for both `192x192` and `512x512`
- `e2e/pwa.spec.ts`'s second test asserts the InstallBanner is visible on a fresh (never-standalone) Playwright context, hides after clicking the `aria-label="Скрыть"` button, and stays hidden after `page.reload()` — proving the `__pwa_install_banner_dismissed` localStorage key persists the dismissal, not just in-memory React state — then clears that key so the shared authenticated session isn't left dismissed for later local re-runs
- Full verification run (`npm run test:e2e -- e2e/pie-chart.spec.ts e2e/pwa.spec.ts`) passes: 4/4 tests (1 setup + 3 spec tests, since pie-chart.spec.ts has 1 test and pwa.spec.ts has 2)
- `npx playwright test --list` confirms both files' tests are matched under the `authenticated` project

## Task Commits

Each task was committed atomically:

1. **Task 1: Annual pie-chart data verification** - `75546c1` (feat)
2. **Task 2: PWA manifest and install-banner behavior** - `e877d6a` (feat)

## Files Created/Modified
- `e2e/pie-chart.spec.ts` - Seeds bonus+vacation via real UI, asserts the annual pie chart's rendered `<dl>` figures satisfy gross = tax + net within a 1-ruble tolerance
- `e2e/pwa.spec.ts` - Verifies the served `/manifest.webmanifest` JSON fields and the InstallBanner's visible/dismiss/persist-across-reload behavior

## Decisions Made
- Bonus dated "today" (guaranteed within the current tax year and the earliest possible event) and vacation dated +14/+17 days out (a distinct, non-overlapping range from Plan 07-03's vacation.spec.ts ranges of +30/+34 and +60/+63 days), since every `authenticated`-project spec file shares the same fixture user/session and Neon branch
- The `<dl>` money-figure parser splits each cell's text on `" · "` before stripping non-digit characters — found necessary during the first live test run (see Deviations below); the plan's described helper ("strips non-breaking spaces/₽/thousand separators") did not anticipate the adjacent percent figure's own digits concatenating into the parsed amount
- Skipped the plan's optional SVG structural check (`svg path.recharts-sector` count) — the plan's own `<read_first>` flagged it as "if a structural check is wanted," and the rendered-DOM-text gross=tax+net invariant is the plan's actual required acceptance criterion; adding an assertion on Recharts' internal (version-fragile) CSS class names would add brittleness without proving anything the text-based check doesn't already prove

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `<dl>` money-figure parser initially concatenated the adjacent percent figure's digits into the parsed ruble amount**
- **Found during:** Task 1, first `npm run test:e2e -- e2e/pie-chart.spec.ts` run
- **Issue:** Each `<dd>` renders as `"{formatKopecks(...)} · {percent}%"` (e.g. `"700 000 ₽ · 100,0%"`). The initial `parseRublesFromFormatted` helper stripped all non-digit characters from the full cell text, so `"700 000 ₽ · 100,0%"` parsed as `7000001000` (the money digits `700000` immediately followed by the percent digits `1000`) instead of `700000`. This made the gross=tax+net assertion fail with a nonsensical ~6.3 billion-ruble discrepancy even though the real rendered figures (700 000 = 91 000 + 609 000) were correct.
- **Fix:** Split the cell text on `"·"` first and parse only the portion before the separator (the money figure), discarding the percent portion entirely.
- **Files modified:** `e2e/pie-chart.spec.ts`
- **Verification:** Re-ran `npm run test:e2e -- e2e/pie-chart.spec.ts` — test passes, parsed values (700000/91000/609000) match the rendered DOM text exactly, and 91000 + 609000 - 700000 = 0 (within the 1-ruble tolerance)
- **Committed in:** `75546c1` (Task 1 commit — fixed before the task's single commit, not a follow-up commit)

---

**Total deviations:** 1 auto-fixed (1 bug, found and fixed during the task's own first live test run before committing)
**Impact on plan:** Necessary for the test to actually prove what it claims to prove. No scope creep — same file, same task, fixed before commit.

## Issues Encountered
- This worktree started with no `.env.local` and no `node_modules` (both are gitignored and the worktree was created after Plan 07-01's setup work already ran in a different worktree). Copied `.env.local` from the main repo checkout (not a git-tracked change) and ran `npm install` + `npx playwright install chromium` before either spec could be run against the real Neon database. Neither action touches version-controlled files.
- This worktree's branch (`worktree-agent-a7cce77d418f54c38`) was initially based on an ancestor commit that predated Plan 07-01's scaffold (no `e2e/` directory, no `07-04-PLAN.md` present on disk). Fast-forward merged the worktree branch onto `gsd/phase-07-e2e-test-suite` (0 unique commits on the worktree branch, so this was a pure fast-forward, non-destructive) to pick up Plan 07-01's `playwright.config.ts`/`e2e/fixtures.ts`/`auth.setup.ts`/`auth.spec.ts` this plan depends on.

## User Setup Required

None - no external service configuration required. `.env.local` (DATABASE_URL, BETTER_AUTH_SECRET) was already present in the parent repo checkout per the existing README.md setup steps; this worktree only needed a local copy to run the suite.

## Next Phase Readiness
- `e2e/pie-chart.spec.ts` and `e2e/pwa.spec.ts` are in place, both passing against a real Next.js production build and Neon database
- E2E-04 is fully covered: the annual pie chart's rendered figures are independently checked for the gross=tax+net invariant, the manifest is verified by fetching the real served endpoint, and the install-banner's localStorage-backed dismissal is proven to survive a reload
- No blockers for Plan 07-05 (CI isolation) — this plan added no new environment variables, config changes, or infrastructure beyond the two spec files themselves

---
*Phase: 07-e2e-test-suite*
*Completed: 2026-09-02*

## Self-Check: PASSED

- FOUND: e2e/pie-chart.spec.ts
- FOUND: e2e/pwa.spec.ts
- FOUND: commit 75546c1
- FOUND: commit e877d6a
