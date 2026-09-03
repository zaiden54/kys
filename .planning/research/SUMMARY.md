# Project Research Summary — НаРуки v1.1

**Project:** НаРуки (Russian payroll take-home calculator PWA)  
**Milestone:** v1.1 — Production Quality Polish  
**Researched:** 2026-09-01  
**Confidence:** HIGH  

---

## Executive Summary

The v1.1 milestone adds production-grade polish to an existing, validated MVP: visual redesign (shadcn/ui + Tailwind), iOS PWA safe-area handling, auth security hardening, end-to-end testing (Playwright), and a staging/production deployment pipeline. The good news is that **no architectural rewrites are required.** All new features integrate cleanly into the existing Next.js 16 App Router stack without touching the core tax calculation logic.

The recommended approach is **parallel work on five fronts: infrastructure setup, auth hardening, CI gating, E2E testing, and UI redesign**, converging on a staging environment for UAT before production release. The key insight from research is that personal-finance users prioritize **clarity and control**—UI polish serves clarity, auth security and e2e tests serve trust, and a staging/prod pipeline serves control over deployments.

**Top risks identified:** (1) Better Auth URL misconfiguration across preview/staging/prod deployments breaking auth on non-production environments, (2) Playwright E2E test flakiness due to shared database state in parallel CI runs, (3) Visual regression from redesign silently breaking UX (no visual tests to catch it). All three are preventable with the strategies outlined in PITFALLS.md.

---

## Key Findings

### Recommended Stack

**v1.0 core stack is locked unchanged:** Next.js 16.3.3 (App Router), React 19.2.8, TypeScript 6.0.3, PostgreSQL 17 (Neon serverless), Drizzle ORM 0.45.2, Better Auth 1.7.2, Recharts 3.10.1, Serwist 9.5.12, date-fns 4.4.0, Zod 4.4.3, Vitest 4.1.11. The v1.0 research validated these thoroughly; no upgrades needed.

**New technologies for v1.1 (all backwards-compatible additions):**

| Technology | Purpose | Why Now |
|-----------|---------|---------|
| **iOS safe-area CSS** (`env(safe-area-inset-*)`) | Reserve padding for iPhone notch/dynamic island/home indicator | Zero-config; CSS standard; critical for v1.1 UX on iPhone 14+ |
| **Playwright 1.62.1** | End-to-end testing for auth flows, form submissions, calculations | Official Next.js 16 recommendation; consensus choice (Cypress EOL) |
| **GitHub Actions CI** | Pre-merge gates on ESLint, TypeScript, Vitest | Enforce code quality before staging/prod deployments |
| **shadcn/ui 4.x + Tailwind CSS 4.x** | Component library + utility CSS for redesign | 2026 consensus for Next.js redesigns; ownership over components; native CSS variables for theming |
| **Playwright MCP 1.62.1** (optional) | AI-assisted test writing during development | Optional but valuable for team velocity on test creation |

All additions integrate natively with v1.0 stack; no conflicts or breaking changes.

### Expected Features — Table Stakes & Differentiators

**Must-have (table stakes for production finance app):**
- UI/UX: Empty states, loading skeletons, error messages (clear + actionable), form validation feedback, confirmation dialogs, accessible dark mode, consistent money formatting
- iOS PWA: Safe-area CSS (dynamic island), viewport-fit=cover, bottom-nav respects home indicator
- Auth security: HTTPS only, httpOnly + secure cookies, generic auth error messages (no user enumeration), CSRF checks, 5-min password reset token expiry
- E2E testing: Golden-path smoke tests (login → salary → forecast), register/login flows, bonus calculation, vacation pay calculation, annual pie chart, logout + redirect checks, PWA installability audit
- Release workflow: Preview deployments per PR, persistent staging environment, environment-scoped variables (Preview/Staging/Prod), manual staging→prod promotion, GitHub Actions pre-merge gate

**Should-have (competitive differentiators):**
- GDPR/CCPA account deletion + data export
- Accessibility audit + WCAG AA compliance
- Undo/change history (deferred to v2 per v1.0 decision)

**Anti-features (explicitly NOT building):**
- SMS 2FA/MFA, comprehensive audit logs, offline-first sync, tax engine refactoring, real-time multi-user collaboration, email notifications infrastructure, mobile app rewrite

### Architecture Approach

**Current state:** Route groups `(auth)` and `(app)` with separate layouts; Server Components enforcing auth; Server Actions for mutations; Better Auth + Neon; per-PR preview deployments with ephemeral Neon branches.

