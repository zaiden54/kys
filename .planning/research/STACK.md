# Technology Stack — v1.1 Milestone

**Project:** НаРуки (v1.1 — Polishing MVP for Production Quality)
**Researched:** 2026-09-01
**Scope:** NEW technologies and configurations for v1.1 work (UI redesign, PWA safe-area, security hardening, e2e testing, CI/CD pipeline)
**Confidence:** HIGH (versions verified via npm, Vercel, official documentation as of Sept 2026)

---

## Executive Summary

**v1.0 MVP stack is validated and remains unchanged.** This research identifies **NEW technology areas** required to polish v1.0 into production quality:

1. **iOS PWA safe-area CSS** — `env(safe-area-inset-top/bottom)` (zero-config, baseline CSS)
2. **Vercel multi-environment URL management** — VERCEL_URL system variable + environment scoping
3. **Playwright 1.62.1 e2e testing** — for auth flows, Server Actions, user journeys
4. **Playwright MCP 1.62.1** — optional AI-assisted test writing (GitHub Copilot integration)
5. **GitHub Actions CI workflow** — ESLint, TypeScript type-check, Vitest gates
6. **shadcn/ui 4.x + Tailwind CSS 4.x** — component library for visual redesign

All additions are **backwards-compatible** with v1.0 (Next.js 16, React 19, Drizzle, Neon, Better Auth). No existing code changes required.

---

## Validated v1.0 Stack (DO NOT CHANGE)

| Package | Version | Reason It's Locked |
|---------|---------|-------------------|
| Next.js | 16.3.3 App Router | Core framework, validated in Phase 4 |
| React | 19.2.8 | Stable with Next.js 16, compiler optimized |
| TypeScript | 6.0.3 (not 7.x) | TS 7 breaks typescript-eslint until 7.1 ships |
| PostgreSQL | Neon serverless (Postgres 17-class) | Relational model required for YTD tax calculations |
| Drizzle ORM | 0.45.2 | Type-safe SQL, edge-runtime friendly |
| Better Auth | 1.7.2 | Self-hosted, Drizzle-integrated, no per-MAU billing |
| Recharts | 3.10.1 | Single chart (pie), validated in Phase 4 |
| Serwist | 9.5.12 | PWA manifest + service worker, iOS install heuristics |
| date-fns | 4.4.0 | Date math for pay dates, отпускные averaging |
| Zod | 4.4.3 | Runtime validation at Server Action boundaries |
| Vitest | 4.1.11 | Unit tests for tax/vacation-pay pure functions |
| Vercel | Hosting + Neon Marketplace integration | Deployment, preview deployments, system variables |

See `.claude/CLAUDE.md` Technology Stack section for v1.0 full details. **No changes to these packages for v1.1.**

---

## NEW Technologies for v1.1

### 1. iOS PWA Safe-Area CSS Support

**Status:** ZERO-CONFIG (no package installation required)

| Component | Specification | Integration |
|-----------|---------------|-------------|
| **CSS Foundation** | `env(safe-area-inset-top/bottom/left/right)` + `@media (display-mode: standalone)` | Add to global CSS or Tailwind config (see below) |
| **What It Does** | Reserves padding on header/footer to avoid overlap with iOS notch, dynamic island, and home indicator | Critical for v1.1: current header overlaps dynamic island on iPhone 14+. Fix required before release. |
| **Browser Support** | iOS 15+, Android 10+ (CSS standard, all evergreen browsers support as of 2026) | No polyfill or shim needed |
| **Next.js + Serwist Integration** | Serwist 9.5.12 already includes `apple-touch-icon` + `apple-mobile-web-app-*` meta tags. Just add CSS. | Verify in `next.config.js` / `serwist` config during Phase 1 (safe-area CSS). |

**Implementation:**

If **NOT using Tailwind** (raw CSS):
```css
/* src/app/globals.css */
@media (display-mode: standalone) {
  body {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }
}
```

If **using Tailwind 4.x** (recommended for redesign):
```css
/* In your tailwind.config.ts or CSS layer */
@layer components {
  @media (display-mode: standalone) {
    .safe-container {
      @apply pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)];
    }
  }
}
```

Then wrap your layout's main content:
```tsx
// app/layout.tsx
<body>
  <header className="fixed top-0 w-full">...</header>
  <main className="safe-container pt-[header-height]">
    {children}
  </main>
</body>
```

