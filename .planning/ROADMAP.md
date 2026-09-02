# Roadmap: НаРуки

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-08-31)
- 🚧 **v1.1 Полировка MVP** — Phases 5-8 (in progress)

## Overview

v1.1 takes the shipped v1.0 MVP to production quality without touching the tax/vacation
calculation engines. Phase 5 stands up isolated per-PR preview environments and a release pipeline
(each PR gets its own Vercel domain + Neon branch via an existing Marketplace integration, scoped
env vars, a single owner per environment for deploys, a CI gate) and fixes `BETTER_AUTH_URL`/
allowed-hosts dynamic resolution as part of that work, since research flags it as a hard blocker
for pre-production UAT if left unfixed. *(2026-09-01: a standalone persistent staging environment
was planned initially but dropped in favor of the already-isolated per-PR previews — see Phase 5's
Key Decisions.)* Phase 6 hardens the login/registration flow itself (no credential leaks, no
account-enumeration signal, correct cookie flags) now that a real pre-production environment exists
to verify it against. Phase 7 locks in a
Playwright e2e suite covering every v1.0 golden path, running in CI against its own isolated Neon
branch — this suite exists specifically as a regression safety net *before* Phase 8's redesign,
not as a final validation pass. Phase 8 is the longest pole: a full visual redesign, consistent
money formatting, empty/loading/error states, confirmation dialogs, dark mode, basic accessibility,
and iOS safe-area handling for the Dynamic Island — all of it UI/CSS surface area, none of it
calculation logic.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-08-31</summary>

- [x] Phase 1: Core Payroll Loop (12/12 plans) — completed 2026-08-29
- [x] Phase 2: Bonuses & One-off Payments (4/4 plans) — completed 2026-08-30
- [x] Phase 3: Vacation Pay (4/4 plans) — completed 2026-08-31
- [x] Phase 4: Annual Overview & PWA Installability (3/3 plans) — completed 2026-08-31

Full detail: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### 🚧 v1.1 Полировка MVP (In Progress)

**Milestone Goal:** Довести v1.0 MVP до продакшн-качества — визуально, по UX, по безопасности, по
автотестовому покрытию и по надёжности релизного процесса, без изменения расчётной модели
(НДФЛ/премии/отпускные).

- [x] **Phase 5: Deploy Pipeline & Environment Config** - Isolated per-PR preview environments (Vercel + Neon) with correctly scoped env vars, a single deploy owner per environment, and a CI quality gate (completed 2026-09-01)
- [x] **Phase 6: Auth Security Hardening** - Login/registration flow verified to leak no credentials, give no enumeration signal, and set correctly-flagged session cookies (completed 2026-09-01)
- [ ] **Phase 7: E2E Test Suite** - Playwright golden-path coverage of every v1.0 feature, running in CI against an isolated Neon branch, with Playwright MCP wired up
- [ ] **Phase 8: Visual Redesign, Accessibility & PWA Safe-Area** - Full visual redesign, consistent money formatting, empty/error/loading states, confirmation dialogs, dark mode, accessibility basics, and Dynamic Island-safe layout

## Phase Details

### Phase 5: Deploy Pipeline & Environment Config

**Goal**: Changes move from feature branch to production through one safe, unambiguous pipeline — isolated per-PR preview environments separate from production, environment-scoped configuration, and no double-deploy races — with `BETTER_AUTH_URL`/allowed-hosts resolving correctly everywhere. *(2026-09-01: "persistent staging environment" narrowed to "isolated per-PR preview environments" — see Key Decisions.)*
**Depends on**: Phase 4
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05, SEC-04
**Success Criteria** (what must be TRUE):

  1. Every PR gets its own isolated preview URL (its own Vercel branch-alias domain + its own Neon branch via the existing Vercel↔Neon Marketplace integration), reachable independent of production, and shows its own data (DEPLOY-01)
  2. Login/register succeed on PR-preview and production alike, with `BETTER_AUTH_URL` and allowed-hosts resolving to the right origin on each — no cross-environment redirect or cookie failures (SEC-04)
  3. Opening a PR triggers exactly one deploy path per environment; GitHub Actions and Vercel auto-deploy never both deploy the same environment (DEPLOY-05)
  4. Every PR runs lint + typecheck + unit tests via GitHub Actions, and a failing check blocks merge (DEPLOY-03)
  5. A documented feature-branch → PR-preview (manual check) → production release procedure exists, has been followed for a real deploy, and environment variables are confirmed correctly scoped per environment (DEPLOY-04, DEPLOY-02)

**Plans**: 4/4 plans executed

Plans:
**Wave 1**

- [x] 05-01-PLAN.md — SEC-04 tracer: dynamic Better Auth baseURL/allowedHosts resolution, proven by a DB-independent unit test
- [x] 05-02-PLAN.md — CI baseline cleanup: fix 4 pre-existing ESLint errors, ignore generated files, add typecheck script, track 2 pre-existing test failures

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-03-PLAN.md — GitHub Actions CI workflow (lint/typecheck/test/build), exercised via a real PR, enforced via branch protection

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 05-04-PLAN.md — *(revised)* Confirmed the existing Vercel↔Neon per-branch preview isolation + DEPLOYMENT.md (feature-branch → PR-preview → production), exercised once for real on PR #2

