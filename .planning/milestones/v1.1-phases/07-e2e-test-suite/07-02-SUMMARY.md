---
phase: 07-e2e-test-suite
plan: 02
subsystem: testing
tags: [playwright, e2e, bonus, forecast, next.js]

requires:
  - phase: 07-e2e-test-suite (Plan 07-01)
    provides: playwright.config.ts's `authenticated` project + storageState (playwright/.auth/user.json), e2e/fixtures.ts helpers, npm run test:e2e script
provides:
  - "e2e/bonus.spec.ts: 3 Playwright tests covering bonus create/edit/delete through the real UI, each asserting the home screen's next-payment forecast reflects the mutation"
affects: [07-03-vacation-e2e, 07-04-pie-chart-pwa-e2e, 07-05-ci-isolation]

actuals:
  tokens: 1482
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "When a row's fields move from static text into form inputs (edit mode), re-locate the row by a unique control it exposes in that mode (e.g. its own \"Сохранить\" submit button) rather than by hasText — input values are not part of an element's text content, so a hasText-based locator captured before the mode switch cannot be re-queried after it"

key-files:
  created:
    - e2e/bonus.spec.ts
  modified: []

key-decisions:
  - "Worktree was branched before Plan 07-01 merged into gsd/phase-07-e2e-test-suite — fast-forward merged the phase branch into this worktree branch at session start to pick up e2e/fixtures.ts, playwright.config.ts, and 07-02-PLAN.md itself, none of which existed in the worktree's initial checkout"
  - "Copied .env.local (gitignored, present in the main repo checkout) into the worktree and ran npm install (node_modules was entirely absent) — both required for the real dev-server + Neon database test run the plan mandates"
  - "Edit test locates the actively-editing <li> via `page.locator(\"li\").filter({ has: page.getByRole(\"button\", { name: \"Сохранить\", exact: true }) })` instead of re-using the pre-edit hasText locator, since edit-mode form values are not exposed as element text content"

patterns-established:
  - "Row-locator-across-mode-switch pattern: capture the row before a mode toggle only for actions taken in that mode; re-derive a fresh locator scoped to a control unique to the new mode for any interaction after the toggle"

requirements-completed: [E2E-02]

coverage:
  - id: D1
    description: "A Playwright test creates a bonus through the real /bonuses form and confirms the home screen's next-payment forecast breakdown reflects the new bonus amount"
    requirement: "E2E-02"
    verification:
      - kind: e2e
        ref: "e2e/bonus.spec.ts#creates a bonus and updates the forecast breakdown"
        status: pass
    human_judgment: false
  - id: D2
    description: "A Playwright test edits an existing bonus's amount/date/note/type through the real inline edit form and confirms the bonus row reflects the new values"
    requirement: "E2E-02"
    verification:
      - kind: e2e
        ref: "e2e/bonus.spec.ts#edits a bonus and reflects the new amount"
        status: pass
    human_judgment: false
  - id: D3
    description: "A Playwright test deletes a future bonus (handling the native window.confirm dialog) and confirms it disappears from the history list and no longer affects the forecast"
    requirement: "E2E-02"
    verification:
      - kind: e2e
        ref: "e2e/bonus.spec.ts#deletes a future bonus"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-09-02
status: complete
---

# Phase 7 Plan 02: Bonus E2E Suite Summary

**Three Playwright tests (create/edit/delete) proving bonuses flow through the real /bonuses UI into the home screen's next-payment forecast, run against a live Next.js server and Neon Postgres database**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-09-02 (session start)
- **Completed:** 2026-09-02T08:09:50Z
- **Tasks:** 2
- **Files modified:** 1 (`e2e/bonus.spec.ts`, created)

