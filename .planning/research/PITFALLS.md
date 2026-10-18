# Domain Pitfalls: Adding UI Redesign, PWA Safe-Area, Security Hardening, Playwright E2E, and Staging/Prod Pipeline

**Project:** НаРуки (Next.js 16 App Router PWA)
**Researched:** 2026-09-01
**Scope:** Pitfalls specific to retrofitting these features into an existing shipped v1.0 system
**Context:** v1.1 milestone focuses on production-quality polish, NOT new calculation features

---

## Critical Pitfalls

Critical pitfalls cause system-wide breakage, data loss, or production outages. Must be prevented, not fixed post-hoc.

### Pitfall 1: Double Deployment (GitHub Actions + Vercel Auto-Deploy Race Condition)

**What goes wrong:** GitHub Actions and Vercel's built-in git integration both trigger builds simultaneously. Vercel auto-deploys on every push to `main`, while your GitHub Actions workflow also runs `vercel deploy`. Result: two builds race, two preview/staging artifacts are created, both fail to coordinate session state or database schema versions, and tests may run against the wrong deployment target. Production promotion gates become impossible to enforce.

**Why it happens:** Vercel's default behavior is to auto-deploy any push to linked branches. GitHub Actions workflows naively call `vercel deploy` without checking if Vercel already triggered. No explicit coordination means both systems act independently.

**Consequences:**
- Flaky test runs due to test hitting old deployment while new one rolls out
- Unreliable gating: tests pass, but production promotion deploys an untested version
- Double CI/CD minutes wasted on redundant builds
- Database migrations run twice, causing conflicts or rollback confusion
- Preview/staging URL becomes ambiguous — which deploy am I hitting?

**Prevention:**
- **Option A (Recommended):** Disable Vercel auto-deploy entirely. Add to `vercel.json`: `{"git": {"deploymentEnabled": false}}`. Let GitHub Actions own all deployments via `vercel deploy` and `vercel promote-production`.
- **Option B:** Keep Vercel auto-deploy for previews only; use `ignoreCommand` in `vercel.json` to skip main/prod builds. GitHub Actions handles production promotion via Deployment Checks.
- **Explicit coordination:** If using both, document which system owns which environment (Vercel → preview, Actions → staging/prod).
- **Test against live URL:** Tests must run against the actual deployed Vercel URL, not localhost, to catch deployment-time issues.

**Detection:**
- Check Vercel project settings: is Git Integration enabled?
- Review workflow logs: how many deployments per push?
- Look for duplicate preview/staging URLs in Vercel dashboard during test runs.

**Phase:** Should be addressed in **Staging/Prod Pipeline phase** — before enabling production promotion gates.

---

### Pitfall 2: `BETTER_AUTH_URL` Misconfiguration Across Environments (Preview/Staging/Prod)

**What goes wrong:** Better Auth's `baseURL` is hardcoded to production domain or is missing entirely. When PR preview or staging deployment spins up, the auth client still redirects to the hardcoded domain, or `BETTER_AUTH_URL` isn't set for the environment. Login flow completes on prod database with session that doesn't match the preview/staging URL, so the preview looks "logged out" even though server has a valid session. Or, `BETTER_AUTH_ALLOWED_HOSTS` doesn't include the preview/staging domains, and auth endpoints reject them.

**Why it happens:**
- `.env.local` has `BETTER_AUTH_URL=https://naruiki.production.com`, which works locally but is hardcoded for production.
- Vercel environment variables aren't configured per-deployment (main, staging branches).
- `baseURL` is a string, not a dynamic/object configuration, so it can't adapt to request URL.
- Team doesn't realize Better Auth validates `Host` header against `allowedHosts` — assumed it auto-detects like other frameworks.

**Consequences:**
- Auth callbacks redirect to wrong domain (user logs into prod instead of preview).
- Session cookie is set for `production.com` but browser is on `preview.vercel.app` — cookie never sent with requests.
- Preview/staging feels completely broken ("you're not logged in"), blocking testing.
- Staging promotion to prod works fine, so bug goes unnoticed until users on staging test against live.

**Prevention:**
- Use Better Auth's **dynamic `baseURL` configuration** with `allowedHosts` object:
  ```typescript
  baseURL: {
    allowedHosts: [
      "localhost:3000",
      "*.vercel.app",  // Wildcard for all preview/staging deployments
      "naruiki.production.com"
    ],
    fallback: "https://naruiki.production.com"  // Only used if no match
  }
  ```
