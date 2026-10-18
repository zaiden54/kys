# Feature Landscape: v1.1 Production Polish

**Project:** НаРуки (Russian PWA Payroll Calculator)  
**Milestone:** v1.1 — Production Quality Polish  
**Researched:** 2026-09-01  
**Confidence:** HIGH

## Executive Summary

v1.1 focuses on bringing v1.0's functional MVP to production-grade polish across five domains: visual design, iOS PWA UX, auth security, E2E test coverage, and release workflow. The research reveals clear "table stakes" patterns expected in polished personal-finance PWAs at this scale, valuable differentiators for a small solo/small-team project, and several "anti-features"—enterprise-grade patterns that would be overkill or actively harmful to velocity.

The key insight: personal-finance users expect **scrupulous clarity about money and state** (no ambiguity, no missing edge cases) and **a feeling of control** (easy undo, clear confirmations, no hidden fees). UI polish serves that clarity. iOS PWA safety handling and auth security serve that trust. Testing and release workflow prevent regressions that break both.

---

## Table Stakes

Features users expect. Missing or poorly implemented = product feels incomplete or untrustworthy.

### UI/UX Foundations

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Empty states** on first login / no salary data | Guidance on next step (e.g., "Enter your salary to get started"), not a blank screen | Low | Skeleton screens preferred over spinners; shows users what to expect. ~30% of UX time spent in off-happy-path states (empty/loading/error). |
| **Loading states** with skeleton screens on data fetch | Reduce perceived load time, prevent layout shift when real content arrives | Low | Pulse animation recommended. Critical for salary history, bonus list, vacation list on slow networks. |
| **Error messages** — clear, non-technical, actionable | Generic "Error" is untrustworthy in finance; show what went wrong and what user should do | Low | Example: "Salary not updated — check your connection and try again" vs. "500 Internal Server Error". |
| **Data state clarity** (pending, processing, confirmed, failed) | Transaction/entry states must be explicit; users tolerate delays more than ambiguity | Low | For salary changes, bonus entries, vacation submissions — each should show confirmation status. |
| **Consistent money formatting** (rubles, decimal precision, tabular figures) | All monetary amounts formatted identically across screens (e.g., "12 345,67₽" with non-breaking spaces, consistent decimal places) | Low | Use Intl.NumberFormat or locale-aware library; avoid hand-rolled formatting. Tabular figures (fixed-width digits) recommended for financial tables. |
| **Form validation feedback** (per-field errors, not just submit-time) | Guide user through multi-step forms (salary amount + pay schedule + effective date); show which fields are required/invalid before they submit | Low | Use React Hook Form + Zod patterns already in codebase; validate amount > 0, dates are valid calendar days, pay schedule days exist (1–31). |
| **Confirmation dialogs** for destructive actions (salary override, bonus delete, vacation cancel) | Prevent accidental loss of salary history; show what will change before committing | Low | Show calculated next payment before and after change so user can verify. |
| **Accessible color contrast & dark mode** | WCAG AA compliance (4.5:1 text/background); both light and dark schemes functional | Medium | iOS PWA often launches in light or dark mode depending on system settings; app must remain readable in both. |
| **Action-oriented design** (balance + recent transactions + next steps) | Finance apps should pair information with action: low balance sits next to a way to transfer funds, pending payment offers tracking options | Low | Home screen: next payment date/amount (actionable) + annual summary (informational) + navigation to edit salary/add bonus. |

