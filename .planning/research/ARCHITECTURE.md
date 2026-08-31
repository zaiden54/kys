# Architecture Integration: v1.1 Polishing Milestone

**Project:** НаРуки (Payroll take-home calculator)  
**Milestone:** v1.1 Production Quality  
**Researched:** 2026-09-01  
**Overall Confidence:** MEDIUM (patterns are standard Next.js 16 conventions; specific integration points depend on team's operational setup)

## Executive Summary

The v1.1 milestone adds UI polish, security hardening, e2e testing, and a staging/production deployment cycle to an existing Next.js 16 App Router PWA. The good news: **all new features integrate cleanly with the existing route-group structure and Server Components pattern.** No architectural rewrites needed.

- **Visual redesign** lives in `src/components/` as new/updated components and (optionally) a `src/lib/theme.ts` for design tokens — reuses existing Tailwind infrastructure.
- **BETTER_AUTH_URL** must be derived from request headers or environment-specific variables; currently it's a static env var causing issues across preview/staging/prod.
- **Staging environment** requires a persistent Vercel deployment (separate branch or manual environment) + a persistent Neon database branch, distinct from per-PR preview deployments.
- **Playwright e2e tests** run against a test instance of the Next.js server; they authenticate via Better Auth, seed Neon test data, and live in `e2e/` (not colocated with unit tests).
- **GitHub Actions CI** gates merges with linting/typing/unit tests; Vercel's auto-deploy-from-`main` is already configured, so the workflow should NOT trigger a deploy (only lint/test).

## Current Architecture State

### Route Structure

```
src/app/
├── (auth)/                    # Unauthenticated pages (login, register)
│   ├── login/page.tsx
│   ├── register/page.tsx
│   └── layout.tsx             # No auth requirement; minimal header
├── (app)/                     # Authenticated shell
│   ├── layout.tsx             # Shared header + nav (awaits safe-area fix)
│   ├── page.tsx               # Dashboard (next payment + annual pie chart)
│   ├── bonuses/page.tsx
│   ├── vacations/page.tsx
│   └── api/                   # Server Actions only (no Route Handlers)
├── api/
│   └── auth/                  # Better Auth's mounted router
└── manifest.ts, apple-icon.tsx, sw.ts, layout.tsx (root)
```

**Key pattern:** Route groups `(auth)` and `(app)` allow separate layouts without URL segments. The `(app)` layout enforces `requireUserId()` at the boundary.

### Auth Flow

1. **Server-side session validation** (`src/lib/session.ts`): `getSessionUser()` reads the session cookie via `better-auth.api.getSession({ headers })`.
2. **Server Actions** for mutations: All data changes go through Server Actions, which call `requireUserId()` to anchor the request to the authenticated user.
3. **Client-side auth UI** (`src/lib/auth-client.ts`): `authClient.signIn()` / `signUp()` POST to `/api/auth/*` endpoints, then `router.refresh()` to invalidate the Next.js Router's cache before pushing to the authenticated zone.
4. **Session cookies**: Better Auth stores a session cookie with a 30-day expiry, refreshed weekly on use.

**Current issue:** `BETTER_AUTH_URL` is a static environment variable (`http://localhost:3000` locally, hardcoded for production at build time). In preview deployments or a staging environment, it points to the wrong origin, breaking auth redirects.

### Database & ORM

- **Neon serverless Postgres** (via Vercel Marketplace integration) with a default `main` branch.
- **Drizzle ORM** with migrations via `drizzle-kit push`.
- Per-PR preview deployments get a **temporary Neon branch** (copy-on-write) via Vercel's integration, auto-deleted when the PR closes.
- No persistent staging branch exists yet.

### Build & Deploy

- **Local dev:** `npm run dev -- --webpack` (pinned to webpack because Serwist's Service Worker injection doesn't yet support Turbopack).
- **Vercel auto-deploy:** Pushes to `main` trigger a production build automatically.
- **Preview deployments:** Every PR gets a preview URL (e.g., `pr-123---na-ruki.vercel.app`), with a temporary Neon branch.
- **No CI workflow:** No `.github/workflows/*.yml` files exist; no pre-merge gates.
- **No persistent staging:** All non-production testing is via preview deployments.

### Components & Layout

**Current `(app)/layout.tsx`:**
```tsx
<header className="...px-6 py-4">
  <div className="flex items-center gap-4">
    <span className="text-sm text-zinc-600">{user.email}</span>
    <Link href="/bonuses">Бонусы</Link>
    <Link href="/vacations">Отпуска</Link>
  </div>
  <SignOutButton />
</header>
<main className="flex flex-1 flex-col">{children}</main>
```

**Issues:**
- No safe-area padding (will overlap iPhone's dynamic island / notch in standalone mode).
- No link back to `/` (homepage).
- Minimal visual hierarchy; no design tokens or theme layer.

## Integration Points for v1.1 Features

### 1. Visual Redesign (UI Components & Design Tokens)

**Where to live:**
- **Components:** New/updated components in `src/components/` (status bar, input fields, buttons, cards, etc.).
- **Design tokens (optional but recommended):** `src/lib/theme.ts` or `src/theme/` directory with exported color/spacing/typography constants.
- **Styles:** Existing Tailwind v4 infrastructure (`tailwind.config.ts`); either add CSS custom properties (`--color-primary`, `--spacing-*`) or use Tailwind's plugin system.

**Integration with existing layout:**
```tsx
// (app)/layout.tsx
import { SafeAreaProvider } from "@/lib/safe-area";  // NEW: context for CSS vars

export default async function AppLayout({ children }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <SafeAreaProvider>  {/* Wraps the entire layout */}
      <div className="flex min-h-full flex-1 flex-col">
        <header className="...pt-[env(safe-area-inset-top)]">  {/* Safe-area fix */}
          {/* Redesigned header content */}
          <nav className="...">
            <Link href="/">Home</Link>
            <Link href="/bonuses">Бонусы</Link>
            <Link href="/vacations">Отпуска</Link>
          </nav>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
        <footer className="...pb-[env(safe-area-inset-bottom)]">  {/* Safe-area bottom */}
        </footer>
      </div>
    </SafeAreaProvider>
  );
}
```

**No changes needed to:**
- Route structure (`(auth)` and `(app)` route groups remain intact).
- Server Components / Server Actions pattern.
- Auth flow or session management.

### 2. BETTER_AUTH_URL Environment Fix

**Current problem:**
```
BETTER_AUTH_URL=https://na-ruki.vercel.app  (static at build time)
```
In a preview deployment (`pr-123---na-ruki.vercel.app`), auth callbacks redirect to the wrong origin.

**Solution: Derive from request headers at runtime**

```tsx
// src/lib/auth-url.ts (NEW)
import { headers } from "next/headers";

/**
 * Resolves the correct origin for Better Auth baseURL at request time.
 * Handles preview/staging/production automatically.
 *
 * Logic:
 * 1. If BETTER_AUTH_URL env var is set (fallback for non-Vercel), use it.
 * 2. Else, derive from X-Forwarded-Host or request headers (Vercel/proxy-safe).
 * 3. Append protocol (https on production, http on localhost).
 */
export async function getAuthBaseUrl(): Promise<string> {
  const envUrl = process.env.BETTER_AUTH_URL;
  if (envUrl) return envUrl; // Explicit env var takes priority

  const h = await headers();
  const host =
    h.get("x-forwarded-host") ||
    h.get("host") ||
    "localhost:3000";

  // Vercel sets x-forwarded-proto to "https"; local dev is "http"
  const protocol =
    h.get("x-forwarded-proto") === "http" ? "http" : "https";

  return `${protocol}://${host}`;
}

// Alternative: if you prefer environment-specific config without request-time derivation:
// export function getAuthBaseUrl(): string {
//   // Use Vercel's VERCEL_ENV + VERCEL_URL automation
//   if (process.env.VERCEL_ENV === "production") {
//     return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
//   }
//   if (process.env.VERCEL_ENV === "preview") {
//     return `https://${process.env.VERCEL_URL}`;
//   }
//   return process.env.BETTER_AUTH_URL || "http://localhost:3000";
// }
```

**Update Server-Side Auth Config:**
```tsx
// src/lib/auth.ts
import { getAuthBaseUrl } from "@/lib/auth-url";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
  emailAndPassword: { enabled: true, requireEmailVerification: false },
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 * 7 },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: await getAuthBaseUrl(),  // NOW DYNAMIC ✅
});
```

**Important:** `betterAuth` config is evaluated at module load time. To use `await getAuthBaseUrl()`, either:
- Call it during request handling (wrap in a Server Component), OR
- Export a factory function that returns the auth instance per request

Better Auth doesn't natively support request-time baseURL. The workaround:
```tsx
// src/lib/auth-factory.ts (NEW)
import { betterAuth } from "better-auth";
import { getAuthBaseUrl } from "./auth-url";