## Accomplishments
- Create-bonus test: fills the real `/bonuses` form, asserts the success message and the new row (amount + note) in the history list, then navigates to `/` and asserts the forecast reflects the bonus — either as the bonus-only next-payment kind label, or as a non-zero "Бонус" breakdown line when it composes with a same-date scheduled payment
- Edit test: opens a row's inline edit form, changes amount/note/type, submits, and asserts the row's rendered text reflects the new amount (not a leftover pre-edit value)
- Delete test: creates a future-dated bonus, registers a `page.on("dialog", accept)` handler before clicking delete (handling `bonus-row.tsx`'s native `window.confirm`), and asserts the row disappears and the amount no longer appears anywhere in the forecast after a fresh navigation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create-bonus flow and forecast impact** - `50c2980` (feat)
2. **Task 2: Edit and delete flows (window.confirm handling)** - `212ed61` (feat)

**Plan metadata:** (this commit, docs)

## Files Created/Modified
- `e2e/bonus.spec.ts` - 3 Playwright tests (create/edit/delete) for bonus mutations and their effect on the home-screen forecast; runs under the `authenticated` project's storageState from Plan 07-01

## Decisions Made
- Fast-forward merged `gsd/phase-07-e2e-test-suite` (which already contained Plan 07-01's commits) into this worktree's branch at session start — the worktree had been created before Plan 07-01 merged back, so `07-02-PLAN.md`, `e2e/fixtures.ts`, `e2e/auth.spec.ts`, `e2e/auth.setup.ts`, and `playwright.config.ts` were all absent from the initial checkout. A `--ff-only` merge was safe since the worktree's HEAD was exactly the phase branch's merge-base (0 unique commits on the worktree side).
- Copied `.env.local` from the main repo checkout into the worktree (gitignored, so not carried by the fast-forward) and ran `npm install` (`node_modules` was entirely absent) — both were required to run the plan's mandated real dev-server + Neon database verification, not mocks.
- Edit test re-locates the row being edited via a locator scoped to its unique "Сохранить" submit button (`page.locator("li").filter({ has: page.getByRole("button", { name: "Сохранить", exact: true }) })`) rather than continuing to use the pre-edit `hasText(note)` locator — once a row enters edit mode, its note/amount live inside `<input>` values, which are not part of the element's text content, so a `hasText`-based locator captured before the mode switch can never re-match after it (found via a real timeout failure during Task 2's first live run, not by inspection).

## Deviations from Plan

None - plan executed exactly as written, with the addition of the environment-setup steps documented above (worktree fast-forward, `.env.local` copy, `npm install`) which were operational prerequisites the plan's own read-first context assumed were already in place.

## Issues Encountered
- First implementation of the edit test used `row.locator(...)` (the original `hasText(note)`-based locator) to fill edit-mode fields, which hung and timed out — root-caused to the fact that Playwright locators re-evaluate their predicate on each call, and `hasText` cannot match text that has moved into a form input's value. Fixed per the decision above; re-ran the full 4-test suite three consecutive times after the fix, all passing, to rule out flakiness before committing.
- One transient `[WebServer] Error: The destination stream closed early` log line appeared in most runs (before or during Task 2's tests) — did not correlate with any test failure across repeated runs and was not investigated further, since it did not affect the deterministic pass/fail outcome of any test.

## User Setup Required

None - no external service configuration required. `.env.local` (DATABASE_URL, BETTER_AUTH_SECRET) already existed in the main repo checkout per Plan 07-01's own README.md setup steps; it just needed to be copied into this worktree.

## Next Phase Readiness
- `e2e/bonus.spec.ts` is in place and passing (`npm run test:e2e -- e2e/bonus.spec.ts`, all 3 tests, 3 consecutive clean runs). `npx playwright test --list` confirms all 3 tests are registered under the `authenticated` project.
- No blockers for Plans 07-03 (vacation) or 07-04 (pie-chart/PWA) — they can add their own spec files under the same `authenticated` project without touching this file or `playwright.config.ts`.
- The row-locator-across-mode-switch pattern documented above is directly reusable for any future inline-edit E2E test (e.g. Plan 07-03's vacation row, if it has a similar edit-in-place UI).

---
*Phase: 07-e2e-test-suite*
*Completed: 2026-09-02*

## Self-Check: PASSED

- FOUND: e2e/bonus.spec.ts
- FOUND: commit 50c2980
- FOUND: commit 212ed61
