# Phase 5: Deploy Pipeline & Environment Config - Pattern Map

**Mapped:** 2026-09-01
**Files analyzed:** 7 new/modified files
**Analogs found:** 3 / 7 (exact matches on existing files; 4 new infrastructure files sourced from RESEARCH.md)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `.github/workflows/ci.yml` | config (CI/CD workflow) | batch/automation | None (new) | no-analog |
| `.github/workflows/deploy.yml` | config (CI/CD workflow) | batch/automation | None (new) | no-analog |
| `vercel.json` | config (deployment) | static configuration | None (new) | no-analog |
| `.planning/phases/05-deploy-pipeline-environment-config/DEPLOYMENT.md` | documentation | static/reference | None (new) | no-analog |
| `src/lib/auth.ts` | service/library (auth config) | request-response | `src/lib/auth.ts` (current) | exact |
| `src/env.ts` | config/utility (environment validation) | static/initialization | `src/env.ts` (current) | exact |
| `.env.example` | config (documentation) | static/reference | `.env.example` (current) | exact |

---

## Pattern Assignments

### `src/lib/auth.ts` (service, request-response)

**Analog:** `src/lib/auth.ts` (current file, update in-place)

**Current imports pattern** (lines 1-5):
```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/lib/db";
import { env } from "@/env";
import * as authSchema from "@/lib/db/auth-schema";
```

**Current config pattern — TO BE REPLACED** (lines 7-19):
```typescript
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // D-06
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days, D-07
    updateAge: 60 * 60 * 24 * 7, // refresh weekly on use
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
});
```

**Updated config pattern — SEC-04 RESOLUTION** (replace line 18 with):
```typescript
// SEC-04: Dynamic baseURL with allowedHosts allowlist
// Validates incoming request host against trusted origins per environment
baseURL: {
  allowedHosts: [
    "localhost:3000",           // Local development
    "localhost:3001",           // Alt port for local testing
    "*.vercel.app",             // Vercel preview deployments
    "staging.example.com",      // Staging persistent environment (update with actual domain)
    "example.com",              // Production (update with actual domain)
  ],
  // Force https in production/staging, http in development
  protocol: process.env.NODE_ENV === "development" ? "http" : "https",
},
```

**Why this pattern:**
- Better Auth checks `x-forwarded-host` (set by Vercel) then `host` header against `allowedHosts` at request time
- Only whitelisted origins are accepted; unrecognized hosts throw error (prevents confused-deputy attacks)
- Same binary works on all environments (localhost, PR previews, staging, production) without rebuild
- Session cookies naturally follow domain rules: staging.example.com cookies ≠ example.com cookies (correct isolation)

---

### `src/env.ts` (config/utility, static/initialization)

**Analog:** `src/env.ts` (current file, update in-place)

**Current pattern** (lines 1-16):
```typescript
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import { betterAuthSecretSchema } from "@/lib/validation/auth-secret";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: betterAuthSecretSchema,
    BETTER_AUTH_URL: z.string().url(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  },
});
```

**Updated pattern — BETTER_AUTH_URL deprecation** (keep existing structure, update lines 9 and 14):
```typescript
export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: betterAuthSecretSchema,
    // DEPRECATED: BETTER_AUTH_URL is no longer used in auth.ts
    // Replaced with dynamic baseURL allowedHosts config in src/lib/auth.ts
    // Kept here for backward compatibility only; may be removed in future phase
    BETTER_AUTH_URL: z.string().url().optional().default("http://localhost:3000"),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  },
});
```

**Why this pattern:**
- `@t3-oss/env-nextjs` provides type-safe runtime validation via Zod
- Keeps schema definition and runtime assignment in one place
- Optional + default on deprecated `BETTER_AUTH_URL` ensures no build-time failures if the env var is missing
- Single `env` export used throughout codebase; changes here propagate automatically

---

### `.env.example` (config, static/reference)

**Analog:** `.env.example` (current file, update in-place)

**Current pattern** (lines 1-4):
```bash
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
# Generate with: openssl rand -base64 32
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
```

