---
schema_version: 1
open_count: 4
waived_count: 0
fixed_count: 0
total_count: 4
last_updated: 2026-09-01T13:19:09.941Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 03 | unrun-verify | .planning/phases/03-vacation-pay/03-04-PLAN.md |  | Task 1 tracer preview check and Task 2 full manual UAT (create/edit/overlap/blocked-delete/nav-link) not click-through-verified in a browser during this autonomous single-session execution; substituted with a full production build (npm run build) plus 315 passing automated tests (23 real-DB forecast integration cases + 9 mocked vacation-action cases) covering the exact same behaviors. | open |  | 2026-08-30T21:12:34.632Z |  |
| 2 | 04 | unrun-verify | .planning/phases/04-annual-overview-pwa-installability/04-01-PLAN.md |  | AnnualPieChart's actual donut rendering (proportions, colors, legibility) was not click-through-verified in a real browser during this autonomous single-session execution; substituted with jsdom render tests (baseline-note presence), a Cell-count structural check, and a full production build. A human should visually confirm the chart on the home screen before phase close-out. | open |  | 2026-08-31T07:40:31.315Z |  |
| 3 | 05 | unrun-verify | .github/workflows/ci.yml |  | CI no longer exercises the repository/DB layer (money/tax-critical code): 6 unmocked DB-integration test files excluded from CI's npm test invocation (schema.test.ts, salary-repository.test.ts, bonus-repository.test.ts, vacation-repository.test.ts, annual-summary.test.ts, forecast.test.ts) because src/lib/db/index.ts's neon-http driver cannot connect to a vanilla postgres:17 service container. These 6 files still run locally against a real Neon dev branch (npm test, unaffected). Phase 7's isolated-branch-per-CI-run (E2E-06) is the intended long-term fix. | open |  | 2026-09-01T12:06:31.951Z |  |
| 4 | 05 | unrun-verify | .planning/phases/05-deploy-pipeline-environment-config/DEPLOYMENT.md |  | DEPLOY-02 partial: BETTER_AUTH_SECRET scoping for the Vercel Preview environment was not verified this phase — no MCP tool available to read/write Vercel project environment variables (Neon MCP and Vercel MCP tools covered branch/deployment/protection management but not env vars), and the vercel CLI had no authenticated session in this environment. DATABASE_URL is auto-scoped per-branch by the existing Vercel-Neon Marketplace integration (verified). A human should check the Vercel dashboard to confirm BETTER_AUTH_SECRET differs between Production and Preview. | open |  | 2026-09-01T13:19:09.941Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "03",
    "file": ".planning/phases/03-vacation-pay/03-04-PLAN.md",
    "line": null,
    "description": "Task 1 tracer preview check and Task 2 full manual UAT (create/edit/overlap/blocked-delete/nav-link) not click-through-verified in a browser during this autonomous single-session execution; substituted with a full production build (npm run build) plus 315 passing automated tests (23 real-DB forecast integration cases + 9 mocked vacation-action cases) covering the exact same behaviors.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-30T21:12:34.632Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "04",
    "file": ".planning/phases/04-annual-overview-pwa-installability/04-01-PLAN.md",
    "line": null,
    "description": "AnnualPieChart's actual donut rendering (proportions, colors, legibility) was not click-through-verified in a real browser during this autonomous single-session execution; substituted with jsdom render tests (baseline-note presence), a Cell-count structural check, and a full production build. A human should visually confirm the chart on the home screen before phase close-out.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-31T07:40:31.315Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "05",
    "file": ".github/workflows/ci.yml",
    "line": null,
    "description": "CI no longer exercises the repository/DB layer (money/tax-critical code): 6 unmocked DB-integration test files excluded from CI's npm test invocation (schema.test.ts, salary-repository.test.ts, bonus-repository.test.ts, vacation-repository.test.ts, annual-summary.test.ts, forecast.test.ts) because src/lib/db/index.ts's neon-http driver cannot connect to a vanilla postgres:17 service container. These 6 files still run locally against a real Neon dev branch (npm test, unaffected). Phase 7's isolated-branch-per-CI-run (E2E-06) is the intended long-term fix.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-01T12:06:31.951Z",
    "resolved_at": null
  },
  {
    "id": 4,
    "kind": "unrun-verify",
    "phase": "05",
    "file": ".planning/phases/05-deploy-pipeline-environment-config/DEPLOYMENT.md",
    "line": null,
    "description": "DEPLOY-02 partial: BETTER_AUTH_SECRET scoping for the Vercel Preview environment was not verified this phase — no MCP tool available to read/write Vercel project environment variables (Neon MCP and Vercel MCP tools covered branch/deployment/protection management but not env vars), and the vercel CLI had no authenticated session in this environment. DATABASE_URL is auto-scoped per-branch by the existing Vercel-Neon Marketplace integration (verified). A human should check the Vercel dashboard to confirm BETTER_AUTH_SECRET differs between Production and Preview.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-01T13:19:09.941Z",
    "resolved_at": null
  }
]
````
