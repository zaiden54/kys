/**
 * Deletes the CI-only Neon branch created by e2e/global-setup.ts. Local runs
 * are a no-op, mirroring setup's guard.
 *
 * A failed delete here is logged loudly but never thrown past teardown — a
 * leaked CI branch is a cost/hygiene issue to catch via Neon's own
 * dashboard, not a reason to fail an otherwise-passing CI run. The job's
 * exit status still reflects the failure via process.exitCode.
 */
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";

const NEON_API_BASE = "https://console.neon.tech/api/v2";
const BRANCH_ID_FILE = path.resolve(__dirname, ".ci-branch.json");

export default async function globalTeardown(): Promise<void> {
  if (!process.env.CI) {
    return;
  }

  const projectId = process.env.NEON_PROJECT_ID;
  if (!projectId) {
    console.error("NEON_PROJECT_ID missing in CI — cannot delete e2e branch");
    process.exitCode = 1;
    return;
  }

  if (!existsSync(BRANCH_ID_FILE)) {
    console.error(`${BRANCH_ID_FILE} not found — global-setup.ts may not have run/completed`);
    process.exitCode = 1;
    return;
  }

  try {
    const { branchId } = JSON.parse(readFileSync(BRANCH_ID_FILE, "utf8")) as {
      branchId: string;
    };
    const res = await fetch(`${NEON_API_BASE}/projects/${projectId}/branches/${branchId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${process.env.NEON_API_KEY}` },
    });
    if (!res.ok) {
      throw new Error(`DELETE branch ${branchId} failed: ${res.status}`);
    }
  } catch (err) {
    console.error("Failed to delete CI Neon branch:", err);
    process.exitCode = 1;
  } finally {
    unlinkSync(BRANCH_ID_FILE);
  }
}