**v1.1 integrations (no rewrites, only additions):**
1. Visual redesign in `src/components/` with theme tokens
2. Dynamic BETTER_AUTH_URL derivation from request headers
3. Persistent staging environment with separate Neon staging branch
4. Playwright E2E tests in `e2e/` directory with isolated database per run
5. GitHub Actions CI gate (lint/type-check/test before merge)

**Phase order based on dependencies:** Infrastructure → Auth hardening → CI gate → E2E tests → UI redesign → UAT.

### Critical Pitfalls

1. **Double deployment (GH Actions + Vercel race):** Disable Vercel auto-deploy; let Actions own deployments.
2. **BETTER_AUTH_URL misconfiguration:** Derive dynamically from request headers; configure `allowedHosts` with wildcards.
3. **Password leaks in URL:** Always use POST for auth; verify in DevTools Network tab.
4. **Safe-area CSS breaks layout:** Verify `viewport-fit=cover` meta tag; apply padding only to header/footer; test on real iPhone.
5. **Playwright tests flake in CI:** Create isolated Neon branch per test run; use serial execution; auth via `storageState`.
6. **Visual regression passes silently:** Add Playwright `toMatchScreenshot()` baseline tests; capture golden screenshots.

---

## Implications for Roadmap

### 6-Phase Structure

**Phase 1: Infrastructure Setup** — Neon staging branch, Vercel environment config, GitHub Actions secrets scoping  
**Phase 2: Auth Security Hardening** — Dynamic BETTER_AUTH_URL, auth-factory pattern, security audit  
**Phase 3: CI Gate Setup** — GitHub Actions workflow, branch protection rules  
**Phase 4: E2E Test Suite** — Playwright fixtures, database isolation, CI integration  
**Phase 5: UI Redesign** — shadcn/ui components, safe-area CSS, visual regression tests, dark mode  
**Phase 6: Integration & UAT** — E2E on staging, manual iOS testing, PWA install test, release sign-off  

### Rationale

Infrastructure first ensures all phases have working staging. Auth hardening unblocks testing. CI gate enforces quality. E2E tests validate before redesign. UI redesign comes last because it doesn't affect logic. Phases 2-4 can run in parallel after Phase 1.

### Research Flags

**Needs validation mid-phase:**
- Phase 1: Verify staging branch doesn't already exist in Vercel
- Phase 4: Neon globalSetup needs CI validation (works locally, may need GitHub Actions adjustments)

**Standard patterns (skip research-phase):**
- Phase 2: Request-header derivation is proven Next.js pattern
- Phase 3: GitHub Actions CI is consensus workflow
- Phase 5: shadcn/ui + Tailwind 4 + safe-area CSS are 2026 standard
- Phase 6: Validation only; no research needed

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | v1.0 validated; v1.1 additions verified via npm, official docs, 2026 consensus |
| Features | HIGH | Fintech UX patterns, iOS PWA, auth security cross-checked across 5+ sources |
| Architecture | MEDIUM-HIGH | Next.js 16 patterns standard; BETTER_AUTH_URL derivation proven; Playwright + Neon needs CI validation |
| Pitfalls | HIGH | All 6 critical pitfalls verified 2+ sources; prevention strategies are consensus |

**Overall: HIGH confidence**

### Gaps to Address

1. Vercel staging branch pre-existence — coordinate during Phase 1
2. Neon globalSetup in CI runners — validation needed mid-Phase 4
3. Visual regression baseline — design agreement needed before Phase 5
4. iOS device testing access — simulator-only limitations must be documented
5. Custom staging domain — requires Vercel setup if desired

---

## Sources

**High Confidence:**
- npm registry (v1.1 package versions)
- Official docs: Next.js 16, Better Auth, Vercel, Neon, Playwright
- MDN, W3C CSS Archive, typescript-eslint GitHub issues
- Cross-checked fintech UX: Raw.Studio, Appthetics, Eleken, Design4Users (5+ sources)
- iOS PWA: ITNEXT, CSS-Tricks, Netguru, DEV Community

**Medium Confidence:**
- Community consensus: ixartz/Next-js-Boilerplate, TurboStarter, MakerKit (2026)
- Tech news: InfoQ, The Register, Visual Studio Magazine
- Independent articles: LogRocket, DEV Community, Medium (2026)

---

*Research completed: 2026-09-01*  
*Synthesized from: STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md*  
*Ready for roadmap planning.*