**Known Caveat (2026):** Using `next/link` instead of raw `<a>` tags can set `env()` values to 0px in some Turbopack builds. Test on real iOS device during Phase 1.

**Confidence:** HIGH (CSS standard approved by W3C Jan 2026, native iOS Safari support, documented in MDN + multiple 2026 PWA guides)

---

### 2. Better Auth URL Management Across Vercel Environments

**Status:** CONFIGURATION CHANGE (no package changes)

**Problem:** v1.0 likely has `BETTER_AUTH_URL` as a static string, causing redirect failures on preview deployments. Each deployment (prod/staging/PR preview) needs its own URL.

| Environment | URL Source | Configuration |
|-------------|-----------|---------------|
| **Production** | Custom domain (e.g., `naruki.yourcompany.com`) | Set in Vercel dashboard: Production scope |
| **Staging** | Custom domain (e.g., `staging.naruki.yourcompany.com`) | Optional; use Vercel branch deployment if preferred |
| **PR Preview** | Auto-generated (e.g., `pr-123--naruki.vercel.app`) | Use Vercel's system variable `VERCEL_URL` |

**Implementation in Better Auth Config:**

```typescript
// lib/better-auth.ts or app/api/auth/[...]/route.ts

const baseURL = process.env.BETTER_AUTH_URL 
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

export const auth = createAuth({
  baseURL,
  // ... rest of config
})
```

**Vercel Dashboard Setup:**

1. **Production scope:**
   - Key: `BETTER_AUTH_URL`
   - Value: `https://naruki.yourcompany.com` (or custom prod domain)
   - Environment: Production only

2. **Preview scope:**
   - Leave `BETTER_AUTH_URL` unset (defaults to fallback using `VERCEL_URL`)
   - OR set if using a persistent staging domain

3. **Development (local):**
   - Create `.env.local`: `BETTER_AUTH_URL=http://localhost:3000`

**How It Works:**
- Vercel automatically populates `VERCEL_URL` for every deployment (PR preview, branch deploy, prod)
- Example: `git push origin feature-branch` → Vercel creates `pr-123--naruki.vercel.app` → `VERCEL_URL` env var = `pr-123--naruki.vercel.app`
- Better Auth callback URL auto-resolves to that URL → no redirect loops

**Neon Database Pairing:**
- Ensure Neon branch connection string also scopes per environment (existing in v1.0, verify during Phase 1)
- Production = main branch, Staging = staging branch, Preview = ephemeral PR branch

**Confidence:** HIGH (Vercel VERCEL_URL is first-class system variable, confirmed in official Vercel + Better Auth docs)

---

### 3. Playwright 1.62.1 for E2E Testing

**Status:** NEW DEPENDENCY

| Package | Version | Install Command |
|---------|---------|-----------------|
| `@playwright/test` | 1.62.1 | `npm install -D @playwright/test` |

**Why This Version:**
- July 2026 stable release, recommended by Next.js 16 official guide
- AI snapshots (accessibility tree assertions instead of brittle CSS locators)
- Better Server Actions handling than earlier versions
- Official MCP integration (see Section 4)
- Playwright is the 2026 consensus for Next.js e2e testing (Cypress Electron reached EOL)

**Do NOT use Playwright 2.0-alpha** — breaking API changes, wait for stable.

**Setup for Next.js 16 App Router:**

1. **Install browsers:**
   ```bash
   npm install -D @playwright/test
   npx playwright install
   ```

2. **Create `playwright.config.ts` at project root:**
   ```typescript
   import { defineConfig, devices } from '@playwright/test'
   
   export default defineConfig({
     testDir: './e2e',
     webServer: {
       command: 'npm run dev',
       url: 'http://localhost:3000',
       reuseExistingServer: !process.env.CI,
     },
     use: {
       baseURL: 'http://localhost:3000',
       screenshot: 'only-on-failure',
       trace: 'on-first-retry',
     },
     projects: [
       { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
       { name: 'safari', use: { ...devices['Desktop Safari'] } },
       { name: 'webkit', use: { ...devices['iPhone 14'] } },
     ],
   })
   ```

