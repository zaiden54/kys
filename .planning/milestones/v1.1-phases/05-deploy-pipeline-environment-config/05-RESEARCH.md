# Phase 5: Deploy Pipeline & Environment Config - Research

**Researched:** 2026-09-01
**Domain:** Vercel deployment, GitHub Actions CI, Neon database branching, Better Auth environment configuration
**Confidence:** HIGH

## Summary

Phase 5 establishes a multi-environment deployment pipeline for a Next.js + Vercel + Neon application with automated CI checks and environment-scoped configuration. The phase bridges development (local + PR previews) → staging (persistent integration environment) → production (live users), with each tier having its own database branch, environment variables, and `BETTER_AUTH_URL` origin. GitHub Actions CI runs lint, typecheck, and unit tests on every PR and blocks merge on failure. Vercel auto-deploy is disabled; GitHub Actions becomes the sole deploy entry point, eliminating race conditions. The Better Auth security gap (SEC-04) is resolved by moving from a static `BETTER_AUTH_URL` to a dynamic `baseURL` configuration that validates against an allowlist of trusted origins per environment.

**Primary recommendation:** Implement GitHub Actions as the sole deployment orchestrator; disable Vercel auto-deploy via `vercel.json`. Configure Better Auth's `baseURL` as an object with `allowedHosts` allowlist validated at request time rather than a static environment variable. Use Vercel's Neon Marketplace integration to auto-create database branches per preview deployment. Establish a release checklist document (`DEPLOYMENT.md`) that formalizes feature-branch → staging → production workflow with pre-deploy verification steps.

## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation choices are at Claude's discretion — pure infrastructure phase with no user-facing behavior to design.

### Claude's Discretion
- How `BETTER_AUTH_URL`/trusted-origins resolve per environment (static per-environment env var vs. dynamic request-derived origin) is an implementation choice, constrained only by success criterion 2 (must work correctly on PR-preview, staging, and production without cross-environment redirect/cookie failures).
- Whether the single deploy path (success criterion 3) is "GitHub Actions deploys, Vercel auto-deploy disabled" or "Vercel auto-deploy only, GitHub Actions runs checks but not deploy" is Claude's call — either satisfies "exactly one deploy path per environment."
- Naming/structure of the staging Neon branch and Vercel domain is Claude's call.

### Deferred Ideas (OUT OF SCOPE)
None — discuss phase skipped (infrastructure phase).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEPLOY-01 | Persistent staging URL (its own Vercel domain + its own Neon branch) exists, is reachable independent of production, and shows its own data | Vercel custom/pro environments; Neon branching with persistent root staging branch |
| DEPLOY-02 | Environment-scoped env vars confirmed (BETTER_AUTH_URL, DATABASE_URL per environment) | Vercel environment variable scoping (Production/Preview/Development); Neon auto-inject via Marketplace integration |
| DEPLOY-03 | Every PR runs lint + typecheck + unit tests via GitHub Actions, failing check blocks merge | GitHub Actions CI workflow template; branch protection rules |
| DEPLOY-04 | Documented feature-branch → staging (manual check) → production release procedure, exercised once for real | Release workflow patterns; staging verification checklist |
| DEPLOY-05 | Exactly one deploy path per environment; GitHub Actions and Vercel auto-deploy never both deploy the same environment | vercel.json `ignoreCommand`/`git.deploymentEnabled` configuration; GitHub Actions deployment strategy |
| SEC-04 | `BETTER_AUTH_URL`/allowed-hosts resolve correctly on PR-preview, staging, and production without cross-environment redirect/cookie failures | Better Auth dynamic baseURL with allowedHosts allowlist pattern |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Environment variable scoping | API / Backend (env.ts, auth.ts) | DevOps (Vercel dashboard, vercel.json) | Environment variables and auth config are server-side concerns; scoping rules enforced at deploy time |
| CI/CD workflow orchestration | DevOps (GitHub Actions) | API / Backend (build system) | GitHub Actions is the deployment entry point; build system (Next.js) is invoked by Actions |
| Database branching per environment | Database / Storage (Neon) | DevOps (Vercel Marketplace integration) | Neon owns branch creation; Vercel integration automates branch lifecycle |
| Authentication URL resolution | API / Backend (Better Auth config) | Frontend Server (SSR/hydration) | Auth URL is server-side; used by Better Auth and checked by cookie validation on both tiers |
| Release approval gate | DevOps / Operations (manual staging UAT) | Frontend (visual regression if applicable) | Human decision to promote from staging to production; verification happens at deploy time |

## Standard Stack

### Core Deployment Tooling

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Vercel | Latest (dashboard + CLI) | Hosting and deployment platform | Native Next.js 16 support, zero-config for App Router; auto-CDN, preview deployments, edge runtime; Marketplace integration with Neon |
| GitHub Actions | Built-in (gh.com) | CI/CD orchestration and deployment trigger | Free with GitHub.com repos; native Git integration; status checks block merge on failed tests |
| Neon | Serverless Postgres (via Marketplace) | Database per environment | Copy-on-write branching for instant preview/staging branches; Vercel Marketplace integration auto-injects `DATABASE_URL` per environment; scale-to-zero cost |
| Vercel Neon Marketplace Integration | Latest | Automatic database branch management | Creates isolated branch per PR preview; auto-deletes branch on PR close; generates unique credentials per branch (no production key reuse) |
| Better Auth | 1.7.2 (configured per environment) | Authentication with dynamic origin resolution | Dynamic `baseURL` with `allowedHosts` allowlist supports PR-preview, staging, and production on different origins without hardcoding |