**Updated pattern — environment variable scoping documentation** (replace with):
```bash
# DATABASE_URL is auto-injected by Vercel Neon Marketplace integration
# Do not set locally; instead run: vercel env pull
# Format: postgresql://user:password@host/dbname
# DATABASE_URL=

# BETTER_AUTH_SECRET should be a strong random value
# Generate with: openssl rand -base64 32
# Set in Vercel dashboard under Environment Variables (Production/Preview/Development)
BETTER_AUTH_SECRET=

# BETTER_AUTH_URL is DEPRECATED — no longer used by auth.ts
# Replaced with dynamic baseURL allowedHosts config in src/lib/auth.ts
# This variable is kept for backward-compatibility only; may be removed in a future phase
# BETTER_AUTH_URL=http://localhost:3000
```

**Why this pattern:**
- Clearly documents which variables are auto-injected (DATABASE_URL) vs. user-provided (BETTER_AUTH_SECRET)
- Documents Vercel workflow (`vercel env pull`) for local development
- Deprecation notice guides future contributors
- Comments indicate expected format and generation method for each secret

---

## New Files (No Existing Analogs)

The following files are new infrastructure components with no existing codebase analog. Patterns are sourced directly from RESEARCH.md and official platform documentation.

### `.github/workflows/ci.yml` (config, batch/automation)

**Role:** GitHub Actions CI workflow — runs lint, typecheck, test, build on every PR and push to main

**Pattern source:** RESEARCH.md Section "GitHub Actions CI Workflow for Next.js + Vitest" (lines 527–571) and GitHub Actions documentation

**Implementation template:**
```yaml
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
        # NOTE: Use --webpack flag to match package.json build script
        # (Turbopack disabled for @serwist/next compatibility per Phase 4)
        run: npm run build
```

**Key details:**
- Runs on `ubuntu-latest` (GitHub-hosted runner, free tier included)
- Uses `actions/setup-node@v4` with npm caching for fast dependency installation
- Executes `npm ci` (clean install) rather than `npm install` for reproducible builds
- Build step uses `npm run build` which includes `--webpack` flag (per package.json)
- No environment variables needed (uses only local dependencies and linting)
- Matches package.json scripts exactly: `lint`, `test`, `build`

**Integration point:**
- Must set GitHub branch protection rule on `main` requiring this workflow to pass (Settings → Branches → Add rule → main → Require status checks)
- Workflow name is `CI`; status check reference is `ci / ci`

---

### `.github/workflows/deploy.yml` (config, batch/automation)

**Role:** GitHub Actions deploy job — invokes Vercel CLI to deploy to production on main branch merge

**Pattern source:** RESEARCH.md and Vercel + GitHub Actions integration guides

**Implementation template:**
```yaml
name: Deploy

on:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
      
      - name: Install Vercel CLI
        run: npm install -g vercel
      
      - name: Deploy to Vercel Production
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
        run: vercel deploy --prod
```

**Key details:**
- Triggers only on push to `main` branch (not on PR creation)
- Requires three GitHub Secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
  - Generate `VERCEL_TOKEN` from Vercel dashboard (Account Settings → Tokens → Create)
  - Copy `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` from Vercel project settings
- `vercel deploy --prod` flags production deployment (uses Production environment variables from Vercel)
- Separate from CI workflow (CI runs on PR + main; Deploy runs only on main merge)

**Integration point:**
- GitHub Secrets must be configured in repo settings (Settings → Secrets and variables → Actions)
- Will only run if `VERCEL_TOKEN` exists; fails silently otherwise
- Requires Vercel.json to disable auto-deploy (see next section)

---

### `vercel.json` (config, static configuration)

**Role:** Vercel project configuration — disables auto-deploy on main/staging, relies on GitHub Actions as sole orchestrator

**Pattern source:** RESEARCH.md Section "Vercel Deployment Configuration" (lines 609–627) and Vercel Git Configuration documentation

