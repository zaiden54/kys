---
phase: quick/261028-0jr
plan: 01
subsystem: build/deploy
tags: [neon, vercel, drizzle, preview]
status: complete
requires: []
provides:
  - preview-only drizzle-kit push during Vercel builds
affects: [package.json build script, README.md]
key-files:
  created: [scripts/apply-preview-schema.mjs]
  modified: [package.json, README.md]
decisions:
  - "Guard strictly on VERCEL_ENV === preview; missing DATABASE_URL on preview is a hard exit 1"
metrics:
  tasks: 2
actuals:
  tasks: 2
  commits: 2
plan_head_before: eb023444d145ecfa29ccdf31a4ab77f9e6a540ed
plan_head_after: da6f854c64b85ff2207059d6bf42049dcd2ca618
commits: 2
completed: 2026-10-28
---

# Quick 261028-0jr: Apply Drizzle schema to Neon preview branch Summary

`build` now runs `scripts/apply-preview-schema.mjs` before `next build --webpack`; on Vercel preview builds it runs `npx drizzle-kit push --force` against the integration-injected per-branch DATABASE_URL, everywhere else it logs one "skipping" line and exits 0.

## Commits
- 1cbe033: feat(261028-0jr-01): script + build script wiring
- da6f854: docs(261028-0jr-01): README section "Vercel deploys and Neon branches"

## Verification
- VERCEL_ENV unset: one "skipping" line, exit 0 (PASS)
- VERCEL_ENV=production: skipping, exit 0 (PASS)
- VERCEL_ENV=preview, DATABASE_URL unset: exit 1 (PASS)
- package.json build string exact; no `${...DATABASE_URL` interpolation in script (PASS)
- `npm run lint`: 0 errors, 2 pre-existing warnings (react-hooks/incompatible-library); `npm run typecheck`: exit 0
- README section order check (PASS)
- The real push path (VERCEL_ENV=preview with DATABASE_URL) was NOT executed locally by design; it is exercised only on Vercel preview builds.

## Deviations from Plan
None - plan executed exactly as written.

## Known Stubs
None.

## Self-Check: PASSED
