# Phase 7: E2E Test Suite — API Coverage

**Detector result:** `detected: true` (triggered by the phrase "Playwright MCP server integration" in 07-PATTERNS.md's file-classification table, plus the phase's own genuine use of the Neon Management API for CI branch lifecycle).

This phase touches two external API surfaces. Neither is a *product-facing* integration (no end-user-visible feature calls either API) — both are test/CI infrastructure. Recorded honestly below rather than silently skipped, per the API Coverage Decision Checkpoint.

## 1. Neon Management API (`https://console.neon.tech/api/v2`)

Used exclusively by `e2e/global-setup.ts` / `e2e/global-teardown.ts` to give each CI run its own throwaway database branch (E2E-06). This is infrastructure lifecycle, not a product feature — narrowed from the full Neon API surface accordingly.

| capability | decision | reason |
|---|---|---|
| `POST /projects/{project_id}/branches` (create branch, with an endpoint) | INTEGRATE | Core mechanism for E2E-06's per-CI-run isolated branch |
| Branch connection URI retrieval (from the create-branch response, or `GET /projects/{project_id}/connection_uri`) | INTEGRATE | Needed to point `DATABASE_URL` at the new branch |
| `DELETE /projects/{project_id}/branches/{branch_id}` (delete branch) | INTEGRATE | Required cleanup so CI branches never accumulate (cost + data hygiene) |
| `GET /projects/{project_id}/branches` (list, to find the `default: true` parent) | INTEGRATE | Needed to resolve the correct parent branch to fork from without hardcoding a branch name |
| Schema diffing / branch reset / restore endpoints | OPT-OUT | Not needed — this phase applies the repo's own `drizzle-kit push` to the fresh branch instead of diffing against Neon's own schema-diff API |
| Read replicas | OPT-OUT | No read-scaling need for a single-CI-run throwaway branch |
| Org/project-level admin endpoints (create/delete *projects*, billing, members) | OPT-OUT | Out of scope — this phase only manages branches within the project the app already deploys to |
| Neon Auth / Data API / Object Storage / AI Gateway / Functions | OPT-OUT | Unrelated backend primitives this app does not use anywhere (its auth is Better Auth, not Neon Auth) |
| Branch-scoped logs / observability (`/telemetry/...`) | OPT-OUT | Not needed for a short-lived CI branch with no debugging requirement beyond CI's own job logs |

## 2. Playwright MCP (E2E-05)

**No external API integration in the product-facing sense.** Per CONTEXT.md's locked decision, "wired into the repo" means committing a `.mcp.json` that points at `npx @playwright/mcp@latest` for future interactive test authoring against the running dev server — a one-time dev-tooling config addition, not a runtime dependency the CI suite calls into. There is no capability surface to enumerate INTEGRATE/OPT-OUT rows for beyond "the MCP server starts and can drive a browser," which is the entire point of installing it; narrowing further would be inventing scope that doesn't exist.
