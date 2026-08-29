---
status: testing
phase: 01-core-payroll-loop
source: [01-VERIFICATION.md]
started: 2026-08-29T16:45:00Z
updated: 2026-08-29T17:48:49Z
---

## Current Test

number: 1
name: Apply the current schema to Neon and run the full suite
expected: |
  All 231 tests pass, including persistence, ownership, concurrency, and
  forecast integration.
awaiting: user response

## Tests

### 1. Apply the current schema to Neon and run the full suite
expected: Apply the current Drizzle/Better Auth schema, then `npm test` passes all 231 tests without PostgreSQL `42P01 relation "user" does not exist`.
result: [pending]

### 2. Verify cross-device convergence
expected: Two independent authenticated browser profiles converge after reload; both show identical salary, schedule, YTD, and forecast state, and stale replacement re-prompts.
result: [pending]

### 3. Confirm the prompted salary snapshot
expected: In a real browser, edit the live form while its replacement prompt is open. Confirmation uses the prompt snapshot, displays old/new values, and cannot be double-fired.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

- The current Neon database must be provisioned with the application schema before Test 1 can execute.