### Phase 6: Auth Security Hardening

**Goal**: Users can trust the login/registration flow — it never leaks a credential, never tells an attacker whether an account exists, and sets session cookies with the correct security flags.
**Depends on**: Phase 5
**Requirements**: SEC-01, SEC-02, SEC-03
**Success Criteria** (what must be TRUE):

  1. Inspecting the browser Network tab and server logs during login/registration shows the password only inside the encrypted POST body — never in a URL, query string, or log line (SEC-01)
  2. Submitting a wrong password and submitting a non-existent email both return the same generic error message and response shape, so an attacker cannot distinguish the two cases (SEC-02)
  3. The session cookie set after login is confirmed via its actual `Set-Cookie` header (on a PR-preview deployment) to have `httpOnly`, `secure`, and a correctly scoped `path`/`domain` (SEC-03)

**Plans**: 1/1 plans executed

Plans:
**Wave 1**

- [x] 06-01-PLAN.md — SEC-02 hardcoded generic login error (tracer) + local automated proof of SEC-01/SEC-02/SEC-03 + live PR-preview verification of SEC-01/SEC-03's HTTPS-only guarantees

### Phase 7: E2E Test Suite

**Goal**: Every v1.0 golden path is protected by an automated Playwright suite that runs in CI against its own isolated data, so the upcoming visual redesign has a real regression safety net.
**Depends on**: Phase 6
**Requirements**: E2E-01, E2E-02, E2E-03, E2E-04, E2E-05, E2E-06
**Success Criteria** (what must be TRUE):

  1. A Playwright test drives register → login → enter salary/schedule → see the correct next-payment forecast, end to end (E2E-01)
  2. Playwright tests cover add/edit/delete for both bonuses and vacations and confirm the forecast/отпускные numbers shown update correctly after each change (E2E-02, E2E-03)
  3. Playwright tests cover the annual pie-chart summary and the PWA install/manifest flow (E2E-04)
  4. Playwright MCP is wired into the repo so a developer can drive or author new tests against the running app through it (E2E-05)
  5. The full suite runs in CI against its own isolated Neon branch — a CI run never reads or writes staging/production data (E2E-06)

**Plans**: 1/5 plans executed

Plans:
**Wave 1**

- [x] 07-01-PLAN.md — Playwright scaffold + E2E-01 golden path (tracer) + storageState setup infra

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 07-02-PLAN.md — E2E-02 bonus add/edit/delete + forecast-update coverage
- [ ] 07-03-PLAN.md — E2E-03 vacation add/edit/delete + overlap validation + отпускные coverage
- [ ] 07-04-PLAN.md — E2E-04 annual pie-chart + PWA manifest/install-banner coverage

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 07-05-PLAN.md — E2E-06 CI isolation (Neon globalSetup/globalTeardown, new `e2e` required job) + E2E-05 Playwright MCP wiring

### Phase 8: Visual Redesign, Accessibility & PWA Safe-Area

**Goal**: The app looks and feels like a finished product — consistent, accessible, dark-mode aware, and safe on notched iPhones — with zero change to any calculation logic.
**Depends on**: Phase 7
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, PWA-01, PWA-02
**Success Criteria** (what must be TRUE):

  1. Every screen (login, home, bonuses, vacations, annual summary) shows a clear empty/loading/error state instead of a blank screen or a raw technical error (UI-01)
  2. Every money amount is formatted identically (locale-aware, tabular figures) across the whole app, and overwriting a salary or deleting a bonus/vacation shows a confirmation dialog with the before/after value (UI-02, UI-03)
  3. From any screen, the user can return to the home screen in one tap/click (UI-04)
  4. The app reflects the redesigned visual system (typography, color, components via `frontend-design`), follows the system dark/light theme, and meets basic accessibility requirements — contrast, focus indicators, labeled form fields (UI-05, UI-06, UI-07)
  5. On an iPhone with a Dynamic Island, the header/nav never overlaps it or the home indicator — verified with `viewport-fit=cover` configured and `env(safe-area-inset-*)` applied (PWA-01, PWA-02)

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Core Payroll Loop | v1.0 | 12/12 | Complete | 2026-08-29 |
| 2. Bonuses & One-off Payments | v1.0 | 4/4 | Complete | 2026-08-30 |
| 3. Vacation Pay | v1.0 | 4/4 | Complete | 2026-08-31 |
| 4. Annual Overview & PWA Installability | v1.0 | 3/3 | Complete | 2026-08-31 |
| 5. Deploy Pipeline & Environment Config | v1.1 | 4/4 | Complete    | 2026-09-01 |
| 6. Auth Security Hardening | v1.1 | 1/1 | Complete    | 2026-09-01 |
| 7. E2E Test Suite | v1.1 | 1/5 | In Progress|  |
| 8. Visual Redesign, Accessibility & PWA Safe-Area | v1.1 | 0/TBD | Not started | - |