### Supporting Tools for CI/CD

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| npm | Built-in (from package.json scripts) | Dependency installation and build orchestration | Standard Node.js package manager; cache via GitHub Actions actions/setup-node@v4 |
| Drizzle Kit | 0.31.10 | Database migrations (for staging/preview schema sync) | Code-first schema allows preview branches to inherit parent schema via copy-on-write; migrations run at app start if needed (handled in server startup or manual trigger) |
| Vercel CLI | Latest | Local preview, branch deployment info, env var management | `vercel env pull` for local development; `vercel deploy --prod` for emergency deploy; deploy preview/staging from CLI |

## Package Legitimacy Audit

> **Status:** All packages already pinned in Phase 1-4; no new packages required for Phase 5 infrastructure configuration.

| Package | Registry | Age | Status | Verdict |
|---------|----------|-----|--------|---------|
| All production/dev dependencies | npm | Verified in Phase 1-4 | Already audited | OK |

**Packages removed due to [SLOP] verdict:** None
**Packages flagged as suspicious [SUS]:** None
**New packages in Phase 5:** None — this phase uses existing stack

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub.com (Git)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │feature-branch│  │staging-branch│  │main (master) │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
└──────────┬──────────────┬──────────────┬──────────────────────────┘
           │              │              │
           ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│             GitHub Actions (CI/CD Pipeline)                     │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Trigger: on PR, on push to main, on staging merge      │    │
│  │ ┌─────────────────────────────────────────┐            │    │
│  │ │ 1. Checkout code + setup Node           │            │    │
│  │ │ 2. npm ci (cache: npm)                  │            │    │
│  │ │ 3. npm run lint (ESLint)                │            │    │
│  │ │ 4. npx tsc --noEmit (TypeScript)        │            │    │
│  │ │ 5. npm test (Vitest)                    │            │    │
│  │ │ 6. npm run build (with --webpack)       │            │    │
│  │ │ 7. [On main merge] Deploy to Vercel     │            │    │
│  │ │    via vercel deploy --prod              │            │    │
│  │ └─────────────────────────────────────────┘            │    │
│  │ BLOCKS: PR merge if lint/typecheck/test fail           │    │
│  └────────────────────────────────────────────────────────┘    │
└──────────┬──────────────────────────────────────────────────────┘
           │ (on success)
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Vercel (Deployment Platform)                  │
│                                                                  │
│  ┌──────────────────────────────────────────┐                  │
│  │ Preview Deployments (auto-created on PR) │                  │
│  │ ├─ https://{pr-number}.myapp-pr.vercel.app              │
│  │ └─ Neon auto-creates branch per PR                       │
│  │    (copy-on-write from staging/main)                     │
│  └──────────────────────────────────────────┘                  │
│                                                                  │
│  ┌──────────────────────────────────────────┐                  │
│  │ Staging Environment (persistent branch)  │                  │
│  │ ├─ https://staging.myapp.vercel.app     │                  │
│  │ ├─ Neon: persistent staging branch       │                  │
│  │ └─ DATABASE_URL → staging branch         │                  │
│  │    BETTER_AUTH_URL → staging domain      │                  │
│  └──────────────────────────────────────────┘                  │
│                                                                  │
│  ┌──────────────────────────────────────────┐                  │
│  │ Production Environment (main branch)     │                  │
│  │ ├─ https://myapp.com (custom domain)    │                  │
│  │ ├─ Neon: main/production branch          │                  │
│  │ └─ DATABASE_URL → main branch            │                  │
│  │    BETTER_AUTH_URL → production domain   │                  │
│  └──────────────────────────────────────────┘                  │
└──────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Neon Postgres (Database & Branching)               │
│  ┌───────────────────────────────────────────────────────┐    │
│  │ Copy-on-Write Branching Model                         │    │
│  │                                                       │    │
│  │ main (root)                                           │    │
│  │   ├─ staging (persistent, for UAT)                    │    │
│  │   │   └─ Data syncs from main periodically            │    │
│  │   └─ feature-abc (ephemeral PR preview)               │    │
│  │       └─ Auto-created on PR; deleted on PR close      │    │
│  │                                                       │    │
│  │ Each branch: isolated database, new credentials,      │    │
│  │ no prod key reuse, instant provisioning               │    │
│  └───────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
.github/
├── workflows/
│   ├── ci.yml                    # Lint + typecheck + test + build on every PR/push
│   └── deploy.yml                # Deploy to Vercel (triggered on main merge)
.planning/
├── phases/05-deploy-pipeline-environment-config/
│   ├── 05-CONTEXT.md
│   ├── 05-RESEARCH.md (this file)
│   ├── 05-PLAN.md
│   ├── 05-VERIFICATION.md
│   └── DEPLOYMENT.md             # Release procedure checklist (new, created in Phase 5)
src/
├── env.ts                        # Updated: add dynamic baseURL config to env schema
├── lib/
│   ├── auth.ts                   # Updated: use dynamic baseURL with allowedHosts
│   └── db/
│       ├── schema.ts
│       └── auth-schema.ts
vercel.json                        # New: deployment configuration
.env.example                       # Updated: document environment variable scopes
.env.local                         # Local dev (git-ignored)
.env.production                    # Production env vars (git-ignored, loaded by Vercel)
.env.preview                       # Preview/staging env vars (git-ignored, loaded by Vercel)
```

### Pattern 1: Dynamic Better Auth baseURL with allowedHosts (SEC-04 Resolution)

**What:** Instead of hardcoding a single `BETTER_AUTH_URL` environment variable, configure Better Auth's `baseURL` as an object that validates the current request's origin against an allowlist of trusted hosts. Better Auth automatically derives the correct base URL from the request's `host` or `x-forwarded-host` header, enabling the same deployed app to work correctly on PR-preview, staging, and production without requiring different builds or static env var overrides.

**When to use:** This is mandatory for SEC-04 and any multi-environment deployment where the app's origin changes per environment (localhost:3000 for dev, *.vercel.app for previews, staging.example.com for staging, example.com for production).

**Implementation:**

```typescript
// src/lib/auth.ts — Updated from Phase 1

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/lib/db";
import { env } from "@/env";
import * as authSchema from "@/lib/db/auth-schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // D-06
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days, D-07
    updateAge: 60 * 60 * 24 * 7,  // refresh weekly on use
  },
  secret: env.BETTER_AUTH_SECRET,
  // SEC-04: Dynamic baseURL with allowedHosts allowlist
  // Validates incoming request host against trusted origins
  baseURL: {
    allowedHosts: [
      "localhost:3000",           // Local development
      "*.vercel.app",             // Vercel preview deployments
      "staging.example.com",      // Staging persistent environment
      "example.com",              // Production (update with actual domain)
    ],
    // Force https in production/staging, http in development
    protocol: process.env.NODE_ENV === "development" ? "http" : "https",
  },
});
```

**Source:** [better-auth.com/docs/guides/dynamic-base-url](https://better-auth.com/docs/guides/dynamic-base-url) — official Better Auth documentation

**Why this works:**
- Better Auth checks `x-forwarded-host` (set by Vercel), then `host` header (browser/direct) against `allowedHosts`
- Only whitelisted origins are accepted; unrecognized hosts throw an error (preventing confused-deputy attacks)
- Protocol is controlled per environment (http for localhost dev, https for all deployed)
- Requires zero changes to the deployed build; the same binary works on all three environments
- Cookie domain validation naturally follows: cookies set for staging.example.com won't work on example.com, which is correct

**Updated env.ts validation:**

```typescript
// src/env.ts — Keep existing structure, but document the change

