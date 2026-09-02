/**
 * CI-only Neon branch lifecycle: gives every CI run its own throwaway,
 * isolated database branch (E2E-06) instead of sharing the project's real
 * default branch. Local runs are a complete no-op — they use whatever
 * DATABASE_URL is already configured in .env.local, per 07-CONTEXT.md's
 * "local repeated runs follow verify-auth-security.mjs's self-cleanup
 * pattern" decision.
 *
 * DEVIATION (Task 2, live-CI proof): Playwright's own task order starts
 * `config.webServer` BEFORE running this file (confirmed against a real
 * GitHub Actions run — playwright/lib/runner/index.js's
 * `createGlobalSetupTasks` runs the webServer plugin's setup before
 * `config.globalSetups`), so by the time this function used to run, the
 * webServer's `next build`/`next start` had already failed for lack of a
 * real DATABASE_URL. The actual provisioning now happens earlier, in
 * e2e/ci-branch-setup.mjs, run as its own GitHub Actions step *before*
 * `npm run test:e2e` (see .github/workflows/ci.yml's `e2e` job).
 *
 * This function is now only a guard, not a fallback: CI always requires
 * e2e/ci-branch-setup.mjs to have already run and written
 * e2e/.ci-branch.json before webServer/next build starts. There is no
 * self-contained fallback branch-creation path here anymore — a duplicate
 * of ci-branch-setup.mjs's flow used to live in this file, but it could
 * never actually run in the one scenario (CI=1, no pre-existing
 * DATABASE_URL) it claimed to rescue, since webServer's `next build` fails
 * before this globalSetup hook is ever reached. If e2e/.ci-branch.json is
 * missing, that means the CI step didn't run — surface that loudly instead
 * of silently trying (and failing) to duplicate its work.
 */
import { existsSync } from "node:fs";
import path from "node:path";

const BRANCH_ID_FILE = path.resolve(__dirname, ".ci-branch.json");

export default async function globalSetup(): Promise<void> {
  if (!process.env.CI) {
    return;
  }

  if (existsSync(BRANCH_ID_FILE)) {
    // e2e/ci-branch-setup.mjs already provisioned and wrote this file as an
    // earlier CI step (before webServer/next build ran) — nothing to do.
    return;
  }

  throw new Error(
    "e2e/.ci-branch.json not found — e2e/ci-branch-setup.mjs must run as its own CI step " +
      "before `npm run test:e2e` (see .github/workflows/ci.yml's `e2e` job). By the time " +
      "this globalSetup hook runs, Playwright's webServer has already started `next build`, " +
      "which requires DATABASE_URL to already be set.",
  );
}
