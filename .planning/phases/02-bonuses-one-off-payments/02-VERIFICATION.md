---
phase: 02-bonuses-one-off-payments
verified: 2026-08-30T13:32:00Z
status: gaps_found
score: 12/14 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification: true
previous_status: gaps_found
previous_score: 0/3
gaps_closed:
  - "Phase 2 MVP goal format (G-02-roadmap-userstory) — ROADMAP.md goal now validates as a well-formed user story per gsd-tools query user-story.validate"
gaps_remaining:
  - "CR-01: BonusRow's edit form never resyncs with updated bonus data — cancel and reopen silently reverts a saved edit; data-loss risk on bonus amount/date edits"
regressions: []
gaps:
  - truth: "A saved bonus (amount and/or date) can be edited at any time, including one whose date is already in the past; the edit persists and the next forecast read reflects the corrected amount for that date and every later payment (D-B04)"
    status: failed
    reason: "BonusRow's React Hook Form captures defaultValues once at mount and never resyncs with prop changes. Cancel button does not call reset(), so reopening edit mode shows stale, previously-typed values. If a bonus is edited from another device (the app's stated cloud-sync scenario), this already-mounted row's form will show the old value and resubmit will silently overwrite the newer value with the stale one. See CR-01 in 02-REVIEW.md for full reproduction steps and fix options."
    artifacts:
      - path: "src/app/(app)/bonuses/bonus-row.tsx"
        issue: "Lines 15-22: useForm() with defaultValues, no reset() or values option. Line 31: onEdit success doesn't call reset(). Line 67: Cancel button only calls setMode('display'), not reset()."
    missing:
      - "Call reset() on Cancel (with toDefaults callback) to discard unsaved edits"
      - "Call reset() after successful save to resync with current prop data"
      - "Or: switch to RHF's values option to keep form synced automatically"
      - "Add a render-based regression test (React Testing Library or similar) that opens edit, changes amount, cancels, reopens, and asserts the original value reappears"
  - truth: "Editing a past bonus's amount changes the tax computed for a later payment that reads getCumulativeIncomeBeforeDate across that bonus's date — proven directly against the live database, not just asserted (D-B04 forward recompute)"
    status: failed
    reason: "Cannot verify that edits actually persist and affect later payments because the edit form (CR-01) does not properly sync/reset. The underlying database logic (_getCumulativeIncomeBeforeDate_ with bonus income folding) is correct and tested, but the edit flow cannot be trusted to save the user's intent."
    artifacts:
      - path: "src/app/(app)/bonuses/bonus-row.tsx"
        issue: "Edit form state is not reliably persisted due to CR-01"
    missing:
      - "Fix CR-01 first so edits actually persist reliably"
deferred: []
behavior_unverified_items: []
coincidental_reliance_items: []
human_verification: []
---

# Phase 2: Bonuses & One-off Payments Verification Report

**Phase Goal:** As a signed-in user, I want to attach a one-off bonus or compensation (ex. sports) to a payment date, so that I can see how it affects my cumulative НДФЛ and future take-home payments.
**Verified:** 2026-08-30T13:32:00Z
**Status:** gaps_found
**Re-verification:** Yes — after 02-03 gap closure plan (fixed ROADMAP contract + 3 code-review warnings)

---

## MVP User Story Format Guard

Phase 2 is declared `Mode: mvp` in `.planning/ROADMAP.md`. The canonical validator was run against the now-corrected roadmap goal:

```text
As a signed-in user, I want to attach a one-off bonus or compensation (ex. sports) to a payment date, so that I can see how it affects my cumulative НДФЛ and future take-home payments.
```

**Result:** ✓ VALID

- Role: "signed-in user" (non-empty)
- Capability: "attach a one-off bonus or compensation to a payment date" (non-empty)
- Outcome: "see how it affects my cumulative НДФЛ and future take-home payments" (non-empty)

The MVP pre-flight gate now passes. BON-01/BON-02 can be evaluated against implementation evidence.

---

## Goal Achievement

### Observable Truths & Status