3. **Create test file `e2e/golden-path.spec.ts`:**
   ```typescript
   import { test, expect } from '@playwright/test'
   
   test.describe('Golden Path — Full User Journey', () => {
     test('login → enter salary → forecast next payment', async ({ page }) => {
       // 1. Navigate to login
       await page.goto('/auth/login')
       
       // 2. Fill login form (Server Action)
       await page.fill('input[name="email"]', 'test@example.com')
       await page.fill('input[name="password"]', 'testpass123')
       await page.click('button:has-text("Log In")')
       
       // 3. Wait for navigation + Better Auth session cookie
       await page.waitForURL('/dashboard')
       
       // 4. Verify session cookie present
       const cookies = await page.context().cookies()
       expect(cookies.some(c => c.name === 'better_auth_session')).toBe(true)
       
       // 5. Enter salary (Server Action)
       await page.goto('/salary')
       await page.fill('input[name="gross_salary"]', '100000')
       await page.click('button:has-text("Save")')
       
       // 6. Verify next payment forecast displays
       await page.waitForSelector('text=₽')
       const nextPayment = await page.locator('[data-testid="next-payment-amount"]').textContent()
       expect(nextPayment).toMatch(/\d+/)
     })
   })
   ```

**Key Integration Points:**
- Tests run against full Next.js 16 app (with Server Actions, Neon DB, Better Auth)
- Playwright can read/set cookies for auth testing
- Runs on CI and locally

**Separation from Vitest (existing):**
- **Vitest:** Pure function tests (НДФЛ calculation, отпускные math) — fast, isolated
- **Playwright:** Integration/e2e tests (user flows, form submission, navigation) — full app context

**Add to package.json scripts:**
```json
{
  "scripts": {
    "test": "vitest run",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

**Confidence:** HIGH (official Next.js 16 guide, multiple 2026 boilerplates use Playwright 1.62, consensus on Server Actions testing)

---

### 4. Playwright MCP 1.62.1 (Optional AI-Assisted Test Writing)

**Status:** OPTIONAL DEV-TIME TOOL

| Package | Version | Install Command |
|---------|---------|-----------------|
| `@playwright/mcp` | 1.62.1 | `npm install -D @playwright/mcp` |

**What It Does:**
- Exposes Playwright browser automation as MCP (Model Context Protocol) tools
- Allows AI agents (Claude Code, GitHub Copilot) to drive a real browser, inspect accessibility tree, generate tests
- Uses accessibility snapshots (roles/labels) instead of screenshots — faster, more reliable for AI

**When to Use:**
- During test writing: Start dev server + Playwright MCP, use Claude/Copilot to prompt "write a test for the bonus form"
- AI agent connects to real browser, examines page structure, generates test code based on actual layout (not guesses)
- Optional; not required if team prefers manual test writing

**GitHub Copilot Auto-Integration:**
- Playwright MCP v1.62 is auto-configured in GitHub Copilot's Coding Agent as of Sept 2026
- No setup needed in Copilot; just mention "test the login flow" and Copilot can spin up a browser

**Workflow Example:**
1. `npm run dev` (Next.js app running)
2. `npx playwright mcp` (starts MCP server, listens for connections)
3. In Claude Code: "Write a Playwright test for the salary entry form on /salary"
4. Claude connects to MCP server → navigates to `/salary` in real browser → takes accessibility snapshot → generates test code
5. You review generated test, commit it

**Confidence:** MEDIUM-HIGH (official v1.62 release, integrated into Copilot, but CI/CD integration patterns still emerging — test thoroughly before adding to CI)

---

### 5. GitHub Actions CI Workflow

**Status:** NEW WORKFLOW FILE (`.github/workflows/ci.yml`)

**Purpose:** Gate merges/deployments on code quality checks (ESLint, TypeScript, Vitest)

**Required Steps:**

| Step | Command | Purpose |
|------|---------|---------|
| Checkout | `actions/checkout@v4` | Pull code from Git |
| Setup Node | `actions/setup-node@v4` with Node 20.x | Next.js 16 requires Node 20+ |
| Install deps | `npm ci` (not `npm install`) | Idempotent, uses lock file, caches dependencies |
| Type check | `npx tsc --noEmit` | Catch TS errors without full build |
| Lint | `npm run lint` (existing ESLint config) | Code quality, type-aware linting (requires TypeScript 6.0.x parser) |
| Unit tests | `npm run test` (Vitest) | НДФЛ + отпускные calculation tests |
| Build | `npm run build` | Verify production bundle builds |

**Sample Workflow File (`.github/workflows/ci.yml`):**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'
      
      - run: npm ci
      
      - name: Type check
        run: npx tsc --noEmit
      
      - name: Lint
        run: npm run lint
      
      - name: Unit tests
        run: npm run test
      
      - name: Build
        run: npm run build
```