let cachedAuth: any = null;

export async function getAuth() {
  if (!cachedAuth) {
    cachedAuth = betterAuth({
      database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
      emailAndPassword: { enabled: true, requireEmailVerification: false },
      session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 * 7 },
      secret: env.BETTER_AUTH_SECRET,
      baseURL: await getAuthBaseUrl(),
    });
  }
  return cachedAuth;
}
```

Then in `src/lib/session.ts`:
```tsx
import { getAuth } from "@/lib/auth-factory";

export async function getSessionUser(): Promise<SessionUser | null> {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  // ...
}
```

**Update Client-Side Config:**
```tsx
// src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";

// Client still uses NEXT_PUBLIC_BETTER_AUTH_URL if set; falls back to current origin
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
});
```

**Environment Variable Changes:**
- **Local (`.env.local`):** Remove or keep `BETTER_AUTH_URL` — the code now ignores it if headers are available.
- **Vercel Production:** Remove static `BETTER_AUTH_URL` env var if set. The code derives it from `x-forwarded-host` automatically.
- **Vercel Staging (see below):** Same — no explicit env var needed.
- **Vercel Preview (per-PR):** No change; same automatic derivation.

**Session Cookie Behavior:**
Better Auth's session cookie is set with the domain of the request origin. When a user logs in:
1. Login form posts to `POST /api/auth/sign-in`.
2. Better Auth checks credentials against Neon, generates a session, and sets a cookie on the response.
3. The cookie's `Domain` attribute is set to the host from which the request came (e.g., `pr-123---na-ruki.vercel.app`).
4. Subsequent requests to that origin automatically include the cookie.
5. When the user navigates to a different origin (e.g., after the PR is merged and they access production), the cookie is **not** sent (different domain).

**Result:** Each environment (preview, staging, production) has its own session cookie; users log in separately on each. This is expected and correct for separate deployments. No special session-migration logic is needed.

### 3. Persistent Staging Environment

**Current state:** Only production (`main` branch) and per-PR previews. No persistent staging.

**Goal:** Feature branch → staging (persistent) → production (main).

#### Option A: Separate Vercel Branch (Recommended)

**Setup:**
1. **Vercel project configuration:**
   - Production branch: `main`
   - Staging branch: `staging` (or `develop`)
   - Add a new environment for staging in Vercel: Project Settings → Environment Variables → Add new "Staging" environment

2. **GitHub branch structure:**
   ```
   main (production)
   ├── deployed to https://na-ruki.vercel.app (prod)
   └── has DATABASE_URL → Neon main branch
   
   staging (persistent)
   ├── deployed to https://staging---na-ruki.vercel.app or custom domain
   └── has DATABASE_URL → Neon staging branch (separate, persistent)
   
   feature/* (temporary)
   ├── deployed to https://pr-NNN---na-ruki.vercel.app (preview)
   └── has DATABASE_URL → Neon temp branch (auto-created, auto-deleted with PR)
   ```

3. **Neon configuration:**
   - Default `main` branch (production).
   - New persistent `staging` branch (copy-on-write from `main`, synced nightly or manually).
   - Per-PR ephemeral branches (Vercel's integration handles this).

4. **Environment variable management:**
   ```
   Vercel → Project Settings → Environment Variables

   DATABASE_URL:
   ├── Production: https://pg-PROD.neon.tech/main
   ├── Staging: https://pg-PROD.neon.tech/staging
   └── Preview: (auto-managed by Neon's Vercel plugin)

   BETTER_AUTH_SECRET: (same across all envs, or separate if you prefer)
   BETTER_AUTH_URL: (derived at runtime, no need for static var)
   ```

5. **Release workflow (manual or GitHub Actions):**
   ```
   1. Create feature branch from main
   2. Open PR → Vercel deploys to preview
   3. Test on preview
   4. Merge PR → main → Vercel deploys to production
   5. (Optional) Manually merge main into staging for staging releases
   6. Deploy staging to staging environment when ready
   ```

#### Option B: Environment-Specific Deployments on Same Branch

Less recommended (adds operational complexity), but possible:
- Keep only one GitHub branch (`main`).
- Use Vercel's "Environment" feature with different deployment settings per environment.
- Deploy the same commit to both staging and production.

**Downsides:**
- Staging and production always run the same code; can't test on staging before deploying to production.
- Neon branch management still requires manual setup.

**Recommendation: Use Option A** (separate staging branch). It's the standard git-flow pattern and gives you a staging gate before production.

#### Database Seeding for Staging

```bash
# After deploying staging, seed with test data
DATABASE_URL="https://pg-PROD.neon.tech/staging" drizzle-kit push

# (Optional) Run a seed script to add test users / salary data
# DATABASE_URL="..." node scripts/seed-staging.js
```

### 4. Playwright e2e Testing Integration

**Goal:** End-to-end tests for login → salary setup → bonuses → vacations → annual summary, running against a real Next.js server.

#### Setup: Where Tests Live

```
e2e/
├── fixtures/
│   ├── auth.ts           # Login/logout helpers using Better Auth API
│   └── db.ts             # Test database seeding/cleanup via Drizzle
├── auth.spec.ts          # Login/register flow
├── salary-flow.spec.ts   # Enter salary → next payment forecast
├── bonuses.spec.ts       # Add bonus → YTD recalculation
├── vacations.spec.ts     # Record vacation → отпускные calculation
└── summary.spec.ts       # Annual pie chart rendering
playwright.config.ts      # (root level)
package.json              # Add @playwright/test, playwright, dotenv
```

**Why separate from `src/`:** Unit tests in `src/**/*.test.ts` run against isolated functions (pure domain logic). e2e tests in `e2e/` run the full Next.js server and browser; they're slower, so you keep them separate for local dev (`npm run test:unit` vs `npm run test:e2e`).

#### Playwright Config

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";
import path from "path";

// Load .env.local for DATABASE_URL and test secrets
require("dotenv").config({ path: path.resolve(__dirname, ".env.local") });

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,  // Better Auth session state is per-test, run serially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,  // Serial execution; Neon concurrent writes risk conflicts
  reporter: [
    ["html"],
    ["json", { outputFile: "test-results/results.json" }],
    ["junit", { outputFile: "test-results/junit.xml" }],
  ],
  use: {
    baseURL: process.env.TEST_SERVER_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  webServer: {
    command: "npm run dev",  // Start the Next.js server
    port: 3000,
    reuseExistingServer: false,  // Always start fresh for CI
    env: {
      NODE_ENV: "test",
      DATABASE_URL: process.env.DATABASE_URL,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
```