- Set `BETTER_AUTH_ALLOWED_HOSTS` as environment variable for each deployment tier (main/staging branches get different env vars on Vercel).
- Test preview deployments explicitly: log in on PR preview, verify session cookie domain matches preview URL.
- Document: "If auth doesn't work on preview/staging, check Vercel Environment Variables — is `BETTER_AUTH_URL` or `BETTER_AUTH_ALLOWED_HOSTS` set for this branch?"

**Detection:**
- Playwright test fails to log in on preview but passes on prod.
- Browser DevTools → Application → Cookies shows no auth cookie on preview URL, but shows one on prod.
- Vercel logs show auth endpoint returning 403 "Untrusted origin".

**Phase:** Must be fixed in **Security Hardening phase**, before staging environment is live, or it will block all staging UAT.

---

### Pitfall 3: Better Auth Password Leak Scenarios (Misconfigured Auth Flow Exposes URL or Network Tab)

**What goes wrong:** During login/registration, password or sensitive token appears in:
- Browser URL bar (visible to anyone looking over shoulder, screenshot in chat)
- DevTools Network tab (visible to users with F12 open, cached in session files)
- Server logs (if `signIn` request is logged with query params instead of POST body)
- Browser password manager autofill dropdown (if form is misconfigured as GET)

**Why it happens (specific to Better Auth + Next.js):**
1. **Form accidentally becomes GET:** HTML form falls back to GET if JS doesn't load, or error handler doesn't prevent submission.
2. **Next.js RSC prefetch query params:** App Router may append CSRF tokens or state params to URLs during soft navigation.
3. **Browser password manager:** Autofill dropdown captures form action URL and leaks it if URL has sensitive params.
4. **Better Auth `sendOTP` flow leaks code:** If email/SMS contains a direct link with the OTP in query string, and user bookmarks it or shares via chat, the code is exposed.

**Consequences:**
- User's password visible in browser history, system clipboard from copy-paste, screenshots, screen recordings.
- Attacker with access to one user's browser history has plaintext passwords for all devices that user logged into.
- Reset tokens (if leaked in email links) are valid for hours (default 3600s per Better Auth), giving attacker full account takeover.

**Prevention:**
- **Always use POST for auth forms**, never GET:
  ```html
  <form method="POST" action="/api/auth/signin">
    <!-- Never GET -->
  </form>
  ```
- **No query params in auth flows:** State tokens go in POST body or hidden form fields, not URL.
- **Server Actions for auth:** Better Auth is already compatible; use `authClient.signIn.email()` which POSTs. Verify in DevTools Network tab: POST request, credentials in body, not params.
- **Disable browser password manager on auth forms** if you can't control the form action (risky, not recommended—better to fix the form).
- **For reset/OTP tokens:** 
  - Store tokens server-side (hashed), send short-lived code (5 min expiry) in email, not the full token.
  - Set `resetPasswordTokenExpiresIn: 300` (5 min) instead of default 3600s.
- **Log only non-sensitive auth data:** Never log request body in auth endpoints; log email and success status only.
- **Test with Network tab open:** During dev, open DevTools, submit login form, verify only POST request with no plaintext password in URL or visible in response headers.

**Detection (for existing system):**
- Search repo for `method="get"` on auth forms.
- Check `authClient.signIn.email()` call — if it's being awaited without `.then()`, it's a fetch, which Better Auth handles as POST (good).
- Look at Vercel production logs for auth endpoints — grep for `password` in log output.
- Manual check: Log in on staging with DevTools open, inspect Network tab for the login POST request.

**Phase:** Part of **Security Hardening phase**. Must be validated before shipping to production.

---

### Pitfall 4: Safe-Area-Inset CSS Retrofit Breaks Layout or Hides Content on iOS

**What goes wrong:** You add `env(safe-area-inset-top)` padding to the header to avoid the dynamic island, but the padding appears on all browsers (adding unnecessary height on Android/desktop), or it doesn't apply at all on iOS because viewport-fit wasn't set, or it applies but other components shift unexpectedly, pushing content off-screen. The app looks broken on iPhone but fine everywhere else.

**Why it happens:**
- `viewport-fit=cover` isn't in the `<meta name="viewport">` tag, so iOS ignores safe-area insets entirely.
- Safe-area padding is applied globally to `html` or `body`, pushing the whole layout down, cascading into unintended layout shifts.
- You forgot to add `apple-mobile-web-app-capable: yes` meta tag, so iOS doesn't enable standalone mode and safe-area doesn't apply.
- Tailwind classes use `pl-safe` / `pb-safe` but the custom plugin isn't registered in `tailwind.config.ts`, so classes are silently ignored.
- Touch handlers conflict: `touch-action: manipulation` on `html` breaks iOS input focus, while safe-area is supposed to work alongside it.

