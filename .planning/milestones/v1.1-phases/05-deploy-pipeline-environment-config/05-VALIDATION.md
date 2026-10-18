---
phase: 5
slug: deploy-pipeline-environment-config
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-01
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.11 + jsdom (existing, see Phase 4) |
| **Config file** | vitest.config.ts (existing) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test -- --coverage` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd-verify-work`:** Full CI suite (`.github/workflows/ci.yml`) must be green on the branch
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 0 | DEPLOY-03 | — | GitHub Actions CI job runs lint+typecheck+test+build on every PR and blocks merge on failure | integration | `npm run lint && npx tsc --noEmit && npm test && npm run build` | ✅ W0 | ⬜ pending |
| 05-01-02 | 01 | 0 | SEC-04 | T-05-01 | Better Auth resolves `baseURL`/allowed-hosts correctly from request origin on PR-preview, staging, and production | unit | `npm test` (auth config) | ❌ W0 (no dedicated test yet) | ⬜ pending |
| 05-02-01 | TBD | TBD | DEPLOY-01 | — | Staging persistent environment reachable independently, own Neon branch, own data | manual | `curl https://<staging-domain>/` + Neon dashboard branch check | ✅ W0 | ⬜ pending |
| 05-02-02 | TBD | TBD | DEPLOY-02 | T-05-02 | Environment variables scoped correctly per environment (no prod secret leaking to Preview) | manual | Vercel dashboard → Environment Variables scope check | ✅ W0 | ⬜ pending |
| 05-02-03 | TBD | TBD | DEPLOY-05 | T-05-03 | GitHub Actions and Vercel auto-deploy never both deploy the same environment | manual | Trigger one commit, observe Vercel deployments list for exactly one deploy per environment | ✅ W0 | ⬜ pending |
| 05-02-04 | TBD | TBD | DEPLOY-04 | — | Documented feature-branch → staging → production procedure exists and was followed for a real deploy | manual | Walk `DEPLOYMENT.md` checklist end-to-end | ✅ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*(The planner assigns final task IDs/waves — this table is seeded from research's requirement→test map and refined during planning.)*

---

## Wave 0 Requirements

- [ ] `.github/workflows/ci.yml` — GitHub Actions CI workflow (lint, typecheck, test, build) — stubs coverage for DEPLOY-03
- [ ] `vercel.json` — disables Vercel auto-deploy on main/staging (`git.deploymentEnabled`) — supports DEPLOY-05
- [ ] `src/lib/auth.ts` / `src/env.ts` — dynamic `baseURL`/allowedHosts resolution — supports SEC-04

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Persistent staging URL reachable with its own data | DEPLOY-01 | Requires live Vercel domain + Neon branch provisioning, not reproducible in a unit test | Open the staging URL in a browser, confirm it loads and shows staging-only data distinct from production |
| Login/register succeed on PR-preview, staging, and production without cross-environment cookie/redirect failures | SEC-04 | Requires real deployed origins on 3 distinct environments; cannot be simulated locally | Register/login on a PR-preview deploy, on staging, and on production; confirm no redirect loop or rejected cookie on any |
| Exactly one deploy path per environment (no double-deploy race) | DEPLOY-05 | Requires observing real Vercel deployment history after a push, not a local assertion | Push one commit to main, check Vercel dashboard shows exactly one deployment for that commit/environment |
| Environment variables correctly scoped per environment | DEPLOY-02 | Vercel dashboard configuration state, not code | Inspect Vercel Environment Variables settings; confirm each var's Production/Preview/Development checkboxes match intent |
| Documented release procedure followed for a real deploy | DEPLOY-04 | Process verification, not a code assertion | Execute `DEPLOYMENT.md` checklist once for a real feature branch → staging → production deploy |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
