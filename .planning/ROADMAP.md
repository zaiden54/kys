# Roadmap: НаРуки

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-08-31)
- 🚧 **v1.1 Полировка MVP** — Phases 5-8 (in progress)

## Overview

v1.1 takes the shipped v1.0 MVP to production quality without touching the tax/vacation
calculation engines. Phase 5 stands up a persistent staging environment and release pipeline
(separate Vercel domain + Neon branch, scoped env vars, a single owner per environment for
deploys, a CI gate) and fixes `BETTER_AUTH_URL`/allowed-hosts dynamic resolution as part of that
work, since research flags it as a hard blocker for staging UAT if left unfixed. Phase 6 hardens
the login/registration flow itself (no credential leaks, no account-enumeration signal, correct
cookie flags) now that a real staging environment exists to verify it against. Phase 7 locks in a
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

- [ ] **Phase 5: Deploy Pipeline & Environment Config** - Persistent staging (Vercel + Neon) with correctly scoped env vars, a single deploy owner per environment, and a CI quality gate
- [ ] **Phase 6: Auth Security Hardening** - Login/registration flow verified to leak no credentials, give no enumeration signal, and set correctly-flagged session cookies
- [ ] **Phase 7: E2E Test Suite** - Playwright golden-path coverage of every v1.0 feature, running in CI against an isolated Neon branch, with Playwright MCP wired up
- [ ] **Phase 8: Visual Redesign, Accessibility & PWA Safe-Area** - Full visual redesign, consistent money formatting, empty/error/loading states, confirmation dialogs, dark mode, accessibility basics, and Dynamic Island-safe layout

## Phase Details

### Phase 5: Deploy Pipeline & Environment Config

**Goal**: Changes move from feature branch to production through one safe, unambiguous pipeline — a persistent staging environment separate from production, environment-scoped configuration, and no double-deploy races — with `BETTER_AUTH_URL`/allowed-hosts resolving correctly everywhere before staging goes live.
**Depends on**: Phase 4
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05, SEC-04
**Success Criteria** (what must be TRUE):

  1. A persistent staging URL (its own Vercel domain + its own Neon branch) exists, is reachable independent of production, and shows its own data (DEPLOY-01)
  2. Login/register succeed on PR-preview, staging, and production alike, with `BETTER_AUTH_URL` and allowed-hosts resolving to the right origin on each — no cross-environment redirect or cookie failures (SEC-04)
  3. Opening a PR triggers exactly one deploy path per environment; GitHub Actions and Vercel auto-deploy never both deploy the same environment (DEPLOY-05)
  4. Every PR runs lint + typecheck + unit tests via GitHub Actions, and a failing check blocks merge (DEPLOY-03)
  5. A documented feature-branch → staging (manual check) → production release procedure exists, has been followed for a real deploy, and environment variables are confirmed correctly scoped per environment (DEPLOY-04, DEPLOY-02)

**Plans**: TBD

### Phase 6: Auth Security Hardening

**Goal**: Users can trust the login/registration flow — it never leaks a credential, never tells an attacker whether an account exists, and sets session cookies with the correct security flags.
**Depends on**: Phase 5
**Requirements**: SEC-01, SEC-02, SEC-03
**Success Criteria** (what must be TRUE):

  1. Inspecting the browser Network tab and server logs during login/registration shows the password only inside the encrypted POST body — never in a URL, query string, or log line (SEC-01)
  2. Submitting a wrong password and submitting a non-existent email both return the same generic error message and response shape, so an attacker cannot distinguish the two cases (SEC-02)
  3. The session cookie set after login is confirmed via its actual `Set-Cookie` header (on staging) to have `httpOnly`, `secure`, and a correctly scoped `path`/`domain` (SEC-03)

**Plans**: TBD

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

**Plans**: TBD

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
| 5. Deploy Pipeline & Environment Config | v1.1 | 0/TBD | Not started | - |
| 6. Auth Security Hardening | v1.1 | 0/TBD | Not started | - |
| 7. E2E Test Suite | v1.1 | 0/TBD | Not started | - |
| 8. Visual Redesign, Accessibility & PWA Safe-Area | v1.1 | 0/TBD | Not started | - |
