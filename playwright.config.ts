import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

// `playwright test` runs in its own Node process and, like `vitest run`
// (see vitest.config.ts), does not load .env.local the way `next dev`/`next
// build` do. e2e/fixtures.ts's deleteUserByEmail needs DATABASE_URL to clean
// up disposable test users, so load it explicitly here. Safe to no-op when
// the file is absent.
try {
  process.loadEnvFile(path.resolve(__dirname, ".env.local"));
} catch {
  // .env.local not present — fine for CI, which supplies DATABASE_URL via
  // its own env, not a checked-in file.
}

// E2E-01..06 golden-path suite. Serial execution (fullyParallel: false,
// workers: 1) matches 07-CONTEXT.md's CI-isolation decision — this project
// runs against exactly one shared Neon branch per run (both in CI and, in
// effect, in local dev since it's the developer's own single .env.local
// DATABASE_URL), so parallel workers racing disposable-user creation/cleanup
// against the same database is unsafe.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  globalSetup: require.resolve("./e2e/global-setup.ts"),
  globalTeardown: require.resolve("./e2e/global-teardown.ts"),
  use: {
    // Never hardcode localhost directly here — Plan 07-05's CI job can
    // override this without editing this file again.
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  webServer: {
    // Production mode (not `next dev`), specifically so Serwist's service
    // worker actually registers — next.config.ts's `disable:
    // process.env.NODE_ENV === "development"` flag silently skips SW
    // registration under `next dev`, which Plan 07-04's PWA test needs.
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      // Runs e2e/auth.setup.ts, which registers a persistent fixture user
      // and saves its session to playwright/.auth/user.json for the
      // `authenticated` project below.
      name: "setup",
      testMatch: /auth\.setup\.ts$/,
    },
    {
      // auth.spec.ts (E2E-01) deliberately runs unauthenticated from its
      // own fresh registration — it must never depend on `setup` or share
      // storageState with the `authenticated` project.
      name: "chromium",
      testMatch: /auth\.spec\.ts$/,
      testIgnore: /auth\.setup\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Bonus/vacation/pie-chart/pwa specs (Plans 07-02/03/04) declare this
      // project so they get a logged-in session for free via
      // dependencies: ["setup"] + storageState, without re-implementing
      // login. None of these spec files exist yet, so this project
      // currently matches zero test files (a harmless no-op).
      name: "authenticated",
      testMatch: /(bonus|vacation|pie-chart|pwa)\.spec\.ts$/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/user.json" },
    },
  ],
});
