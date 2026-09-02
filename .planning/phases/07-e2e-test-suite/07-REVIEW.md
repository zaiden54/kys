---
phase: 07-e2e-test-suite
reviewed: 2026-09-02T14:44:11Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - e2e/auth.setup.ts
  - e2e/auth.spec.ts
  - e2e/bonus.spec.ts
  - e2e/ci-branch-setup.mjs
  - e2e/ci-branch-teardown.mjs
  - e2e/fixtures.ts
  - e2e/global-setup.ts
  - e2e/global-teardown.ts
  - e2e/pie-chart.spec.ts
  - e2e/pwa.spec.ts
  - e2e/vacation.spec.ts
  - .github/workflows/ci.yml
  - .gitignore
  - .mcp.json
  - package.json
  - playwright.config.ts
  - README.md
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-09-02T14:44:11Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Reviewed the full E2E test suite (specs, fixtures, Playwright config) and the CI-only Neon
branch-lifecycle scripts (`e2e/ci-branch-setup.mjs`, `e2e/global-setup.ts`,
`e2e/global-teardown.ts`, `e2e/ci-branch-teardown.mjs`), with the CI workflow and secret-handling
discipline as the primary focus per this phase's nature.

**Selector/DOM correctness:** I cross-checked every `getByLabel`/`getByRole`/`getByText`/CSS
selector used across `auth.setup.ts`, `auth.spec.ts`, `bonus.spec.ts`, `vacation.spec.ts`, and
`pie-chart.spec.ts` against the actual rendered markup in `src/components/pay-setup-forms.tsx`,
`src/app/(app)/bonuses/bonus-{form,row}.tsx`, `src/app/(app)/vacations/vacation-{form,row}.tsx`,
`src/components/annual-pie-chart.tsx`, and `src/components/install-banner.tsx`. All labels,
button names, `dt`/`dd` pairs, and grid-column orderings match exactly — no flaky-selector risk
found.

**Fixture/cleanup safety (`e2e/fixtures.ts`):** `deleteUserByEmail`'s raw SQL DELETE is
parameterized via the `neon` tagged-template driver (not string-interpolated), and `email` is
always this file's own `uniqueEmail()` output (timestamp + random suffix, `@example.com`
domain) — it can never match a pre-existing real user row, in a test DB or otherwise. I found no
path where this cleanup could touch non-test data. `deleteUserByEmail`'s target-table reasoning
(cascading FKs on `salary_history`/`bonuses`/`vacations`/etc.) is correct against
`src/lib/db/schema.ts`.

**Secret-handling discipline:** `NEON_API_KEY`/`NEON_PROJECT_ID` are read only from
`process.env`, sent only as a `Bearer` header, and every thrown error deliberately omits
response bodies (the `T-07-08` comment is honored consistently across all four Neon-branch
scripts). I did not find any point where the raw API key is logged. However, see WR-02 below —
the *derived* Neon connection URI (which embeds a live DB password) is written to `GITHUB_ENV`
and `.env.local` without ever being registered for GitHub Actions' log-masking, unlike
`NEON_API_KEY` itself (which Actions auto-masks because it originates from the `secrets`
context).

**CI job structure:** `.github/workflows/ci.yml`'s `e2e` job correctly declares `needs: ci`,
never adds a deploy step (consistent with the file's own top-of-file prohibition and
`DEPLOYMENT.md`), and the "Backstop Neon branch cleanup" step correctly uses `if: always()`. The
`ci` job's dummy `DATABASE_URL` for lint/typecheck/build is safe given `src/env.ts` only
validates URL *shape* and both the Neon serverless client and Drizzle are lazy (verified against
`src/lib/db/index.ts`).

Four warnings and two info items are below — none are blockers; the suite's actual correctness
(selector accuracy, injection safety, secret-value-in-error-message discipline) is solid.

## Warnings

### WR-01: `webServer.command` passes `--webpack` in a way npm silently drops today and will hard-error on in a future major version

**File:** `playwright.config.ts:40`
**Issue:** `command: "npm run build --webpack && npm run start"` passes `--webpack` after `npm
run build` without a `--` separator. I verified this empirically (`npm --version` → 11.19.0):
npm does **not** forward `--webpack` to the `build` script — it treats it as an unknown npm CLI
config and prints `npm warn Unknown cli config "--webpack". This will stop working in the next
major version of npm.` The flag is also redundant: `package.json`'s own `"build": "next build
--webpack"` script already hardcodes `--webpack`, so this extra flag was never doing anything.
Today this only pollutes CI logs with a warning; once npm's "next major version" ships, the
unknown-flag warning becomes a hard error, which would break `webServer` startup for the entire
`e2e` CI job (the exact failure mode `e2e/ci-branch-setup.mjs`'s own header comment is written to
guard against).
**Fix:**
```ts
command: "npm run build && npm run start",
```

### WR-02: Neon connection URI (with live DB password) is never masked in CI logs

**File:** `e2e/ci-branch-setup.mjs:87-98`, `e2e/global-setup.ts:121-130`
**Issue:** `uri` (the resolved pooled connection string, which embeds a live role password for
the freshly-created branch) is written to `$GITHUB_ENV` and `.env.local` but is never passed
through GitHub Actions' `::add-mask::` workflow command. `NEON_API_KEY` is automatically masked
by Actions because it originates from the `secrets` context, but `uri` is a value computed at
runtime from an API response — Actions has no way to know it's sensitive. If any downstream step
in the same job ever echoes `DATABASE_URL` (a build failure stack trace, a `drizzle-kit push`
connection error inheriting `stdio: "inherit"`, or a future debug `console.log`), the live
password would appear in cleartext in the public/shared CI log. Given this phase's explicit focus
on credential-leakage risk, this is the one concrete gap: nothing currently prints `uri`, but
nothing prevents it from leaking if something later does.
**Fix:** Mask the value immediately after resolving it, before writing it anywhere:
```js
const { uri } = await neonApi(/* ... */);
console.log(`::add-mask::${uri}`);
```
Apply the same in `e2e/global-setup.ts` right after its own `const { uri } = await neonApi<...>(...)`.