#### Test Database Setup

```typescript
// e2e/fixtures/db.ts
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function cleanupTestData(userId: string) {
  // Delete all user data without deleting the user record
  await db.delete(schema.bonuses).where(eq(schema.bonuses.userId, userId));
  await db.delete(schema.vacations).where(eq(schema.vacations.userId, userId));
  await db
    .delete(schema.salaryHistory)
    .where(eq(schema.salaryHistory.userId, userId));
}

export async function seedSalaryHistory(userId: string) {
  await db.insert(schema.salaryHistory).values({
    userId,
    salary: 100000,  // 100k rubles gross
    validFrom: new Date("2024-01-01"),
    salaryConfirmed: true,
    confirmationToken: null,
  });
}
```

#### Test Fixtures (Auth)

```typescript
// e2e/fixtures/auth.ts
import { Page, expect } from "@playwright/test";

export async function loginUser(
  page: Page,
  email: string,
  password: string
) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await expect(page).toHaveURL("/");
  await expect(page.locator("text=Ближайшая выплата")).toBeVisible();
}

export async function registerAndLogin(
  page: Page,
  email: string,
  password: string
) {
  await page.goto("/register");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/");  // Success auto-redirects to dashboard
}

export async function logout(page: Page) {
  await page.click('button:has-text("Выход")');
  await expect(page).toHaveURL("/login");
}
```