### iOS PWA UX & Safety

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Safe-area CSS insets** (top/bottom/left/right padding around notch, Dynamic Island, home indicator) | Without this, fixed headers/footers hide behind hardware features on iPhone 13/14/15+; looks broken | Low | Use `env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`, etc. in CSS with fallbacks (e.g., `padding: env(safe-area-inset-top, 0px)`). Conservative landscape buffer of ~20px from top. |
| **Viewport-fit=cover + safe-area handling** | Enables full-screen PWA feel; requires careful CSS to avoid content behind Dynamic Island | Low | Already in CLAUDE.md requirements ("хедер/навигация уважают `env(safe-area-inset-top/bottom)`"). Dynamic Island vs. notch handled identically via env() vars; Dynamic Island may report 30% more inset space. |
| **Bottom navigation or action bar** respects home indicator safe area | Fixed bottom UI (nav, buttons) must not be hidden behind home indicator swipe zone on iPhone | Low–Medium | iOS PWA viewport shifts on scroll; fixed bottom must account for safe-area-inset-bottom or will shift unexpectedly. Test on actual device or iOS simulator. |
| **Standalone mode detection** (navigator.standalone or media query) | App can adapt UI if launched from home screen vs. browser tab (e.g., hide "Add to Home Screen" prompt if already standalone) | Low | Rarely needed in this app, but useful to avoid confusion. |
| **No offline requirement, but clean service worker** | Serwist configured with empty precache (no offline caching yet per v1 scope); service worker must be minimal and active for install-ability | Low | Aligns with CLAUDE.md decision; revisit if v2 adds offline. |

### Auth Security & UX

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **HTTPS only, SameSite cookies** (Lax or Strict) | Prevent credential leakage and CSRF attacks on banking data | Low | Vercel auto-enforces HTTPS; Better Auth handles SameSite by default. |
| **httpOnly, secure session cookies** | Prevent JavaScript credential theft; XSS can't leak sessions if they're httpOnly | Low | Better Auth default; verify in browser dev tools (Network tab) that session cookies have httpOnly flag. |
| **Generic error messages** on login/register failures | Never reveal if email exists/doesn't exist (user enumeration attack); never show "Invalid password" vs. "Invalid email" | Low | Say "Incorrect email or password" for both cases. Prevents attackers from enumerating valid user accounts. |
| **Origin ↔ Host header verification** for Server Actions | Next.js built-in CSRF check; verify POST requests come from same host | Low | Automatic in Next.js App Router Server Actions; custom API Routes need manual verification via headers. |
| **No credentials in URL/logs/Network tab** | Password/session tokens must never appear in browser address bar, server logs, or Network tab | Medium | Test via browser DevTools: type on login form, check URL bar (should be POST to `/api/auth/...` without password param), check Network tab request body (no password), check browser console logs (no password dump). Better Auth + Server Actions should naturally avoid this, but confirm via UAT. |
| **Password reset flow with time-limited token** | Secure way to recover access without storing plaintext or sending password via email | Low | Better Auth includes reset flow; verify it uses secure token generation and ~15–30 min expiry. |
| **No "Remember me" with extended session TTL** on shared devices | 30-day session TTL appropriate for personal device; longer than that risks credential reuse on borrowed phone | Low | Current Better Auth config is 30 days; keep it. Avoid session extension without user re-entry. |

### E2E Testing (Golden Path)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Smoke test: login → salary entry → view next payment** | Verify core flow works end-to-end without relying on unit tests alone | Low | Single Playwright test, <1 min execution, catches auth/routing/DB/UI breakage at once. |
| **Register → login → add salary → verify home screen calculation** | Full user signup journey + immediate calculation trust-building | Low | Runs once per deploy; one break here wakes someone at 2 AM. |
| **Add bonus/compensation → verify it increases next payment** | Tax calculation correctness (highest-risk code); changes to cumulative-income logic must be caught here | Low | Use realistic salary + bonus amounts to avoid rounding surprises; check calculated amount matches expected. |
| **Add vacation dates → verify отпускные calculation** | 12-month average-earnings logic correctness; one bug here is very visible to users | Medium | Requires setup: add salary → wait several pay dates (or mock time) → add vacation → verify calculation. Consider fixture data or fast-forward helper. |
| **View annual pie chart** with gross/tax/net summary | Verify chart renders, uses correct YTD calculations, responsive on mobile | Low | Screenshot test or simple assertion that chart element exists and contains expected values. |
| **Logout → verify session cleared** | Security check; logged-out user should not access `/salary` or `/bonuses` (redirected to login) | Low | Login required for most routes; middleware/Server Component checks auth status. |
| **PWA installability** (on iOS simulator or Lighthouse check) | Verify web.app manifest valid, icons present, safe-area CSS in place | Low | Lighthouse PWA audit; "Add to Home Screen" prompt should appear. Manual test on iOS simulator or device. |