**Implementation template:**
```json
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

**Key details:**
- `deploymentEnabled.main: false` — Vercel does NOT auto-deploy when commits land on `main` branch
- `deploymentEnabled.staging: false` — Vercel does NOT auto-deploy on `staging` branch
- `ignoreCommand: "exit 0"` — Fallback: if deployment somehow triggers despite the above, immediately exit with 0 (skip the build)
- Preview deployments remain enabled (Vercel still creates preview URLs per PR automatically, which is valuable)

**Why this pattern:**
- Prevents double-deploy race: both Vercel and GitHub Actions triggering on same commit
- Single orchestrator (GitHub Actions) owns all production/staging deploys
- Vercel remains fast deployment platform; only deploy orchestration moves to GitHub Actions
- Preview deployments stay automatic (fast PR review experience)

**Integration point:**
- Commit to repo root (same level as package.json)
- Takes effect immediately on next deployment attempt
- Can test by pushing to main and verifying only GitHub Actions deployment appears in Vercel dashboard (not an auto-triggered one)

---

### `.planning/phases/05-deploy-pipeline-environment-config/DEPLOYMENT.md` (documentation, static/reference)

**Role:** Release procedure checklist — documents feature-branch → staging → production workflow with manual UAT verification steps

**Pattern source:** RESEARCH.md Section "Deployment Manual Verification Checklist" (lines 631–706) and release management best practices

**Implementation template:** (full content provided in RESEARCH.md lines 631–706)

**Key details:**
- Three main phases: Feature Branch → Staging (manual gate), Staging → Production (controlled release), Rollback Procedure (if needed)
- Each phase has pre-deployment checks, deployment steps, manual verification (UAT), and approval gates
- Staging verification includes specific auth flows (register, login) and app-core flows (salary entry, bonus, data persistence)
- Cross-environment verification: log out on staging, log in on production, verify no session bleed
- Production smoke test includes auth, existing data loads, monitoring checks
- Rollback procedure documented with step-by-step revert and monitoring

**Why this pattern:**
- Formalizes manual gate between environments (prevents accidental production deploys)
- Ensures consistent UAT checklist across team (same steps every time)
- Captures tribal knowledge in git-tracked document
- Serves as training material for new team members on release process

**Integration point:**
- Commit to `.planning/phases/05-deploy-pipeline-environment-config/` directory (same as other phase docs)
- Reference in README or developer guide as the canonical release procedure
- Use as template for Phase 6+ releases; update based on lessons learned

---

## Shared Patterns

### Environment Variable Scoping (DEPLOY-02)

**Applies to:** `.github/workflows/`, `.env.example`, `src/env.ts`, `vercel.json`

**Pattern:** Environment variables are scoped per Vercel environment (Production, Preview, Development) and never mix across tiers.

**Concrete excerpt from RESEARCH.md (Pattern 4, lines 369–416):**

```
Setup in Vercel Dashboard:
- Name: DATABASE_URL
  Production: (Neon Marketplace auto-fills: main branch URL)
  Preview: (Neon Marketplace auto-fills: preview branch URL)
  Development: (leave empty or set to local-dev Neon branch)
  Environments: [✓ Production, ✓ Preview, ✓ Development]
  [Save]

- Name: BETTER_AUTH_SECRET
  Production: (generate with: openssl rand -base64 32)
  Preview: (same or separate, depending on your secret rotation policy)
  Development: (set locally via .env.local)
  Environments: [✓ Production, ✓ Preview, ✓ Development]
  [Save]
```

**Local development workflow:**
```bash
# Pull Production/Preview env vars to local dev
vercel env pull
# Creates .env.local with all environment variables
```

**Why this pattern:**
- Prevents production secrets (DATABASE_URL keys, BETTER_AUTH_SECRET) from leaking to staging or local dev
- Neon Marketplace integration auto-creates unique branch credentials per Preview environment
- Single source of truth in Vercel dashboard; no need to manually manage .env files per environment

---

### Request-Time Origin Validation (SEC-04)

**Applies to:** `src/lib/auth.ts` baseURL configuration

**Pattern:** Better Auth's `baseURL` is configured as an object with `allowedHosts` allowlist, validated at request time rather than build time.

**Concrete excerpt from `src/lib/auth.ts` update:**

```typescript
baseURL: {
  allowedHosts: [
    "localhost:3000",           // Local development
    "localhost:3001",           // Alt port
    "*.vercel.app",             // Vercel preview deployments
    "staging.example.com",      // Staging
    "example.com",              // Production
  ],
  protocol: process.env.NODE_ENV === "development" ? "http" : "https",
},
```

**Why this pattern:**
- Better Auth reads `x-forwarded-host` header (set by Vercel proxy) and validates against allowlist
- Single build works on all environments; no rebuild needed when deploying to staging or production
- Prevents confused-deputy attacks: unrecognized host headers are rejected with error
- Session cookies naturally scope to correct domain (staging cookies ≠ production cookies)

---

### GitHub Actions CI Gate (DEPLOY-03)

**Applies to:** `.github/workflows/ci.yml` + GitHub branch protection rules

**Pattern:** Every PR and push to main runs CI workflow (lint, typecheck, test, build). Merge is blocked if any check fails.

**Concrete excerpt from `.github/workflows/ci.yml`:**

```yaml
on:
  pull_request:
    branches: [main]
  push:
    branches: [main, staging]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm test
      - run: npm run build