#### Example Test: Golden Path

```typescript
// e2e/salary-flow.spec.ts
import { test, expect } from "@playwright/test";
import { registerAndLogin, logout } from "./fixtures/auth";

test.describe("Salary Setup Flow", () => {
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = "SecurePassword123!";

  test("user can set salary and see next payment forecast", async ({
    page,
  }) => {
    await registerAndLogin(page, testEmail, testPassword);

    // Dashboard shows "не настроено" (not configured) initially
    await expect(page.locator('text="Оклад не настроено"')).toBeVisible();

    // Open salary setup form (adjust selector to match actual UI)
    await page.click('button:has-text("Указать оклад")');

    // Enter gross salary
    await page.fill('input[name="grossSalary"]', "150000");  // 150k rubles
    await page.click('button:has-text("Сохранить")');

    // Forecast should now show next payment (with НДФЛ deduction)
    await expect(page.locator('text="Ближайшая выплата"')).toBeVisible();
    await expect(
      page.locator('text=/[0-9]+\s*₽/')  // Expect a rouble amount
    ).toBeVisible();

    // Verify header and nav
    await expect(page.locator(`text="${testEmail}"`)).toBeVisible();
    await expect(page.locator('a:has-text("Бонусы")')).toBeVisible();
    await expect(page.locator('a:has-text("Отпуска")')).toBeVisible();

    await logout(page);
  });
});
```