### Release Workflow (Feature → Staging → Prod)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Preview deployments per PR** (Vercel auto-deploys PR branches) | Test feature branch changes before merge; isolates risky changes from prod | Low | Vercel default; no config needed. Each PR gets a unique URL (`project-name-pr-123.vercel.app`). |
| **Neon database branch per Vercel preview** | Preview URL can safely test schema changes and data mutations without touching staging/prod databases | Low–Medium | Vercel + Neon integration auto-creates `preview/<branch>` Neon branches; copy-on-write, instant, no data leaks. |
| **Persistent staging environment** (separate Vercel domain + Neon branch) | Verify feature on production-like infra before flipping the switch to prod; catch environment-specific bugs (e.g., `BETTER_AUTH_URL` misconfiguration) | Low–Medium | Set up via Vercel Settings → Environments. Staging branch auto-deploys from `staging` Git branch; staging uses its own Neon database branch. |
| **Environment variables scoped per environment** (Preview / Staging / Prod) | `BETTER_AUTH_URL` and `DATABASE_URL` differ per stage; wrong values break auth or use wrong database | Low | Vercel UI: Settings → Environment Variables → set per environment. Also check `.env.local` is gitignored (secrets must not reach repo). |
| **Manual promotion from staging → prod** (no auto-merge to main) | Team reviews staging URL before releasing; catches UX regressions or data issues before users see them | Low | Vercel Deployments → Stage & Promote; pro/team feature. Can be bypassed (force-push main to trigger prod deploy), but safer flow is stage first. |
| **GitHub Actions gate** (lint + type check + unit tests before merge) | Prevent obviously broken code reaching staging/prod (syntax errors, type mismatches, test failures) | Medium | Example: `vitest + tsc + eslint` run on every PR; fail if any check fails. Already implemented per CLAUDE.md ("GitHub Actions гейт"), verify it's enforced on main branch. |

---

## Differentiators

Features that set the product apart. Not expected, but valued when present. Low priority for v1.1 unless team explicitly prioritizes them.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Playful/branded error messages** (e.g., "Hmm, our math is broken 🤔" vs. technical error code) | Builds brand personality; finance apps are often serious, a light touch is memorable | Low | Secondary to correctness; only if visual redesign includes style guide. Avoid if it obscures the actual problem (always explain what went wrong first). |
| **Undo for recent changes** (revert last salary edit, bonus delete) | Reduces anxiety about data loss; useful if salary changes frequently | Medium | Requires audit log or version history; out of scope for v1.1 (v1.0 KEY DECISION: "Замена оклада перезаписывает значение без журнала аудита"). Revisit in v2 if users request it. |
| **Multi-currency support** (USD, EUR, etc. for expat employees) | Expands market; Russian app but some users may live abroad. Current scope is RUB only. | High | Out of v1.1; requires НДФЛ exemptions and currency conversion logic. v2 feature. |
| **Export to PDF/CSV** (salary summary, bonus history, vacation accrual) | Users may want to share with accountant or archive; improves trust ("I can verify you have my data") | Low–Medium | Client-side PDF generation via `jsPDF` or `pdfkit`; CSV is trivial. Nice-to-have, not essential for v1.1. |
| **Notification / alert on low balance forecast** (e.g., "Your next payment is in 10 days, you'll receive ₽50k") | Gentle reminder or early warning if salary looks unexpectedly low (typo catchable) | Low | Use browser Notification API (requires permission) or in-app toast. Low priority; consider if v1.1 redesign includes home screen notifications UX. |
| **Accessibility (keyboard nav, screen reader, high contrast mode)** | Compliance + ethical; personal finance app should be usable by elderly, low-vision, etc. | Medium | Existing codebase may have gaps. Audit via axe or Wave; fix critical (text contrast, button labels, form field labels). Full wcag 2.1 AA may be v2. |
| **Dark mode toggle** with system theme detection | Modern UX expectation; especially on iPhone where many apps support dark mode | Low–Medium | CSS media query `prefers-color-scheme` detects system setting; toggle to override. Verify both modes are fully tested on iOS. |
| **Biometric auth (Face ID / Touch ID) on iOS** | Faster re-entry after session expiry; improves UX for repeat users | Medium–High | Requires WebAuthn or platform-specific solution; out of v1.1 scope. v2 feature. |
| **Data export & account deletion** (GDPR/CCPA compliance) | Legal requirement in some jurisdictions; builds trust ("I can leave if I want to") | Medium | Implement user-initiated account deletion via Server Action + cascade delete from Postgres. Consider data retention policy (delete after 30 days or immediately?). Add to account settings. |

