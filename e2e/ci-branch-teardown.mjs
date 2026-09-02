#!/usr/bin/env node
/**
 * CI-level backstop cleanup, run as a final `if: always()` GitHub Actions
 * step after `npm run test:e2e`.
 *
 * e2e/global-teardown.ts (Playwright's own globalTeardown hook) is the
 * primary deletion path and handles the normal pass/fail case correctly —
 * Playwright always runs globalTeardown at the end of a run regardless of
 * test outcome. This script exists only for the case where Playwright's
 * own teardown chain never gets a chance to run at all — e.g. `webServer`
 * fails to start after e2e/ci-branch-setup.mjs already created a branch,
 * which aborts the run before any of Playwright's own tasks (including our
 * globalTeardown registration) are reached. Idempotent: no-ops if
 * e2e/.ci-branch.json is already gone (the common case, deleted by
 * global-teardown.ts).
 */
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NEON_API_BASE = "https://console.neon.tech/api/v2";
const BRANCH_ID_FILE = path.resolve(__dirname, ".ci-branch.json");

async function main() {
  if (!process.env.CI) {
    return;
  }

  if (!existsSync(BRANCH_ID_FILE)) {
    // Normal case: e2e/global-teardown.ts already deleted the branch and
    // this file along with it.
    return;
  }

  const projectId = process.env.NEON_PROJECT_ID;
  if (!projectId) {
    console.error("NEON_PROJECT_ID missing — cannot run CI backstop branch cleanup");
    process.exitCode = 1;
    return;
  }

  console.error(
    `${BRANCH_ID_FILE} still present after the test run — Playwright's own globalTeardown ` +
      "did not run (likely a webServer startup failure). Deleting the branch here as a backstop.",
  );

  try {
    const { branchId } = JSON.parse(readFileSync(BRANCH_ID_FILE, "utf8"));
    const res = await fetch(`${NEON_API_BASE}/projects/${projectId}/branches/${branchId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${process.env.NEON_API_KEY}` },
    });
    if (!res.ok) {
      throw new Error(`DELETE branch ${branchId} failed: ${res.status}`);
    }
  } catch (err) {
    console.error("CI backstop branch cleanup failed:", err);
    process.exitCode = 1;
  } finally {
    unlinkSync(BRANCH_ID_FILE);
  }
}

main();
