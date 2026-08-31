---
phase: 03-vacation-pay
plan: 02
subsystem: database, validation, ui
tags: [drizzle, zod, react-hook-form, bonus, vacation-pay]

# Dependency graph
requires:
  - phase: 03-vacation-pay
    provides: "03-01's bonuses.type column ('premium'|'compensation', NOT NULL DEFAULT 'premium') and bonus_type_valid check constraint, live in Neon"
provides:
  - "createBonus/updateBonus require a validated BonusType ('premium'|'compensation') as their trailing argument"
  - "bonusInputSchema validates and defaults the type field ('premium')"
  - "saveBonusAction threads the validated type through to the repository"
  - "Create and edit bonus forms both expose a Тип выплаты selector, defaulting to premium"
affects: [03-04, bonus-repository, bonus-server-actions, bonus-ui]

# Actuals (#2632)
actuals:
  tokens: 5416
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "FormData optional-field parsing uses `formData.get(field) || undefined` (not the raw null) so Zod's `.default(...)` actually applies when the field is absent — matches the existing `id` field's pattern, now also applied to `type`"

key-files:
  created: []
  modified:
    - src/lib/db/bonus-repository.ts
    - src/lib/db/bonus-repository.test.ts
    - src/lib/validation/bonus.ts
    - src/lib/validation/bonus.test.ts
    - src/app/actions/bonus.ts
    - src/app/actions/bonus.test.ts
    - src/app/actions/forecast.test.ts
    - src/lib/db/salary-repository.test.ts
    - src/app/(app)/bonuses/bonus-form.tsx
    - src/app/(app)/bonuses/bonus-row.tsx
    - src/app/(app)/bonuses/bonus-row.render.test.tsx

key-decisions:
  - "bonus-row.tsx's edit-mode type selector uses aria-label=\"Тип выплаты\" rather than a visible <label> element, matching that form's existing pattern of having no visible labels on any of its fields (date/amount/note are all unlabeled inputs) — the create form (bonus-form.tsx) does use a visible <label>, per its own established pattern."
  - "saveBonusAction's type parse uses `formData.get(\"type\") || undefined`, not the raw FormData.get() result, so Zod's `.default(\"premium\")` fires when the field is genuinely absent — FormData.get() returns null (not undefined) for a missing key, which silently defeats Zod's `.default()`."

patterns-established: []

requirements-completed: [VAC-02]

coverage:
  - id: D1
    description: "createBonus/updateBonus require an explicit BonusType and persist it exactly as passed"
    requirement: "VAC-02"
    verification:
      - kind: unit
        ref: "src/lib/db/bonus-repository.test.ts#round-trips type through createBonus and updateBonus"
        status: pass
    human_judgment: false
  - id: D2
    description: "A bonus row inserted without an explicit type reads back as 'premium' from the database column default alone, not any application fallback"
    requirement: "VAC-02"
    verification:
      - kind: integration
        ref: "src/lib/db/bonus-repository.test.ts#reads a legacy row inserted without an explicit type back as 'premium' via the database default (D-V03)"
        status: pass
    human_judgment: false
  - id: D3
    description: "bonusInputSchema validates the type field: defaults to 'premium' when omitted, accepts 'compensation', rejects invalid strings"
    requirement: "VAC-02"
    verification:
      - kind: unit
        ref: "src/lib/validation/bonus.test.ts#defaults type to 'premium' when omitted / accepts an explicit 'compensation' type / rejects an invalid type value"
        status: pass
    human_judgment: false
  - id: D4
    description: "saveBonusAction parses and threads the validated type through to createBonus/updateBonus"
    requirement: "VAC-02"
    verification:
      - kind: unit
        ref: "src/app/actions/bonus.test.ts#creates when id is absent / updates when id is present / threads an explicit 'compensation' type through to createBonus"
        status: pass
      - kind: integration
        ref: "src/app/actions/forecast.test.ts#(12) a bonus saved through the server action appears in the forecast"
        status: pass
    human_judgment: false
  - id: D5
    description: "Both the create and edit bonus forms let the user choose the type, defaulting to premium, with the edit form pre-filled from the bonus's stored type"
    requirement: "VAC-02"
    verification:
      - kind: unit
        ref: "src/app/(app)/bonuses/bonus-row.render.test.tsx (all 4 pre-existing resync/dirty-field/superseded-save tests pass with makeBonus()'s type now derived from overrides)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-08-30
status: complete
---

# Phase 3 Plan 02: Bonus Type Reclassification Summary

**createBonus/updateBonus, bonusInputSchema, saveBonusAction, and both bonus forms all carry an explicit, validated, user-settable "premium"/"compensation" bonus type — reversing Phase 2's D-B07 "no bonus category" decision on purpose, per 03-CONTEXT.md.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-30T20:36:00Z
- **Completed:** 2026-08-30T20:42:43Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- `createBonus`/`updateBonus` in `src/lib/db/bonus-repository.ts` require a `BonusType` (`"premium" | "compensation"`) trailing argument, persisted exactly as passed; a new `BonusType` type alias is exported for reuse.
- `bonusInputSchema` gains a `type` field (`z.enum(["premium", "compensation"])`, defaulting to `"premium"`), with server-side rejection of any other string.
- `saveBonusAction` parses `type` from `FormData` and threads it through to both `createBonus` and `updateBonus`.
- Both the create form (`bonus-form.tsx`) and the edit form (`bonus-row.tsx`) expose a "Тип выплаты" selector with the two locked Russian option labels — creating defaults to `"premium"`, editing pre-fills from the bonus's actual stored type.
- A physical-database-default proof test confirms a bonus row inserted without an explicit `type` (simulating a pre-Phase-3 row) reads back as `"premium"` purely from the Postgres column default — no application-level fallback logic exists anywhere (D-V03).