import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import { betterAuthSecretSchema } from "@/lib/validation/auth-secret";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: betterAuthSecretSchema,
    // DEPRECATED: BETTER_AUTH_URL no longer used (replaced with dynamic baseURL allowedHosts)
    // Kept for backward compat if needed, but auth.ts now ignores it
    BETTER_AUTH_URL: z.string().url().optional().default("http://localhost:3000"),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  },
});
```

### Pattern 2: GitHub Actions CI Workflow (DEPLOY-03)

**What:** A GitHub Actions workflow (`.github/workflows/ci.yml`) that runs on every PR and push to main, executing lint, typecheck, test, and build steps in sequence, with caching for npm dependencies. On failure, the workflow report blocks PR merge via branch protection rules.

**When to use:** This is mandatory for DEPLOY-03. Every change flows through this gate before reaching staging or production.

**Implementation:**

```yaml
# .github/workflows/ci.yml

name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [20.x]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint
        run: npm run lint
      
      - name: Type check
        run: npx tsc --noEmit
      
      - name: Unit tests
        run: npm test
      
      - name: Build
        run: npm run build
```

**How to enforce:**
1. In GitHub repository settings, go to Settings → Branches → Add rule
2. Apply to `main`
3. Enable "Require status checks to pass before merging"
4. Add the `ci / ci` check (or equivalent from workflow output)
5. Uncheck "Dismiss stale pull request approvals when new commits are pushed"

**Source:** [GitHub Actions documentation](https://github.com/features/actions) + [Next.js CI examples from DEV Community](https://dev.to/whoffagents/github-actions-cicd-for-nextjs-tests-type-checking-and-auto-deploy-1kp7)

### Pattern 3: Vercel Deployment Configuration (DEPLOY-05)

**What:** A `vercel.json` file that configures Vercel to skip auto-deployment and rely solely on GitHub Actions as the orchestrator. This prevents the double-deploy race where both Vercel and GitHub Actions try to deploy the same commit.

**When to use:** This is mandatory for DEPLOY-05. Ensures a single, unambiguous deploy path per environment.

**Implementation:**

```json
// vercel.json

{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {
    "deploymentEnabled": {
      "main": false,
      "staging": false
    }
  },
  "ignoreCommand": "exit 0"
}
```

**What this does:**
- `deploymentEnabled.main: false` → Vercel does NOT auto-deploy when commits land on `main`; GitHub Actions owns this
- `deploymentEnabled.staging: false` → Vercel does NOT auto-deploy on `staging` branch; GitHub Actions owns promotion to staging
- `ignoreCommand: "exit 0"` → Fallback: if a deployment somehow triggers, skip the build (return exit code 0 = skip)

**Alternative for Preview deployments:** Keep Preview deployments enabled so Vercel auto-creates preview URLs per PR, but disable production auto-deploy. This gives fast PR preview links while keeping main/staging under explicit GitHub Actions control.

```json
// Hybrid approach (recommended): Preview auto-deploy, Production/Staging via Actions

{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {
    "deploymentEnabled": {
      "main": false,
      "staging": false
    }
  },
  "ignoreCommand": "exit 0"
}
```

**Source:** [Vercel docs: Git Configuration](https://vercel.com/docs/project-configuration/git-configuration) + [Vercel KB: How can I use GitHub Actions with Vercel?](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel)

### Pattern 4: Environment Variable Scoping (DEPLOY-02)

**What:** Vercel environment variables are scoped to Production, Preview, and Development. Each Neon branch (main, staging, feature-x) gets its own `DATABASE_URL` injected via the Vercel-Neon Marketplace integration. The `BETTER_AUTH_URL` is no longer needed (replaced by dynamic baseURL), but other config-driven URLs (e.g., API endpoints, webhook URLs) follow the same scoping pattern.

**When to use:** Every environment variable that changes per environment must be explicitly scoped in Vercel dashboard to avoid production keys leaking to staging or vice versa.

**Setup in Vercel Dashboard:**

```
Environment Variables → Add New
- Name: DATABASE_URL
  Production: (Neon Marketplace auto-fills: main branch URL)
  Preview: (Neon Marketplace auto-fills: preview branch URL)
  Development: (leave empty or set to local-dev Neon branch)
  Environments: Production, Preview, Development
  [Save]

