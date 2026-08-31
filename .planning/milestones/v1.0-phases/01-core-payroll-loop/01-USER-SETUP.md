# Phase 01: User Setup Required

**Generated:** 2026-08-28
**Phase:** 01-core-payroll-loop
**Status:** Complete

Complete these items for Plan 01-01 (and every later Phase 1 plan) to run. Claude automated everything possible; these items require human access to the Neon dashboard, which Claude does not have credentials for.

## Environment Variables

| Status | Variable | Source | Add to |
|--------|----------|--------|--------|
| [x] | `DATABASE_URL` | Neon Console → your project → Connection Details → **pooled** connection string (includes `sslmode=require`) | `.env.local` |
| [x] | `BETTER_AUTH_SECRET` | Generate locally: `openssl rand -base64 32` | `.env.local` |
| [x] | `BETTER_AUTH_URL` | Static value for local dev: `http://localhost:3000` | `.env.local` |

## Account Setup

- [x] **Create a Neon account** (if needed)
  - URL: https://console.neon.tech
  - Skip if: already have a Neon account

## Dashboard Configuration

- [x] **Create a Neon project and database for НаРуки**
  - Location: https://console.neon.tech → New Project
  - Notes: use the **pooled** connection string (not the direct one) — Task 2 wires the app through `drizzle-orm/neon-http`, which expects the pooled endpoint.

## Verification

After completing setup:

```bash
# Confirm the three vars are present (values not printed)
grep -c DATABASE_URL .env.local
grep -c BETTER_AUTH_SECRET .env.local
grep -c BETTER_AUTH_URL .env.local

# Confirm .env.local is gitignored, not staged
git check-ignore -q .env.local && echo "ignored ok"
```

Expected results:
- All three `grep -c` checks return `1` or more.
- `git check-ignore -q .env.local` exits 0 (prints "ignored ok").

---

**Once all items complete:** Mark status as "Complete" at top of file, then resume plan `01-01` execution — Task 2 (`Scaffold Next.js 16, pin the toolchain, validate env, wire the Neon Drizzle client`) can proceed once `DATABASE_URL` is real.