**Consequences:**
- Dynamic island on iPhone 15/Pro overlaps with header text, rendering app unreadable.
- Or: Safe-area padding applies, but layout shifts and content drops below the fold.
- Android users see extra padding that doesn't exist in design mockups.
- Desktop users see unnecessary spacing reserved for mobile notches.
- Existing Vitest render tests pass (they run in jsdom without viewport), but real iPhone breaks immediately.

**Prevention:**
- **Viewport meta tag setup (required first):**
  ```html
  <meta name="viewport" 
    content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  ```
- **Use a Tailwind plugin for safe-area classes:**
  ```typescript
  // tailwind.config.ts
  module.exports = {
    plugins: [
      require('tailwindcss-safe-area')
      // or define custom plugin:
      // ({ addUtilities }) => {
      //   addUtilities({
      //     '.pt-safe': { paddingTop: 'env(safe-area-inset-top)' },
      //     '.pb-safe': { paddingBottom: 'env(safe-area-inset-bottom)' },
      //   })
      // }
    ]
  }
  ```
- **Apply safe-area padding only to iOS-specific components:**
  ```tsx
  export function Header() {
    return (
      <header className="pt-safe">
        {/* Dynamic island space is now reserved */}
      </header>
    )
  }
  ```
  Not to the whole layout.
