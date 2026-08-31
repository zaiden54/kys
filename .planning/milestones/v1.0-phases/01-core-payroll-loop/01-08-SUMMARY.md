---
phase: 01-core-payroll-loop
plan: 08
subsystem: domain-hardening
tags: [ndfl, tax-brackets, gross-split, db-constraints, product-metadata, tdd, gap-closure]

requires:
  - phase: 01-core-payroll-loop
    provides: "forecastNextPayment orchestration and Moscow-anchored time (01-06); atomic salary/schedule/YTD upserts (01-07) -- neither of which this plan's files overlap"
provides:
  - "halfSplitGross (forecast.ts): kind-aware floor/remainder split that reconciles exactly to the monthly gross for any parity, closing WR-02"
  - "assertStrictlyAscending (ndfl-brackets.ts): enforced inside bracketsForYear, guarding taxOnCumulative's ascending-scale assumption against a future mis-ordered scale, closing WR-04"
  - "Corrected ndfl-brackets.ts header comment that no longer claims a primary-statute verification that never happened"
  - "salary_gross_amount_positive and ytd_amount_nonnegative live database check constraints, proven by a Zod-bypassing integration suite, closing WR-03"
  - "src/app/layout.tsx product metadata (НаРуки) and lang=\"ru\", closing WR-05"
affects: [phase-02, phase-03, phase-04, any future write path to salary_history/ytd_baseline, any future NDFL_SCALES entry]

actuals:
  tokens: 4150
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Floor/remainder reconciling split for a two-way division of an integer amount (avans gets floor(gross/2), the other side gets the remainder) -- generalizable to any future exact two-way money split"
    - "Single ordering-assertion chokepoint inside a lookup function (bracketsForYear), rather than a module-load-time throw, so a future data-only edit is caught at first use without risking a whole-build failure"
    - "Live check() constraints as a second, DB-level gate behind Zod validation for money columns, proven by Zod-bypassing direct-Drizzle-insert integration tests"

key-files:
  created:
    - src/domain/tax/ndfl-brackets.test.ts
    - src/lib/db/schema.test.ts
  modified:
    - src/app/actions/forecast.ts
    - src/app/actions/forecast.test.ts
    - src/domain/tax/ndfl-brackets.ts
    - src/lib/db/schema.ts
    - src/app/layout.tsx

key-decisions:
  - "MAX_VERIFIED_TAX_YEAR left at 2026, not lowered, while correcting the statute-verification comment -- lowering it would throw on every current-year forecast, turning a comment-accuracy fix into a live outage over an already-tracked open item, not a new functional regression. Its own doc comment now records this reasoning."
  - "The <html> lang attribute was changed from \"en\" to \"ru\" as a deliberate extension of WR-05 beyond the review's literal text (which only named the metadata title/description) -- every string this app renders is Russian, and the declared document language is what screen readers announce and what Safari's translation prompt reads on the exact iOS 'Add to Home Screen' install path this project targets. Same scaffold-default-never-adjusted defect class, same <html> element."
  - "PWA manifest, apple-touch-icon, and apple-mobile-web-app-* tags were intentionally NOT added in this task -- they are Phase 4 scope; this task only stops the app from misidentifying itself in the browser tab and link previews."

patterns-established:
  - "Reconciling integer split via floor + remainder for any exact two-way money division"
  - "Ordering-invariant guard at the single lookup chokepoint of a versioned data table, swept by a registered-entry test rather than asserted only at module load"

requirements-completed: [TAX-01, HOME-01]