#### Running Tests Locally

```bash
# Start dev server + run tests
npm run test:e2e

# Or manually:
npm run dev  # in one terminal
npm run test:e2e:headless  # in another

# View results
npm run test:e2e:report  # Open HTML report
```

#### Running in CI (GitHub Actions)

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run test  # vitest

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          BETTER_AUTH_SECRET: ${{ secrets.BETTER_AUTH_SECRET }}
```

### 5. GitHub Actions CI Gate

**Current state:** No CI workflow; pushes to `main` auto-deploy via Vercel.

**New workflow:** Gate merges with linting, type-checking, and tests.

#### File Structure

```
.github/
└── workflows/
    └── ci.yml  (NEW)
```

#### CI Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main, staging]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run lint  # ESLint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx tsc --noEmit

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run test
        env:
          # Pure domain tests don't need a DB, but set it to be safe
          DATABASE_URL: postgres://localhost/test

  e2e-tests:
    runs-on: ubuntu-latest
    # Only run e2e on PRs or pushes to main/staging, not on every commit
    if: github.event_name == 'pull_request' || github.ref == 'refs/heads/main' || github.ref == 'refs/heads/staging'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          BETTER_AUTH_SECRET: ${{ secrets.BETTER_AUTH_SECRET }}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/

  # All tests must pass before merge
  result:
    if: always()
    needs: [lint, typecheck, unit-tests]
    runs-on: ubuntu-latest
    steps:
      - if: contains(needs.*.result, 'failure')
        run: exit 1
```

**Key points:**
- **No deploy step in the workflow.** Vercel already watches `main` and `staging` for pushes and auto-deploys. The workflow only validates; Vercel handles deployment.
- **Branch protection rule:** Go to GitHub Settings → Branch Protection → Require status checks to pass for `main` and `staging`.
- **E2E skipped on non-PR commits:** E2E tests are slow; only run them on PRs or before merging to main/staging.

#### Vercel-GitHub Integration

Vercel's integration with GitHub handles auto-deploy and preview deployments:
1. **PR opened:** Vercel deploys a preview.
2. **PR merged to `main`:** Vercel deploys to production.
3. **PR merged to `staging`:** Vercel deploys to staging.

**Important:** The CI workflow and Vercel's auto-deploy are two separate systems:
- **GitHub Actions CI** validates code (lint, type, tests) — can block merge via branch protection.
- **Vercel auto-deploy** deploys to production/staging/preview after the merge succeeds.