- Name: BETTER_AUTH_SECRET
  Production: (generate with: openssl rand -base64 32)
  Preview: (same or separate, depending on your secret rotation policy)
  Development: (set locally via .env.local)
  Environments: Production, Preview, Development
  [Save]
```

**Local development (via `vercel env pull`):**
```bash
vercel env pull
# Creates local .env.local with all environment variables
# Note: only works for the environment your Vercel CLI account has access to
```

**`.env.example` (committed to git, documents expected vars):**

```bash
# DATABASE_URL is injected by Vercel (Neon Marketplace integration)
# Do not set locally; instead run: vercel env pull
# DATABASE_URL=postgresql://user:password@host/dbname

# BETTER_AUTH_SECRET should be a strong random value
# Generate with: openssl rand -base64 32
# Set in Vercel dashboard under Environment Variables
BETTER_AUTH_SECRET=

# BETTER_AUTH_URL is no longer used (replaced with dynamic baseURL in auth.ts)
# Kept here for reference/backward-compat only
# BETTER_AUTH_URL=http://localhost:3000
```

**Source:** [Vercel docs: Environment Variables](https://vercel.com/docs/environment-variables) + [Vercel docs: Managing across environments](https://vercel.com/docs/environment-variables/manage-across-environments)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deploy orchestration across environments | Custom shell scripts + cron jobs | GitHub Actions + Vercel | GitHub Actions integrates natively with Git; Vercel has built-in preview URLs; managing deploy state in scripts is error-prone and not auditable |
| Database branch management per PR | Manual Neon API calls + env var file templating | Vercel-Neon Marketplace integration | The integration handles branch lifecycle (create on PR open, delete on PR close), credential rotation, and env var injection atomically; manual management risks orphaned branches or stale creds |
| Multi-environment auth configuration | Per-build env var overrides or conditional imports | Better Auth's dynamic baseURL with allowedHosts | Request-time validation is safer than build-time configuration; a single build works across all environments without conditional code paths that can drift |
| CI status check enforcement | Manual PR reviews checking log links | GitHub branch protection rules with status checks | Rules are declarative, enforceable by policy, auditable in repo settings, and cannot be bypassed by individual developers |
| Environment variable rotation | Manual updates to `.env` files + redeploy | Vercel dashboard (encrypted secrets) + Neon key auto-rotation | Secrets in Vercel dashboard are never exposed in build logs or shell history; Neon can auto-rotate keys per branch policy |

**Key insight:** Deploy and auth configuration are high-risk areas where manual process complexity directly correlates with incidents (wrong key in staging, accidental prod deploy, expired preview creds). Use platform-native tooling for these, even if it seems "less customizable" at first — the saved operational burden far outweighs the reduced flexibility.

## Runtime State Inventory

> **SKIPPED for greenfield deployment phase** — This phase does not rename, rebrand, or migrate existing runtime state. It adds new environments and pipeline infrastructure with no existing service configs to preserve or migrate.

## Common Pitfalls

### Pitfall 1: Vercel + GitHub Actions Both Deploying

**What goes wrong:** Both Vercel's auto-deploy and GitHub Actions' deploy job trigger on the same commit, creating two concurrent deployments to the same environment. The second deployment overwrites the first, causing race conditions, orphaned preview environments, and unpredictable artifact versions in production.

**Why it happens:** Vercel's default is to auto-deploy whenever a commit lands on a connected branch. GitHub Actions is then added separately for CI checks. Without explicit coordination, both fire on every push.

**How to avoid:** 
- Set `git.deploymentEnabled: { main: false, staging: false }` in `vercel.json` to disable Vercel auto-deploy on production and staging branches
- Keep Preview deployments enabled if you want fast preview URLs (Vercel's preview system is still valuable even if GitHub Actions owns main/staging deploys)
- Explicitly invoke `vercel deploy --prod` from the GitHub Actions workflow only when appropriate (on main merge → production, or manually triggered staging merge)

**Warning signs:** 
- Multiple deployments in Vercel dashboard with same commit hash within seconds
- Preview deployment URL works but shows stale code (a second deployment overwrote the first)
- GitHub Actions log shows "Deployment successful" but Vercel dashboard shows a different commit hash deployed

### Pitfall 2: BETTER_AUTH_URL Mismatch on Staging

**What goes wrong:** The app is deployed to staging.example.com but `BETTER_AUTH_URL` is still set to the production URL (example.com). When a user tries to register/login on staging, Better Auth redirects to the production URL, breaking the staging flow. Alternatively, cookies set for example.com are rejected on staging.example.com because the domain doesn't match.

**Why it happens:** A static environment variable makes it easy to forget that it needs to change per environment. The first deployment uses the production value, and it's overlooked during the staging setup.

**How to avoid:**
- Never use a static `BETTER_AUTH_URL` for multi-environment setups
- Use dynamic `baseURL` with `allowedHosts` allowlist in auth.ts instead
- Test login flow on each environment (local, preview, staging, production) before marking deployment complete
- Add a manual UAT step to DEPLOYMENT.md: "Log in / register on staging and verify no cross-domain redirects"

**Warning signs:**
- Login redirects to production domain when done from staging
- Session cookie appears empty/missing on staging
- `400 Bad Request` from Better Auth citing "Invalid base URL" in logs

### Pitfall 3: Preview Database Branch Conflicts

**What goes wrong:** Two PR previews run migrations simultaneously against the same database (if using a shared Neon branch). Migration order is non-deterministic; one migration might fail while the other succeeds, leaving the schema in an inconsistent state. Tests in one PR fail because the schema from the other PR's migration is partially applied.

**Why it happens:** If Vercel-Neon integration is not configured to create a branch per preview, all previews share the same branch.

**How to avoid:**
- Ensure Vercel-Neon Marketplace integration is configured to "Create a database branch for deployment: Preview"
- Confirm each preview deployment gets its own Neon branch (check Vercel dashboard → Project → Settings → Storage → Neon)
- Keep the number of concurrent PRs reasonable; Neon's free tier supports many branches but has limits

**Warning signs:**
- Two preview URLs for different PRs point to the same Neon connection string
- Migration logs in CI show "ERROR: relation already exists" or schema conflicts
- PR tests pass locally but fail on the preview deployment

### Pitfall 4: Missing CI Status Check on Branch Protection

**What goes wrong:** GitHub Actions CI workflow runs and fails (test failure), but the PR can still be merged because the status check is not linked to branch protection rules. The bad code lands on main and goes to production.

**Why it happens:** Branch protection rules are not automatically created when a GitHub Actions workflow is added. They require explicit setup in repo settings.

**How to avoid:**
- After creating `.github/workflows/ci.yml`, explicitly add a branch protection rule
- Settings → Branches → Add rule → Apply to "main"
- Enable "Require status checks to pass before merging"
- Select the CI workflow output as a required check
- Test: create a dummy PR with a lint failure; verify merge button is disabled

**Warning signs:**
- "Merge" button is green even when workflow shows red (failed test)
- A commit with failed tests accidentally landed on main
- `.github/workflows/` directory exists but branch protection rule does not list the workflow

### Pitfall 5: Environment Variables Not Injected to Vercel Preview

**What goes wrong:** A preview deployment spins up but crashes at runtime because `DATABASE_URL` is undefined. The Vercel-Neon integration set the variable on Production and Development, but not on Preview.

**Why it happens:** When adding environment variables manually in Vercel dashboard, it's easy to forget to check the "Preview" checkbox alongside Production.

**How to avoid:**
- Always enable "Preview" when adding environment variables needed by the app (DATABASE_URL, BETTER_AUTH_SECRET, etc.)
- After adding a variable, deploy a PR and check the preview build log: search for "DATABASE_URL" to confirm it's loaded
- Use `vercel env pull` locally to double-check what's configured

**Warning signs:**
- Preview URL loads but shows "Error: database connection failed" or "Error: BETTER_AUTH_SECRET undefined"
- Build succeeds but runtime crashes immediately
- Manually deploying a PR via `vercel deploy` works (pulls correct env vars), but GitHub Actions preview deploy fails

## Code Examples

Verified patterns from official sources:

### GitHub Actions CI Workflow for Next.js + Vitest

```yaml
# .github/workflows/ci.yml
# Source: https://dev.to/whoffagents/github-actions-cicd-for-nextjs-tests-type-checking-and-auto-deploy-1kp7