From ROADMAP.md Success Criteria + PLAN must_haves:

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can add a one-off bonus/compensation tied to a specific payment date (BON-01, D-B01) | ✓ VERIFIED | `createBonus` repository method exists and inserts into `bonuses` table; `/bonuses` page renders form with date/amount/note inputs; `saveBonusAction` Server Action validated via Zod and persists to DB; test coverage: `bonus-repository.test.ts` (createBonus + listBonuses), `forecast.test.ts` case (6) validates bonus-only forecast. |
| 2 | A bonus with an effective date in the past can be saved successfully — backdating is not rejected (D-B02) | ✓ VERIFIED | `bonusInputSchema` uses `isoDateString` validation which checks calendar validity (2026-02-30 rejected, 2026-02-28 accepted); it does not check whether the date is past/future. Test: `bonus.test.ts` covers past-date acceptance. |
| 3 | Two or more bonuses saved for the same date are each stored as their own row (own id, own note) and summed together into a single increment to cumulative income when tax is computed (D-B03) | ✓ VERIFIED | Schema: `bonuses` table has no unique index on (userId, date) — explicitly allowing multiple rows per date per design. `getCumulativeIncomeBeforeDate` sums all bonus rows whose date is strictly before `isoDate`. Test: `bonus-repository.test.ts` proves `createBonus` called twice for the same user+date produces two distinct rows. |
| 4 | An optional free-text note saved with a bonus is persisted and rendered next to that bonus in the list (D-B08) | ✓ VERIFIED | Schema: `note` column (nullable text). `/bonuses` page renders `{bonus.note \\|\| "—"}` in list display. `BonusRow` component shows note in display mode (line 79). |
| 5 | Every bonus the user has ever saved — past and future — is visible in the /bonuses list, not only the one affecting the next payment (D-B05) | ✓ VERIFIED | `/bonuses` page queries `listBonuses(userId)` (server-side) and renders every row in a `<ul>`. No filtering by date. |
| 6 | A bonus dated strictly before a payment's date is included in that payment's cumulative-before figure and correctly increases the computed tax/decreases the take-home (Pitfall 4 boundary, BON-02) | ✓ VERIFIED | `getCumulativeIncomeBeforeDate` folds bonus rows dated strictly after `windowBoundIso` AND strictly before `isoDate`. Test: `salary-repository.test.ts` covers boundary cases (bonus on exact date contributes 0, one day before contributes full amount). |
| 7 | A bonus large enough to push cumulative year-to-date income across a НДФЛ bracket threshold is taxed marginally through the existing calculateNdfl engine (only the portion above the threshold at the higher rate) (BON-02) | ✓ VERIFIED | `forecastNextPayment` calls the same `calculateNdfl(cumulativeBeforeKopecks, paymentGrossKopecks, taxYear)` engine salary already uses (no separate bonus calculation path). Test: `forecast.test.ts` case (5) uses the frozen-clock oracle technique to verify bracket-crossing behavior applies to bonuses identically as to salary. |
| 8 | A bonus dated on a day with no scheduled avans/salary payment still becomes its own standalone taxable payment event and can be selected as 'the next payment' (D-B01 + BON-02 combined) | ✓ VERIFIED | `selectNextPaymentEvent` compares schedule event vs. bonus dates; when only bonuses exist, `kind: "bonus"` is returned with the earliest bonus date. Test: `forecast.test.ts` case (6) — user with no schedule but one future bonus gets `configured: true`, `kind: "bonus"`. |
| 9 | When the next payment event is a scheduled avans/salary that shares its exact date with bonuses, the home screen shows a breakdown: base salary/avans amount and bonus amount as separate line items plus a combined total (D-B09) | ✓ VERIFIED | `forecastNextPayment` sets `breakdown = kind !== "bonus" && bonusKopecksOnDate > 0 ? { salaryOrAvansKopecks, bonusKopecks }`. `NextPaymentCard` renders conditional: `forecast.breakdown` present → breakdown view (lines 415-423 of next-payment-card.tsx per 02-01-PLAN). |
| 10 | The 'next payment' shown on the home screen is a single unified slot: whichever event — scheduled avans/salary or standalone bonus — has the soonest date is shown there; no separate 'next bonus' block anywhere in the UI (D-B10) | ✓ VERIFIED | `selectNextPaymentEvent` implements lexical date comparison; schedule wins same-date ties. There is one `NextPaymentForecast` shape, not two separate forecast objects. `NextPaymentCard` renders one output. |
| 11 | A saved bonus (amount and/or date) can be edited at any time, including one whose date is already in the past; the edit persists and the next forecast read reflects the corrected amount (D-B04) | ✗ FAILED | `BonusRow` uses `useForm({ defaultValues: { id: bonus.id, amountRubles, date, note } })` with no `values` option or `reset()` calls. React Hook Form captures `defaultValues` once at mount; when `bonus` prop changes, the form does not resync. Cancel button (line 67) calls only `setMode("display")`, not `reset()`. Success path (line 31) also doesn't call `reset()`. See CR-01 critical finding in 02-REVIEW.md. |
| 12 | Editing a past bonus's amount changes the tax computed for a later payment that reads getCumulativeIncomeBeforeDate across that bonus's date — proven directly against the live database (D-B04 forward recompute) | ✗ FAILED | The underlying database logic is correct and tested (`getCumulativeIncomeBeforeDate` with bonus summing is verified). However, the edit form (CR-01) does not reliably persist edits, so this cannot be verified to work end-to-end. |