```

**GitHub branch protection rule setup:**
```
Settings → Branches → Add rule
- Apply to: main
- [✓] Require a pull request before merging
- [✓] Require status checks to pass before merging
- [✓] Require branches to be up to date before merging
- Status checks: Select "ci / ci" (workflow output)
- [Save]
```

**Why this pattern:**
- Blocks untested/linted code from reaching main
- CI runs in GitHub's environment (exact same OS + Node version for all developers)
- Status check is declarative and enforceable; cannot be bypassed by individual developers
- Caching npm dependencies speeds up CI to ~2-3 minutes

---

### Single Deploy Path (DEPLOY-05)

**Applies to:** `vercel.json` + `.github/workflows/deploy.yml`

**Pattern:** Exactly one deployment path per environment. GitHub Actions orchestrates; Vercel auto-deploy is disabled.

**Concrete excerpt:**

**vercel.json disables auto-deploy:**
```json
{
  "git": {
    "deploymentEnabled": {
      "main": false,
      "staging": false
    }
  },
  "ignoreCommand": "exit 0"
}
```

**GitHub Actions invokes Vercel CLI:**
```yaml
- name: Deploy to Vercel Production
  env:
    VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
  run: vercel deploy --prod
```

**Why this pattern:**
- Prevents race condition: Vercel auto-deploy + GitHub Actions both triggering on same commit
- GitHub Actions becomes audit trail for all production deployments
- Explicit `vercel deploy --prod` command is more visible in logs than implicit auto-deploy
- Preview deployments still work automatically (fast PR review experience without manual gate)

---

## No Analog Found

Files with no close match in the codebase (patterns sourced from RESEARCH.md and official platform documentation):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.github/workflows/ci.yml` | config (CI/CD) | batch/automation | GitHub Actions workflows are new to this project; no existing CI setup |
| `.github/workflows/deploy.yml` | config (CI/CD) | batch/automation | GitHub Actions deploy orchestration is new to this project |
| `vercel.json` | config (deployment) | static configuration | Vercel project configuration is new to this project; previous phases used defaults |
| `DEPLOYMENT.md` | documentation | static/reference | Release procedure documentation is new to this project; no existing process doc |

---

## Metadata

**Analog search scope:** `/home/zaiden/code/kys/src`, `/home/zaiden/code/kys/.env*`, root config files

**Files scanned:** 
- `src/lib/auth.ts` (19 lines) — auth service configuration
- `src/env.ts` (16 lines) — environment validation
- `.env.example` (4 lines) — env var documentation
- `package.json` (48 lines) — build scripts and dependencies
- `tsconfig.json` (34 lines) — TypeScript configuration
- `next.config.ts` (26 lines) — Next.js configuration

**Pattern extraction date:** 2026-09-01

**Confidence assessment:**
- Existing analogs (src/lib/auth.ts, src/env.ts, .env.example): EXACT (same files to be updated)
- GitHub Actions workflows: HIGH (sourced from RESEARCH.md, cross-referenced with GitHub Actions docs)
- vercel.json: HIGH (sourced from RESEARCH.md, cross-referenced with Vercel docs)
- DEPLOYMENT.md: HIGH (sourced from RESEARCH.md, general release best practices)

**Ready for planning:** Yes. Planner can now reference existing patterns for auth/env config updates, and use RESEARCH.md code examples directly for new GitHub Actions workflows and vercel.json.
