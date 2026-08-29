---
status: testing
phase: 01-core-payroll-loop
source: [01-VERIFICATION.md]
started: 2026-08-29T16:45:00Z
updated: 2026-08-29T16:45:00Z
---

## Current Test

number: 1
name: Restore Neon access and run the full suite
expected: |
  The configured database accepts authentication and every schema, repository,
  forecast, stale-CAS and concurrency test passes.
awaiting: user response

## Tests

### 1. Restore Neon access and run the full suite
expected: `npx vitest run` reaches all live assertions and passes without `password authentication failed for user 'on-hands_owner'`.
result: [pending]

### 2. Confirm the prompted salary snapshot
expected: In a real browser, trigger an exact-date replacement prompt, then edit the still-open form. Confirm writes the prompt's original snapshot, displays both old and new amounts, and cannot be double-fired.
result: [pending]

### 3. Verify cross-device convergence
expected: Two independent authenticated browser profiles for one account converge after reload; a stale salary confirmation re-prompts instead of overwriting the other session's newer value.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

- External Neon credential must be restored before Test 1 can execute.
