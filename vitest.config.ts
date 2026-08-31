import { defineConfig } from "vitest/config";
import path from "node:path";

// Integration tests (e.g. src/lib/db/salary-repository.test.ts) read
// DATABASE_URL via src/env.ts. `vitest run` does not load .env.local the way
// `next dev`/`next build` do, so load it explicitly here using Node's
// built-in process.loadEnvFile — no new dependency required. Safe to no-op
// when the file is absent (pure-domain-only test runs, e.g. CI without a
// configured database).
try {
  process.loadEnvFile(path.resolve(__dirname, ".env.local"));
} catch {
  // .env.local not present — fine for test suites that don't touch the DB.
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Node 22+'s built-in global `localStorage` (Web Storage API, on by
    // default) shadows jsdom's own window.localStorage implementation in
    // jsdom-environment tests, silently leaving `window.localStorage`
    // undefined ("localStorage is not available because --localstorage-file
    // was not provided"). Disabling it lets jsdom's implementation through —
    // needed by install-banner.render.test.tsx and any future test that
    // exercises localStorage-backed UI state.
    execArgv: ["--no-experimental-webstorage"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