---

## Anti-Features

Features to explicitly NOT build. Overkill for this project's scale or actively harmful to momentum.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **SMS-based 2FA / MFA** | Adds operational complexity (SMS provider, phone number validation, rate limiting) without proportional security gain for a personal-finance app with <1000 users. Session theft is the real risk, not password guessing. | Focus on secure session handling (httpOnly, SameSite, CSRF checks). If team later wants 2FA, use email-based magic links (simpler to implement and UX-friendly on iPhone). |
| **Comprehensive audit log / change history for every field** | Personal-finance apps typically don't need this; users trust salary changes once they're confirmed. Audit logging adds schema complexity, storage cost, and privacy concerns. | Current compromise ("Замена оклада перезаписывает значение без журнала аудита") is correct: confirmation before overwrite + HMAC-signed value reduces race conditions but keeps schema simple. Revisit only if users explicitly ask for "show me what changed" UX. |
| **Offline-first sync with local IndexedDB cache** | v1 scope explicitly out ("Offline-режим не требуется в v1"). Building sync now is speculative complexity. iOS PWA doesn't even support Service Worker background sync reliably. | Keep current model: server-authoritative, no offline mode. If v2 adds offline, migrate to lightweight sync library (TanStack Query prefetch, not custom conflict resolution). |
| **Custom, hand-rolled НДФЛ tax engine refactor** | Tax calculations are high-risk; wrong bracket math = every number on screen is wrong. Current engine (progressive brackets, cumulative income, etc.) is proven and tested. Avoid "optimizing" or refactoring this mid-project. | Freeze tax calculation logic during v1.1 polish (only merge pure bug fixes, not refactors). Write Playwright tests around known edge cases (salary change mid-month, bonus timing, leap year). Never touch this code unless a bug is confirmed. |
| **Real-time collaboration** (multiple users editing same salary record simultaneously) | v1.0 already solved race conditions via "compare and swap" + HMAC signature per KEY DECISION 14. Adding real-time awareness (WebSockets, Yjs) would break that model and add complexity. | Current conflict-free update pattern (confirm-before-overwrite) works well for single user + multiple devices. If team wants multi-user collaboration (wife + husband budgeting together), that's a v2 scope change. |
| **Automated email notifications** on salary changes or payment forecasts | Adds email provider dependency (SendGrid, Mailgun), auth setup, rate limiting. Overkill for v1.1 (users can check app anytime). | Browser Notification API (in-app toast) is simpler and doesn't require email infrastructure. If v2 wants email digest, wire it up then. |
| **Mobile-only app using React Native or Flutter** | Tempting to "just rebuild in React Native for iOS," but team already has Next.js PWA working. Rewrite = months of lost momentum and double the testing burden. | Stick with Next.js PWA. If iOS app becomes strategic later (App Store visibility), consider sharing logic via a shared TS package (`@naruiki/tax-engine`, `@naruiki/salary-calc`) and building a native app that imports it. For now, PWA is ship-worthy. |
| **Enterprise-grade CI/CD pipeline** (GitOps, multiple approval stages, infrastructure-as-code) | Overkill for solo/small-team project. GitHub Actions gate (lint/test) + Vercel preview + manual staging promotion is sufficient. | Current setup is right-sized: git push → preview auto-deploy → manual test → push to staging branch → test → merge to main (prod deploy). No need for ArgoCD, Helm, or Terraform. |
| **Comprehensive analytics / telemetry** (event tracking, heatmaps, funnel analysis) | Privacy-sensitive app with <1000 users; heavy analytics is overkill and risks data leakage. | Light analytics if needed: page views via server logs or Vercel Analytics (privacy-friendly, minimal). Avoid client-side event tracking libraries (Mixpanel, Amplitude, Segment) until you have specific questions to answer. |
| **Internationalization (i18n)** for multiple languages (English, Spanish, German, etc.) | App is Russian-specific (НДФЛ tax rates are RU-only). i18n early adds complexity without proportional benefit. | Keep Russian as source language. If team later wants English translation (for export, or expat users), add i18n then. Do not template strings now ("The salary is X" → message ID "salary_is_x"). |
| **A/B testing framework** (feature flags, staged rollouts) | Premature for v1.1 polish. Feature flags add cognitive load; if a feature is ready, ship it. | Simple branching: feature branch → staging → manual approval → prod. If a feature breaks prod (unlikely with staging tests), revert via git revert or rollback (Vercel supports instant rollback). No need for gradual rollout orchestration. |