coverage:
  - id: D1
    description: "halfSplitGross(gross, kind) reconciles exactly across parities including the review's 10_000_001 kopeck case; every pre-existing forecast test's arithmetic is unchanged (all fixtures use even-kopeck gross values, so old and new rules agree by construction)"
    requirement: "HOME-01"
    verification:
      - kind: unit
        ref: "src/app/actions/forecast.test.ts describe(\"halfSplitGross\") (7 new tests) -- npx vitest run src/app/actions/forecast.test.ts"
        status: pass
      - kind: unit
        ref: "src/app/actions/forecast.test.ts describe(\"forecastNextPayment\") (7 pre-existing tests, unmodified assertions) -- same command"
        status: pass
    human_judgment: false
  - id: D2
    description: "assertStrictlyAscending throws for non-ascending/duplicated/transposed bracket arrays and passes for every registered NDFL_SCALES entry; bracketsForYear enforces it at its single lookup chokepoint"
    requirement: "TAX-01"
    verification:
      - kind: unit
        ref: "src/domain/tax/ndfl-brackets.test.ts (8 tests) and src/domain/tax/calculate-ndfl.test.ts (22 tests, unmodified) -- npx vitest run src/domain/tax/ndfl-brackets.test.ts src/domain/tax/calculate-ndfl.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "ndfl-brackets.ts header comment no longer claims a primary-statute re-confirmation that never happened; points at 01-VERIFICATION.md's open human_verification item instead; bracket data (thresholds/rates/fixed bases) byte-identical"
    verification:
      - kind: other
        ref: "grep -qF '01-VERIFICATION.md' src/domain/tax/ndfl-brackets.ts && ! grep -qF 're-confirmed against primary statute' src/domain/tax/ndfl-brackets.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "salary_gross_amount_positive and ytd_amount_nonnegative check constraints are live in the database (not merely declared), proven by direct Zod-bypassing Drizzle inserts; D-11's zero YTD baseline still accepted"
    requirement: "n/a (WR-03, defense-in-depth, no phase-1 requirement ID claims this directly)"
    verification:
      - kind: integration
        ref: "src/lib/db/schema.test.ts (5 tests against the live Neon database) -- npx vitest run src/lib/db/schema.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "The live drizzle-kit push applied only the two expected ADD CONSTRAINT statements, with zero pre-existing violating rows found beforehand"
    verification:
      - kind: other
        ref: "Pre-push query against live DB: 0 rows in salary_history WHERE gross_amount_kopecks <= 0; 0 rows in ytd_baseline WHERE amount_kopecks < 0. Captured push log's statement list: exactly 2 ALTER TABLE ... ADD CONSTRAINT statements, no drop/truncate, exit code 0, no interactive confirmation encountered."
        status: pass
    human_judgment: false
  - id: D6
    description: "Product metadata and document language corrected (WR-05); PWA manifest/icons intentionally deferred to Phase 4"
    verification:
      - kind: other
        ref: "grep -qF 'НаРуки' src/app/layout.tsx && grep -qF 'lang=\"ru\"' src/app/layout.tsx && ! grep -qF 'Create Next App' src/app/layout.tsx"
        status: pass
    human_judgment: false
  - id: D7
    description: "01-VERIFICATION.md human_verification items remain OPEN and are not addressed by this plan -- in particular the НДФЛ bracket primary-statute item is made MORE visible in code, not closed"
    verification: []
    human_judgment: true
    rationale: "This plan touches only computation guards, DB constraints, and product metadata -- none of it is browser-visible, and the primary-statute confirmation requires live web access no execution sandbox in this project has had."

duration: 15min
completed: 2026-08-29
status: complete
---

# Phase 01 Plan 08: Residual Review Findings (WR-02, WR-03, WR-04, WR-05) Summary

**Closed all five residual 01-VERIFICATION.md anti-pattern rows this phase's other gap-closure plans didn't touch: the avans/salary gross split now reconciles by construction on any kopeck parity, a mis-ordered future НДФЛ bracket scale fails loudly instead of under-taxing, two money columns are bounded at the live database layer behind a Zod-bypassing proof, a false statute-verification claim was removed from the tax module's header comment, and the app now identifies itself as НаРуки in Russian instead of shipping create-next-app's scaffold defaults.**

## Performance
- **Duration:** ~15min (task execution; excludes required-reading review)
- **Started:** 2026-08-29T11:44:00Z (approx., first commit 11:48:05+03:00)
- **Completed:** 2026-08-29T11:53:08+03:00
- **Tasks:** 3 completed
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- `halfSplitGross` in `src/app/actions/forecast.ts` is now kind-aware and exported, splitting floor/remainder so the avans and salary shares always sum to exactly the monthly gross oklad, closing the review's worked 10_000_001-kopeck one-kopeck-drift example (WR-02).
- `assertStrictlyAscending` in `src/domain/tax/ndfl-brackets.ts` is enforced inside `bracketsForYear` at the single lookup chokepoint, so a future mis-ordered bracket scale throws instead of silently selecting a lower bracket and under-taxing (WR-04).
- `ndfl-brackets.ts`'s header comment no longer claims a primary-statute (НК РФ ст.224) re-confirmation that 01-03-SUMMARY.md and STATE.md both record as never having happened; it now points explicitly at `01-VERIFICATION.md`'s open `human_verification` item.
- `salary_history.gross_amount_kopecks` and `ytd_baseline.amount_kopecks` now carry live database `check()` constraints (`salary_gross_amount_positive`, `ytd_amount_nonnegative`), applied via `drizzle-kit push` and proven live by a new integration suite that writes directly through Drizzle, bypassing Zod entirely (WR-03).
- `src/app/layout.tsx` now declares the product's real name and description (НаРуки) and `lang="ru"` instead of the unmodified create-next-app scaffold (WR-05).
- Zero new npm dependencies across all three tasks (`git diff --exit-code package.json package-lock.json` passed after every task); full suite (93/93), `tsc`, `lint`, and `build` all green.

