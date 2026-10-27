#!/usr/bin/env node
// Preview-only Drizzle schema push, run as the first half of the `build`
// script (`node scripts/apply-preview-schema.mjs && next build --webpack`).
//
// - It is a deliberate no-op unless VERCEL_ENV is exactly "preview".
// - Why: the Neon-Managed Vercel integration forks a `preview/<git-branch>`
//   Neon branch from `production` for each preview deployment and injects
//   DATABASE_URL into the preview build. This project has no migration files;
//   the schema is applied with `drizzle-kit push`, so without this step a
//   preview branch database can lag the code under review.
// - Production schema is intentionally NOT touched here; it is still applied
//   manually with `npm run db:push`.
// - GitHub Actions CI and local builds have no VERCEL_ENV, so they skip.
//
// The DATABASE_URL value is never logged; it is referenced by name only
// (drizzle.config.ts reads process.env.DATABASE_URL).
import { execFileSync } from "node:child_process";

async function main() {
  const vercelEnv = process.env.VERCEL_ENV;

  if (vercelEnv !== "preview") {
    console.log(
      `apply-preview-schema: VERCEL_ENV is ${vercelEnv ? `"${vercelEnv}"` : "unset"}, skipping schema push`,
    );
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.error(
      "FAIL [apply-preview-schema]: DATABASE_URL is required on Vercel preview builds, but the preview branch database URL was not injected",
    );
    process.exit(1);
  }

  // --force: never block on an interactive data-loss prompt in a non-TTY
  // build. Only the preview branch (a copy-on-write fork) can be affected.
  execFileSync("npx", ["drizzle-kit", "push", "--force"], {
    stdio: "inherit",
    env: process.env,
  });
}

main().catch((err) => {
  console.error(
    `FAIL [apply-preview-schema]: drizzle-kit push failed (${err instanceof Error ? err.message : "unknown error"})`,
  );
  process.exit(1);
});