**Protect Main Branch:**
- In GitHub: Settings → Branches → Branch Protection Rules
- Require `ci/github-actions` status check to pass before merge
- Require PR review (existing team practice)

**Vercel Integration:**
- Vercel automatically reads CI status
- Can configure to deploy only after CI passes
- Or set "Ignore Build Step" to a check that fails if CI hasn't passed

**Optional: Database Test Step (if adding integration tests later):**
```yaml
      - name: Create Neon preview branch
        if: github.event_name == 'pull_request'
        run: |
          neon branch create --parent main --name pr-${{ github.event.pull_request.number }}
```

**Confidence:** HIGH (standard Node.js CI pattern, documented in multiple 2026 Next.js boilerplates, no exotic dependencies)

---

### 6. Component Library: shadcn/ui 4.x + Tailwind CSS 4.x

**Status:** NEW DEPENDENCY (for UI redesign)

| Package | Version | Purpose |
|---------|---------|---------|
| `shadcn/ui` | 4.x | Copy-paste React components (Button, Input, Select, Card, etc.) with Tailwind styling |
| `@radix-ui/*` | Latest (peer dependency of shadcn) | Unstyled, accessible primitives (Dialog, Select, Popover, etc.) |
| `tailwindcss` | 4.x | Utility CSS framework with native CSS variables support |
| `class-variance-authority` | 0.7.x | (Optional) Helper for component variant composition |

**Why This Stack for v1.1 Redesign:**
- **Ownership:** shadcn components are source code you copy into your project — you own them, can modify without library version lock
- **TypeScript:** Full TS types, integrates cleanly with Next.js 16 App Router
- **Accessibility:** Radix UI primitives provide ARIA + keyboard navigation; shadcn adds Tailwind styling
- **Theming:** Tailwind 4.x supports native CSS variables for dark mode, color schemes
- **Zero Runtime Overhead:** Components are just React code, no extra runtime dependencies beyond Radix + Tailwind
- **iOS PWA Compatible:** Tailwind can use `env(safe-area-inset-*)` for safe-area integration (see Section 1)

**Setup:**

1. **Install Tailwind 4:**
   ```bash
   npm install -D tailwindcss@^4 postcss autoprefixer
   npm install clsx class-variance-authority
   ```

2. **Initialize shadcn/ui CLI:**
   ```bash
   npx shadcn-ui@latest init
   ```
   CLI prompts:
   - Styling: Tailwind CSS ✓
   - Base color: slate (or your choice)
   - CSS variables: Yes ✓
   - Component directory: `./src/components/ui`

3. **Add components as needed:**
   ```bash
   npx shadcn-ui@latest add button input form card select
   ```
   Components are copied to `src/components/ui/` — you own the code.

**Integration with v1.0 Stack:**

- **Recharts (existing):** shadcn/ui doesn't replace it. Recharts stays for the pie chart.
- **Better Auth forms:** Wrap `<input>` in shadcn `<Input>`, hook React Hook Form into shadcn `<Form>` component.
- **Serwist PWA:** No conflict. Just ensure root layout respects safe-area CSS.
- **Next.js 16 App Router:** shadcn/ui works natively with Server Components and Server Actions.

**Example: Salary Input Form with shadcn/ui + React Hook Form:**

```tsx
// app/salary/page.tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Form, FormControl, FormLabel, FormMessage, FormField } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const schema = z.object({
  gross_salary: z.number().positive(),
})

export default function SalaryPage() {
  const form = useForm({
    resolver: zodResolver(schema),
  })
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="gross_salary"
          render={({ field }) => (
            <div>
              <FormLabel>Gross Salary (₽)</FormLabel>
              <FormControl>
                <Input type="number" {...field} />
              </FormControl>
              <FormMessage />
            </div>
          )}
        />
        <Button type="submit">Save</Button>
      </form>
    </Form>
  )
}
```