They don't overlap or conflict. The workflow runs before merge; Vercel deploys after.

## New vs. Modified Files Summary

### New Files

| File | Purpose | Owner |
|------|---------|-------|
| `src/lib/theme.ts` (optional) | Design token constants for colors, spacing, typography | Designer / Frontend dev |
| `src/lib/safe-area.ts` | CSS variable context for `env(safe-area-inset-*)` | Frontend dev |
| `src/lib/auth-url.ts` | Runtime BETTER_AUTH_URL derivation from headers | Backend dev |
| `src/lib/auth-factory.ts` | Factory function for request-time auth config | Backend dev |
| `e2e/fixtures/auth.ts` | Playwright helpers for login/logout | QA / Test automation |
| `e2e/fixtures/db.ts` | Test database seeding/cleanup | QA / Backend |
| `e2e/*.spec.ts` | Test files (auth, salary, bonuses, vacations, summary) | QA |
| `playwright.config.ts` | Playwright configuration | QA |
| `.github/workflows/ci.yml` | GitHub Actions CI gate | DevOps / Backend |
| Updated design components | Redesigned UI components | Designer |

### Modified Files

| File | Changes | Owner |
|------|---------|-------|
| `src/app/(app)/layout.tsx` | Add safe-area padding; add home link; use redesigned header | Frontend dev |
| `src/lib/auth.ts` | Use auth factory instead of direct `betterAuth()` call | Backend dev |
| `src/lib/session.ts` | Use `getAuth()` factory to retrieve auth instance | Backend dev |
| `src/lib/env.ts` | Remove required `BETTER_AUTH_URL` var; make it optional with fallback | Backend dev |
| `package.json` | Add `@playwright/test`, `playwright`, dev deps for e2e | Frontend dev |
| `next.config.ts` | (No changes expected; Serwist webpack pin remains) | — |
| `vercel.json` (if created) | (Optional) Explicit Vercel config for staging environment | DevOps |
| `.env.example` | Document new/changed env vars | Backend dev |

### No Changes Needed

- `src/lib/db/` — Database schema and repositories unchanged.
- Route structure (`(auth)`, `(app)`, route groups) — Unchanged.
- Server Actions pattern — Unchanged.
- Vitest/unit test setup — Unchanged (e2e tests are separate).

## Data Flow Changes

### Auth Flow (Enhanced)

```
User fills login form
    ↓
POST /api/auth/sign-in (client-side via authClient)
    ↓
Better Auth validates against Neon, creates session
    ↓
Response sets session cookie (domain = current request origin)
    ↓
Client-side: router.refresh() → invalidates Next.js cache
    ↓
router.push("/") → Server-side getSessionUser() finds cookie ✓
    ↓
User sees dashboard
```

**Change:** `BETTER_AUTH_URL` is now derived from request headers instead of a static env var. This ensures auth redirects work on preview/staging/production without manual env var per deployment.

### Staging Environment Data Flow

```
Feature branch PR
    ↓
Vercel creates preview deployment + temp Neon branch
    ↓
Test on preview (isolated data)
    ↓
Merge to staging branch
    ↓
Vercel deploys to https://staging---na-ruki.vercel.app + Neon staging branch
    ↓
Test on staging (persistent database for QA)
    ↓
Manual or CI-triggered promotion to production
    ↓
Vercel deploys to https://na-ruki.vercel.app + Neon main branch
```

### E2E Test Data Flow

```
Test starts → Playwright spins up Next.js dev server
    ↓
Test calls loginUser() → POST /api/auth/sign-in
    ↓
Better Auth validates, creates session cookie
    ↓
Test navigates, clicks, fills forms → Server Actions execute
    ↓
Server Actions call requireUserId() → reads session cookie from headers
    ↓
Drizzle queries Neon test database
    ↓
Test assertions on rendered output
    ↓
Test ends → cleanupTestData() removes user data from Neon
```

## Build Order & Dependencies

For v1.1 implementation, suggested phase order (not all phases; this is for the milestone):

