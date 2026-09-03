#!/usr/bin/env node
/**
 * CI-only Neon branch provisioning, run as its own GitHub Actions step
 * BEFORE `npm run test:e2e`.
 *
 * Why this exists as a standalone script rather than living solely inside
 * Playwright's `globalSetup` hook (e2e/global-setup.ts): Playwright's
 * internal task order starts `config.webServer` BEFORE running the user's
 * `globalSetup` file (confirmed empirically against a real GitHub Actions
 * run of this exact job — playwright/lib/runner/index.js's
 * `createGlobalSetupTasks` runs `createPluginSetupTasks` (webServer) before
 * `config.globalSetups`). Since `webServer.command` here builds and starts
 * the real Next.js app (which validates DATABASE_URL via src/env.ts at
 * `next build` module-collection time, then makes real DB calls once
 * running), the isolated Neon branch must exist and be exported to the job
 * env *before* `npm run test:e2e` is even invoked — not from inside it.
 * e2e/global-setup.ts is left in place as a defensive no-op/fallback (see
 * its own guard) and e2e/global-teardown.ts is unaffected — Playwright's
 * globalTeardown runs at the very end of the whole run regardless of this
 * ordering quirk, so branch *deletion* was never actually broken, only
 * *creation* was.
 *
 * Guarded to no-op outside CI, mirroring e2e/global-setup.ts's own guard.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NEON_API_BASE = "https://console.neon.tech/api/v2";
const BRANCH_ID_FILE = path.resolve(__dirname, ".ci-branch.json");
const ENV_LOCAL_FILE = path.resolve(__dirname, "..", ".env.local");

async function neonApi(pathname, init, { sensitive = false } = {}) {
  const res = await fetch(`${NEON_API_BASE}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.NEON_API_KEY}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    // Only the connection_uri endpoint's response body carries a live
    // credential (T-07-08) — every other Neon API error body is just
    // {message, code}, safe to surface so CI failures are diagnosable
    // (e.g. "branch limit exceeded for plan") instead of a bare status code.
    let detail = "";
    if (!sensitive) {
      try {
        const body = await res.clone().json();
        if (body?.message) detail = `: ${body.message}`;
      } catch {
        // response wasn't JSON — fall back to the bare status
      }
    }
    throw new Error(`Neon API ${init?.method ?? "GET"} ${pathname} failed: ${res.status}${detail}`);
  }
  return res.json();
}

async function main() {
  if (!process.env.CI) {
    return;
  }

  const projectId = process.env.NEON_PROJECT_ID;
  if (!projectId) {
    throw new Error("NEON_PROJECT_ID is required in CI for e2e/ci-branch-setup.mjs");
  }

  // 1. Find the project's real default branch — never hardcode "main".
  const { branches } = await neonApi(`/projects/${projectId}/branches`);
  const parent = branches.find((b) => b.default);
  if (!parent) {
    throw new Error(`No default branch found for Neon project ${projectId}`);
  }

  // 1.5. Best-effort prune of stale `e2e-ci-*` branches this same script
  // creates (see step 2 below). These are single-purpose, disposable CI
  // branches — e2e/global-teardown.ts and the "Backstop Neon branch
  // cleanup" CI step both delete the branch a run created once that run
  // finishes, but a run that gets cancelled or hard-killed before either
  // teardown path runs leaves its branch behind forever. On a plan with a
  // low branch-count ceiling, enough of those orphans accumulate to make
  // *this* POST fail with "branches limit exceeded" before a single test
  // ever runs. Age-gated (>2h) so a slow-but-still-running concurrent CI
  // job's branch is never raced/deleted out from under it.
  const staleCutoffMs = Date.now() - 2 * 60 * 60 * 1000;
  const staleBranches = branches.filter(
    (b) => b.name?.startsWith("e2e-ci-") && new Date(b.created_at).getTime() < staleCutoffMs,
  );
  for (const stale of staleBranches) {
    try {
      await neonApi(`/projects/${projectId}/branches/${stale.id}`, { method: "DELETE" });
      console.log(`Pruned stale CI branch ${stale.id} (${stale.name})`);
    } catch (err) {
      // Non-fatal — worst case this run still fails the same way it would
      // have without pruning, just with a clearer error from the POST below.
      console.error(`Failed to prune stale CI branch ${stale.id} (${stale.name}):`, err);
    }
  }

  // 2. Create a fresh, disposable branch (with its own read-write compute
  // endpoint) forked from that default branch.
  const branchName = `e2e-ci-${process.env.GITHUB_RUN_ID ?? Date.now()}`;
  const created = await neonApi(`/projects/${projectId}/branches`, {
    method: "POST",
    body: JSON.stringify({
      branch: { parent_id: parent.id, name: branchName },
      endpoints: [{ type: "read_write" }],
    }),
  });

  const branchId = created.branch.id;
  const database = created.databases?.[0];
  if (!database) {
    throw new Error(`Newly created branch ${branchId} has no database in its create response`);
  }

  // 3. Resolve the actual connection URI for that branch/database/role.
  const { uri } = await neonApi(
    `/projects/${projectId}/connection_uri?branch_id=${branchId}&database_name=${encodeURIComponent(database.name)}&role_name=${encodeURIComponent(database.owner_name)}&pooled=true`,
    undefined,
    { sensitive: true },
  );

  // Mask the resolved URI immediately — it embeds a live DB password and,
  // unlike NEON_API_KEY, GitHub Actions has no way to know it's sensitive
  // since it's computed at runtime rather than sourced from `secrets`.
  if (process.env.GITHUB_ACTIONS) {
    console.log(`::add-mask::${uri}`);
  }

  // 4. Export DATABASE_URL to every later step in this job (so
  // `npm run test:e2e` — including its Playwright-spawned webServer child —
  // inherits it at spawn time) AND write .env.local as a second,
  // independent path (Next.js's own built-in env loading), belt-and-suspenders.
  if (process.env.GITHUB_ENV) {
    appendFileSync(process.env.GITHUB_ENV, `DATABASE_URL=${uri}\n`);
  }
  writeFileSync(ENV_LOCAL_FILE, `DATABASE_URL=${uri}\n`);

  // 5. Apply the current schema to the fresh, empty branch non-interactively.
  execFileSync("npx", ["drizzle-kit", "push", "--force"], {
    env: { ...process.env, DATABASE_URL: uri },
    stdio: "inherit",
  });

  // 6. Persist the branch id for e2e/global-teardown.ts (and the CI-level
  // `if: always()` backstop cleanup step) to read back.
  writeFileSync(BRANCH_ID_FILE, JSON.stringify({ branchId }));

  console.log(`Provisioned isolated Neon branch ${branchId} (${branchName})`);
}

main().catch((err) => {
  console.error("Failed to provision CI Neon branch:", err);
  process.exit(1);
});