### WR-03: Teardown deletes its own tracking file even when the remote Neon DELETE fails, defeating the backstop's retry signal

**File:** `e2e/global-teardown.ts:34-50`
**Issue:** The `finally` block (`unlinkSync(BRANCH_ID_FILE)`, line 49) runs unconditionally,
including when the `fetch(...DELETE...)` call throws or returns non-OK (caught at lines 45-47).
`e2e/ci-branch-teardown.mjs`'s own docstring says it "no-ops if `e2e/.ci-branch.json` is already
gone (the common case, deleted by `global-teardown.ts`)" — but after this code path, the file is
also gone when deletion *failed*, not just when it succeeded. The backstop step
(`.github/workflows/ci.yml`'s `if: always()` step) therefore cannot distinguish "already cleaned
up" from "cleanup was attempted and failed" and will never retry a genuinely leaked branch. The
job does still fail loudly via `process.exitCode = 1` here, so the failure isn't silent at the CI
level, but the retry mechanism the backstop step exists for never engages for this specific
failure mode.
**Fix:** Only unlink the marker file after a confirmed-successful delete, so the backstop can
still see and retry a failed deletion:
```ts
try {
  const { branchId } = JSON.parse(readFileSync(BRANCH_ID_FILE, "utf8")) as { branchId: string };
  const res = await fetch(/* ...DELETE... */);
  if (!res.ok) throw new Error(`DELETE branch ${branchId} failed: ${res.status}`);
  unlinkSync(BRANCH_ID_FILE); // only clear the marker once deletion is confirmed
} catch (err) {
  console.error("Failed to delete CI Neon branch:", err);
  process.exitCode = 1;
}
```

### WR-04: `global-setup.ts`'s fallback branch-provisioning path is dead code, and its comment overstates that it still works

**File:** `e2e/global-setup.ts:34-39`, `86-141`
**Issue:** The header comment claims this file's full branch-creation flow (lines 86-141) "still
performs the full branch-creation flow itself, so this file's original contract keeps working for
any future caller that invokes Playwright without the preceding CI step." That's the exact
scenario the file's own earlier comment (lines 25-39) says is broken: Playwright starts
`config.webServer` (which runs `next build` — and `next build` fails immediately if
`DATABASE_URL` is unset, since `src/env.ts` validates it eagerly via `@t3-oss/env-nextjs` with no
`.optional()`) *before* `config.globalSetups` runs. So for a hypothetical future caller that sets
`CI=1` without first running `e2e/ci-branch-setup.mjs`, `webServer` would fail before this file's
fallback logic ever executes — this is precisely the failure mode `e2e/ci-branch-setup.mjs` was
introduced to fix. The fallback is unreachable in the one environment (`CI=1`, no pre-existing
`DATABASE_URL`) it's meant to serve, and the comment's claim that it "keeps working" is
misleading for a future maintainer who might rely on it.
**Fix:** Either remove the duplicated ~55-line fallback flow (keep only the
`existsSync(BRANCH_ID_FILE)` early-return guard, with a comment stating CI now always requires
`e2e/ci-branch-setup.mjs` to run first), or correct the comment to state plainly that this
fallback only helps a caller who has *already* ensured `DATABASE_URL`/webServer can start some
other way — it does not independently rescue the "no CI step ran first" scenario it claims to.

## Info

### IN-01: `global-teardown.ts`'s missing-marker-file branch appears unreachable under current CI wiring

**File:** `e2e/global-teardown.ts:28-32`
**Issue:** `if (!existsSync(BRANCH_ID_FILE)) { ... process.exitCode = 1; return; }` is written to
catch the case where `global-setup.ts` "may not have run/completed." Given the current job order
in `.github/workflows/ci.yml` (`e2e/ci-branch-setup.mjs` always runs as its own step and always
writes `e2e/.ci-branch.json` before `npm run test:e2e` starts), and given that a `webServer`
startup failure aborts the whole Playwright run before `globalTeardown` is reached (per
`e2e/ci-branch-setup.mjs`'s own header comment), this branch has no live path to execute in the
documented CI flow — by the time `global-teardown.ts` runs at all, the file is guaranteed to
exist. Not a bug, just worth a comment noting it's a defensive guard for a code path that
shouldn't currently be reachable, so a future refactor doesn't assume it's exercised by any
existing test/CI run.
**Fix:** Optional — add a one-line comment acknowledging this branch is currently unreached
under the documented job ordering, to save a future debugging session.

### IN-02: Non-null assertion on `DATABASE_URL` gives an unclear failure if ever unset

**File:** `e2e/fixtures.ts:23`
**Issue:** `const sql = neon(process.env.DATABASE_URL!);` asserts non-null without a guard. If a
spec's cleanup path ever runs with `DATABASE_URL` unset (e.g., a misconfigured local `.env.local`
that `playwright.config.ts`'s own `process.loadEnvFile` couldn't find), the failure surfaces as
whatever `neon(undefined)` throws internally, not a clear message pointing at the missing env var.
**Fix:**
```ts
export async function deleteUserByEmail(email: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for e2e/fixtures.ts cleanup");
  const sql = neon(databaseUrl);
  await sql`delete from "user" where email = ${email}`;
}
```

---

_Reviewed: 2026-09-02T14:44:11Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