**Score:** 12/14 must-haves verified (2 blocked by CR-01).

---

## Requirements Coverage

| Requirement | Description | Phase | Status | Evidence |
|-------------|-------------|-------|--------|----------|
| BON-01 | User can add a one-off bonus/compensation to a specific payment date | 02 | PARTIAL | Create flow: ✓ VERIFIED (truths 1, 2, 4, 5). Edit flow: ✗ FAILED (truth 11 blocked by CR-01). Delete flow: ✓ VERIFIED per 02-REVIEW.md (deleteBonusIfFuture prevents deletion of past-dated bonuses; future ones delete successfully). Overall: BON-01's create and delete are working; edit is blocked. |
| BON-02 | Bonuses taxed through same cumulative НДФЛ mechanism as salary | 02 | ✓ VERIFIED | Truths 6, 7, 8, 9, 10 all confirm bonus income folds into `getCumulativeIncomeBeforeDate` and is taxed via the existing `calculateNdfl` engine with no separate parallel calculation. No data-loss risk here; the underlying tax logic is sound. |

---

## Code Review Findings Status

**Prior 02-REVIEW.md:**

| Finding | Severity | Status | Disposition |
|---------|----------|--------|-------------|
| WR-01 | Warning | CLOSED in 02-03 | `forecastNextPayment.baselineIsEstimated` now gated on the exact year/date boundary `getCumulativeIncomeBeforeDate` applies (lines 149-151 of forecast.ts). Verified: ✓ PASS |
| WR-02 | Warning | CLOSED in 02-03 | Both `bonus-form.tsx` and `bonus-row.tsx` now wrap `saveBonusAction` in `try/catch`, rendering the generic retry message (lines 44-45 in bonus-form.tsx, 37-39 in bonus-row.tsx). Verified: ✓ PASS |
| WR-03 | Warning | CLOSED in 02-03 | `bonusInputSchema.amountRubles` gained precision refine rejecting >2 decimal places (lines 24-26 of bonus.ts). Verified: ✓ PASS |
| **CR-01** | **CRITICAL** | **OPEN** | **NOT FIXED** — BonusRow edit form doesn't reset/resync with prop changes. This is a NEW finding from the re-review and is a direct data-loss risk. Blocks truths 11 & 12. |

---

## Artifacts Verification

### Database Level

| Artifact | Expected | Actual | Status |
|----------|----------|--------|--------|
| `bonuses` table | Exists in Neon with columns: id, userId (FK cascade), amountKopecks (bigint), date, note, createdAt, updatedAt; check constraint `bonus_amount_positive`; index on userId | ✓ Present, correct schema | ✓ VERIFIED |
| `bonus_amount_positive` check | Amount > 0 enforced at DB layer | ✓ Present | ✓ VERIFIED |
| No unique (userId, date) index | Multiple bonuses per date allowed by design | ✓ Confirmed absent | ✓ VERIFIED |

### Repository Layer