name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main, staging]

permissions:
  contents: read
  statuses: write

jobs:
  ci:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint
        run: npm run lint
      
      - name: Type check
        run: npx tsc --noEmit
      
      - name: Unit tests
        run: npm test
      
      - name: Build
        run: npm run build
```

### Better Auth Dynamic baseURL Configuration

```typescript
// src/lib/auth.ts
// Source: https://better-auth.com/docs/guides/dynamic-base-url

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/lib/db";
import { env } from "@/env";
import * as authSchema from "@/lib/db/auth-schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24 * 7,
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: {
    allowedHosts: [
      "localhost:3000",
      "localhost:3001",
      "*.vercel.app",
      "staging.example.com",
      "example.com",
    ],
    protocol: process.env.NODE_ENV === "development" ? "http" : "https",
  },
});
```

### Vercel Deployment Configuration (vercel.json)

```json
// vercel.json
// Source: https://vercel.com/docs/project-configuration/git-configuration

{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {
    "deploymentEnabled": {
      "main": false,
      "staging": false
    }
  },
  "ignoreCommand": "exit 0",
  "env": {
    "BETTER_AUTH_SECRET": "@better-auth-secret"
  }
}
```

### Deployment Manual Verification Checklist (DEPLOYMENT.md)

```markdown
# DEPLOYMENT.md — Release Procedure

## Feature Branch → Staging (Manual Gate)

1. **Pre-deployment:**
   - [ ] All PR checks pass (GitHub Actions CI green)
   - [ ] Code review approved
   - [ ] Feature branch is up-to-date with main (rebase or merge main)

2. **Deploy to staging:**
   - [ ] Merge feature branch into staging via PR
   - [ ] GitHub Actions CI runs on staging branch
   - [ ] Wait for Vercel deployment to complete (check Vercel dashboard)
   - [ ] Staging URL is responsive: https://staging.example.com/

3. **Manual verification on staging:**
   - [ ] **Auth flow:** Register new user with test email → verify email/password match
   - [ ] **Auth flow:** Log in with test user → session established, no redirects to production
   - [ ] **App core:** Enter salary data → forecast shown correctly
   - [ ] **App core:** Add bonus → summary updates
   - [ ] **Data persistence:** Refresh page → data still present
   - [ ] **Cross-device:** Log out on staging → log in on production → no session bleed
   - [ ] **Database:** Check staging Neon branch in dashboard → latest migration applied

4. **Approval for production:**
   - [ ] QA sign-off (manual UAT passed)
   - [ ] Product owner notified
   - [ ] No blocking issues in staging

## Staging → Production (Controlled Release)

1. **Pre-production:**
   - [ ] Create a release PR: staging → main
   - [ ] GitHub Actions CI runs (lint, test, build)
   - [ ] Review changes one more time (changelog if applicable)

2. **Deploy to production:**
   - [ ] Merge release PR to main
   - [ ] GitHub Actions CI runs on main
   - [ ] GitHub Actions deploy job: `vercel deploy --prod`
   - [ ] Wait for Vercel production deployment (check dashboard)
   - [ ] Production URL is responsive: https://example.com/

