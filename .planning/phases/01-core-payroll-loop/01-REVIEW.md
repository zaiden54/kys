---
phase: 01-core-payroll-loop
status: clean
reviewed: 2026-08-29
depth: standard
files_reviewed: 8
critical: 0
warnings: 0
info: 0
---

# Phase 01 Code Review

## Result

Clean after one review-time fix.

## Resolved Finding

- **Warning — salary replacement claim row identity was not enforced by CAS.** The claim carried `rowId`, but `replaceSalaryIfUnchanged` initially compared only the stored amount. A delete/reinsert with the same amount inside the ten-minute claim TTL could therefore accept consent for a different physical row. Commit `a9b9392` adds the stored `salary_history.id` equality to `setWhere`, passes the verified claim row id from the Server Action, and updates focused action/integration coverage.

## Checks

- Focused token/action/component suites: 18/18 pass after the fix.
- `npx tsc --noEmit`: pass.
- `npm run lint`: pass.
- No raw errors, salary values, user ids, or secrets are logged or returned.
- Server Action derives identity from `requireUserId`, validates FormData, verifies the server-signed claim, and constrains the client result shape.
- No package, schema, migration, tax, schedule, YTD, or forecast changes.

## Remaining Verification Debt

- Live Neon integration tests cannot authenticate with the configured `on-hands_owner` password; this is external to the reviewed diff.
- Real-browser snapshot-edit and two-session AUTH-02 checks remain human UAT.