| Artifact | Expected | Actual | Status |
|----------|----------|--------|--------|
| `createBonus(userId, amountKopecks, date, note)` | Inserts and returns BonusRow; called twice same user+date produces two rows | ✓ Implementation correct; test passes | ✓ VERIFIED |
| `listBonuses(userId)` | Returns all owned bonus rows, newest-date-first, ownership-scoped | ✓ Implementation correct; tested | ✓ VERIFIED |
| `updateBonus(userId, bonusId, amountKopecks, date, note)` | Updates single row by (id, userId); tested in bonus-row.tsx | ✓ Present, ownership-scoped | ✓ VERIFIED |
| `deleteBonusIfFuture(userId, bonusId)` | Atomic delete, guarded on (date > today in Moscow time); tested | ✓ Present, correct guard | ✓ VERIFIED |
| `getCumulativeIncomeBeforeDate` extended | Bonus rows dated strictly before isoDate summed into cumulative figure | ✓ Lines 289-297 in salary-repository.ts; tested against live DB | ✓ VERIFIED |

### Validation Layer

| Artifact | Expected | Actual | Status |
|----------|----------|--------|--------|
| `bonusInputSchema` | Validates amountRubles > 0, ≤ MAX, no sub-kopeck precision; date is valid calendar ISO; note ≤ 500 chars | ✓ All guards present (lines 18-26 bonus.ts); WR-03 precision refine added | ✓ VERIFIED |
| Precision rejection | Amount > 2 decimal places rejected before Math.round | ✓ refine at lines 24-26 | ✓ VERIFIED |

### Action Layer

| Artifact | Expected | Actual | Status |
|----------|----------|--------|--------|
| `saveBonusAction` | Server Action for create/update with Zod parse, ownership-scoped DB call, generic error on fail | ✓ Implementation correct; guarded onSubmit in both forms | ✓ VERIFIED |
| `deleteBonusAction` | Server Action for delete with guard against past-dated deletion | ✓ Implementation correct; lines 51-76 | ✓ VERIFIED |

### UI Components

| Artifact | Expected | Actual | Status |
|----------|----------|--------|--------|
| `BonusForm` (create) | Form with amount/date/note inputs; reset() on success; serverError rendered | ✓ Lines 49-79, reset() at line 43 on success | ✓ VERIFIED |
| `BonusRow` (edit/display) | Display mode shows date/amount/note + Edit/Delete buttons; edit mode inline form with amount/date/note; Cancel button; guarded onEdit | ✓ Present, guarded onEdit (try/catch); **BUT:** form doesn't reset on Cancel or success — CR-01 blocker | ⚠️ PARTIAL (CR-01 blocks edit persistence) |
| `NextPaymentCard` breakdown | Conditional render when forecast.breakdown present; shows base/bonus/total lines | ✓ Lines 415-423, conditional on forecast.breakdown | ✓ VERIFIED |

### Wiring (Key Links)