---

## Feature Dependencies

```
Visual Redesign (UI/UX/Components)
  ↓
iOS Safe-Area CSS Integration
  (parallel with auth security verification)
  ↓
Auth Security Verification
  (parallel with safe-area, prerequisites nothing)
  ↓
E2E Test Suite
  (validates all UI + auth + calculation changes)
  ↓
Staging & Prod Workflow
  (operational layer, independent of above)
  ↓
Final Integration & UAT
  (validates everything works together on staging URL)
  ↓
Ship to Production
```

**Non-blocking parallel work:**
- Visual redesign can happen alongside safe-area fix and auth security verification (all three touch UI/auth layers but don't conflict)
- E2E tests can be written once features are stable (can retroactively test v1.0 as-is)
- Staging/prod workflow can be set up independently (doesn't require code changes to app logic)

---

## MVP Recommendation for v1.1

**Phase Structure:** 6 phases (redesign + safe-area + security + testing + workflow + final integration)

**Prioritize (order of implementation, not time):**

1. **Auth Security Verification** (low effort, high confidence needed before UAT)
   - Audit password field behavior, error messages, credential leakage via browser DevTools
   - Verify BETTER_AUTH_URL resolves correctly on preview/staging/prod
   - Write verification test (Browser DevTools + manual login/register)
   - Output: Security audit report + fixes if needed

2. **iOS Safe-Area CSS** (low effort, blocks redesign from looking correct on iPhone)
   - Add `env(safe-area-inset-*)` to header, footer, navigation components
   - Test on iOS simulator or actual device (iPhone 14+ with Dynamic Island ideal)
   - Verify bottom nav doesn't hide behind home indicator on scroll
   - Output: CSS fixes, landing on design system

3. **Visual Redesign** via `frontend-design` skill (medium effort, longest pole)
   - Define design tokens (colors, typography, spacing, component library)
   - Redesign all screens: login, register, home/next-payment, salary entry, bonus list/form, vacation list/form, annual summary
   - Include empty states, loading states, error states for each screen
   - Verify dark mode works on both light and dark iOS themes
   - Output: Figma/design file + component CSS/Tailwind tokens

4. **E2E Test Suite** (medium effort, validates all above)
   - Write Playwright tests for golden path: register → salary → bonus → vacation → pie chart → logout
   - Test on Chrome (default) + Safari (iOS-like, most different browser)
   - Integrate with GitHub Actions gate (run on every PR)
   - Output: Tests in `tests/e2e/`, CI workflow added

5. **Staging & Prod Workflow** (low effort, unblocks team shipping)
   - Set up Vercel staging environment with own domain
   - Set up Neon staging database branch
   - Configure environment variables per stage (Preview / Staging / Prod)
   - Test deploy flow: feature branch → preview → manual push to staging → manual merge to main (prod)
   - Document release checklist
   - Output: Vercel config, documented workflow, example PR

6. **Integration & UAT** (low effort, validates everything works together)
   - Run full E2E suite on staging URL
   - Manual spot-check on iOS device/simulator: login, add salary, view next payment, add bonus, view summary
   - Verify PWA install-to-home works
   - Ship to prod via merge + Vercel auto-deploy
   - Monitor prod for errors (Vercel error logs)
   - Output: UAT sign-off, release notes, retrospective

**Defer to v1.2 or later:**
- Biometric auth (Face ID / Touch ID)
- Multi-currency support
- Undo/change history
- Email notifications
- Advanced analytics
- A/B testing
- i18n translations (beyond Russian)

---

## Complexity & Risk Notes

| Area | Complexity | Risk | Mitigation |
|------|------------|------|-----------|
| iOS safe-area CSS | Low | Visual regression (header/footer hidden on iPhone 14+) | Test on iOS simulator in Xcode (free, no device needed); also check Lighthouse PWA audit. |
| Visual redesign | Medium | Design quality, accessibility gaps, time slip | Start with design system (tokens, components) before implementing in code. Separate design phase from implementation. Use `frontend-design` skill. |
| Auth security verification | Low | Password leakage undiscovered until live user reports it | Write a Playwright test: login form → DevTools Network tab → verify no password in URL/headers/body. Manual test on staging before prod. |
| E2E tests on slow CI | Medium | Tests timeout or flake if infra is slow | Set reasonable timeouts (10–20 sec per test, not 5 min). Mock time for vacation tests (don't wait 12 months). Use Neon branching so tests have isolated DB. |
| BETTER_AUTH_URL misconfiguration | Low–Medium | Auth fails on staging/prod if URL env var is wrong | Verify in Playwright test: POST to `/api/auth/callback/credentials` should succeed if credentials valid, fail if invalid (not redirect to login infinite loop). Add to smoke test. |
| Release process confusion | Low | Developer merges to wrong branch, deploys to wrong env | Document decision tree in README or wiki. Add branch protection rules to `main` (require PR review). |

---

## Roadmap Implications

Based on this research, the v1.1 roadmap should:

1. **Start with auth security audit** (quick, unblocks confidence for UAT)
2. **Parallel: iOS safe-area CSS** (pairs with redesign, low risk)
3. **Parallel: Visual redesign via `frontend-design`** (longest pole, good to start early)
4. **Layer in E2E tests** as features stabilize (don't wait for perfect; write tests as you code)
5. **Set up staging/prod workflow early** (enables safe deployment practice mid-phase)
6. **Final phase: Integration & UAT** before shipping v1.1

**Phase ordering rationale:**
- Security & layout fixes are **low-risk, high-confidence** work; doing them first de-risks the redesign
- Visual redesign is **longest pole**, benefits from parallel safe-area CSS and auth fixes landing first
- E2E testing is **high-value but non-blocking**; can write tests alongside feature work
- Staging/prod workflow is **operational**, can be set up independently but should be live before UAT
- Final integration is a **formality** if earlier phases are solid

---

## Sources

### UI/UX Patterns, Empty States, Loading, Error States
- [Raw.Studio — Empty States, Error States & Onboarding: The Hidden UX Moments Users Notice](https://raw.studio/blog/empty-states-error-states-onboarding-the-hidden-ux-moments-users-notice/)
- [UXPin — Designing the Overlooked Empty States – UX Best Practices](https://www.uxpin.com/studio/blog/ux-best-practices-designing-the-overlooked-empty-states/)
- [UX Patterns for Developers — Empty States Pattern](https://uxpatterns.dev/patterns/user-feedback/empty-states)
- [Vibe Coder — Empty States Loading States Error States The UX AI Forgets](https://blog.vibecoder.me/empty-states-loading-states-error-states)
- [Appthetics — Budgeting Apps UX Patterns for Trustworthy Finance Products](https://www.appthetics.com/blog/budgeting-apps-ux-patterns)

### Fintech UI Design Patterns
- [Eleken — Fintech UI examples to build trust](https://www.eleken.co/blog-posts/trusted-fintech-ui-examples)
- [The Skins Factory — Fintech UI/UX Design: Best Practices for Financial Apps in 2026](https://www.theskinsfactory.com/uiux-design-blog/fintech-ui-ux-design)
- [AdminLTE — Fintech Dashboard Design: 9 Real Products, Analyzed (2026)](https://adminlte.io/blog/fintech-dashboard-design-examples/)
- [Design4Users — UI/UX Design for Finance: Smart Concepts for Fintech Digital Products](https://design4users.com/ui-ux-design-finance-fintech-digital-products/)
- [WANDR Studio — Fintech Dashboard Design Patterns and Examples](https://www.wandr.studio/blog/fintech-dashboard-design)
- [SaaS Factor — Fintech Mobile App Design: The Complete Guide 2026](https://www.saasfactor.co/blogs/fintech-mobile-app-design)
- [Art of Style Frame — Fintech Dashboard Design Patterns That Build Trust](https://artofstyleframe.com/blog/fintech-dashboard-design-patterns/)

### iOS PWA Safe-Area & Dynamic Island Handling
- [Mohammad Shehadeh — Understanding env() Safe Area Insets in CSS](https://mohammadshehadeh.com/css/safe-area-insets)
- [CSS-Tricks — "The Notch" and CSS](https://css-tricks.com/the-notch-and-css/)
- [W3C Public CSS Archive — Dynamic Island inset dimensions discussion](https://lists.w3.org/Archives/Public/public-css-archive/2025Oct/1072.html)
- [GitHub Issue — Fix iOS PWA safe area handling for dynamic island and bottom home indicator](https://github.com/Latitudes-Dev/shuvcode/issues/244)
- [GitHub Issue — Menu button hidden behind Dynamic Island and viewport scrolling not locked on iOS PWA](https://github.com/Latitudes-Dev/shuvcode/issues/264)

### iOS Standalone PWA UX
- [Medium — UX basics for Progressive Web Apps (PWAs) by Richard Graves](https://medium.com/@richard.graves/ux-basics-for-progressive-web-apps-pwas-da58d2104241)
- [web.dev — App design (PWA patterns)](https://web.dev/learn/pwa/app-design)
- [Netguru — 6 Tips To Make Your iOS PWA Feel Like a Native App](https://www.netguru.com/blog/pwa-ios)
- [Marketur — Fixed Bottom Navigation in WordPress PWA (iOS Fix)](https://marketur.net/fixed-bottom-navigation-wordpress-pwa/)
- [DEV Community — Getting 'Save to Home Screen' to Kinda Work on iOS](https://naildrivin5.com/blog/2023/08/24/braindump-of-pwa-on-ios.html)

### Authentication Security & Best Practices
- [Auth0 Learning — Authentication Best Practices](https://learning.auth0.com/path/authentication-best-practices)
- [Cathay Bank — Password Hygiene Best Practices: The Dos and Don'ts of Securing Your Accounts](https://www.cathaybank.com/about-us/insights-by-cathay/password-hygiene-best-practices-to-secure-your-account)
- [SecurDen — 15 Password Management Best Practices for 2026](https://www.securden.com/blog/password-management-best-practices.html)
- [LoginRadius — Password Management Best Practices: How to Protect Passwords in 2026](https://www.loginradius.com/blog/identity/password-management-best-practices)
- [Deepak Gupta — Web App Authentication & Authorization Best Practices](https://guptadeepak.com/best-practices-for-user-authentication-and-authorization-in-web-applications-a-comprehensive-security-framework/)
- [Delinea — 20 Password Management Best Practices | 2025](https://delinea.com/blog/20-password-management-best-practices)
- [arXiv — An Empirical Assessment of Security Risks of Global Android Banking Apps](https://arxiv.org/pdf/1805.05236)

### Next.js Server Actions Security & CSRF
- [Clerk — Next.js Authentication Guide 2026](https://clerk.com/articles/nextjs-authentication-guide-2026)
- [Authgear — Next.js Security Best Practices: Complete 2026 Guide](https://www.authgear.com/post/nextjs-security-best-practices/)
- [Telerik — Protecting Next.js Apps Against Cross-Site Request Forgery](https://www.telerik.com/blogs/protecting-nextjs-applications-cross-site-request-forgery-csrf-attacks)
- [Next.js Docs — Data Security](https://nextjs.org/docs/app/guides/data-security)
- [Next.js Blog — How to Think About Security in Next.js](https://nextjs.org/blog/security-nextjs-server-components-actions)
- [LogRocket — Protecting Next.js apps from CSRF attacks](https://blog.logrocket.com/protecting-next-js-apps-csrf-attacks/)
- [Vinta Software — Next-level security: how to hack-proof your Next.js applications](https://www.vintasoftware.com/blog/security-nextjs-applications)
- [TurboStarter — Complete Next.js security guide 2026](https://www.turbostarter.dev/blog/complete-nextjs-security-guide-2025-authentication-api-protection-and-best-practices)
- [Vibe App Scanner — CSRF in Next.js: Server Actions, App Router Mutations, and API Route Sessions](https://vibeappscanner.com/vulnerability-in/csrf-nextjs)

### Playwright E2E Testing
- [Medium — E2E tests with PlayWright by Fedor GNETKOV](https://medium.com/@gnetkov/e2e-tests-with-playwright-3b011df85791)
- [BrowserStack — How to perform End to End Testing using Playwright [2026]](https://www.browserstack.com/guide/end-to-end-testing-using-playwright)
- [DeviQA — Playwright E2E Testing Guide: Setup, Advanced Techniques & CI/CD Integration (2026)](https://www.deviqa.com/blog/guide-to-playwright-end-to-end-testing-in-2025/)
- [GetAutonoma — Playwright E2E Testing: The Complete Guide from Setup to CI/CD](https://getautonoma.com/blog/playwright-e2e-testing)
- [TestDino — Playwright E2E Testing: Step-by-Step Setup Guide 2026](https://testdino.com/blog/playwright-e2e-testing)
- [Aims AI — Playwright End-to-End Testing: The Complete Guide (2026)](https://playwright.aims-ai.com/blog/playwright-end-to-end-testing-guide)

### Vercel Staging & Deployment
- [Vercel Knowledge Base — How do I set up a staging environment on Vercel?](https://vercel.com/kb/guide/set-up-a-staging-environment-on-vercel)
- [Vercel Docs — Environments](https://vercel.com/docs/deployments/environments)
- [Vercel Changelog — Stage and manually promote deployments to production](https://vercel.com/changelog/stage-and-manually-promote-deployments-to-production)
- [Vercel Docs — Promoting Deployments](https://vercel.com/docs/deployments/promoting-a-deployment)
- [Vercel Community — Best practice for Production / Pre-Production deployment](https://community.vercel.com/t/best-practice-for-production-pre-production-deployment/9534)

### Neon Database Branching & Vercel Integration
- [Neon Guides — Testing Auth changes safely with Vercel and Neon Branching](https://neon.com/guides/vercel-neon-auth-branching)
- [Neon Docs — Connecting with the Vercel-Managed Integration](https://neon.com/docs/guides/vercel-managed-integration)
- [Neon Blog — Vercel Native Integration: Create a Neon Branch Per Preview](https://neon.com/blog/neon-vercel-native-integration)
- [Vercel Marketplace — Neon for Vercel](https://vercel.com/marketplace/neon)
- [Neon Docs — Connecting with the Neon-Managed Integration](https://neon.com/docs/guides/neon-managed-vercel-integration)
- [Neon Blog — Full-Stack Preview Deployments with Vercel and Neon](https://neon.com/blog/neon-vercel-integration)
- [Neon Docs — Get started with branching](https://neon.com/docs/guides/branching-intro)
- [Neon Blog — A database for every preview environment using Neon, GitHub Actions, and Vercel](https://neon.com/blog/branching-with-preview-environments)

### React Money & Currency Formatting
- [GitHub — react-currency-format](https://github.com/mohitgupta8888/react-currency-format)
- [shadcn/ui Patterns — Currency Input](https://www.shadcn.io/patterns/input-special-5)
- [Syncfusion — React Numeric Textbox Component | Currency Text Box](https://www.syncfusion.com/react-components/react-numeric-textbox)
- [npm — react-currency-input-field](https://www.npmjs.com/package/react-currency-input-field)
- [DEV Community — Simplify Currency Formatting in React: A Zero-Dependency Solution with Intl API](https://dev.to/josephciullo/simplify-currency-formatting-in-react-a-zero-dependency-solution-with-intl-api-3kok)
- [DEV Community — Building a currency input with React and TypeScript](https://dev.to/ambrookhuis/building-a-currency-input-with-react-and-typescript-2jd7)

---

**Overall Confidence:** HIGH across all areas. Research synthesizes current 2026 best practices from active projects and documentation.