**When NOT to Use shadcn/ui:**
- If team has existing design system that's not Tailwind-based
- If you prefer CSS-in-JS (emotion, styled-components) — shadcn is Tailwind-first, not compatible
- If you need highly specialized/custom components — build them separately

**Theming (Recommended for Redesign):**

Tailwind 4.x + shadcn support CSS variables theming:

```css
/* app/globals.css */
:root {
  --background: 0 0% 100%;
  --foreground: 0 0% 3.6%;
  --primary: 200 90% 56%;
  --primary-foreground: 0 0% 100%;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: 0 0% 3.6%;
    --foreground: 0 0% 98%;
    --primary: 200 90% 56%;
  }
}
```

Then shadcn components automatically respect the theme.

**Confidence:** HIGH (shadcn/ui is 2026 consensus for Next.js redesigns, overtook MUI, Tailwind 4.x stable with CSS variables, multiple 2026 dev surveys confirm this stack)

---

## Installation Summary

### Complete Command Sequence for v1.1 Additions

```bash
# Playwright e2e testing
npm install -D @playwright/test
npx playwright install

# Playwright MCP (optional, for AI-assisted test writing)
npm install -D @playwright/mcp

# Tailwind 4 + shadcn/ui (for redesign)
npm install -D tailwindcss@^4 postcss autoprefixer
npm install clsx class-variance-authority
npx shadcn-ui@latest init

# GitHub Actions CI (no install needed, just create .github/workflows/ci.yml)
```

### GitHub Actions Workflow File

Create `.github/workflows/ci.yml` at project root (see Section 5 above).

### Vercel Configuration

Update Vercel dashboard:
1. Project Settings → Environment Variables
2. Add/update `BETTER_AUTH_URL` for Production/Preview scopes (see Section 2)

---

## Version Compatibility with v1.0

