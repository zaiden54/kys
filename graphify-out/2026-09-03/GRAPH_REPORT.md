# Graph Report - kys  (2026-09-03)

## Corpus Check
- 299 files · ~402,118 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 966 nodes · 1906 edges · 86 communities (53 shown, 32 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 79 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Payroll Forecast Domain
- Test Utilities and Scripts
- Payroll Setup Actions
- Bonus Actions and Data
- Vacation Forecast Actions
- Development Tooling
- Visual Design System
- Runtime Dependencies
- TypeScript Configuration
- Authentication UI
- Core Payroll Plans
- Annual PWA Planning
- Tax and Vacation Math
- E2E Verification Helpers
- Dashboard Components
- Vacation and Bonus Research
- Deployment Planning
- MVP Requirements Coverage
- PWA Icon Routes
- Technology Research
- Annual Overview Delivery
- Gap Closure Plans
- CI Workflow Architecture
- Project Planning Decisions
- UI and PWA Requirements
- Next.js Application Stack
- Authentication Security
- Product Research
- Auth Hardening Phase
- Install Banner State
- E2E Milestone Planning
- Secret Validation
- Deployment Requirements
- Standalone PWA Detection
- Auth Redirect Verification
- Isolated E2E Database
- Server Auth Guard
- Feature Requirements
- Project Retrospective
- Bonus Form Tests
- Bonus Row Tests
- Root Application Layout
- Payroll Form Tests
- Phase One Quality Gates
- Phase Two Quality Gates
- Vacation Requirements
- Service Worker Configuration
- Deployment Platforms
- Core Payroll Documentation
- Bonus Editing Decisions
- Zero-State UX
- Playwright MCP Config
- CI Alternatives
- Error Boundary
- Charting Libraries
- Vacation Code Review
- Environment Secrets
- Agent Instructions
- ESLint Configuration
- PostCSS Configuration
- Document Asset
- GSD Workflow
- Project Overview
- Date Utilities
- Database Studio
- Environment Validation
- Unit Testing
- Design Token Decision
- Vacation Calculation Policy
- Authentication Flow
- Explicit Anti-Features
- Auth Security Baseline
- Future Differentiators
- E2E Testing Baseline
- iOS PWA Baseline
- Release Workflow Baseline
- PWA Icon Pitfall
- Dynamic Auth URLs
- Playwright MCP Research
- Worktree Credential Issue
- Globe Asset
- Next.js Brand Asset
- Vercel Brand Asset
- Window Asset
- Auth Client API

## God Nodes (most connected - your core abstractions)
1. `todayIsoInMoscow()` - 30 edges
2. `requireUserId()` - 24 edges
3. `Phase 8 Plan 01: Design Tokens, Shared Shell & Home Screen Tracer` - 24 edges
4. `forecastNextPayment()` - 21 edges
5. `computeAnnualSummary()` - 20 edges
6. `Phase 07: Code Review Report` - 20 edges
7. `Phase 07: E2E Test Suite Verification Report` - 20 edges
8. `Phase 8 Plan 06: Whole-Phase Regression & Verification Closure` - 20 edges
9. `Kopecks` - 19 edges
10. `Phase 8 Plan 02: Bonuses Screen Restyle` - 17 edges

## Surprising Connections (you probably didn't know these)
- `WR-01: YTD baseline never taxed in computeAnnualSummary (overstates На руки)` --references--> `computeAnnualSummary()`  [EXTRACTED]
  .planning/milestones/v1.0-phases/04-annual-overview-pwa-installability/04-REVIEW.md → src/app/actions/annual-summary.ts
- `CR-01: useIsStandalone SSR/hydration mismatch` --references--> `useIsStandalone()`  [EXTRACTED]
  .planning/milestones/v1.0-phases/04-annual-overview-pwa-installability/04-REVIEW.md → src/lib/use-standalone.ts
- `AppError()` --implements--> `Phase 4 Plan 01: Annual Summary Engine + Recharts Chart`  [EXTRACTED]
  src/app/(app)/error.tsx → .planning/milestones/v1.0-phases/04-annual-overview-pwa-installability/04-01-PLAN.md
- `LoginPage()` --implements--> `SEC-02: hardcoded generic login error (no error.message/code pass-through)`  [EXTRACTED]
  src/app/(auth)/login/page.tsx → .planning/milestones/v1.1-phases/06-auth-security-hardening/06-01-PLAN.md
- `LoginPage()` --implements--> `Phase 4 Plan 03: Auth Redirect Fix (G-04-2)`  [EXTRACTED]
  src/app/(auth)/login/page.tsx → .planning/milestones/v1.0-phases/04-annual-overview-pwa-installability/04-03-PLAN.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **v1.0 MVP Phase Sequence** — _planning_milestones_v1_0_roadmap_phase_1, _planning_milestones_v1_0_roadmap_phase_2, _planning_milestones_v1_0_roadmap_phase_3, _planning_milestones_v1_0_roadmap_phase_4 [EXTRACTED 1.00]
- **v1.1 Полировка MVP Phase Sequence** — _planning_milestones_v1_1_roadmap_phase_5, _planning_milestones_v1_1_roadmap_phase_6, _planning_milestones_v1_1_roadmap_phase_7, _planning_milestones_v1_1_roadmap_phase_8 [EXTRACTED 1.00]
- **Auth No-Redirect Bug Investigation Group** — _planning_debug_auth_no_redirect_standalone_bug, _planning_debug_auth_no_redirect_standalone_login_page, _planning_debug_auth_no_redirect_standalone_register_page, _planning_debug_auth_no_redirect_standalone_session_ts, _planning_debug_auth_no_redirect_standalone_app_layout [EXTRACTED 0.90]
- **Vacation Phase Plan Execution Chain** — _planning_milestones_v1_0_phases_03_vacation_pay_03_01_plan_foundation_plan, _planning_milestones_v1_0_phases_03_vacation_pay_03_02_plan_bonus_type_plan, _planning_milestones_v1_0_phases_03_vacation_pay_03_03_plan_repository_plan, _planning_milestones_v1_0_phases_03_vacation_pay_03_04_plan_ui_forecast_plan [EXTRACTED 1.00]
- **Phase 2 Quality Gates** — _planning_milestones_v1_0_phases_02_bonuses_one_off_payments_02_review_code_review, _planning_milestones_v1_0_phases_02_bonuses_one_off_payments_02_security_security_audit, _planning_milestones_v1_0_phases_02_bonuses_one_off_payments_02_validation_validation_strategy, _planning_milestones_v1_0_phases_02_bonuses_one_off_payments_02_verification_final_verification [INFERRED 0.85]
- **Phase 04 Annual Overview Delivery** — _planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_context_phase_4_context, _planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_01_plan_annual_summary_engine_plan, _planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_01_summary_annual_summary_engine_summary, _planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_verification_phase_4_verification_report [INFERRED 0.85]
- **Phase 04 PWA Installability Delivery** — _planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_research_serwist_pwa_configuration, _planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_02_plan_pwa_installability_plan, _planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_02_summary_pwa_installability_summary, _planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_uat_phase_04_uat, _planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_verification_phase_4_verification_report [INFERRED 0.85]
- **Phase 4 plan waves delivering HOME-02 and PWA-01** — planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_01_plan, planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_02_plan, planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_03_plan [EXTRACTED 1.00]
- **G-04-2 gap: discovery in UAT, closure plan, summary, and re-verification** — planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_uat, planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_03_plan, planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_03_summary, planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_verification [EXTRACTED 1.00]
- **Phase 6 SEC-01/02/03 hardening decision chain** — planning_milestones_v1_1_phases_06_auth_security_hardening_06_context, planning_milestones_v1_1_phases_06_auth_security_hardening_06_research, planning_milestones_v1_1_phases_06_auth_security_hardening_06_01_plan, planning_milestones_v1_1_phases_06_auth_security_hardening_06_verification [EXTRACTED 1.00]
- **Phase 7 E2E Test Suite Plan Sequence** — doc_plan01, doc_plan02, doc_plan03, doc_plan04, doc_plan05 [INFERRED 0.85]
- **CI Neon Branch Lifecycle Scripts** — e2e_global_setup, e2e_global_teardown, e2e_ci_branch_setup, e2e_ci_branch_teardown [EXTRACTED 1.00]
- **Phase 7 Review-Fix-Verify Quality Loop** — doc_review, doc_reviewfix, doc_verification [EXTRACTED 0.95]
- **Phase 8 Wave-2 Per-Screen Restyle Plans (Bonuses, Vacations, Forms, Auth)** — planning_milestones_v1_1_phases_08_visual_redesign_accessibility_pwa_safe_area_08_02_plan_doc, planning_milestones_v1_1_phases_08_visual_redesign_accessibility_pwa_safe_area_08_03_plan_doc, planning_milestones_v1_1_phases_08_visual_redesign_accessibility_pwa_safe_area_08_04_plan_doc, planning_milestones_v1_1_phases_08_visual_redesign_accessibility_pwa_safe_area_08_05_plan_doc, planning_milestones_v1_1_phases_08_visual_redesign_accessibility_pwa_safe_area_08_01_plan_doc [EXTRACTED 0.95]
- **Phase 8 Code Review -> Fix -> Gap Closure -> Re-Verification Loop** — planning_milestones_v1_1_phases_08_visual_redesign_accessibility_pwa_safe_area_08_review_doc, planning_milestones_v1_1_phases_08_visual_redesign_accessibility_pwa_safe_area_08_review_fix_doc, planning_milestones_v1_1_phases_08_visual_redesign_accessibility_pwa_safe_area_08_07_plan_doc, planning_milestones_v1_1_phases_08_visual_redesign_accessibility_pwa_safe_area_08_verification_doc [EXTRACTED 0.90]
- **Phase 8 SEC-02 Security-Boundary Preservation During Restyle** — planning_milestones_v1_1_phases_08_visual_redesign_accessibility_pwa_safe_area_08_05_plan_doc, planning_milestones_v1_1_phases_08_visual_redesign_accessibility_pwa_safe_area_08_05_summary_doc, concept_sec_02_generic_login_error [EXTRACTED 0.90]
- **Phase One Assurance Artifacts** — _planning_milestones_v1_0_phases_01_core_payroll_loop_01_review_phase_one_code_review, _planning_milestones_v1_0_phases_01_core_payroll_loop_01_security_phase_one_security_audit, _planning_milestones_v1_0_phases_01_core_payroll_loop_01_validation_phase_one_validation_strategy, _planning_milestones_v1_0_phases_01_core_payroll_loop_01_verification_phase_one_verification [INFERRED 0.85]
- **Bonus Phase Plan and Summary Chain** — _planning_milestones_v1_0_phases_02_bonuses_one_off_payments_02_01_plan_bonus_creation_forecast_plan, _planning_milestones_v1_0_phases_02_bonuses_one_off_payments_02_01_summary_bonus_creation_forecast, _planning_milestones_v1_0_phases_02_bonuses_one_off_payments_02_02_plan_bonus_edit_history_plan, _planning_milestones_v1_0_phases_02_bonuses_one_off_payments_02_02_summary_bonus_edit_history, _planning_milestones_v1_0_phases_02_bonuses_one_off_payments_02_03_plan_bonus_gap_closure_plan, _planning_milestones_v1_0_phases_02_bonuses_one_off_payments_02_03_summary_bonus_gap_closure [EXTRACTED 1.00]
- **Phase Five Plan and Summary Delivery Chain** — _planning_milestones_v1_1_phases_05_deploy_pipeline_environment_config_05_01_plan_dynamic_auth_origin_plan, _planning_milestones_v1_1_phases_05_deploy_pipeline_environment_config_05_01_summary_dynamic_auth_origin, _planning_milestones_v1_1_phases_05_deploy_pipeline_environment_config_05_02_plan_ci_baseline_plan, _planning_milestones_v1_1_phases_05_deploy_pipeline_environment_config_05_02_summary_ci_baseline, _planning_milestones_v1_1_phases_05_deploy_pipeline_environment_config_05_03_plan_ci_branch_protection_plan, _planning_milestones_v1_1_phases_05_deploy_pipeline_environment_config_05_03_summary_ci_branch_protection, _planning_milestones_v1_1_phases_05_deploy_pipeline_environment_config_05_04_plan_deployment_procedure_plan, _planning_milestones_v1_1_phases_05_deploy_pipeline_environment_config_05_04_summary_deployment_procedure [EXTRACTED 1.00]
- **Phase Five Assurance Artifacts** — _planning_milestones_v1_1_phases_05_deploy_pipeline_environment_config_05_review_deployment_code_review, _planning_milestones_v1_1_phases_05_deploy_pipeline_environment_config_05_review_fix_deployment_review_fixes, _planning_milestones_v1_1_phases_05_deploy_pipeline_environment_config_05_validation_deployment_validation_strategy, _planning_milestones_v1_1_phases_05_deploy_pipeline_environment_config_05_verification_deployment_verification [INFERRED 0.85]

## Communities (86 total, 32 thin omitted)

### Community 0 - "Payroll Forecast Domain"
Cohesion: 0.08
Nodes (65): AnnualSummaryResult, computeAnnualSummary(), forecastNextPayment(), ForecastResult, selectNextPaymentEvent(), TODO: pre-existing bug (not caused by Phase 5) — forecastNextPayment does not…, TODO: pre-existing bug (not caused by Phase 5) — forecastNextPayment does not…, OnboardingPage() (+57 more)

### Community 1 - "Test Utilities and Scripts"
Cohesion: 0.07
Nodes (51): .github/workflows/ci.yml, .mcp.json, CI-Only Neon Branch Lifecycle Pattern, Disposable Test User + Self-Cleanup Pattern, Gross = Tax + Net Two-Slice Invariant, Neon Management API, Package Legitimacy Gate, Playwright MCP (+43 more)

### Community 2 - "Payroll Setup Actions"
Cohesion: 0.06
Nodes (52): PAY_SETUP_PATHS, revalidatePaySetupPaths(), SalaryActionResult, saveSalaryAction(), confirmation(), saveScheduleAction(), saveYtdBaselineAction(), ScheduleActionResult (+44 more)

### Community 3 - "Bonus Actions and Data"
Cohesion: 0.07
Nodes (35): BonusActionResult, deleteBonusAction(), revalidateBonusPaths(), saveBonusAction(), mocks, { GET, POST }, BonusForm(), onSubmit() (+27 more)

### Community 4 - "Vacation Forecast Actions"
Cohesion: 0.08
Nodes (33): NextPaymentForecast, deleteVacationAction(), revalidateVacationPaths(), saveVacationAction(), mocks, VacationActionResult, BonusRow(), onDelete() (+25 more)

### Community 5 - "Development Tooling"
Cohesion: 0.05
Nodes (43): drizzle-kit, eslint, eslint-config-next, jsdom, devDependencies, drizzle-kit, eslint, eslint-config-next (+35 more)

### Community 6 - "Visual Design System"
Cohesion: 0.16
Nodes (43): Account-enumeration protection (no signal to distinguish wrong-password vs unknown-email), Annual Pie Chart Zero-Income Empty State, Frozen Calculation Engine Constraint (Zero Change to src/domain, src/lib/db), Dark-Base / Light-Override CSS Variable Polarity, CSS Variable Design Token System (color/typography/spacing/font-family), Focus-Visible Outline Accessibility Pattern, Safe-Area Inset Single Source of Truth ((app) layout header/main), Salary Overwrite Confirmation Panel (Struck-Through Old / Conditional-Accent New) (+35 more)

### Community 7 - "Runtime Dependencies"
Cohesion: 0.06
Nodes (35): better-auth, @better-auth/drizzle-adapter, date-fns, date-holidays, drizzle-orm, drizzle-zod, @hookform/resolvers, @neondatabase/serverless (+27 more)

### Community 8 - "TypeScript Configuration"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 9 - "Authentication UI"
Cohesion: 0.12
Nodes (11): G-04-2: router.refresh() before router.push() fix, LoginInput, LoginPage(), loginSchema, { pushMock, refreshMock }, RegisterInput, RegisterPage(), registerSchema (+3 more)

### Community 10 - "Core Payroll Plans"
Cohesion: 0.11
Nodes (21): Plan 01-01: Application scaffold, Neon schema, and Better Auth, Summary 01-01: Core scaffold completed, Plan 01-02: Authenticated walking skeleton, Summary 01-02: Authentication mounted, Plan 01-03: Pure tax and schedule engines, Summary 01-03: Tax and schedule engines completed, Plan 01-04: Salary, schedule, and YTD input slice, Summary 01-04: Pay setup input slice completed (+13 more)

### Community 11 - "Annual PWA Planning"
Cohesion: 0.10
Nodes (21): Phase 3 UI Design Contract, Phase 03 Validation Strategy, Phase 3 Vacation Pay Verification Report, Annual Summary Engine Plan, Annual Summary Engine and Recharts Summary, PWA Installability Plan, PWA Installability Summary, Auth Redirect Fix Plan (+13 more)

### Community 12 - "Tax and Vacation Math"
Cohesion: 0.19
Nodes (14): AnnualEvent, Kopecks, NdflResult, roundToRuble(), taxOnCumulative(), assertStrictlyAscending(), bracketsForYear(), MAX_VERIFIED_TAX_YEAR (+6 more)

### Community 13 - "E2E Verification Helpers"
Cohesion: 0.18
Nodes (17): cookieHeaderFromSetCookie(), countUsersByEmail(), createdEmails, deleteUsersByEmail(), fail(), main(), signUp(), sql (+9 more)

### Community 14 - "Dashboard Components"
Cohesion: 0.16
Nodes (10): AnnualSummary, AnnualResult, ForecastResult, MISSING_COPY, AnnualPieChart(), formatPercent(), percentFormatter, SkeletonLoader() (+2 more)

### Community 15 - "Vacation and Bonus Research"
Cohesion: 0.12
Nodes (17): Phase 2 Bonus Pattern Map, Phase 2 Bonus Research, Phase 2 UI Design Contract, Vacation Pay Foundation Plan, Vacation Pay Foundation Summary, Vacation Bonus Type Reclassification Plan, Vacation Bonus Type Reclassification Summary, Vacation Repository and Income Integration Plan (+9 more)

### Community 16 - "Deployment Planning"
Cohesion: 0.12
Nodes (17): Dynamic Better Auth Origin Plan, Dynamic Better Auth Base URL Resolution, CI Baseline Cleanup Plan, CI Baseline Cleanup, CI Pipeline and Branch Protection Plan, CI Pipeline and Branch Protection, Deployment Procedure and Environment Plan, Deployment Procedure and Environment Verification (+9 more)

### Community 17 - "MVP Requirements Coverage"
Cohesion: 0.15
Nodes (15): forecastNextPayment, Blocking Gap: Exact-Date Vacation Collision, NextPaymentCard, v1.0 Milestone Audit (gaps_found), selectNextPaymentEvent, AUTH-01: register/login, AUTH-02: cloud sync across devices, HOME-01: next payment amount/date (+7 more)

### Community 18 - "PWA Icon Routes"
Cohesion: 0.22
Nodes (8): GET(), getResponse(), AppleIcon(), contentType, size, manifest(), PWA_ICON_BACKGROUND_HEX, renderPwaIconMarkup()

### Community 19 - "Technology Research"
Cohesion: 0.17
Nodes (13): Clerk (alternative), Prisma v7 (alternative), Supabase (alternative), Firebase/Firestore/MongoDB (avoid), NextAuth.js v4 (avoid), PlanetScale (avoid), Dedicated time-series DB (avoid), Better Auth 1.7.2 (+5 more)

### Community 20 - "Annual Overview Delivery"
Cohesion: 0.21
Nodes (13): WR-01: YTD baseline never taxed in computeAnnualSummary (overstates На руки), CR-01: useIsStandalone SSR/hydration mismatch, Phase 4 Plan 01: Annual Summary Engine + Recharts Chart, Phase 4 Plan 01 Summary, Phase 4 Plan 02: PWA Installability, Phase 4 Plan 02 Summary, Phase 4 Plan 03 Summary, Phase 4 Context (+5 more)

### Community 21 - "Gap Closure Plans"
Cohesion: 0.21
Nodes (12): Consent-Bound Salary Replacement, Calendar and Authentication-Secret Gap Closure Plan, Calendar and Authentication-Secret Validation, Core Payroll Gap-Closure Pattern Map, Phase One Code Review, Phase One Deployment Setup, Bonus Creation and Forecast Plan, Bonus Creation and Forecast Tracer (+4 more)

### Community 22 - "CI Workflow Architecture"
Cohesion: 0.20
Nodes (11): Playwright 1.62.1, e2e/ci-branch-teardown.mjs (referenced), e2e job (isolated Neon branch), src/env.ts (referenced), e2e/global-teardown.ts (referenced), ci job (lint/typecheck/unit-tests/build), src/lib/auth.ts (referenced), src/lib/db/index.ts (referenced, neon-http driver) (+3 more)

### Community 23 - "Project Planning Decisions"
Cohesion: 0.18
Nodes (10): router.refresh() before router.push() fix, src/app/(auth)/login/page.tsx, src/app/(auth)/register/page.tsx, v1.0 MVP Milestone, v1.1 Полировка MVP Milestone, Decision: cloud sync with accounts instead of local storage, Decision: router.refresh() required before router.push() post client-side auth, НаРуки PROJECT.md Overview (+2 more)

### Community 24 - "UI and PWA Requirements"
Cohesion: 0.18
Nodes (11): PWA-01 (v1.1): safe-area-inset header/nav, PWA-02: viewport-fit=cover on real/simulated iPhone, UI-01: empty/loading/error states, UI-02: uniform money formatting, UI-03: destructive-action confirmation dialogs, UI-04: return-to-home from any screen, UI-05: visual redesign via frontend-design skill, UI-06: system dark theme support (+3 more)

### Community 25 - "Next.js Application Stack"
Cohesion: 0.20
Nodes (10): next-pwa (avoid), Client-side offline-first sync engines (avoid), TypeScript 7.0.x (avoid for now), Next.js 16.3.3 App Router, React 19.2.8, Serwist (@serwist/next), TypeScript 6.0.3, typescript-eslint compatibility gap (+2 more)

### Community 26 - "Authentication Security"
Cohesion: 0.22
Nodes (10): Debug KB Entry: password-visible-devtools, Password Visible in DevTools (misinterpretation), TLS Transport Confirmed Secure (no-code resolution), scripts/verify-auth-security.mjs, SEC-01: no password leak in URL/logs, SEC-02: generic auth errors (no enumeration), SEC-03: httpOnly/secure session cookie, Phase 6: Auth Security Hardening (+2 more)

### Community 27 - "Product Research"
Cohesion: 0.20
Nodes (10): SEC-04: dynamic BETTER_AUTH_URL/allowed-hosts, BETTER_AUTH_URL Dynamic Derivation Pattern, Playwright e2e Integration Plan, Route Structure ((auth)/(app) route groups), Table Stakes: UI/UX Foundations, Pitfall: BETTER_AUTH_URL Misconfiguration Across Environments, iOS PWA Safe-Area CSS Support (zero-config), Playwright 1.62.1 for E2E Testing (+2 more)

### Community 28 - "Auth Hardening Phase"
Cohesion: 0.29
Nodes (10): Phase 6 Plan 01: Auth Security Hardening, Phase 6 Plan 01 Summary, Phase 6 Context, Phase 6 Pattern Map, Phase 6 Research, Phase 6 Code Review Report, Phase 6 Code Review Fix Report, Phase 6 UAT Log (+2 more)

### Community 29 - "Install Banner State"
Cohesion: 0.33
Nodes (6): getDismissedServerSnapshot(), getDismissedSnapshot(), InstallBanner(), handleDismiss(), setDismissedFlag(), subscribeToDismissed()

### Community 30 - "E2E Milestone Planning"
Cohesion: 0.22
Nodes (9): v1.1 Milestone Audit (tech_debt only, no blockers), E2E-01: golden-path smoke test, E2E-02: bonus add/edit/delete coverage, E2E-03: vacation add/edit/delete coverage, E2E-04: annual pie summary + PWA install coverage, E2E-05: Playwright MCP integration, Phase 7: E2E Test Suite, WINDOWS #1: vacation UAT unrun-verify (open) (+1 more)

### Community 31 - "Secret Validation"
Cohesion: 0.33
Nodes (6): AUTH_SECRET_MIN_LENGTH, betterAuthSecretSchema, isPlaceholderSecret(), PLACEHOLDER_MARKERS, rejectedCases, thirtyOneDiverseChars

### Community 32 - "Deployment Requirements"
Cohesion: 0.29
Nodes (7): DEPLOY-01: isolated per-PR preview environments, DEPLOY-02: env vars scoped per environment, DEPLOY-03: GitHub Actions blocks merge on failure, DEPLOY-04: documented release cycle, DEPLOY-05: no double-deploy race, Phase 5: Deploy Pipeline & Environment Config, Pitfall: Double Deployment Race

### Community 33 - "Standalone PWA Detection"
Cohesion: 0.43
Nodes (6): iOS standalone-PWA storage-jar re-login expectation, detectStandalone(), getStandaloneServerSnapshot(), Navigator, subscribeToStandalone(), useIsStandalone()

### Community 34 - "Auth Redirect Verification"
Cohesion: 0.43
Nodes (7): Manual-only real-device/deployment verification (cannot be scripted in sandbox), Debug session: auth-no-redirect-standalone, Phase 4 Plan 03: Auth Redirect Fix (G-04-2), Phase 4 UAT Log, Phase 4 Validation Strategy, Phase 4 Verification Report, Phase 6 Validation Strategy

### Community 35 - "Isolated E2E Database"
Cohesion: 0.33
Nodes (6): e2e/ci-branch-setup.mjs (referenced), E2E-06: isolated Neon branch in CI, Decision: one throwaway Neon branch per CI run (not per-test), Pitfall: Playwright Pass Locally, Fail in CI (Headless Differences), Pitfall: Playwright Flake From Auth/DB State Pollution, Pattern: provision Neon CI branch before test:e2e, not inside globalSetup

### Community 36 - "Server Auth Guard"
Cohesion: 0.33
Nodes (6): (app)/layout.tsx (getSessionUser gate), Auth No-Redirect Bug (router.push without refresh), Next.js bundled App Router auth guide (canonical Server Action redirect), login/page.render.test.tsx (mocked useRouter blind spot), src/lib/session.ts (requireUserId), scripts/verify-auth-flow.mjs

### Community 37 - "Feature Requirements"
Cohesion: 0.33
Nodes (6): BON-01: one-off bonus/compensation, BON-02: bonus taxed via cumulative НДФЛ, HOME-02: annual pie chart, PWA-01 (v1.0): install to iPhone home screen, Phase 2: Bonuses & One-off Payments, Phase 4: Annual Overview & PWA Installability

### Community 38 - "Project Retrospective"
Cohesion: 0.33
Nodes (6): Decision: separate --color-accent-button token for WCAG AA contrast, Pattern: CSS tokens dark-mode-first with light override, Pattern: verify WCAG contrast independently per role (text vs background), v1.1 Retrospective, Recurring Defect: stale git worktree fork-base, Project State: v1.1 shipped, awaiting next milestone

### Community 39 - "Bonus Form Tests"
Cohesion: 0.33
Nodes (4): descendants(), sourceFile, sourcePath, sourceText

### Community 40 - "Bonus Row Tests"
Cohesion: 0.33
Nodes (4): descendants(), sourceFile, sourcePath, sourceText

### Community 41 - "Root Application Layout"
Cohesion: 0.33
Nodes (4): geistMono, geistSans, metadata, viewport

### Community 42 - "Payroll Form Tests"
Cohesion: 0.33
Nodes (4): descendants(), sourceFile, sourcePath, sourceText

### Community 43 - "Phase One Quality Gates"
Cohesion: 0.40
Nodes (5): Phase One Security Audit, Phase One User Acceptance Testing, Phase One Validation Strategy, Phase One Goal Verification, Phase One API Coverage Decision

### Community 44 - "Phase Two Quality Gates"
Cohesion: 0.40
Nodes (5): Phase 2 Code Review, Phase 2 Code Review Fixes, Phase 2 Security Audit, Phase 2 Validation Strategy, Phase 2 Final Verification

### Community 45 - "Vacation Requirements"
Cohesion: 0.40
Nodes (5): VAC-01: enter vacation dates, VAC-02: отпускные ст.139 average-earnings calc, VAC-03: simplified-calculation disclosure, Phase 3: Vacation Pay, Decision: bonus type split premия/компенсация (D-V02)

### Community 46 - "Service Worker Configuration"
Cohesion: 0.40
Nodes (3): nextConfig, serwist, WorkerGlobalScope

### Community 47 - "Deployment Platforms"
Cohesion: 0.50
Nodes (4): Fly.io (alternative), Railway (alternative), Neon Branching, Vercel CLI/Dashboard

### Community 48 - "Core Payroll Documentation"
Cohesion: 0.50
Nodes (4): Core Payroll Loop Decisions, Phase One Decision History, Core Payroll Loop Research, Payroll Walking Skeleton

### Community 49 - "Bonus Editing Decisions"
Cohesion: 0.50
Nodes (4): BonusRow Edit-Form Resync Plan, BonusRow Edit-Form Resync, Bonus Product Decisions, Bonus Decision History

### Community 50 - "Zero-State UX"
Cohesion: 0.50
Nodes (4): Decision: never render computed ₽0 as a confirmed result — extended to annual pie chart, Pitfall: Visual Regression Passes Silently in jsdom Tests, Pattern: never render computed ₽0 as confirmed amount, WINDOWS #2: AnnualPieChart render unrun-verify (fixed)

### Community 51 - "Playwright MCP Config"
Cohesion: 0.50
Nodes (3): npx, playwright, @playwright/mcp

### Community 52 - "CI Alternatives"
Cohesion: 1.00
Nodes (3): GitHub Actions CI Gate Plan, Persistent Staging Environment Plan (Option A, later dropped), GitHub Actions CI Workflow (proposed)

## Ambiguous Edges - Review These
- `Persistent Staging Environment Plan (Option A, later dropped)` → `Persistent Staging Environment Plan (Option A, later dropped)`  [AMBIGUOUS]
  .planning/research/ARCHITECTURE.md · relation: conceptually_related_to

## Knowledge Gaps
- **278 isolated node(s):** `npx`, `@playwright/mcp`, `__dirname`, `BRANCH_ID_FILE`, `ENV_LOCAL_FILE` (+273 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 366 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Persistent Staging Environment Plan (Option A, later dropped)` and `Persistent Staging Environment Plan (Option A, later dropped)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `LoginPage()` connect `Authentication UI` to `Standalone PWA Detection`, `Auth Redirect Verification`, `Visual Design System`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `SEC-02: hardcoded generic login error (no error.message/code pass-through)` connect `Visual Design System` to `Authentication UI`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **What connects `npx`, `@playwright/mcp`, `__dirname` to the rest of the system?**
  _278 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Payroll Forecast Domain` be split into smaller, more focused modules?**
  _Cohesion score 0.07993730407523511 - nodes in this community are weakly interconnected._
- **Should `Test Utilities and Scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.07276995305164319 - nodes in this community are weakly interconnected._
- **Should `Payroll Setup Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.06240084611316764 - nodes in this community are weakly interconnected._