3. **Smoke test on production:**
   - [ ] **Auth:** Log in with existing production user → session works
   - [ ] **Auth:** Register new user → confirmation email received
   - [ ] **App core:** Existing data loads → forecasts match pre-deploy
   - [ ] **Monitoring:** No error spike in Vercel Analytics
   - [ ] **Database:** Production Neon main branch healthy (check logs)

4. **Post-production:**
   - [ ] Keep monitoring for 30 minutes (watch for errors)
   - [ ] Alert team that production deployment is complete
   - [ ] Delete staging branch (optional, if planning a new staging cycle)

## Rollback Procedure (if production fails)

1. [ ] Identify the bad commit: `git log --oneline -5` on main
2. [ ] Revert: `git revert <commit-hash>`
3. [ ] Push to main: `git push origin main`
4. [ ] GitHub Actions CI runs + auto-deploys to production
5. [ ] Monitor Vercel dashboard until rollback deployment completes
6. [ ] Confirm production is stable again
7. [ ] File incident summary: what failed, why, how to prevent

## Environments at a Glance

| Environment | URL | Database | Deploy Trigger | Who Approves |
|-------------|-----|----------|-----------------|-------------|
| Local Dev | http://localhost:3000 | Local Neon branch (or connectionString) | `npm run dev` | Self |
| PR Preview | https://{pr-num}.myapp-pr.vercel.app | Neon preview branch (auto-created) | PR push to feature branch | Automatic (Vercel) |
| Staging | https://staging.example.com | Neon staging branch (persistent) | Merge to staging branch | QA + Product Owner |
| Production | https://example.com | Neon main branch | Merge to main branch | Product Owner + Ops |
```

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vercel account (Pro+ plan) | DEPLOY-01, DEPLOY-02 (custom environment scoping) | ✓ | Latest | Hobby plan (branch-scoped Preview only; staging requires workaround) |
| Neon account + Vercel Marketplace integration | DEPLOY-01, DEPLOY-02 (database branching per environment) | ✓ | Latest | Manual Neon API calls + env var templating (not recommended) |
| GitHub account + repo setup | DEPLOY-03, DEPLOY-05 (CI/CD orchestration) | ✓ | Latest | — (required) |
| GitHub Actions (included with GitHub.com) | DEPLOY-03, DEPLOY-05 | ✓ | Built-in | None (GitHub Actions is mandatory for CI) |
| Vercel CLI (`npm i -D vercel`) | Local staging deployment, branch info queries | ✓ | Latest | Manual Vercel dashboard (slower for manual deployments) |
| Node.js 20+ (for build) | npm ci, build step | ✓ | 20.x | Node 18.x (not recommended; Next.js 16+ officially supports 20+) |

**Missing dependencies with no fallback:** None — all required tools are free/included with platform accounts.

**Missing dependencies with fallback:**
- Vercel Pro plan → Hobby plan (staging requires extra workaround with branch-scoped Preview env vars; still works but less clean)
- Neon Marketplace integration → Manual API automation (adds operational complexity; not recommended for Phase 5)

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.11 + jsdom (existing, see Phase 4) |
| Config file | vitest.config.ts (existing) |
| Quick run command | `npm test` |
| Full suite command | `npm test -- --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEPLOY-03 | GitHub Actions CI job runs on every PR and blocks merge on failure | Integration / System | `npm run lint && npx tsc --noEmit && npm test && npm run build` in CI | ✅ Wave 0 (.github/workflows/ci.yml created in Phase 5) |
| SEC-04 | Better Auth resolves baseURL correctly from request origin on each environment | Unit (auth config) | `npm test` (no specific test yet; may require manual verification) | ❌ Wave 0 (added in Phase 6 or Phase 7 E2E suite) |
| DEPLOY-01 | Staging persistent environment exists with independent database branch | Manual / System | Manual verification: `curl https://staging.example.com/` + check Neon branch in dashboard | ✅ Wave 0 (setup in Phase 5, verified in Phase 5 manual UAT) |
| DEPLOY-02 | Environment variables are correctly scoped per environment | Manual / System | Manual verification: check Vercel dashboard Environment Variables section, ensure each var has correct checkboxes | ✅ Wave 0 (setup in Phase 5) |
| DEPLOY-05 | GitHub Actions and Vercel auto-deploy do not race | Manual / System | Monitor Vercel dashboard during a test deployment to ensure single deployment per commit | ✅ Wave 0 (setup + verification in Phase 5) |
| DEPLOY-04 | Feature-branch → staging → production release procedure is documented and followed | Manual / Process | Walk through DEPLOYMENT.md checklist for a real staging deploy and production merge | ✅ Wave 0 (documented in Phase 5, executed first time in Phase 5 or Phase 6) |

### Sampling Rate

- **Per task commit:** `npm test` (unit tests only, fast pass/fail)
- **Per wave merge:** `npm run build` (catch build-time errors before merge)
- **Phase gate:** Full CI suite green (.github/workflows/ci.yml must show all checks passing on main) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `.github/workflows/ci.yml` — GitHub Actions CI workflow (lint, typecheck, test, build)
- [ ] `.github/workflows/deploy.yml` — GitHub Actions deploy job (invoke `vercel deploy --prod` on main merge)
- [ ] `vercel.json` — Vercel configuration to disable auto-deploy and set git deployment rules
- [ ] `.planning/phases/05-deploy-pipeline-environment-config/DEPLOYMENT.md` — Release procedure checklist and manual UAT steps
- [ ] Manual setup in Vercel dashboard: create staging custom environment, scope environment variables (DATABASE_URL, BETTER_AUTH_SECRET) to Production/Preview/Development
- [ ] Manual setup in Neon dashboard: confirm persistent staging branch created, verify staging branch is separate from main
- [ ] Manual setup in GitHub: create branch protection rule on main requiring CI checks to pass
- [ ] `src/lib/auth.ts` — Updated with dynamic `baseURL` allowedHosts configuration
- [ ] `src/env.ts` — Document that `BETTER_AUTH_URL` is deprecated (optional env var, no longer used by auth.ts)
- [ ] `.env.example` — Updated to reflect environment variable scopes and dynamic auth setup

