---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 0
total_count: 2
last_updated: 2026-08-31T07:40:31.315Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 03 | unrun-verify | .planning/phases/03-vacation-pay/03-04-PLAN.md |  | Task 1 tracer preview check and Task 2 full manual UAT (create/edit/overlap/blocked-delete/nav-link) not click-through-verified in a browser during this autonomous single-session execution; substituted with a full production build (npm run build) plus 315 passing automated tests (23 real-DB forecast integration cases + 9 mocked vacation-action cases) covering the exact same behaviors. | open |  | 2026-08-30T21:12:34.632Z |  |
| 2 | 04 | unrun-verify | .planning/phases/04-annual-overview-pwa-installability/04-01-PLAN.md |  | AnnualPieChart's actual donut rendering (proportions, colors, legibility) was not click-through-verified in a real browser during this autonomous single-session execution; substituted with jsdom render tests (baseline-note presence), a Cell-count structural check, and a full production build. A human should visually confirm the chart on the home screen before phase close-out. | open |  | 2026-08-31T07:40:31.315Z |  |

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
  }
]
````
