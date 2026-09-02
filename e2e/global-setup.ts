/**
 * CI-only Neon branch lifecycle: gives every CI run its own throwaway,
 * isolated database branch (E2E-06) instead of sharing the project's real
 * default branch. Local runs are a complete no-op — they use whatever
 * DATABASE_URL is already configured in .env.local, per 07-CONTEXT.md's
 * "local repeated runs follow verify-auth-security.mjs's self-cleanup
 * pattern" decision.
 *
 * Management API base URL is `https://console.neon.tech/api/v2` (confirmed
 * against Neon's own official API reference during implementation —
 * `https://api.neon.tech/v2` from research/PITFALLS.md's illustrative
 * pseudocode is wrong, do not use it).
 *
 * The create-branch response does NOT include a ready-made
 * `connection_uris` field (confirmed live against Neon's API reference
 * during implementation, resolving Task 1's own flagged uncertainty about
 * this) — it does, however, already include `databases`/`roles` arrays for
 * the branch when `endpoints: [{ type: "read_write" }]` is requested, so
 * the database name and role name are read directly from that response
 * (never from a possibly-unset DATABASE_URL, which the CI job intentionally
 * does not pre-set — see Task 1's read_first note and .github/workflows/ci.yml's
 * `e2e` job) and used to call `GET /projects/{id}/connection_uri` for the
 * actual connection string.
 *
 * DEVIATION (Task 2, live-CI proof): Playwright's own task order starts
 * `config.webServer` BEFORE running this file (confirmed against a real
 * GitHub Actions run — playwright/lib/runner/index.js's
 * `createGlobalSetupTasks` runs the webServer plugin's setup before
 * `config.globalSetups`), so by the time this function used to run, the
 * webServer's `next build`/`next start` had already failed for lack of a
 * real DATABASE_URL. The actual provisioning now happens earlier, in
 * e2e/ci-branch-setup.mjs, run as its own GitHub Actions step *before*
 * `npm run test:e2e` (see .github/workflows/ci.yml's `e2e` job). This
 * function is left in place as a defensive no-op/fallback: if
 * e2e/.ci-branch.json already exists (the CI step already provisioned
 * everything), it does nothing; otherwise it still performs the full
 * branch-creation flow itself, so this file's original contract keeps
 * working for any future caller that invokes Playwright without the
 * preceding CI step.
 */
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

const NEON_API_BASE = "https://console.neon.tech/api/v2";
const BRANCH_ID_FILE = path.resolve(__dirname, ".ci-branch.json");

interface NeonBranch {
  id: string;
  default: boolean;
}

interface NeonDatabase {
  name: string;
  owner_name: string;
}

async function neonApi<T>(pathname: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${NEON_API_BASE}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.NEON_API_KEY}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    // Never log response bodies (T-07-08) — they can carry connection URIs
    // with live credentials. Status + endpoint only.
    throw new Error(`Neon API ${init?.method ?? "GET"} ${pathname} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export default async function globalSetup(): Promise<void> {
  if (!process.env.CI) {
    return;
  }

  if (existsSync(BRANCH_ID_FILE)) {
    // e2e/ci-branch-setup.mjs already provisioned and wrote this file as an
    // earlier CI step (before webServer/next build ran) — nothing to do.
    return;
  }

  const projectId = process.env.NEON_PROJECT_ID;
  if (!projectId) {
    throw new Error("NEON_PROJECT_ID is required in CI for e2e/global-setup.ts");
  }

  // 1. Find the project's real default branch — never hardcode "main".
  const { branches } = await neonApi<{ branches: NeonBranch[] }>(
    `/projects/${projectId}/branches`,
  );
  const parent = branches.find((b) => b.default);
  if (!parent) {
    throw new Error(`No default branch found for Neon project ${projectId}`);
  }

  // 2. Create a fresh, disposable branch (with its own read-write compute
  // endpoint) forked from that default branch.
  const branchName = `e2e-ci-${process.env.GITHUB_RUN_ID ?? Date.now()}`;
  const created = await neonApi<{
    branch: { id: string };
    databases: NeonDatabase[];
  }>(`/projects/${projectId}/branches`, {
    method: "POST",
    body: JSON.stringify({
      branch: { parent_id: parent.id, name: branchName },
      endpoints: [{ type: "read_write" }],
    }),
  });

  const branchId = created.branch.id;
  const database = created.databases[0];
  if (!database) {
    throw new Error(`Newly created branch ${branchId} has no database in its create response`);
  }

  // 3. Resolve the actual connection URI for that branch/database/role.
  const { uri } = await neonApi<{ uri: string }>(
    `/projects/${projectId}/connection_uri?branch_id=${branchId}&database_name=${encodeURIComponent(database.name)}&role_name=${encodeURIComponent(database.owner_name)}&pooled=true`,
  );

  // 4. Point this run at the fresh branch. Both belt-and-suspenders: the
  // in-process env var (webServer is spawned as this process's own child
  // and inherits it) and a .env.local file (removes any doubt about how
  // next build/next start resolve env in this exact Next.js version).
  process.env.DATABASE_URL = uri;
  writeFileSync(path.resolve(__dirname, "..", ".env.local"), `DATABASE_URL=${uri}\n`);

  // 5. Apply the current schema to the fresh, empty branch non-interactively.
  execFileSync("npx", ["drizzle-kit", "push", "--force"], {
    env: { ...process.env, DATABASE_URL: uri },
    stdio: "inherit",
  });

  // 6. Persist the branch id for global-teardown.ts — Playwright does not
  // guarantee shared in-memory module state between setup and teardown.
  writeFileSync(BRANCH_ID_FILE, JSON.stringify({ branchId }));
}
