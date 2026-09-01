# Deployment & Release Procedure

**Status:** Live as of 2026-09-01 (Phase 5)

## Environments

| Environment | How it's created | Domain pattern | Database |
|---|---|---|---|
| Local dev | `npm run dev` | `http://localhost:3000` | Neon `dev` branch (`.env.local`) |
| PR-preview | Automatic on every push to a non-`main` branch — Vercel's native GitHub git integration | `on-hands-git-<branch-slug>-careeremit-9861s-projects.vercel.app` (stable, per-branch) and a per-deployment hash URL | A dedicated Neon branch, auto-created and destroyed by the **Vercel↔Neon Marketplace integration** — named `preview/<branch-name>`, forked from `production` at push time. Confirmed live: pushing `gsd/phase-05-deploy-pipeline-environment-config` produced Neon branch `preview/gsd/phase-05-deploy-pipeline-environment-config`. |
| Production | Push/merge to `main` | `on-hands-three.vercel.app`, `on-hands-careeremit-9861s-projects.vercel.app`, `on-hands-git-main-careeremit-9861s-projects.vercel.app` | Neon `production` branch |

**No separate persistent "staging" environment exists.** Phase 5 originally planned one (its own always-on Vercel domain + dedicated Neon branch), and even provisioned it (a pushed `staging` git branch + a `preview/staging` Neon branch) before discovering during execution that:

1. The Vercel↔Neon Marketplace integration was *already* auto-provisioning an isolated Neon branch per git branch — including per PR-preview — so a hand-built "staging" branch duplicated infrastructure that already existed for every branch.
2. Making the staging branch-alias domain reachable for automated/manual checks would have required disabling Vercel Authentication (SSO) project-wide for all preview deployments (the Vercel API has no "protect production only" mode) — a real security-posture change beyond this phase's scope.

The project owner decided to drop the standalone staging concept and rely on PR-preview deployments (which already get the same per-branch database isolation) for the manual pre-production check. The `staging` git branch and its Neon branch were deleted after this decision.

## Release Procedure

**feature-branch → PR-preview (manual check) → production**

1. Push a feature/phase branch. Vercel auto-deploys it to its own preview URL; the Vercel↔Neon integration auto-provisions an isolated `preview/<branch>` Neon database for it.
2. Open a PR against `main`. GitHub Actions (`.github/workflows/ci.yml`) runs lint + typecheck + build + pure-domain tests on every push to the PR. `main` has branch protection requiring this `ci` check to pass — a red check blocks merge (`enforce_admins: true`).
3. **Manual check on PR-preview** (developer, logged into their own Vercel account — the preview URL is protected by Vercel Authentication, same as it always was): open the PR's preview URL, confirm the app loads, and exercise register/login to confirm no cross-environment redirect/cookie failures (SEC-04's dynamic `allowedHosts` resolution covers this).
4. Merge the PR to `main`. Vercel's native git integration deploys `main` to production automatically — this is the **only** deploy path for production; GitHub Actions has no deploy step (DEPLOY-05: verified no `vercel deploy`/`vercel --prod` invocation anywhere in `ci.yml`).

## Exercised for real (this phase)

- PR #2 (`gsd/phase-05-deploy-pipeline-environment-config` → `main`): opened, CI went green (`gh pr checks 2`), branch protection on `main` confirmed live via `gh api repos/zaiden54/kys/branches/main/protection` (returns 200 with `required_status_checks.contexts: ["ci"]`, was a 404 "Branch not protected" before this phase).
- PR #2's preview deployment (`dpl_CF66P37L5G8CXBGKKV6idHxEPbMn`, READY) has its own Neon branch (`preview/gsd/phase-05-deploy-pipeline-environment-config`, auto-created by the Vercel↔Neon integration) — confirmed via `mcp__Neon__list_branches` during this phase's execution.

## Environment variable scoping (DEPLOY-02) — partial, open item

- `DATABASE_URL`: auto-scoped per-branch by the Vercel↔Neon Marketplace integration for every Preview deployment (confirmed via the `neonCreatedAtMs`/branch-per-deployment behavior observed in Vercel's own deployment metadata during this phase). No manual action needed.
- `BETTER_AUTH_SECRET` for the Preview environment: **not verified this phase.** The orchestrator had Neon MCP tools (branch create/list/delete) and Vercel MCP tools (project/deployment/protection read+write) available, but no tool to read or write Vercel project environment variables — that requires either an authenticated `vercel` CLI session (none was available; `vercel whoami` reported logged out with no token in this environment) or the Vercel dashboard directly.
- **Action needed:** a human should check Vercel dashboard → `on-hands` project → Settings → Environment Variables → confirm `BETTER_AUTH_SECRET` is NOT the same value for Production and Preview (DEPLOY-02's own prohibition: never scope a production secret to Preview). If it is shared, generate a fresh value for Preview only.

## Deployment protection

Vercel Authentication (SSO) is enabled project-wide (`all_except_custom_domains` — i.e. every deployment URL except the three custom/default production domains requires a Vercel account login to view). This was **not changed** during this phase (an attempt to narrow it to "preview only" was blocked — the Vercel API has no such mode; the only way to make preview URLs publicly reachable is to disable protection entirely, which the project owner declined once the trade-off was clear). This means:

- Anyone with a `careeremit-9861s-projects` Vercel account can view any PR-preview or production deployment.
- Automated scripts (e.g. `scripts/verify-auth-flow.mjs`) cannot reach a PR-preview URL unauthenticated. The "manual check" step above is genuinely manual — a human logs into Vercel and clicks through it — which matches the requirement's own wording ("staging (ручная проверка)" / "manual check").