| v1.0 Package | v1.0 Version | v1.1 Impact | Change Required? |
|--------------|--------------|-------------|------------------|
| Next.js | 16.3.3 | Works natively with Playwright, Tailwind 4, shadcn/ui | NO — keep locked |
| React | 19.2.8 | Compatible with shadcn/ui, React Hook Form | NO |
| TypeScript | 6.0.3 | REQUIRED for Playwright + ESLint CI; do NOT upgrade to 7.x | NO — keep locked |
| Drizzle ORM | 0.45.2 | No changes needed | NO |
| Better Auth | 1.7.2 | Redesign may wrap auth form in shadcn UI; logic unchanged | NO — keep locked |
| Serwist | 9.5.12 | Safe-area CSS pairs cleanly with existing manifest config | NO |
| Recharts | 3.10.1 | Unchanged (shadcn doesn't replace data viz) | NO |

**No Breaking Changes:** All v1.1 additions are backwards-compatible.

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| **iOS Safe-Area CSS** | HIGH | CSS standard (W3C Jan 2026), all browsers support, iOS native feature, documented in MDN + multiple 2026 PWA guides |
| **Vercel Multi-Environment URLs** | HIGH | VERCEL_URL is first-class system variable (official Vercel docs), Better Auth docs cover deployment patterns, cross-checked across 2026 guides |
| **Playwright 1.62.1** | HIGH | July 2026 stable, recommended in Next.js 16 official guide, consensus choice for e2e testing (Cypress EOL), multiple 2026 boilerplates use this version |
| **Playwright MCP** | MEDIUM-HIGH | Official v1.62 release, auto-integrated into GitHub Copilot (2026), but MCP patterns still emerging—test in CI before production use |
| **GitHub Actions CI** | HIGH | Standard Node.js pattern, documented in ixartz/Next-js-Boilerplate and multiple 2026 CI/CD guides, no exotic dependencies |
| **shadcn/ui 4.x + Tailwind 4.x** | HIGH | 2026 consensus picks for Next.js redesigns (overtook MUI), Tailwind 4.x stable with native CSS variables, excellent Next.js 16 support |

---

## Phase-Specific Research Flags

1. **Phase 1 (Safe-Area CSS):** Test on real iOS device (iPhone 14+) to verify `env(safe-area-inset-*)` values under dynamic island conditions. Check both `next/link` and raw `<a>` navigation.

2. **Phase 2 (UI Redesign + shadcn/ui):** Consider building `design-tokens.json` from Tailwind config for design system consistency. Test dark mode switching with CSS variables.

3. **Phase 3 (Playwright e2e):** Verify Playwright MCP works reliably in headless GitHub Actions runners before adding to CI. Local dev usage is confirmed; CI use needs validation.

4. **Phase 4 (GitHub Actions + Vercel):** Confirm Neon preview branch auto-creation works with CI webhook (existing in v1.0, but test for v1.1 scope).

5. **Ongoing:** Re-check Playwright 2.0 status at each phase boundary. If 2.0 stable ships, plan an upgrade path (unlikely before Q4 2026).

---

## Sources

- **iOS Safe-Area CSS:**
  - [MDN: env() CSS function](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env)
  - [GitHub: next/link + safe-area issue #81264](https://github.com/vercel/next.js/discussions/81264)
  - [ITNEXT: Make Your PWAs Look Handsome on iOS](https://itnext.io/make-your-pwas-look-handsome-on-ios-fd8fdfcd5777)
  - [W3C CSS WG: Safe to Release for env(safe-area-inset-*)](https://lists.w3.org/Archives/Public/public-css-archive/2026Jan/0316.html)
  - **Confidence: HIGH**

- **Vercel Environment Variables:**
  - [Vercel Docs: Environment Variables](https://vercel.com/docs/environment-variables)
  - [Vercel Docs: System Environment Variables](https://vercel.com/docs/environment-variables/system-environment-variables)
  - [Vercel Docs: Environments](https://vercel.com/docs/deployments/environments)
  - [Better Auth: Options Reference](https://better-auth.com/docs/reference/options)
  - **Confidence: HIGH**

- **Playwright 1.62.1 E2E Testing:**
  - [Next.js: Testing with Playwright](https://nextjs.org/docs/app/guides/testing/playwright)
  - [Medium: Next.js Testing 2026 — Vitest & Playwright](https://medium.com/@securestartkit/next-js-testing-in-2026-vitest-playwright-0caf6dd1f829)
  - [Autonoma AI: Next.js Playwright Testing Guide](https://getautonoma.com/blog/nextjs-playwright-testing-guide)
  - [Safedep.io: E2E Testing with Next.js + Playwright + MSW](https://safedep.io/end-to-end-test-nextjs-msw-playwright/)
  - **Confidence: HIGH**

- **Playwright MCP:**
  - [MCP Directory: Playwright MCP Guide 2026](https://mcp.directory/blog/playwright-browser-mcp-guide-2026)
  - [TestQuality: Playwright MCP Architecture 2026](https://testquality.com/playwright-test-agents-mcp-architecture-2026/)
  - [Bug0: Playwright MCP for AI Testing](https://bug0.com/blog/playwright-mcp-changes-ai-testing-2026)
  - **Confidence: MEDIUM-HIGH**

- **GitHub Actions CI:**
  - [GitHub: ixartz/Next-js-Boilerplate](https://github.com/ixartz/Next-js-Boilerplate)
  - [Easton Dev: Next.js CI/CD with GitHub Actions](https://eastondev.com/blog/en/posts/dev/20251220-nextjs-cicd-github-actions/)
  - [Tech Insider: GitHub Actions Tutorial 2026](https://tech-insider.org/github-actions-tutorial-cicd-12-steps-2026/)
  - **Confidence: HIGH**

- **shadcn/ui 4.x + Tailwind CSS 4.x:**
  - [shadcn/ui: Installation for Next.js](https://ui.shadcn.com/docs/installation/next)
  - [shadcn/ui: Component Library](https://ui.shadcn.com/)
  - [DEV: Best Tailwind CSS UI Libraries 2026](https://dev.to/stacknotice/best-tailwind-css-ui-libraries-in-2026-beyond-shadcnui-f98)
  - [WrappixeL: Top shadcn/ui Resources 2026](https://wrappixel.com/blog/shadcn-ui-libraries)
  - **Confidence: HIGH**

---

**Next Steps:** Review this research with the team. Prioritize based on roadmap sequencing:
1. Vercel URL fix + GitHub Actions CI (unblocks all deployments)
2. iOS safe-area CSS (UX/visual quality)
3. Playwright e2e (quality assurance)
4. shadcn/ui redesign (visual polish)
5. Playwright MCP (optional enhancement to test writing)

---

*v1.1 Stack Research — НаРуки Milestone*  
*Researched: 2026-09-01*