## Task Commits
1. **Task 1 (RED): failing test for reconciling gross split** - `4ee464e` (test)
2. **Task 1 (GREEN): implement kind-aware floor/remainder split** - `c4f1641` (feat)
3. **Task 2 (RED): failing test for bracket ordering assertion** - `26986ec` (test)
4. **Task 2 (GREEN): enforce assertStrictlyAscending, correct header comment** - `815d22d` (feat)
5. **Task 3: DB check constraints + live push + product metadata** - `b9c8f06` (feat)

No REFACTOR commits were needed for either TDD task.

## Files Created/Modified
- `src/app/actions/forecast.ts` - `halfSplitGross` now exported, kind-aware, floor/remainder; call site passes `paymentEvent.kind`; doc comment corrected.
- `src/app/actions/forecast.test.ts` - New sibling `describe("halfSplitGross")` parity suite (7 tests); existing `describe("forecastNextPayment")` suite untouched.
- `src/domain/tax/ndfl-brackets.ts` - `assertStrictlyAscending` added, exported, and called inside `bracketsForYear`; header comment and `MAX_VERIFIED_TAX_YEAR` doc comment corrected; bracket data untouched.
- `src/domain/tax/ndfl-brackets.test.ts` (new) - 8 tests: ordering-assertion defect cases, registered-scale sweep, module purity.
- `src/lib/db/schema.ts` - Added `check("salary_gross_amount_positive", ...)` to `salaryHistory` and `check("ytd_amount_nonnegative", ...)` to `ytdBaseline` (which previously had no second-argument config function).
- `src/lib/db/schema.test.ts` (new) - 5 integration tests proving both constraints reject/accept as designed, writing directly through Drizzle with no Zod in the path.
- `src/app/layout.tsx` - `metadata.title`/`metadata.description` and `<html lang>` corrected.

## Decisions Made
See `key-decisions` in frontmatter. In brief: `MAX_VERIFIED_TAX_YEAR` was deliberately left at 2026 (lowering it would be a live outage, not a fix); the `<html lang>` change was a deliberate extension of WR-05's literal text to the same scaffold-default defect class; PWA manifest/icon work is deliberately deferred to Phase 4.

## Live Database Change (Task 3)

Per this plan's `<precondition>` and `critical_live_database_gate`:

1. **Pre-push violating-row check** (run before any schema change): `SELECT count(*) FROM salary_history WHERE gross_amount_kopecks <= 0` returned **0**; `SELECT count(*) FROM ytd_baseline WHERE amount_kopecks < 0` returned **0**. No pre-existing rows would have violated either new constraint — nothing was found, so nothing needed reporting or resolving.
2. **Push command:** `npx drizzle-kit push --verbose < /dev/null > <log> 2>&1`, `DATABASE_URL` exported from `.env.local`. Exit code **0** — no interactive confirmation was encountered (drizzle-kit did not prompt under this invocation).
3. **Captured statement list** (verbatim, the only two lines in the "about to execute" block):
   ```sql
   ALTER TABLE "salary_history" ADD CONSTRAINT "salary_gross_amount_positive" CHECK ("salary_history"."gross_amount_kopecks" > 0);
   ALTER TABLE "ytd_baseline" ADD CONSTRAINT "ytd_amount_nonnegative" CHECK ("ytd_baseline"."amount_kopecks" >= 0);
   ```
   No `DROP`, `TRUNCATE`, or any other statement appeared. `grep -iE 'drop (table|column|constraint)|truncate'` against the captured log returned no match.
4. No auto-accept flag was used; no live row was deleted at any point.

## Deviations from Plan

### Auto-fixed Issues
None — no bugs, missing functionality, or blockers required a Rule 1-3 fix during this plan's execution.

### Documented, Not Altered