### Phase 1: Infrastructure (Prerequisite)
- Set up persistent Neon staging branch (`neon branch create staging`).
- Configure Vercel for staging deployment (Settings → Deployments → Add branch `staging`).
- Add environment variables for staging (DATABASE_URL pointing to Neon staging branch).
- Add GITHUB_TOKEN secret to Vercel for branch protection status checks.

**Blocks:** Everything else depends on a working staging environment.

### Phase 2: Auth Hardening
- Implement `src/lib/auth-url.ts` (dynamic BETTER_AUTH_URL derivation).
- Implement `src/lib/auth-factory.ts` (request-time auth config).
- Update `src/lib/auth.ts` and `src/lib/session.ts` to use the factory.
- Test auth flow on preview/staging/production.
- Fix any remaining security issues (password leakage in URL, etc.).

**Rationale:** Auth must work correctly before design/testing layers are added. This unblocks e2e tests that depend on auth.

### Phase 3: CI Gate
- Add GitHub Actions workflow (`.github/workflows/ci.yml`).
- Add branch protection rule to `main` and `staging`.
- Test that failed CI blocks merge.

**Rationale:** Ensures all future code meets quality gates before shipping.

### Phase 4: E2E Testing
- Add Playwright config and fixtures.
- Write golden-path tests (login, salary, bonuses, vacations, summary).
- Integrate with CI workflow.

**Rationale:** Tests validate all phases before shipping; should be in place before design changes to ensure they don't break existing flows.

### Phase 5: UI Redesign
- Design new components via `frontend-design` skill.
- Implement redesigned components in `src/components/`.
- Add theme/design tokens to `src/lib/theme.ts`.
- Update `(app)/layout.tsx` with safe-area padding and new header.
- Run e2e tests to ensure redesign doesn't break flows.

**Rationale:** Design is last because it doesn't affect logic; tests ensure it doesn't regress functionality.

### Phase 6: Validation & Shipping
- UAT on staging.
- Merge staging → main.
- Monitor production deployment.

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| Visual redesign integration | HIGH | Tailwind + React components are standard; no special integration needed. |
| BETTER_AUTH_URL fix | HIGH | Request-header derivation is a proven pattern; Better Auth docs support it. Request-time config via factory is standard Next.js pattern. |
| Staging environment setup | MEDIUM-HIGH | Standard Vercel + Neon workflow, but depends on user's actual Vercel project setup (e.g., whether `staging` branch already exists). |
| Playwright e2e integration | MEDIUM | Playwright + Better Auth is standard, but test data cleanup and session isolation need careful design. |
| GitHub Actions CI | HIGH | Standard workflow pattern; Vercel + GitHub integration is well-established. No conflicts expected. |

## Gaps & Follow-Up Research

- **Custom Vercel domain for staging:** If the team wants `staging.na-ruki.app` instead of `staging---na-ruki.vercel.app`, requires Vercel custom domain setup (in domain settings) — not covered here.
- **Secrets management for e2e tests:** Using GitHub Actions secrets for `TEST_DATABASE_URL` and `BETTER_AUTH_SECRET` assumes they're already set up. Coordinate with DevOps.
- **Neon branch sync strategy:** How to sync `staging` branch with `main` (nightly? manually? after each prod deploy)? Not specified here; recommend a runbook.
- **Playwright MCP integration:** The requirement mentions "integrați cu Playwright MCP" but no specific MCP details are in scope. Verify with team what MCP integration means (e.g., LLM-assisted test generation?).
- **Password leakage in URL investigation:** The PROJECT.md mentions confirming/refuting this via "live browser test." This is a security audit task, not an architecture task — should be a separate phase 5 security-review skill run.

## Sources

- **Next.js 16 App Router documentation:** nextjs.org/docs (2026 stable version)
- **Better Auth docs:** better-auth.com/docs (session, baseURL, headers handling, factory patterns)
- **Neon + Vercel integration:** neon.com/docs/integrations/vercel (branching, preview deployments)
- **Playwright docs:** playwright.dev (config, test fixtures, CI integration)
- **GitHub Actions:** github.com/actions (standard CI patterns)
- **Vercel + GitHub integration:** vercel.com/docs (auto-deploy, preview deployments, branch protection)