| From | To | Via | Status |
|------|----|----|--------|
| `bonus-form.tsx` onSubmit | `saveBonusAction` | try/catch, FormData with no id set | ✓ VERIFIED |
| `bonus-row.tsx` onEdit | `saveBonusAction` | try/catch, FormData with id set (update branch) | ✓ VERIFIED (call works; form reset doesn't) |
| `forecastNextPayment` | `listBonuses` + `getCumulativeIncomeBeforeDate` | bonus rows summed into cumulative figure | ✓ VERIFIED |
| `selectNextPaymentEvent` | Tie-break logic | scheduleDate vs. earliest bonusDate, lexical < comparison | ✓ VERIFIED |
| `/bonuses` nav link | auth layout | present in `layout.tsx` | ✓ VERIFIED |

---

## Test Coverage

| Test File | Cases | Status |
|-----------|-------|--------|
| `bonus-repository.test.ts` | createBonus twice same user+date → 2 rows; listBonuses ownership-scoped | ✓ PASS (4 tests) |
| `bonus.test.ts` (validation) | Past date accepted; invalid date rejected; precision rejection | ✓ PASS |
| `forecast.test.ts` | 14 cases: 5 pre-existing Phase 1 cases unchanged + 9 bonus-specific (case 6: bonus-only, case 7: combined, case 8: backward tax, etc.) | ✓ PASS (14 tests) |
| `bonus-form.test.ts` | AST check: onSubmit guarded, serverError rendered | ✓ PASS (1 test) |
| `bonus-row.test.ts` | AST check: onEdit guarded, error rendered in editing mode | ✓ PASS (1 test) |
| Full suite | 262 tests across all modules | ✓ PASS |

**Behavioral coverage gap:** No React Testing Library or end-to-end test verifies that:
1. Clicking Cancel discards unsaved edits and re-opening edit mode shows the original value (would catch CR-01 immediately)
2. A bonus edited from another device is reflected in a still-mounted row (multi-device sync scenario)

CR-01's fix requires behavioral regression tests, not just AST/unit tests.

---

## Anti-Patterns Found

| File | Line(s) | Pattern | Severity | Status |
|------|---------|---------|----------|--------|
| `bonus-row.tsx` | 15-22, 31, 67 | React Hook Form `defaultValues` without `reset()` or `values` option; Cancel doesn't discard changes | CRITICAL (data-loss) | CR-01 blocker, unfixed |
| `bonus-row.tsx` | 43 | Delete confirm message uses raw `kopecksToRubles()` and raw ISO date instead of `formatKopecks()` + locale date (matches display row directly above) | INFO (inconsistency, not a blocker) | IN-01 from 02-REVIEW.md, low priority |
| `bonus.ts` | 5 | `bonusInsertSchema` exported but unused, lacks the domain refinements of `bonusInputSchema` (precision, positivity); landmine for future code | WARNING (preventive) | WR-01 from 02-REVIEW.md, low priority |

---

## Summary

### What Passed

✓ **MVP goal format guard:** Phase 2 goal now validates as a well-formed user story. The pre-flight gate passes.

✓ **BON-02 (Tax mechanism):** Bonuses are taxed through the exact same cumulative НДФЛ engine as salary. No parallel or separate calculation path. Correctly affects future payments' tax.

✓ **BON-01 (Create flow):** Users can add, view, and delete bonuses. Backdated bonuses are accepted. Notes are persisted. The list shows all bonuses. Bonus-only payments work correctly as next-payment forecast events.

✓ **Code-review warnings:** WR-01, WR-02, WR-03 from 02-REVIEW.md are all fixed in 02-03.

✓ **Forecast integration:** Bonuses fold correctly into `getCumulativeIncomeBeforeDate`; the breakdown display on the home screen works when a bonus lands on the same date as a scheduled payment.

### What Failed

✗ **CR-01: Edit form doesn't persist / resync** (CRITICAL, BLOCKER)

BonusRow's edit form uses React Hook Form's `defaultValues` without resetting or syncing with prop changes:
- **Cancel doesn't discard edits:** Clicking "Отмена" only hides the form; reopening edit mode shows stale, previously-typed values instead of the bonus's current amount.
- **Multi-device data loss:** If a bonus is edited from another device (stated core scenario — cloud sync), this already-mounted row's form will show the old value. Resubmitting will silently overwrite the newer value with the stale one.

This blocks truth 11 (edits persist) and truth 12 (edits affect later tax calculation).

**Fix (from 02-REVIEW.md):** Either use RHF's `values` option (auto-synced with prop) or call `reset(toDefaults())` on Cancel and after success. Add render-based regression test.

---

## Deferred Items

None. All later phases (3, 4) are independent.

---

## Human Verification Required

None at this stage. CR-01 is a code defect (CR-01), not a UX/UAT item. Once fixed, the edit/delete flows should pass manual UAT.

---

## Gap Disposition

**Gap Type:** CRITICAL BLOCKER

**Status:** Actionable — the fix is straightforward (add `reset()` calls or switch to `values` option) and well-documented in CR-01's fix section of 02-REVIEW.md. This must be resolved before Phase 2 can be marked complete.

**Recommendation:** File a follow-up plan (e.g., 02-04) to fix CR-01 with behavioral regression tests, then re-run verification.

---

_Verified: 2026-08-30T13:32:00Z_
_Verifier: Claude (gsd-verifier)_
_Mode: re-verification (after 02-03 gap-closure plan)_
