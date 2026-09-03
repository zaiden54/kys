# Deferred Items — Phase 05 (Deploy Pipeline & Environment Config)

Out-of-scope discoveries logged during plan execution, per executor SCOPE BOUNDARY rule (fix only issues directly caused by the current task's changes).

## 05-01, Task 1

- **`src/app/actions/forecast.test.ts`** — 2 pre-existing failures against the live Neon database when run with a real `DATABASE_URL` (`composes scheduled pay and vacation pay that land on the same date into one taxable forecast`, `composes bonus and vacation pay that land on the same date into one taxable forecast`). Both assert `vacationId`/tax amounts that only make sense if a specific vacation row already exists in the shared dev database from a prior test run — looks like accumulated live-DB state drift, not a regression from this plan's `src/lib/auth.ts` / `src/lib/auth-allowed-hosts.ts` changes (neither file was touched by these tests, confirmed via `git diff --stat` showing only `auth.ts` + new `auth-allowed-hosts.ts`). Not fixed here — out of scope for SEC-04.
  status: acknowledged
