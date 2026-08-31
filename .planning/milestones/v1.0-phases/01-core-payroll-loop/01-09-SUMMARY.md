---
phase: 01-core-payroll-loop
plan: 09
subsystem: salary-input-resilience
tags: [salary, zod, server-actions, error-handling, tdd, gap-closure]

requires:
  - phase: 01-core-payroll-loop
    provides: "01-08's deployed salary_gross_amount_positive database constraint"
provides:
  - "Salary input validation aligned exactly with Math.round(rubles * 100) > 0"
  - "Non-sensitive SalaryActionResult failure for repository rejection"
  - "SalaryForm retry message for rejected Server Action promises"
  - "Focused boundary, action-contract, and TypeScript-AST regression coverage"
affects: [phase-02, phase-03, salary-setup, server-action-error-contracts]

actuals:
  tokens: 3129
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Validate monetary input against its persisted integer precision, not only its pre-conversion decimal sign"
    - "Expected repository failures remain serializable field-error return values; thrown client transport failures update local UI state"
    - "TypeScript compiler-API structural tests for async error boundaries without a DOM runtime"

key-files:
  created:
    - src/lib/validation/salary.test.ts
    - src/app/actions/salary.test.ts
    - src/components/pay-setup-forms.test.ts
  modified:
    - src/lib/validation/salary.ts
    - src/app/actions/salary.ts
    - src/components/pay-setup-forms.tsx

key-decisions:
  - "The salary threshold is Math.round(value * 100) > 0, so exact 0.005 rubles is valid while 0.0049 is not; an invented 0.01-ruble minimum would reject a representable one-kopeck result."
  - "Repository failures use the fixed grossRubles message 'Не удалось сохранить оклад. Попробуйте ещё раз.' without inspecting or logging the caught error."
  - "SalaryForm uses the same fixed retry message in a parameterless catch, keeping transport/framework failures out of render error boundaries and caught details out of UI output."

requirements-completed: [SAL-01]

duration: 18min
completed: 2026-08-29
status: complete
---

# Phase 01 Plan 09: Salary Precision and Graceful Failure Summary

**Salary setup now rejects values that cannot persist as a positive kopeck, serializes repository rejection as a safe field error, and renders a generic retry message when the client-side Server Action promise itself rejects.**

## Performance

- **Duration:** ~18 minutes, including the tracer approval checkpoint
- **Started:** 2026-08-29T10:58:08Z
- **Completed:** 2026-08-29
- **Tasks:** 2 completed
- **Files changed:** 6 (3 created, 3 modified)

## Accomplishments

- Added the exact persisted-precision salary guard `Math.round(value * 100) > 0` after the existing positive and maximum checks. Numeric and string inputs `0.001` and `0.0049` now receive `Оклад должен быть не меньше одной копейки`; exact `0.005`, `0.01`, and a normal salary remain valid.
- Wrapped only `replaceSalaryAt(...)` in `saveSalaryAction`. A rejection returns `{ success: false, fieldErrors: { grossRubles: ["Не удалось сохранить оклад. Попробуйте ещё раз."] } }`, never revalidates, and exposes neither database text nor the submitted salary amount.
- Wrapped SalaryForm's awaited action and all result handling in `try/catch`. A thrown action promise updates the existing visible `serverError` state with the same generic retry message; the catch has no binding and therefore cannot inspect, log, interpolate, or render thrown details.
- Preserved D-13 backdating, D-14 confirm-before-overwrite, successful writes, and the three existing cache-revalidation paths. Schedule and YTD forms were unchanged.
- Added 18 focused tests: persisted-precision boundaries, invalid-input no-write behavior, safe persistence-failure serialization, success/D-14 regressions, and an AST contract pinning the client catch boundary and visible render link.

## Task Commits

1. **Task 1 RED:** `79d3213` — failing salary precision and action failure tests
2. **Task 1 GREEN:** `8d80de6` — align salary validation with persisted kopecks and contain repository failures
3. **Task 2 RED:** `4238068` — failing SalaryForm rejected-action AST contract
4. **Task 2 GREEN:** `5b1fe70` — render thrown salary action failures through existing state

No REFACTOR commit was needed; both implementations remained narrow after GREEN.

## Verification

- `npx vitest run src/lib/validation/salary.test.ts src/app/actions/salary.test.ts src/components/pay-setup-forms.test.ts` — **PASS**, 3 files / 18 tests.
- `npx vitest run` — **PASS**, 11 files / 111 tests, including the configured live database suites.
- `npx tsc --noEmit` — **PASS**.
- `npm run lint` — **PASS**.
- `npm run build` — **PASS**, Next.js 16.3.3 production build completed and generated all routes.
- `git diff --exit-code package.json package-lock.json src/lib/db/schema.ts` — **PASS**. No dependency or schema drift; 01-08's deployed `salary_gross_amount_positive` constraint is unchanged.

Vitest emitted its pre-existing advisory that `vitest.config.ts` uses ESM syntax while native config loading is planned for a future Vite major version. It did not affect execution and is outside this SAL-01 gap.

## Security and Privacy

- T-01-09-01 is mitigated by validating attacker-controlled FormData at the actual persisted-money boundary before any repository read or write.
- T-01-09-02 is mitigated by returning a fixed field error; the forced-rejection test proves the distinctive fake database message and submitted `123456.78` amount are absent from the serialized result.
- T-01-09-03 is mitigated by a manual async catch in the event-handler path, matching the installed Next.js 16 error-handling guidance.
- T-01-09-04 remains intact: `requireUserId()` is still the first action operation and identity never comes from FormData.
- T-01-09-05 is covered by assertions that validation and persistence failures perform zero revalidation calls.
- No new network endpoint, authentication path, filesystem access, schema boundary, package, or other unplanned threat surface was introduced.

## Deviations from Plan

None — the plan executed exactly as written.

## Known Stubs

None. The `matches: T[] = []` occurrence in the AST test is a traversal accumulator populated during execution, not UI placeholder data.

## Issues Encountered

None. All focused and full verification commands passed on their first post-implementation run.

## User Setup Required

None.

## TDD Gate Compliance

- **Task 1 RED:** `79d3213` failed in the intended six places: four schema boundaries, invalid-input action behavior, and uncaught repository rejection.
- **Task 1 GREEN:** `8d80de6` made all 17 Task 1 tests pass, followed by a clean typecheck and immutable-file gate.
- **Task 2 RED:** `4238068` failed because no `TryStatement` enclosed the awaited `saveSalaryAction` call.
- **Task 2 GREEN:** `5b1fe70` made the AST contract pass, followed by clean typecheck, targeted lint, and immutable-file gate.

## Next Phase Readiness

The sole automated SAL-01 gap recorded in `01-VERIFICATION.md` is closed. Phase verification can be rerun against the completed 9-plan phase. AUTH-02's separate two-real-browser cross-device UAT remains outside this SAL-01 gap plan and is still pending manual verification.

## Self-Check: PASSED

All six created/modified implementation and test files exist. All four Task 01-09 commits (`79d3213`, `8d80de6`, `4238068`, `5b1fe70`) are present in git history, and the full acceptance and plan-level verification commands passed.