**1. Pre-existing plan/reality mismatch: `grep -cF 'kind: PaymentKind' src/app/actions/forecast.ts` acceptance count**
- **Found during:** Task 1 acceptance-criteria verification
- **Issue:** This plan's acceptance criteria expect `grep -cF 'kind: PaymentKind' src/app/actions/forecast.ts` to equal `"1"`. The actual file contains this substring twice: once in the pre-existing `NextPaymentForecast.kind: PaymentKind;` interface field (present since 01-05, confirmed via `git show` against the pre-plan commit `0305882`) and once in this plan's new `halfSplitGross(monthlyGrossKopecks: Kopecks, kind: PaymentKind)` parameter, which the plan's own `<action>` text explicitly requires ("take the payment kind as a second parameter typed `PaymentKind`").
- **Resolution:** No code change. The plan's action-text requirement is fully satisfied; the grep-count acceptance criterion did not account for the pre-existing interface field when written. This mirrors 01-07-SUMMARY.md's precedent for a materially identical situation (a grep-count acceptance criterion that predates the plan's own edits).
- **Verification:** `git show 0305882:src/app/actions/forecast.ts | grep -n 'kind: PaymentKind'` shows the interface field present before this plan touched the file; all other Task 1 acceptance criteria and the full verification suite pass.
- **Commit:** n/a (no code change; both `4ee464e` and `c4f1641` deliver the required behavior).

**Total deviations:** 0 auto-fixed, 1 documented-not-altered (pre-existing plan/reality mismatch, no code change).
**Impact on plan:** None on shipped behavior. `halfSplitGross` is correctly exported and kind-aware exactly as the plan's action text specifies; the grep-count discrepancy is a pre-existing artifact of the plan text, not a defect in the delivered fix.

## Issues Encountered
- `.env.local` could not be safely `source`d directly in bash (its `DATABASE_URL` value contains a `&` in a query parameter, which bash's `source` misparsed). Worked around by extracting `DATABASE_URL` via a small Node script and exporting it explicitly before invoking both the pre-push violating-row query and `drizzle-kit push`. No code or config change; a one-off local invocation detail, not a deviation from the plan's action.

## User Setup Required
None - no external service configuration required.

## TDD Gate Compliance

Task 1 (`tdd="true"`) followed RED → GREEN:
- RED: `4ee464e` `test(01-08): add failing test for reconciling gross split (WR-02)` — confirmed failing with `TypeError: halfSplitGross is not a function` (not yet exported/kind-aware).
- GREEN: `c4f1641` `feat(01-08): make avans/salary gross split reconcile exactly (WR-02)` — 17/17 forecast tests passed immediately after.

Task 2 (`tdd="true"`) followed RED → GREEN:
- RED: `26986ec` `test(01-08): add failing test for bracket ordering assertion (WR-04)` — confirmed failing via `npx tsc --noEmit` (`TS2305: Module has no exported member 'assertStrictlyAscending'`).
- GREEN: `815d22d` `feat(01-08): enforce bracket ordering, stop asserting an unperformed check (WR-04)` — 30/30 tests (ndfl-brackets.test.ts + calculate-ndfl.test.ts) passed immediately after.

No REFACTOR commit was needed for either task. Task 3 (`type="auto"`, no `tdd`) was implemented and verified directly per its own `<action>`/`<acceptance_criteria>`, committed once as a single logical unit.

## Next Phase Readiness

All five residual 01-VERIFICATION.md anti-pattern rows this plan claimed (WR-02, WR-03, WR-04, WR-05, and the stale `ndfl-brackets.ts` header claim) are closed with an automated gate each. Combined with 01-06 (CR-01, Moscow time anchoring) and 01-07 (CR-02/WR-01, atomic upserts), every anti-pattern row and both Critical findings in `01-VERIFICATION.md`/`01-REVIEW.md` now have a shipped, tested fix.

The following `01-VERIFICATION.md` `human_verification` items remain **OPEN** and are **not addressed by this plan** — none of them are within this plan's scope, and none had browser or live-web access available in this execution sandbox:
- The two-browser AUTH-02 cross-device check.
- D-06/D-08 visual confirmation (no email-verification interstitial, no forgot-password affordance).
- **The 2025 НДФЛ bracket primary-statute confirmation against НК РФ ст.224** (pravo.gov.ru/consultant.ru) — Task 2 of this plan made this item **more visible in the code**, not closed: the false "re-confirmed against primary statute" claim was removed from `ndfl-brackets.ts`'s header comment and replaced with an explicit pointer to this exact `01-VERIFICATION.md` `human_verification` entry. The underlying check itself was not performed by this plan (or any plan in this project) — no execution sandbox used across this entire phase has had live web access to pravo.gov.ru or consultant.ru.
- The D-11 (banner persists across reload), D-14 (confirm-before-replace modal), D-04 (gap-warning display), D-13 (backdated history list), D-02 (real-calendar cross-check for weekend/holiday shifts), and D-15 (no visible "upcoming raise" indicator) visual/interactive checks.

This is the final plan of the phase's gap-closure batch (01-06, 01-07, 01-08, all wave 2, all now complete). Phase 1's verification should be re-run to confirm the residual anti-pattern list is empty; the remaining open items above are all `human_verification`-class and require a browser or live web access, not further automated execution.

---
*Phase: 01-core-payroll-loop*
*Completed: 2026-08-29*

## Self-Check: PASSED

All created/modified files verified present on disk (forecast.ts, forecast.test.ts, ndfl-brackets.ts, ndfl-brackets.test.ts, schema.ts, schema.test.ts, layout.tsx, this SUMMARY.md). All five task commits verified present in git history: `4ee464e` (RED, WR-02), `c4f1641` (GREEN, WR-02), `26986ec` (RED, WR-04), `815d22d` (GREEN, WR-04), `b9c8f06` (Task 3, WR-03/WR-05).
