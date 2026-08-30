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
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