## Task Commits

Each task was committed atomically:

1. **Task 1: Repository and validation — a required, defaultable bonus type** - `7f2ab9d` (feat)
2. **Task 2: Server Action and bonus form/row UI wiring** - `26bf88a` (feat)

## Files Created/Modified

- `src/lib/db/bonus-repository.ts` - `createBonus`/`updateBonus` gain a required `BonusType` trailing parameter; new `BonusType` export
- `src/lib/db/bonus-repository.test.ts` - all existing call sites updated with `"premium"`; two new tests (database-default proof, create/update round-trip)
- `src/lib/validation/bonus.ts` - `bonusInputSchema` gains `type: z.enum([...]).default("premium")`
- `src/lib/validation/bonus.test.ts` - three new tests (default, explicit valid value, rejection)
- `src/app/actions/bonus.ts` - `saveBonusAction` parses and threads `type` through to the repository, with a Rule 1 fix for `FormData.get()`'s null-vs-undefined default-bypass
- `src/app/actions/bonus.test.ts` - `formData()` helper accepts a type override; assertions updated with the trailing `"premium"`/`"compensation"` argument; one new test
- `src/app/actions/forecast.test.ts` - Rule 3 fixup: pre-existing `createBonus` call sites updated with the new trailing `"premium"` argument
- `src/lib/db/salary-repository.test.ts` - Rule 3 fixup: pre-existing `createBonus`/`updateBonus` call sites updated with the new trailing `"premium"` argument
- `src/app/(app)/bonuses/bonus-form.tsx` - new "Тип выплаты" `<select>` field, included in `toFormData`, defaulted/reset to `"premium"`
- `src/app/(app)/bonuses/bonus-row.tsx` - identical selector in edit mode, `toDefaults` extended to return the bonus's stored `type`, included in the edit submission's `FormData`
- `src/app/(app)/bonuses/bonus-row.render.test.tsx` - `makeBonus()` fixture's `type` field now derives from `overrides` instead of being hardcoded

## Decisions Made

- `bonus-row.tsx`'s edit-mode selector uses `aria-label="Тип выплаты"` rather than a visible `<label>`, matching that form's existing unlabeled-input convention (date/amount/note have no visible labels either); `bonus-form.tsx`'s create-mode selector uses a visible `<label>`, matching its own established pattern.
- `saveBonusAction`'s `type` parse uses `formData.get("type") || undefined` rather than the raw `FormData.get()` result — `FormData.get()` returns `null`, not `undefined`, for an absent key, which silently defeats Zod's `.default("premium")`. This mirrors the pre-existing `id` field's `formData.get("id") || undefined` pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed pre-existing `createBonus`/`updateBonus` call sites broken by the new required `type` parameter**
- **Found during:** Task 1 (`npx tsc --noEmit` after the repository signature change)
- **Issue:** `src/app/actions/forecast.test.ts` and `src/lib/db/salary-repository.test.ts` call `createBonus`/`updateBonus` directly (outside this plan's `files_modified` list) and failed to compile once the trailing `type` argument became required — a direct, mechanical consequence of this task's own signature change, same category as 03-01's `bonus-row.render.test.tsx` fixup.
- **Fix:** Added `"premium"` as the trailing argument at every call site, preserving every other assertion unchanged.
- **Files modified:** `src/app/actions/forecast.test.ts`, `src/lib/db/salary-repository.test.ts`
- **Verification:** `npx tsc --noEmit` exits 0; full 287-test suite passes.
- **Committed in:** `7f2ab9d` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed `saveBonusAction`'s `type` default silently bypassed by `FormData.get()`'s null return**
- **Found during:** Task 2 (`npm test -- --run`, full suite — `forecast.test.ts`'s real, non-mocked integration test `(12) a bonus saved through the server action appears in the forecast` failed)
- **Issue:** That test submits a real `FormData` object without a `type` key, exercising the actual (un-mocked) `saveBonusAction`. `formData.get("type")` on an absent key returns `null`, and Zod's `z.enum(...).default("premium")` only substitutes the default for `undefined`, not `null` — so the parse failed with "Некорректный тип бонуса" instead of defaulting.
- **Fix:** Changed the parse input to `type: formData.get("type") || undefined`, mirroring the pre-existing `id` field's identical pattern.
- **Files modified:** `src/app/actions/bonus.ts`
- **Verification:** Full 287-test suite passes; `npx tsc --noEmit` exits 0.
- **Committed in:** `26bf88a` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes are necessary, mechanical consequences of this plan's own signature/schema changes. No scope creep — no file outside the direct blast radius of the `type` field was touched.

## Issues Encountered

None beyond the two auto-fixed deviations documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Every bonus write path (repository, validation, Server Action, both forms) now carries an explicit, validated `type`, matching D-V02/D-V03 exactly.
- Plan 03-04 (forecast integration) can now filter real bonus rows by `type === "premium"` when computing an upcoming vacation's gross pay, as planned.
- No blockers. Full 287-test suite and `npx tsc --noEmit` both pass clean.

---
*Phase: 03-vacation-pay*
*Completed: 2026-08-30*

## Self-Check: PASSED

All modified files and commit hashes verified present on disk / in git log (see below).