- **Test on real iPhone or Safari Device Emulation (Responsive Design Mode won't show safe-area correctly):** 
  - Use Xcode simulator with Safari remote debugging, or 
  - Use real device with `vercel preview` URL.
- **Screenshot on iOS before/after to verify visually in tests:**
  - Add Playwright visual regression test with `toMatchScreenshot()` on iPhone 15 Pro viewport.
- **Never apply `touch-action: manipulation` globally** on iOS — it conflicts with input focus. Keep it on specific interactive elements only.

**Detection:**
- Run app in iPhone 15 Pro simulator (notch + dynamic island).
- Open DevTools in Safari remote inspector, check computed styles for `.pt-safe` — should show `padding-top: env(safe-area-inset-top)`.
- Screenshot: header text should clear the dynamic island by at least 8-12px.

**Phase:** Part of **PWA Safe-Area Fix phase**. Test thoroughly on real device before marking done.

---

### Pitfall 5: Playwright E2E Tests Flake Due to Auth State or Database State Pollution

**What goes wrong:** Playwright tests pass individually but fail in CI when run in parallel, or they fail intermittently because:
- Auth state from previous test isn't cleaned up, next test logs in as wrong user.
- Neon database branch isn't created before tests start, so all test workers hit the same database and race for the same rows.
- Form submission in one test succeeds, but response isn't awaited, next test sees stale data.
- Vercel preview deployment is mid-rollout when test starts, test times out waiting for deployment to be ready.

**Why it happens:**
- No `globalSetup.ts` to create isolated database branch per test run.
- `authStorage` (from Playwright cookie state) isn't isolated per test file or worker.
- Multiple Playwright workers (`fullyParallel: true` in config) all query the same Neon `main` branch simultaneously.
- Test doesn't wait for `page.waitForLoadState('networkidle')` after form submission, assumes response is instant.
- `PLAYWRIGHT_API_URL` points to `localhost:3000` instead of the actual Vercel preview deployment URL.

**Consequences:**
- Same tests pass/fail randomly in CI, breaking CI reliability.
- Test suite takes 10x longer because all tests wait for DB locks.
- Feature branch can't be tested until main CI finishes and cleans up.
- Engineers give up on E2E tests ("they're flaky") and skip them.
- Bug reaches production because it only surfaces under parallel DB load.

**Prevention:**
- **Create isolated Neon database branches per test run:**
  ```typescript
  // playwright.config.ts
  import { defineConfig, devices } from '@playwright/test'

  export default defineConfig({
    globalSetup: require.resolve('./e2e/global-setup.ts'),
    globalTeardown: require.resolve('./e2e/global-teardown.ts'),
    webServer: {
      command: 'npm run dev',
      url: process.env.PLAYWRIGHT_API_URL || 'http://localhost:3000',
      reuseExistingServer: !process.env.CI
    }
  })
  ```

  ```typescript
  // e2e/global-setup.ts
  import { chromium } from '@playwright/test'
  import { neon } from '@neondatabase/serverless'

  async function globalSetup() {
    // Create a Neon branch for this test run
    const branchName = `test-${Date.now()}`
    const parentBranch = process.env.DATABASE_BRANCH || 'main'
    
    // Call Neon API to create branch
    const response = await fetch('https://api.neon.tech/v2/branches', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.NEON_API_KEY}` },
      body: JSON.stringify({
        project_id: process.env.NEON_PROJECT_ID,
        branch: { parent_id: parentBranch, name: branchName }
      })
    })
    const data = await response.json()
    process.env.DATABASE_BRANCH = data.branch.id
    process.env.DATABASE_URL = `postgresql://...@ep-${data.branch.id}.neon.tech/...`
  }

  export default globalSetup
  ```

- **Use Playwright's `storageState` for auth:**
  ```typescript
  // e2e/auth.setup.ts
  test('authenticate', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/')
    
    await page.context().storageState({ path: 'playwright/.auth/user.json' })
  })

  // playwright.config.ts
  projects: [
    { name: 'auth', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/user.json' },
      dependencies: ['auth']
    }
  ]
  ```

- **Target the actual Vercel preview deployment:**
  ```bash
  # In GitHub Actions
  - name: Run Playwright tests
    env:
      PLAYWRIGHT_API_URL: ${{ steps.deploy.outputs.preview_url }}
    run: npx playwright test
  ```

- **Always await network idle:**
  ```typescript
  // Don't do this:
  await page.click('button[type="submit"]')
  await page.goto('/salary') // Might race with redirect

  // Do this:
  await page.click('button[type="submit"]')
  await page.waitForURL('**/salary') // Wait for redirect
  ```

**Detection:**
- Run tests locally: `npm run test:e2e` (should pass).
- Run tests in CI with parallelism: Check GitHub Actions logs for random failures.
- Look for timeout errors related to database locks (Neon logs will show conflict).

**Phase:** Part of **Playwright E2E Testing phase**. Must be working reliably before marking phase complete.

---

### Pitfall 6: Visual Regression Due to UI Redesign (Existing Vitest Render Tests Break or Pass Silently)

**What goes wrong:** You redesign the UI components (new fonts, colors, spacing). Vitest render tests using jsdom/`@testing-library` don't catch visual changes because jsdom doesn't render pixels — it only validates DOM structure. Tests still pass, but the app looks completely different on the real browser. Alternatively, snapshots of old render trees are regenerated with the new classNames, making the tests useless as a regression detector.

**Why it happens:**
- Vitest tests are structure-only: `expect(screen.getByRole('button')).toBeInTheDocument()` doesn't care about color, font, or spacing.
- Snapshot tests (if used) capture HTML/className strings, not visual output. Redesign changes classNames, snapshots are regenerated, and the old snapshot is lost.
- No visual regression testing framework set up (e.g., Percy, Chromatic, Playwright `toMatchScreenshot()`).
- Team assumes "if tests pass, UI didn't break," but structure and visuals are independent.

**Consequences:**
- QA catches the broken UI on staging, but it's too late to fix gracefully.
- Component redesign accidentally breaks dark mode or accessibility (font contrast).
- Icon redesign breaks mobile layout (new SVGs have different aspect ratios).
- App ships with a button that looks totally different from the design mockup.

**Prevention:**
- **Set up visual regression testing with Playwright:**
  ```typescript
  // e2e/visual.spec.ts
  test('Header renders correctly', async ({ page, browserName }) => {
    test.skip(browserName === 'firefox', 'Visual test run only on Chromium')
    
    await page.goto('/')
    await expect(page.locator('header')).toMatchSnapshot('header.png')
  })
  ```

  Run with: `npm run test:e2e -- --update-snapshots` after confirming design is intentional.

- **Keep render tests for structure, add visual tests for appearance:**
  ```typescript
  // Render test: structure
  it('renders salary input and submit button', () => {
    render(<SalaryForm />)
    expect(screen.getByLabelText(/gross salary/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
  })

  // Visual test: appearance (Playwright)
  test('salary form looks correct', async ({ page }) => {
    await page.goto('/settings/salary')
    await expect(page.locator('form')).toMatchSnapshot('salary-form.png')
  })
  ```

- **Don't auto-regenerate snapshots in CI.** Make snapshot updates a manual, reviewed step:
  ```bash
  npm run test:e2e -- --update-snapshots  # Local only, commit reviewed
  ```

- **Screenshot key user flows during redesign:**
  - Login screen
  - Salary entry form
  - Dashboard with next payment
  - Pie chart
  - PWA standalone mode on iPhone
  
  Commit these as golden screenshots, then CI compares new screenshots to golden.

**Detection:**
- Before redesign: `npm run test:e2e` passes with current screenshots baseline.
- After redesign: `npm run test:e2e` fails on visual assertions.
- Manually verify the design matches mockups.
- Update snapshots: `npm run test:e2e -- --update-snapshots`.
- Commit updated screenshots as part of the redesign PR.

**Phase:** Part of **UI Redesign phase**. Establish visual regression testing baseline before major redesign, then use it to catch unintended side effects.

---

## Moderate Pitfalls

Moderate pitfalls cause partial breakage, data loss, or significant manual recovery. Should be prevented; if they happen, fix quickly.

### Pitfall 7: PWA Manifest Icons Become Inaccessible After Redesign

**What goes wrong:** During UI redesign, you move assets from `/public/icons/` to `/public/assets/icons/` and update the manifest. But old installed PWAs still reference the old path, so their home screen icons break (show blank). New installs use the new path correctly. App looks unbranded and unprofessional on existing user devices.

**Why it happens:**
- SVG icon asset paths changed during redesign/refactor.
- `manifest.json` was updated, but old PWA installations cached it.
- iOS PWAs cache the manifest aggressively and don't auto-update.
- Team didn't test by actually reinstalling the PWA and checking home screen.

**Consequences:**
- Users who installed v1.0 see broken icon on home screen after v1.1 ships.
- Support requests: "Why is my app icon blank?"
- App looks unprofessional compared to native apps with stable icons.

**Prevention:**
- **Never change icon paths without versioning the manifest:**
  ```json
  {
    "name": "НаРуки",
    "icons": [
      {
        "src": "/icon-192.png",
        "sizes": "192x192",
        "type": "image/png",
        "purpose": "any"
      },
      {
        "src": "/icon-512.png",
        "sizes": "512x512",
        "type": "image/png",
        "purpose": "any maskable"
      }
    ]
  }
  ```
  Keep icons in `/public/` at the root level, or use a versioned path like `/assets/v2/icon-192.png`.

- **Test PWA reinstall on real device:**
  1. Build production deployment: `npm run build`.
  2. Deploy to staging or Vercel preview.
  3. On iPhone, open Safari to the URL.
  4. "Add to Home Screen" → install.
  5. Go to Home Screen, launch app.
  6. Verify icon displays correctly (not blank).

- **Commit icon assets alongside manifest.json** so they're never accidentally moved without manifest update.

**Detection:**
- After redesign, manually test: Safari → "Add to Home Screen" → check home screen.
- Or: Check `/public/` directory structure matches icon paths in `manifest.json`.

**Phase:** Part of **UI Redesign phase**. Test PWA install before marking complete.

---

### Pitfall 8: Serwist `--webpack` Flag Forgotten, Build Breaks on CI (Turbopack Issue)

**What goes wrong:** During setup or after a team member forgets, the build command runs without `--webpack` flag. Serwist tries to inject the service worker into Turbopack, which it doesn't support yet. Build silently succeeds but produces no service worker, so PWA installation heuristics fail. App still works but isn't installable on iOS ("Add to Home Screen" option disappears).

**Why it happens:**
- Serwist's `@serwist/next` plugin doesn't support Turbopack (Next.js 16's default bundler).
- `next dev --webpack` and `next build --webpack` flags are needed, but they're buried in `package.json` scripts.
- New team member runs `next build` without the flag and assumes it's fine.
- CI script doesn't include the flag, so production build is broken.

**Consequences:**
- PWA installability broken in production.
- No obvious error — build succeeds, app runs, but service worker is missing.
- Users can't install to home screen.
- Staging/prod split causes confusion: staging works (flag present), prod doesn't (flag forgotten).

**Prevention:**
- **Always use the flag in package.json scripts:**
  ```json
  {
    "scripts": {
      "dev": "next dev --webpack",
      "build": "next build --webpack",
      "start": "next start"
    }
  }
  ```
- **Document in README:**
  ```markdown
  ## Development

  Serwist PWA requires the --webpack flag due to Turbopack incompatibility.
  Always use `npm run dev` (not `next dev`) and `npm run build` (not `next build`).
  ```
- **Add a check in CI to fail if the flag is missing:**
  ```bash
  # ci.yaml
  - name: Verify Serwist webpack flag
    run: grep -q "next build --webpack" package.json || exit 1
  ```

**Detection:**
- After build: `ls -la .next/server/app-manifest.json` (service worker manifest) — should exist.
- Open DevTools → Application → Service Workers — should show one registered.
- If missing, check CI build logs for Serwist errors or warnings.

**Phase:** Part of **PWA Safe-Area Fix phase**. Verify during build setup.

---

### Pitfall 9: GitHub Actions Secrets Scoped to Wrong Environment, Staging Deploys with Prod Secrets

**What goes wrong:** You set up a GitHub Actions secret `DATABASE_URL` at the repository level (applies to all branches). When you deploy to staging from a feature branch, the workflow reads the repository-level `DATABASE_URL` (which is the production database URL) and deploys to prod database instead of staging. Staging tests corrupt production data.

**Why it happens:**
- Environment-specific secrets weren't configured in GitHub. Only repo-level secrets were used as a shortcut.
- The workflow doesn't check which branch it's on; it just reads `secrets.DATABASE_URL`.
- Vercel environment variables are per-environment, but GitHub Actions secrets aren't, so they must be configured separately.
- Team didn't realize the difference between repository secrets (global) and environment secrets (per-environment) in GitHub.

**Consequences:**
- Staging tests write test data to production Neon database.
- Production database gets polluted with test salary/bonus/user rows.
- Users see test data mixed with real data (confusion, support requests).
- Data cleanup is manual and error-prone.
- Trust in the system is lost.

**Prevention:**
- **Configure GitHub environment-specific secrets:**
  1. Go to repo → Settings → Environments.
  2. Create three environments: `preview`, `staging`, `production`.
  3. For each environment, set its own secrets (e.g., `STAGING_DATABASE_URL`, `PROD_DATABASE_URL`).

  ```yaml
  # .github/workflows/deploy.yml
  jobs:
    deploy:
      runs-on: ubuntu-latest
      environment: ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }}
      steps:
        - uses: actions/checkout@v4
        - name: Deploy
          env:
            DATABASE_URL: ${{ secrets.DATABASE_URL }}
            VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          run: vercel deploy --token ${{ secrets.VERCEL_TOKEN }}
  ```

- **Explicitly map branch → environment:**
  ```yaml
  jobs:
    deploy:
      strategy:
        matrix:
          include:
            - branch: main
              environment: production
            - branch: staging
              environment: staging
            - branch: dev
              environment: preview
      runs-on: ubuntu-latest
      if: github.ref == 'refs/heads/${{ matrix.branch }}'
      environment: ${{ matrix.environment }}
  ```

- **Test locally with a `.env.local` that points to a test Neon branch**, verify it works, then promote to staging.

**Detection:**
- Check repo Settings → Secrets & Variables → Actions: are there repository-level secrets, or only per-environment?
- In workflow file, search for `secrets.` references — verify they match the expected environment.
- Run a staging deploy, check Neon console for which database was hit.

**Phase:** Part of **Staging/Prod Deploy Pipeline phase**. Must be configured before any staging tests run against a real database.

---

### Pitfall 10: Playwright Tests Pass Locally but Fail in CI (Headless vs. Headed Browser Differences)

**What goes wrong:** Tests pass when run locally (`npm run test:e2e`) but fail in CI with timeout errors or assertion mismatches. The difference: local runs use headed browser mode (you see it), CI runs headless (invisible). Headless browsers render differently (fonts, timing, network throttling), so tests that rely on visual timing or DOM metrics fail in CI only.

**Why it happens:**
- Local config: `headless: false` or uses headed browser.
- CI config: `headless: true`, which changes rendering and network behavior.
- Tests assume instant form submission or DOM updates, but headless rendering is slower.
- Network throttling simulated in CI but not locally.

**Consequences:**
- Tests are unreliable: green locally, red in CI, blocking merges.
- Team disables CI tests or ignores failures, defeating the purpose of tests.
- Bugs slip through because tests aren't trusted.

**Prevention:**
- **Ensure CI config matches local config:**
  ```typescript
  // playwright.config.ts
  export default defineConfig({
    use: {
      headless: true,
      trace: 'on-first-retry' // Capture trace on failure for debugging
    },
    webServer: {
      command: 'npm run build && npm start',
      port: 3000,
      reuseExistingServer: process.env.CI === 'true' ? false : true
    }
  })
  ```

- **Use the same browser versions locally and in CI:**
  ```bash
  # Install same versions as CI
  npx playwright install
  ```

- **Add network throttling to local tests to match CI conditions:**
  ```typescript
  test('form submission works under slow network', async ({ page }) => {
    await page.route('**/*', (route) => {
      setTimeout(() => route.continue(), 1000)
    })
    await page.goto('/')
    // Now network is throttled locally, matching CI
  })
  ```

**Detection:**
- Run test locally: passes.
- Push to GitHub, CI fails: check CI logs for timeout or assertion mismatch.
- Compare local browser DevTools (opened during test) with CI video trace.

**Phase:** Part of **Playwright E2E Testing phase**. Establish CI parity before declaring tests reliable.

---

## Minor Pitfalls

Minor pitfalls cause inconvenience, wasted time, or rework. Should be prevented; if they happen, the cost is acceptable.

### Pitfall 11: Accessibility Broken by Safe-Area or Redesign (Focus Outline, Keyboard Navigation)

**What goes wrong:** During safe-area retrofit or redesign, you apply `outline: none` to remove the default focus ring (common in overzealous CSS resets). Keyboard users can't navigate the app anymore because focused elements are invisible. Or, you redesign buttons with custom styles and forget to add `:focus-visible` pseudo-class, so only mouse users can see what's focused.

**Prevention:**
- Always include a visible focus indicator for keyboard navigation:
  ```css
  button:focus-visible {
    outline: 2px solid #0066cc;
    outline-offset: 2px;
  }
  ```
- Don't remove default outlines without providing an alternative.
- Test keyboard navigation: Tab through the entire app using only the keyboard.

**Detection:**
- Use keyboard to navigate: Tab through form fields, should see focus outline on each.
- Run accessibility audit: Lighthouse → Accessibility → check for low contrast or missing focus indicators.

**Phase:** Part of **UI Redesign phase**. Test with keyboard before marking complete.

---

### Pitfall 12: Environment Variables Hardcoded Somewhere, Breaks in CI or Staging

**What goes wrong:** A developer hardcodes `DATABASE_URL` or `BETTER_AUTH_URL` in a `.ts` file (not `.env`), assuming it's for local dev only. Code gets committed, CI runs with that hardcoded value, and prod deploy uses the wrong URL. Or, an environment variable is referenced but not added to the `.env.example`, so the next developer doesn't know it's required.

**Prevention:**
- Use `@t3-oss/env-nextjs` to validate and type all environment variables at startup:
  ```typescript
  // env.ts
  import { createEnv } from "@t3-oss/env-nextjs"
  import { z } from "zod"

  export const env = createEnv({
    server: {
      DATABASE_URL: z.string().url(),
      BETTER_AUTH_URL: z.string().url(),
      NEON_API_KEY: z.string(),
    },
    runtimeEnv: {
      DATABASE_URL: process.env.DATABASE_URL,
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
      NEON_API_KEY: process.env.NEON_API_KEY,
    },
  })
  ```
- If any required variable is missing, the app fails to start with a clear error.
- Keep `.env.example` updated whenever you add a new variable.

**Detection:**
- On fresh clone: `cp .env.example .env.local` → run `npm run dev` → should fail with clear error if any var is missing.

**Phase:** Already established in v1.0. Maintain during v1.1.

---

### Pitfall 13: PR Preview Deployment is Stale (Old Code, Old Database Schema)

**What goes wrong:** You push a PR with database schema changes. Vercel creates a preview deployment, but it uses the old Neon branch (`main` instead of PR-specific branch), so migrations don't run. Frontend expects new schema, but database has old schema. Preview looks broken, but the code is fine.

**Why it happens:**
- Neon branching isn't hooked into Vercel preview deployments.
- Your CI doesn't create a Neon branch for PR preview; Vercel just points to `main`.

**Prevention:**
- Automate Neon branch creation in GitHub Actions:
  ```yaml
  # .github/workflows/preview.yml
  name: Create Preview DB Branch
  on:
    pull_request:
      types: [opened, synchronize]

  jobs:
    create-branch:
      runs-on: ubuntu-latest
      steps:
        - name: Create Neon branch
          run: |
            BRANCH_ID=$(curl -X POST https://api.neon.tech/v2/branches \
              -H "Authorization: Bearer ${{ secrets.NEON_API_KEY }}" \
              -H "Content-Type: application/json" \
              -d '{
                "project_id": "${{ secrets.NEON_PROJECT_ID }}",
                "branch": { "parent_id": "main", "name": "pr-${{ github.event.number }}" }
              }' | jq -r '.branch.id')
            echo "NEON_BRANCH_ID=$BRANCH_ID" >> $GITHUB_ENV

        - name: Update Vercel env var
          run: |
            vercel env add DATABASE_URL_PREVIEW_${{ github.event.number }} \
              "postgresql://...@${{ env.NEON_BRANCH_ID }}.neon.tech/..." \
              --token ${{ secrets.VERCEL_TOKEN }}
  ```

**Detection:**
- Open PR preview, run migration check: does `SELECT * FROM information_schema.tables` show new tables? If using old schema, migration didn't run.

**Phase:** Part of **Staging/Prod Deploy Pipeline phase**. Automate before it becomes a blocker.

---

## Checklist: Before Each Phase Transition

- [ ] **UI Redesign:** Visual regression tests pass on real device (iOS screenshot matches design); existing Vitest tests updated to match new classNames; PWA manifest icons still accessible.
- [ ] **Safe-Area Fix:** `viewport-fit=cover` and `apple-mobile-web-app-capable` meta tags added; safe-area padding applied to header/footer only; tested on iPhone 15/15 Pro simulator with dynamic island visible; no unexpected layout shifts on Android/desktop.
- [ ] **Security Hardening:** Better Auth `baseURL` uses dynamic allowedHosts configuration; auth forms are POST-only (verified in DevTools Network tab); `BETTER_AUTH_URL` and `BETTER_AUTH_ALLOWED_HOSTS` set per environment in Vercel; password reset token expiry is 5 min or less.
- [ ] **Playwright E2E:** Tests pass individually and in parallel (`npm run test:e2e`); Neon database branching integrated into globalSetup; tests run against actual Vercel preview URL (not localhost); auth state is isolated via storageState; database state is cleaned up between test runs.
- [ ] **Staging/Prod Pipeline:** GitHub Actions environment secrets configured (not repo secrets); double-deploy prevention working (Vercel auto-deploy disabled or actions/deploy doesn't run on preview); Deployment Checks gate production promotion on passing CI.

---

## Sources

- [Safe Area Insets - Mohammad Shehadeh](https://mohammadshehadeh.com/css/safe-area-insets)
- [Understanding env() Safe Area Insets - Medium](https://medium.com/@developerr.ayush/understanding-env-safe-area-insets-in-css-from-basics-to-react-and-tailwind-a0b65811a8ab)
- [Fixing iPhone Notch Display in React - TechNetexperts](https://www.technetexperts.com/react-iphone-notch-safe-area-fix/)
- [PWA on iOS: Save to Home Screen Guide - naildrivin5.com](https://naildrivin5.com/blog/2023/08/24/braindump-of-pwa-on-ios.html)
- [Getting PWA Fullscreen on iOS - DEV Community](https://dev.to/oncode/display-your-pwa-website-fullscreen-4776)
- [Better Auth: Dynamic Base URL Guide](https://better-auth.com/docs/guides/dynamic-base-url)
- [Better Auth: Options Reference](https://better-auth.com/docs/reference/options)
- [Complete Guide to Authentication on Vercel - Vercel Knowledge Base](https://vercel.com/kb/guide/complete-guide-authentication-vercel)
- [Testing User Session with Cookies in Playwright + Next.js - GitHub Discussion](https://github.com/vercel/next.js/discussions/62254)
- [Test Next.js Apps with Playwright: 5 Best Practices - JSMastery](https://jsmastery.com/blogs/test-next-js-apps-with-playwright-5-best-practices)
- [End-to-End Testing Auth Flows with Playwright and Next.js - Test Double](https://testdouble.com/insights/how-to-test-auth-flows-with-playwright-and-next-js)
- [Automated E2E Testing with Neon Branching and Playwright - Neon Guides](https://neon.com/guides/e2e-playwright-tests-with-neon-branching)
- [GitHub Actions Environment Secrets Guide - onboardbase.com](https://onboardbase.com/blog/github-actions-environment-variables/)
- [Multiple Environment Deployments with Vercel & GitHub Actions - kevinyipeio](https://kevinyipeio.com/blog/2023/06/30/vercel-how-to-deploy-to-multiple-environments-test-staging-production-more-with-their-own-env-variables-using-github-actions/)
- [Block Vercel Deployment Promotions with GitHub Actions - Vercel Changelog](https://vercel.com/changelog/block-vercel-deployment-promotions-with-github-actions)
- [Deployment Checks - Vercel Docs](https://vercel.com/docs/deployment-checks)
- [Serwist with Turbopack Support - npm](https://www.npmjs.com/package/@serwist/turbopack)
- [Build Next.js 16 PWA with Offline Support - LogRocket Blog](https://blog.logrocket.com/nextjs-16-pwa-offline-support/)
- [Visual Regression Testing - Vitest Guide](https://vitest.dev/guide/browser/visual-regression-testing)
- [Catching UI Bugs with Visual Regression Testing - OpenReplay](https://blog.openreplay.com/catch-ui-bugs-visual-regression-testing/)
- [Visual Regression Testing with Vitest - Markus Oberlehner](https://markus.oberlehner.net/blog/visual-regression-testing-with-vitest/)
- [Best Visual Regression Testing Tools 2026 - Sauce Labs](https://saucelabs.com/resources/blog/comparing-the-20-best-visual-testing-tools-of-2026)
- [GitHub Actions with Vercel Guide - Aaron Francis](https://aaronfrancis.com/2021/the-perfect-vercel-github-actions-deployment-pipeline)
- [Implementing GitHub Actions for Vercel Deployment - Medium](https://medium.com/@sanduniP/implementing-github-actions-for-vercel-deployment-b8412b28a586)
- [How to Use GitHub Actions with Vercel - Vercel Knowledge Base](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel)

---

*Pitfalls research for: v1.1 Polishing milestone (UI redesign, PWA safe-area, security hardening, Playwright e2e, staging/prod pipeline)*
*Researched: 2026-09-01*
