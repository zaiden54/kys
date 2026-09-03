# Graph Report - kys  (2026-09-03)

## Corpus Check
- 297 files · ~406,311 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 988 nodes · 1929 edges · 82 communities (48 shown, 32 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 83 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5b7c0f9d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- salary-repository.ts
- Phase 07: Code Review Report
- actions/salary.ts
- (app)/page.tsx
- vacation-repository.ts
- devDependencies
- Phase 8 Plan 01: Design Tokens, Shared Shell & Home Screen Tracer
- dependencies
- compilerOptions
- login/page.tsx
- Plan 01-04: Salary, schedule, and YTD input slice
- Phase 4 Annual Overview and PWA Verification Report
- ndfl-brackets.ts
- verify-auth-security.mjs
- Phase quick/260903-k9n Plan 01: UI/UX Improvements From Design Review Summary
- Vacation Pay Context
- Dynamic Better Auth Base URL Resolution
- Phase 1: Core Payroll Loop
- GET
- PostgreSQL via Neon
- Phase 4 Plan 02: PWA Installability
- Bonus Creation and Forecast Tracer
- e2e job (isolated Neon branch)
- Auth No-Redirect Bug (router.push without refresh)
- Phase 8: Visual Redesign, Accessibility & PWA Safe-Area
- Next.js 16.3.3 App Router
- Phase 6: Auth Security Hardening
- v1.1 Research Summary
- Phase 6 Plan 01: Auth Security Hardening
- InstallBanner
- Phase 7: E2E Test Suite
- session.ts
- Phase 5: Deploy Pipeline & Environment Config
- useIsStandalone
- Phase 4 Plan 03: Auth Redirect Fix (G-04-2)
- manifest
- v1.1 Retrospective
- bonus-form.test.ts
- bonus-row.test.ts
- app/layout.tsx
- pay-setup-forms.test.ts
- Phase One Goal Verification
- Phase 2 Code Review Fixes
- sw.ts
- Vercel CLI/Dashboard
- Core Payroll Loop Decisions
- BonusRow Edit-Form Resync Plan
- v1.0 Retrospective
- playwright
- Chart.js (alternative)
- Phase 03 Code Review Fix Report
- Pitfall: GitHub Actions Secrets Scoped to Wrong Environment
- Next.js Breaking-Changes Notice
- eslint.config.mjs
- postcss.config.mjs
- Document representation
- GSD Workflow Enforcement
- НаРуки Project
- date-fns 4.4.0
- Drizzle Studio
- @t3-oss/env-nextjs
- Vitest 4.1.11
- Decision: CSS design tokens declared dark-mode-first
- Decision: automatic отпускные via 12-month average, real calendar-day proration
- Auth Flow (session.ts/Server Actions/auth-client.ts)
- Anti-Features (SMS 2FA, audit log, offline sync, tax refactor)
- Table Stakes: Auth Security & UX
- Differentiators (undo, export, biometrics, multi-currency)
- Table Stakes: E2E Testing (Golden Path)
- Table Stakes: iOS PWA UX & Safety
- Table Stakes: Release Workflow
- Pitfall: PWA Manifest Icons Inaccessible After Redesign
- Better Auth URL Management Across Vercel Environments
- Playwright MCP 1.62.1 (AI-assisted test writing)
- WINDOWS #5: Wave 2 worktrees missing live creds (fixed)
- Globe Icon (Next.js scaffold asset)
- Next.js Logo (SVG)
- Vercel Logo
- Window Icon (Browser Window Pictogram)
- { signUp, signIn, signOut, useSession }

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
- `LoginPage()` --implements--> `G-04-2: router.refresh() before router.push() fix`  [EXTRACTED]
  src/app/(auth)/login/page.tsx → .planning/milestones/v1.0-phases/04-annual-overview-pwa-installability/04-03-PLAN.md
- `LoginPage()` --implements--> `SEC-02: hardcoded generic login error (no error.message/code pass-through)`  [EXTRACTED]
  src/app/(auth)/login/page.tsx → .planning/milestones/v1.1-phases/06-auth-security-hardening/06-01-PLAN.md
- `LoginPage()` --implements--> `Phase 4 Plan 03: Auth Redirect Fix (G-04-2)`  [EXTRACTED]
  src/app/(auth)/login/page.tsx → .planning/milestones/v1.0-phases/04-annual-overview-pwa-installability/04-03-PLAN.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Auth No-Redirect Bug Investigation Group** — _planning_debug_auth_no_redirect_standalone_bug, _planning_debug_auth_no_redirect_standalone_login_page, _planning_debug_auth_no_redirect_standalone_register_page, _planning_debug_auth_no_redirect_standalone_session_ts, _planning_debug_auth_no_redirect_standalone_app_layout [EXTRACTED 0.90]
- **Phase 8 Code Review -> Fix -> Gap Closure -> Re-Verification Loop** — planning_milestones_v1_1_phases_08_visual_redesign_accessibility_pwa_safe_area_08_review_doc, planning_milestones_v1_1_phases_08_visual_redesign_accessibility_pwa_safe_area_08_review_fix_doc, planning_milestones_v1_1_phases_08_visual_redesign_accessibility_pwa_safe_area_08_07_plan_doc, planning_milestones_v1_1_phases_08_visual_redesign_accessibility_pwa_safe_area_08_verification_doc [EXTRACTED 0.90]
- **Phase 8 SEC-02 Security-Boundary Preservation During Restyle** — planning_milestones_v1_1_phases_08_visual_redesign_accessibility_pwa_safe_area_08_05_plan_doc, planning_milestones_v1_1_phases_08_visual_redesign_accessibility_pwa_safe_area_08_05_summary_doc, concept_sec_02_generic_login_error [EXTRACTED 0.90]
- **Phase 7 Review-Fix-Verify Quality Loop** — doc_review, doc_reviewfix, doc_verification [EXTRACTED 0.95]
- **Phase 8 Wave-2 Per-Screen Restyle Plans (Bonuses, Vacations, Forms, Auth)** — planning_milestones_v1_1_phases_08_visual_redesign_accessibility_pwa_safe_area_08_02_plan_doc, planning_milestones_v1_1_phases_08_visual_redesign_accessibility_pwa_safe_area_08_03_plan_doc, planning_milestones_v1_1_phases_08_visual_redesign_accessibility_pwa_safe_area_08_04_plan_doc, planning_milestones_v1_1_phases_08_visual_redesign_accessibility_pwa_safe_area_08_05_plan_doc, planning_milestones_v1_1_phases_08_visual_redesign_accessibility_pwa_safe_area_08_01_plan_doc [EXTRACTED 0.95]
- **Bonus Phase Plan and Summary Chain** — _planning_milestones_v1_0_phases_02_bonuses_one_off_payments_02_01_plan_bonus_creation_forecast_plan, _planning_milestones_v1_0_phases_02_bonuses_one_off_payments_02_01_summary_bonus_creation_forecast, _planning_milestones_v1_0_phases_02_bonuses_one_off_payments_02_02_plan_bonus_edit_history_plan, _planning_milestones_v1_0_phases_02_bonuses_one_off_payments_02_02_summary_bonus_edit_history, _planning_milestones_v1_0_phases_02_bonuses_one_off_payments_02_03_plan_bonus_gap_closure_plan, _planning_milestones_v1_0_phases_02_bonuses_one_off_payments_02_03_summary_bonus_gap_closure [EXTRACTED 1.00]
- **G-04-2 gap: discovery in UAT, closure plan, summary, and re-verification** — planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_uat, planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_03_plan, planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_03_summary, planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_verification [EXTRACTED 1.00]
- **CI Neon Branch Lifecycle Scripts** — e2e_global_setup, e2e_global_teardown, e2e_ci_branch_setup, e2e_ci_branch_teardown [EXTRACTED 1.00]
- **Phase 4 plan waves delivering HOME-02 and PWA-01** — planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_01_plan, planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_02_plan, planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_03_plan [EXTRACTED 1.00]
- **Phase 6 SEC-01/02/03 hardening decision chain** — planning_milestones_v1_1_phases_06_auth_security_hardening_06_context, planning_milestones_v1_1_phases_06_auth_security_hardening_06_research, planning_milestones_v1_1_phases_06_auth_security_hardening_06_01_plan, planning_milestones_v1_1_phases_06_auth_security_hardening_06_verification [EXTRACTED 1.00]
- **Phase Five Plan and Summary Delivery Chain** — _planning_milestones_v1_1_phases_05_deploy_pipeline_environment_config_05_01_plan_dynamic_auth_origin_plan, _planning_milestones_v1_1_phases_05_deploy_pipeline_environment_config_05_01_summary_dynamic_auth_origin, _planning_milestones_v1_1_phases_05_deploy_pipeline_environment_config_05_02_plan_ci_baseline_plan, _planning_milestones_v1_1_phases_05_deploy_pipeline_environment_config_05_02_summary_ci_baseline, _planning_milestones_v1_1_phases_05_deploy_pipeline_environment_config_05_03_plan_ci_branch_protection_plan, _planning_milestones_v1_1_phases_05_deploy_pipeline_environment_config_05_03_summary_ci_branch_protection, _planning_milestones_v1_1_phases_05_deploy_pipeline_environment_config_05_04_plan_deployment_procedure_plan, _planning_milestones_v1_1_phases_05_deploy_pipeline_environment_config_05_04_summary_deployment_procedure [EXTRACTED 1.00]
- **v1.0 MVP Phase Sequence** — _planning_milestones_v1_0_roadmap_phase_1, _planning_milestones_v1_0_roadmap_phase_2, _planning_milestones_v1_0_roadmap_phase_3, _planning_milestones_v1_0_roadmap_phase_4 [EXTRACTED 1.00]
- **v1.1 Полировка MVP Phase Sequence** — _planning_milestones_v1_1_roadmap_phase_5, _planning_milestones_v1_1_roadmap_phase_6, _planning_milestones_v1_1_roadmap_phase_7, _planning_milestones_v1_1_roadmap_phase_8 [EXTRACTED 1.00]
- **Vacation Phase Plan Execution Chain** — _planning_milestones_v1_0_phases_03_vacation_pay_03_01_plan_foundation_plan, _planning_milestones_v1_0_phases_03_vacation_pay_03_02_plan_bonus_type_plan, _planning_milestones_v1_0_phases_03_vacation_pay_03_03_plan_repository_plan, _planning_milestones_v1_0_phases_03_vacation_pay_03_04_plan_ui_forecast_plan [EXTRACTED 1.00]
- **Phase 7 E2E Test Suite Plan Sequence** — doc_plan01, doc_plan02, doc_plan03, doc_plan04, doc_plan05 [INFERRED 0.85]
- **Phase 04 Annual Overview Delivery** — _planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_context_phase_4_context, _planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_01_plan_annual_summary_engine_plan, _planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_01_summary_annual_summary_engine_summary, _planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_verification_phase_4_verification_report [INFERRED 0.85]
- **Phase 04 PWA Installability Delivery** — _planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_research_serwist_pwa_configuration, _planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_02_plan_pwa_installability_plan, _planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_02_summary_pwa_installability_summary, _planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_uat_phase_04_uat, _planning_milestones_v1_0_phases_04_annual_overview_pwa_installability_04_verification_phase_4_verification_report [INFERRED 0.85]
- **Phase Five Assurance Artifacts** — _planning_milestones_v1_1_phases_05_deploy_pipeline_environment_config_05_review_deployment_code_review, _planning_milestones_v1_1_phases_05_deploy_pipeline_environment_config_05_review_fix_deployment_review_fixes, _planning_milestones_v1_1_phases_05_deploy_pipeline_environment_config_05_validation_deployment_validation_strategy, _planning_milestones_v1_1_phases_05_deploy_pipeline_environment_config_05_verification_deployment_verification [INFERRED 0.85]
- **Phase One Assurance Artifacts** — _planning_milestones_v1_0_phases_01_core_payroll_loop_01_review_phase_one_code_review, _planning_milestones_v1_0_phases_01_core_payroll_loop_01_security_phase_one_security_audit, _planning_milestones_v1_0_phases_01_core_payroll_loop_01_validation_phase_one_validation_strategy, _planning_milestones_v1_0_phases_01_core_payroll_loop_01_verification_phase_one_verification [INFERRED 0.85]
- **Phase 2 Quality Gates** — _planning_milestones_v1_0_phases_02_bonuses_one_off_payments_02_review_code_review, _planning_milestones_v1_0_phases_02_bonuses_one_off_payments_02_security_security_audit, _planning_milestones_v1_0_phases_02_bonuses_one_off_payments_02_validation_validation_strategy, _planning_milestones_v1_0_phases_02_bonuses_one_off_payments_02_verification_final_verification [INFERRED 0.85]

## Communities (82 total, 32 thin omitted)

### Community 0 - "salary-repository.ts"
Cohesion: 0.06
Nodes (78): AnnualEvent, AnnualSummaryResult, computeAnnualSummary(), forecastNextPayment(), ForecastResult, selectNextPaymentEvent(), TODO: pre-existing bug (not caused by Phase 5) — forecastNextPayment does not…, TODO: pre-existing bug (not caused by Phase 5) — forecastNextPayment does not… (+70 more)

### Community 1 - "Phase 07: Code Review Report"
Cohesion: 0.07
Nodes (50): .github/workflows/ci.yml, .mcp.json, CI-Only Neon Branch Lifecycle Pattern, Gross = Tax + Net Two-Slice Invariant, Neon Management API, Package Legitimacy Gate, Playwright MCP, Playwright globalSetup-after-webServer Ordering Bug (+42 more)

### Community 2 - "actions/salary.ts"
Cohesion: 0.06
Nodes (57): PAY_SETUP_PATHS, revalidatePaySetupPaths(), SalaryActionResult, saveSalaryAction(), confirmation(), saveScheduleAction(), saveYtdBaselineAction(), ScheduleActionResult (+49 more)

### Community 3 - "(app)/page.tsx"
Cohesion: 0.07
Nodes (35): AnnualSummary, BonusActionResult, deleteBonusAction(), revalidateBonusPaths(), saveBonusAction(), mocks, NextPaymentForecast, BonusForm() (+27 more)

### Community 4 - "vacation-repository.ts"
Cohesion: 0.11
Nodes (23): deleteVacationAction(), revalidateVacationPaths(), saveVacationAction(), mocks, VacationActionResult, toFormData(), VacationForm(), onSubmit() (+15 more)

### Community 5 - "devDependencies"
Cohesion: 0.05
Nodes (43): drizzle-kit, eslint, eslint-config-next, jsdom, devDependencies, drizzle-kit, eslint, eslint-config-next (+35 more)

### Community 6 - "Phase 8 Plan 01: Design Tokens, Shared Shell & Home Screen Tracer"
Cohesion: 0.16
Nodes (43): Account-enumeration protection (no signal to distinguish wrong-password vs unknown-email), Annual Pie Chart Zero-Income Empty State, Frozen Calculation Engine Constraint (Zero Change to src/domain, src/lib/db), Dark-Base / Light-Override CSS Variable Polarity, CSS Variable Design Token System (color/typography/spacing/font-family), Focus-Visible Outline Accessibility Pattern, Safe-Area Inset Single Source of Truth ((app) layout header/main), Salary Overwrite Confirmation Panel (Struck-Through Old / Conditional-Accent New) (+35 more)

### Community 7 - "dependencies"
Cohesion: 0.06
Nodes (35): better-auth, @better-auth/drizzle-adapter, date-fns, date-holidays, drizzle-orm, drizzle-zod, @hookform/resolvers, @neondatabase/serverless (+27 more)

### Community 8 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 9 - "login/page.tsx"
Cohesion: 0.14
Nodes (9): LoginInput, LoginPage(), loginSchema, { pushMock, refreshMock }, RegisterInput, RegisterPage(), registerSchema, { pushMock, refreshMock } (+1 more)

### Community 10 - "Plan 01-04: Salary, schedule, and YTD input slice"
Cohesion: 0.11
Nodes (21): Plan 01-01: Application scaffold, Neon schema, and Better Auth, Summary 01-01: Core scaffold completed, Plan 01-02: Authenticated walking skeleton, Summary 01-02: Authentication mounted, Plan 01-03: Pure tax and schedule engines, Summary 01-03: Tax and schedule engines completed, Plan 01-04: Salary, schedule, and YTD input slice, Summary 01-04: Pay setup input slice completed (+13 more)

### Community 11 - "Phase 4 Annual Overview and PWA Verification Report"
Cohesion: 0.10
Nodes (21): Phase 3 UI Design Contract, Phase 03 Validation Strategy, Phase 3 Vacation Pay Verification Report, Annual Summary Engine Plan, Annual Summary Engine and Recharts Summary, PWA Installability Plan, PWA Installability Summary, Auth Redirect Fix Plan (+13 more)

### Community 12 - "ndfl-brackets.ts"
Cohesion: 0.24
Nodes (9): roundToRuble(), taxOnCumulative(), assertStrictlyAscending(), bracketsForYear(), MAX_VERIFIED_TAX_YEAR, NDFL_SCALE_2025, NDFL_SCALES, NdflBracket (+1 more)

### Community 13 - "verify-auth-security.mjs"
Cohesion: 0.16
Nodes (18): Disposable Test User + Self-Cleanup Pattern, cookieHeaderFromSetCookie(), countUsersByEmail(), createdEmails, deleteUsersByEmail(), fail(), main(), signUp() (+10 more)

### Community 14 - "Phase quick/260903-k9n Plan 01: UI/UX Improvements From Design Review Summary"
Cohesion: 0.22
Nodes (8): Deferred, Deviations from Plan, Known Stubs, Phase quick/260903-k9n Plan 01: UI/UX Improvements From Design Review Summary, Pre-existing uncommitted work found and preserved, Self-Check: PASSED, Verification, What Was Built

### Community 15 - "Vacation Pay Context"
Cohesion: 0.12
Nodes (17): Phase 2 Bonus Pattern Map, Phase 2 Bonus Research, Phase 2 UI Design Contract, Vacation Pay Foundation Plan, Vacation Pay Foundation Summary, Vacation Bonus Type Reclassification Plan, Vacation Bonus Type Reclassification Summary, Vacation Repository and Income Integration Plan (+9 more)

### Community 16 - "Dynamic Better Auth Base URL Resolution"
Cohesion: 0.12
Nodes (17): Dynamic Better Auth Origin Plan, Dynamic Better Auth Base URL Resolution, CI Baseline Cleanup Plan, CI Baseline Cleanup, CI Pipeline and Branch Protection Plan, CI Pipeline and Branch Protection, Deployment Procedure and Environment Plan, Deployment Procedure and Environment Verification (+9 more)

### Community 17 - "Phase 1: Core Payroll Loop"
Cohesion: 0.10
Nodes (26): forecastNextPayment, Blocking Gap: Exact-Date Vacation Collision, NextPaymentCard, v1.0 Milestone Audit (gaps_found), selectNextPaymentEvent, AUTH-01: register/login, AUTH-02: cloud sync across devices, BON-01: one-off bonus/compensation (+18 more)

### Community 18 - "GET"
Cohesion: 0.29
Nodes (7): GET(), getResponse(), AppleIcon(), contentType, size, PWA_ICON_BACKGROUND_HEX, renderPwaIconMarkup()

### Community 19 - "PostgreSQL via Neon"
Cohesion: 0.17
Nodes (13): Clerk (alternative), Prisma v7 (alternative), Supabase (alternative), Firebase/Firestore/MongoDB (avoid), NextAuth.js v4 (avoid), PlanetScale (avoid), Dedicated time-series DB (avoid), Better Auth 1.7.2 (+5 more)

### Community 20 - "Phase 4 Plan 02: PWA Installability"
Cohesion: 0.17
Nodes (14): WR-01: YTD baseline never taxed in computeAnnualSummary (overstates На руки), CR-01: useIsStandalone SSR/hydration mismatch, Phase 4 Plan 01: Annual Summary Engine + Recharts Chart, Phase 4 Plan 01 Summary, Phase 4 Plan 02: PWA Installability, Phase 4 Plan 02 Summary, Phase 4 Plan 03 Summary, Phase 4 Context (+6 more)

### Community 21 - "Bonus Creation and Forecast Tracer"
Cohesion: 0.21
Nodes (12): Consent-Bound Salary Replacement, Calendar and Authentication-Secret Gap Closure Plan, Calendar and Authentication-Secret Validation, Core Payroll Gap-Closure Pattern Map, Phase One Code Review, Phase One Deployment Setup, Bonus Creation and Forecast Plan, Bonus Creation and Forecast Tracer (+4 more)

### Community 22 - "e2e job (isolated Neon branch)"
Cohesion: 0.20
Nodes (11): Playwright 1.62.1, e2e/ci-branch-teardown.mjs (referenced), e2e job (isolated Neon branch), src/env.ts (referenced), e2e/global-teardown.ts (referenced), ci job (lint/typecheck/unit-tests/build), src/lib/auth.ts (referenced), src/lib/db/index.ts (referenced, neon-http driver) (+3 more)

### Community 23 - "Auth No-Redirect Bug (router.push without refresh)"
Cohesion: 0.15
Nodes (14): (app)/layout.tsx (getSessionUser gate), Auth No-Redirect Bug (router.push without refresh), router.refresh() before router.push() fix, src/app/(auth)/login/page.tsx, Next.js bundled App Router auth guide (canonical Server Action redirect), src/app/(auth)/register/page.tsx, login/page.render.test.tsx (mocked useRouter blind spot), src/lib/session.ts (requireUserId) (+6 more)

### Community 24 - "Phase 8: Visual Redesign, Accessibility & PWA Safe-Area"
Cohesion: 0.18
Nodes (11): PWA-01 (v1.1): safe-area-inset header/nav, PWA-02: viewport-fit=cover on real/simulated iPhone, UI-01: empty/loading/error states, UI-02: uniform money formatting, UI-03: destructive-action confirmation dialogs, UI-04: return-to-home from any screen, UI-05: visual redesign via frontend-design skill, UI-06: system dark theme support (+3 more)

### Community 25 - "Next.js 16.3.3 App Router"
Cohesion: 0.20
Nodes (10): next-pwa (avoid), Client-side offline-first sync engines (avoid), TypeScript 7.0.x (avoid for now), Next.js 16.3.3 App Router, React 19.2.8, Serwist (@serwist/next), TypeScript 6.0.3, typescript-eslint compatibility gap (+2 more)

### Community 26 - "Phase 6: Auth Security Hardening"
Cohesion: 0.22
Nodes (10): Debug KB Entry: password-visible-devtools, Password Visible in DevTools (misinterpretation), TLS Transport Confirmed Secure (no-code resolution), scripts/verify-auth-security.mjs, SEC-01: no password leak in URL/logs, SEC-02: generic auth errors (no enumeration), SEC-03: httpOnly/secure session cookie, Phase 6: Auth Security Hardening (+2 more)

### Community 27 - "v1.1 Research Summary"
Cohesion: 0.18
Nodes (12): DEPLOY-05: no double-deploy race, GitHub Actions CI Gate Plan, Playwright e2e Integration Plan, Route Structure ((auth)/(app) route groups), Persistent Staging Environment Plan (Option A, later dropped), Table Stakes: UI/UX Foundations, Pitfall: Double Deployment Race, GitHub Actions CI Workflow (proposed) (+4 more)

### Community 28 - "Phase 6 Plan 01: Auth Security Hardening"
Cohesion: 0.25
Nodes (11): G-04-2: router.refresh() before router.push() fix, Phase 6 Plan 01: Auth Security Hardening, Phase 6 Plan 01 Summary, Phase 6 Context, Phase 6 Pattern Map, Phase 6 Research, Phase 6 Code Review Report, Phase 6 Code Review Fix Report (+3 more)

### Community 29 - "InstallBanner"
Cohesion: 0.33
Nodes (6): getDismissedServerSnapshot(), getDismissedSnapshot(), InstallBanner(), handleDismiss(), setDismissedFlag(), subscribeToDismissed()

### Community 30 - "Phase 7: E2E Test Suite"
Cohesion: 0.22
Nodes (9): e2e/ci-branch-setup.mjs (referenced), E2E-01: golden-path smoke test, E2E-02: bonus add/edit/delete coverage, E2E-03: vacation add/edit/delete coverage, E2E-04: annual pie summary + PWA install coverage, E2E-05: Playwright MCP integration, E2E-06: isolated Neon branch in CI, Phase 7: E2E Test Suite (+1 more)

### Community 31 - "session.ts"
Cohesion: 0.08
Nodes (20): { GET, POST }, AppLayout(), AppNavigation(), groups, IconProps, isActive(), NavGroup, NavItem (+12 more)

### Community 32 - "Phase 5: Deploy Pipeline & Environment Config"
Cohesion: 0.18
Nodes (11): v1.1 Milestone Audit (tech_debt only, no blockers), DEPLOY-01: isolated per-PR preview environments, DEPLOY-02: env vars scoped per environment, DEPLOY-03: GitHub Actions blocks merge on failure, DEPLOY-04: documented release cycle, SEC-04: dynamic BETTER_AUTH_URL/allowed-hosts, Phase 5: Deploy Pipeline & Environment Config, BETTER_AUTH_URL Dynamic Derivation Pattern (+3 more)

### Community 33 - "useIsStandalone"
Cohesion: 0.43
Nodes (6): iOS standalone-PWA storage-jar re-login expectation, detectStandalone(), getStandaloneServerSnapshot(), Navigator, subscribeToStandalone(), useIsStandalone()

### Community 34 - "Phase 4 Plan 03: Auth Redirect Fix (G-04-2)"
Cohesion: 0.43
Nodes (7): Manual-only real-device/deployment verification (cannot be scripted in sandbox), Debug session: auth-no-redirect-standalone, Phase 4 Plan 03: Auth Redirect Fix (G-04-2), Phase 4 UAT Log, Phase 4 Validation Strategy, Phase 4 Verification Report, Phase 6 Validation Strategy

### Community 38 - "v1.1 Retrospective"
Cohesion: 0.29
Nodes (7): Decision: separate --color-accent-button token for WCAG AA contrast, Pitfall: Playwright Pass Locally, Fail in CI (Headless Differences), Pitfall: Playwright Flake From Auth/DB State Pollution, Pattern: provision Neon CI branch before test:e2e, not inside globalSetup, Pattern: CSS tokens dark-mode-first with light override, Pattern: verify WCAG contrast independently per role (text vs background), v1.1 Retrospective

### Community 39 - "bonus-form.test.ts"
Cohesion: 0.33
Nodes (4): descendants(), sourceFile, sourcePath, sourceText

### Community 40 - "bonus-row.test.ts"
Cohesion: 0.33
Nodes (4): descendants(), sourceFile, sourcePath, sourceText

### Community 41 - "app/layout.tsx"
Cohesion: 0.33
Nodes (4): geistMono, geistSans, metadata, viewport

### Community 42 - "pay-setup-forms.test.ts"
Cohesion: 0.33
Nodes (4): descendants(), sourceFile, sourcePath, sourceText

### Community 43 - "Phase One Goal Verification"
Cohesion: 0.40
Nodes (5): Phase One Security Audit, Phase One User Acceptance Testing, Phase One Validation Strategy, Phase One Goal Verification, Phase One API Coverage Decision

### Community 44 - "Phase 2 Code Review Fixes"
Cohesion: 0.40
Nodes (5): Phase 2 Code Review, Phase 2 Code Review Fixes, Phase 2 Security Audit, Phase 2 Validation Strategy, Phase 2 Final Verification

### Community 46 - "sw.ts"
Cohesion: 0.40
Nodes (3): nextConfig, serwist, WorkerGlobalScope

### Community 47 - "Vercel CLI/Dashboard"
Cohesion: 0.50
Nodes (4): Fly.io (alternative), Railway (alternative), Neon Branching, Vercel CLI/Dashboard

### Community 48 - "Core Payroll Loop Decisions"
Cohesion: 0.50
Nodes (4): Core Payroll Loop Decisions, Phase One Decision History, Core Payroll Loop Research, Payroll Walking Skeleton

### Community 49 - "BonusRow Edit-Form Resync Plan"
Cohesion: 0.50
Nodes (4): BonusRow Edit-Form Resync Plan, BonusRow Edit-Form Resync, Bonus Product Decisions, Bonus Decision History

### Community 50 - "v1.0 Retrospective"
Cohesion: 0.22
Nodes (8): v1.0 MVP Milestone, v1.1 Полировка MVP Milestone, Decision: never render computed ₽0 as a confirmed result — extended to annual pie chart, Pitfall: Visual Regression Passes Silently in jsdom Tests, Pattern: never render computed ₽0 as confirmed amount, Pattern: router.refresh() before router.push() after client auth, v1.0 Retrospective, WINDOWS #2: AnnualPieChart render unrun-verify (fixed)

### Community 51 - "playwright"
Cohesion: 0.50
Nodes (3): npx, playwright, @playwright/mcp

## Ambiguous Edges - Review These
- `Persistent Staging Environment Plan (Option A, later dropped)` → `Persistent Staging Environment Plan (Option A, later dropped)`  [AMBIGUOUS]
  .planning/research/ARCHITECTURE.md · relation: conceptually_related_to

## Knowledge Gaps
- **288 isolated node(s):** `npx`, `@playwright/mcp`, `__dirname`, `BRANCH_ID_FILE`, `ENV_LOCAL_FILE` (+283 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 382 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Persistent Staging Environment Plan (Option A, later dropped)` and `Persistent Staging Environment Plan (Option A, later dropped)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `LoginPage()` connect `login/page.tsx` to `useIsStandalone`, `Phase 4 Plan 03: Auth Redirect Fix (G-04-2)`, `Phase 6 Plan 01: Auth Security Hardening`, `Phase 8 Plan 01: Design Tokens, Shared Shell & Home Screen Tracer`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `SEC-02: hardcoded generic login error (no error.message/code pass-through)` connect `Phase 8 Plan 01: Design Tokens, Shared Shell & Home Screen Tracer` to `login/page.tsx`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **What connects `npx`, `@playwright/mcp`, `__dirname` to the rest of the system?**
  _288 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `salary-repository.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06404586404586404 - nodes in this community are weakly interconnected._
- **Should `Phase 07: Code Review Report` be split into smaller, more focused modules?**
  _Cohesion score 0.07364185110663984 - nodes in this community are weakly interconnected._
- **Should `actions/salary.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06105834464043419 - nodes in this community are weakly interconnected._