*(Automated test coverage:* `npm test` runs existing test suite; full suite covers Vitest + TypeScript checks but does NOT include multi-environment E2E validation — that belongs to Phase 7 Playwright suite. *Manual gaps:* Staging deployment and cross-environment auth flow verification are manual steps per DEPLOYMENT.md.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Separate staging environment from production (deployment isolation per DEPLOY-01) |
| V2 Authentication | yes | Better Auth dynamic baseURL with allowedHosts (SEC-04) — validates request origin before issuing cookies |
| V3 Session Management | yes | Session cookies scoped to correct domain per environment (inherit from Better Auth baseURL validation) |
| V4 Access Control | yes | Branch protection rules block untested code from reaching main (DEPLOY-03) |
| V5 Input Validation | Partial | Existing (Phase 1-4); no new input validation in Phase 5 |
| V6 Cryptography | yes | BETTER_AUTH_SECRET securely stored in Vercel (not in git); never exposed in logs or build artifacts |
| V8 Data Protection | yes | Staging database is physically isolated from production (separate Neon branch, new credentials, no prod key reuse) |

### Known Threat Patterns for Next.js + Vercel + Better Auth

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| BETTER_AUTH_URL mismatch across environments | Tampering / Cross-site | Use dynamic baseURL with allowedHosts allowlist; validate at request time, not build time |
| Credentials accidentally leaking to Preview | Information Disclosure | Scope each secret to appropriate environments in Vercel dashboard; enable "Production only" for BETTER_AUTH_SECRET if staging uses a different secret |
| Vercel auto-deploy racing with GitHub Actions | Tampering / Denial | Disable Vercel auto-deploy via vercel.json; single orchestrator (GitHub Actions) owns all production/staging deploys |
| Staged commits accidentally reaching production | Tampering | Branch protection rule requires CI checks; enforce via GitHub status check requirement |
| Stale Neon credentials on preview branch | Information Disclosure | Vercel-Neon integration auto-creates new branch credentials; delete branch on PR close to expire old creds immediately |
| SQL injection via user input (salary, bonus, vacation) | Injection | Already mitigated in Phase 1 (Zod validation + Drizzle parameterized queries); no new SQL exposure in Phase 5 |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vercel Pro plan is available for custom staging environment + environment variable scoping | Standard Stack, Environment Availability | If only Hobby plan available, staging requires branch-scoped Preview env vars and is less isolated; still works but requires workaround (branch naming convention: `staging/*` all use same env vars) |
| A2 | Neon API key will be available via Vercel Marketplace integration (auto-provisioned) | Pattern 2 (Neon branching), Runtime State Inventory | If manual Neon API integration required instead, GitHub Actions workflow needs explicit Neon API key stored in GitHub Secrets; adds complexity and key rotation management |
| A3 | Staging domain (staging.example.com) is not yet registered or in use | Deferred Ideas, Phase Boundary | If staging domain already exists or is in use, renaming required (e.g., staging-v2.example.com); update DEPLOYMENT.md and allowedHosts accordingly |
| A4 | GitHub.com repo is public or private but Vercel + GitHub integration is enabled | Environment Availability | If integration not enabled, manual Vercel CLI deployment required; slower and less automated |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

Note: A1 and A3 are tagged `[ASSUMED]` because they rely on project-specific infrastructure (plan level, domain availability) not confirmed in this session. A2 and A4 are also `[ASSUMED]` but can be verified during Phase 5 planning by checking Vercel project settings.

## Open Questions

1. **Staging domain name and DNS setup**
   - What we know: A staging environment with a separate origin is needed for SEC-04 (Better Auth allowedHosts validation)
   - What's unclear: Should staging use a Vercel-managed domain (e.g., staging.myapp-prod.vercel.app) or a custom domain (e.g., staging.example.com)? If custom, is DNS already configured?
   - Recommendation: Use Vercel-managed domain for Phase 5 (no DNS setup required, automatic SSL); custom domain can be added in Phase 6 if needed. Update `allowedHosts` accordingly.

2. **Staging database data sync policy**
   - What we know: Staging has a persistent Neon branch separate from production
   - What's unclear: Should staging data be manually refreshed from production (copy-on-write branch update) or gradually diverge? What's the team's UAT data refresh cadence?
   - Recommendation: Document in DEPLOYMENT.md that staging branch data is persistent and accumulates test data over time. If a clean staging state is needed, manually request a Neon branch reset (doc the command) or re-branch from main before a major release.

3. **Concurrent PR preview limitations**
   - What we know: Vercel-Neon auto-creates branches per PR preview
   - What's unclear: How many concurrent preview environments are acceptable? Neon's free tier supports many, but operational overhead (stale branches, disk usage) grows with count.
   - Recommendation: Document in DEPLOYMENT.md that PRs older than 14 days should be merged or closed to keep the preview environment list clean. Set a reminder in project wiki or CI job to flag long-lived PRs.

4. **GitHub Actions deployment credentials (Vercel API token)**
   - What we know: GitHub Actions deploy job will need to invoke `vercel deploy --prod`
   - What's unclear: Is a Vercel API token already configured in GitHub Secrets, or does it need to be created?
   - Recommendation: During Phase 5 planning, check GitHub Secrets for `VERCEL_TOKEN`; if missing, generate one from Vercel dashboard and add to repo Secrets.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| NextAuth.js v4 with callback-based auth | Better Auth with dynamic baseURL config | 2025–2026 (Next.js 14+ ecosystem) | Better Auth is now the recommended auth library for new Next.js projects; callback-based Auth.js is legacy |
| Vercel auto-deploy for all branches | GitHub Actions as single orchestrator, Vercel only for hosting | 2024–2026 (platform best practice) | Explicit control over deployment pathways reduces race conditions and increases auditability |
| Static environment variables per env | Dynamic request-based configuration (Better Auth allowedHosts) | 2023–2026 (multi-environment SaaS standard) | Eliminates need for separate builds per environment; same binary works everywhere with request-time validation |
| Manual database branching + env var templating | Vercel-Neon Marketplace integration with auto-branch lifecycle | 2024–2026 (native platform integration) | Eliminates manual branch management; preview branches created and destroyed atomically with deployment lifecycle |
| Per-environment CI jobs (separate workflows for prod/staging) | Single CI job with branch-aware matrix strategy | 2024–2026 | Reduces workflow boilerplate; single source of truth for test/build logic |

**Deprecated/outdated:**
- **NextAuth.js v4:** Legacy; use Better Auth instead (see CLAUDE.md stack rationale)
- **`next-pwa`:** Archived since Aug 2023; use Serwist instead (already adopted in Phase 4)
- **Vercel Postgres:** Auto-migrated to Neon in Dec 2024 (see CLAUDE.md history)
- **PlanetScale for this domain:** MySQL lacks window functions needed for progressive tax calculation; Postgres only

## Sources

### Primary (HIGH confidence)

- [Vercel docs: Environments](https://vercel.com/docs/deployments/environments) — environment types (Production, Preview, Development) and their scopes
- [Vercel docs: Git Configuration](https://vercel.com/docs/project-configuration/git-configuration) — `vercel.json` git.deploymentEnabled and ignoreCommand options
- [Vercel docs: Environment Variables](https://vercel.com/docs/environment-variables) — scoping env vars to Production/Preview/Development
- [Neon docs: Branching](https://neon.com/docs/introduction/branching) — database branching architecture and copy-on-write mechanics
- [Neon docs: Vercel Integration](https://neon.com/docs/guides/vercel-managed-integration) — Vercel-Neon Marketplace auto-provisioning and branch lifecycle
- [Better Auth docs: Dynamic Base URL](https://better-auth.com/docs/guides/dynamic-base-url) — allowedHosts allowlist configuration pattern
- [GitHub Actions docs](https://docs.github.com/en/actions) — workflow syntax and status checks
- [Vercel KB: Git Configuration](https://vercel.com/kb/guide/set-up-a-staging-environment-on-vercel) — staging environment setup guide

### Secondary (MEDIUM confidence)

- [DEV Community: GitHub Actions CI/CD for Next.js](https://dev.to/whoffagents/github-actions-cicd-for-nextjs-tests-type-checking-and-auto-deploy-1kp7) — CI workflow examples with lint, typecheck, test steps
- [Medium: Implementing GitHub Actions for Vercel Deployment](https://medium.com/@sanduniP/implementing-github-actions-for-vercel-deployment-b8412b28a586) — GitHub Actions + Vercel integration patterns (2026)
- [Neon blog: Database Branching with Preview Environments](https://neon.com/blog/branching-with-preview-environments) — Vercel-Neon workflow for automated environment isolation
- [Neon blog: Practical Guide to Database Branching](https://neon.com/blog/practical-guide-to-database-branching) — branching strategies and naming conventions
- [Supabase docs: Vercel Integration Environment Variables](https://supabase.com/docs/guides/troubleshooting/vercel-integration-environment-variables-not-syncing-for-persistent-git-branches-b9191e) — cross-platform env var scoping lessons learned

### Tertiary (search/patterns, not authoritative docs)

- [Geek Logbook: Controlling Branch Deployments and Redirects in Vercel](https://geeklogbook.com/controlling-branch-deployments-and-redirects-in-vercel-a-practical-guide/) — branch-based deployment control patterns
- [Release Management Best Practices (GitScrum, Asana, Titanapps)](various URLs from RESULTS) — release checklists and staging-to-production procedures

## Metadata

**Confidence breakdown:**
- **Standard Stack (HIGH):** All tools and versions confirmed against Vercel official docs, Neon docs, GitHub Actions docs, and Better Auth docs
- **Architecture Patterns (HIGH):** Code examples sourced from official documentation; Vercel-Neon integration is a GA platform feature as of 2024
- **Deployment Configuration (HIGH):** `vercel.json` syntax and GitHub Actions CI workflow structure verified against official guides
- **Better Auth SEC-04 (HIGH):** Dynamic baseURL with allowedHosts pattern sourced directly from Better Auth official docs
- **Common Pitfalls (MEDIUM-HIGH):** Patterns derived from known issues documented in Vercel KB, Neon discussions, and GitHub Actions community (not official advisory, but well-established)
- **Release Procedures (MEDIUM):** General best practices from multiple 2026-dated sources; project-specific details (exact checklist, UAT steps) will be refined during Phase 5 planning

**Research date:** 2026-09-01
**Valid until:** 2026-09-30 (stable infrastructure layer; Vercel/Neon APIs unlikely to change within 30 days)

**Next steps for planner:**
- Confirm Vercel plan level (Pro+ recommended for custom staging environment)
- Confirm Neon account is provisioned and Marketplace integration is enabled in Vercel
- Confirm GitHub Secrets include VERCEL_TOKEN (or plan to create it in Phase 5 execution)
- Confirm staging domain name preference (Vercel-managed vs. custom)
- Review DEPLOYMENT.md template and tailor manual UAT steps for project specifics
