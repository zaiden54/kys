---
status: testing
phase: 04-annual-overview-pwa-installability
source: [04-VERIFICATION.md]
started: 2026-08-31T17:30:00Z
updated: 2026-08-31T19:00:00Z
---

## Current Test

number: 2
name: Standalone App Launch and Re-Login
expected: |
  Tap the installed app icon to launch it in standalone mode. Verify: (1) app launches without Safari UI chrome, (2) user is not logged in (storage-jar separation), (3) login screen displays with re-login hint ("Похоже, это первый запуск с домашнего экрана…"), (4) log in with test credentials, (5) home screen displays (next payment card, pie chart, install banner hidden). This test was previously blocked by gap G-04-2 (login/register redirect did not complete); G-04-2 is now fixed in code (router.refresh() before router.push()) and covered by passing automated tests — re-attempt this test on a real device to confirm the fix holds in an actual browser/standalone-PWA environment.
awaiting: user response

## Tests

### 1. iPhone Home Screen Installation
expected: On a physical iPhone (iOS 15+), open the app in Safari, tap Share → Add to Home Screen, confirm the "НаРуки" app appears on the home screen with the correct icon. App installs to home screen, icon appears (monochrome "H" on dark background), installation completes without error.
result: pass

### 2. Standalone App Launch and Re-Login
expected: |
  Tap the installed app icon to launch it in standalone mode. Verify: (1) app launches without Safari UI chrome, (2) user is not logged in (storage-jar separation), (3) login screen displays with re-login hint ("Похоже, это первый запуск с домашнего экрана…"), (4) log in with test credentials, (5) home screen displays (next payment card, pie chart, install banner hidden).
  Expected: app launches fullscreen standalone, login screen with re-login hint, after login home screen renders with correct data.
result: pending

### 3. AnnualPieChart Visual Verification
expected: |
  On the home screen (Safari tab and standalone app), visually inspect the pie chart: donut proportions match displayed percentages, "Налог" (red #dc2626) and "На руки" (green #16a34a) slices clearly distinct, title "Доход и налоги в {YYYY} году" readable, 3-row summary correct, estimated-baseline note appears when applicable.
  Expected: proportions accurate, colors legible in light/dark mode, text readable, layout matches other cards.
result: pending

## Summary

total: 3
passed: 1
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

- gap_id: G-04-2
  truth: "After installing as a standalone PWA, the user remains able to log back in and sees their data"
  status: resolved
  reason: "Code-level fix verified: src/app/(auth)/login/page.tsx and src/app/(auth)/register/page.tsx both now call router.refresh() before router.push(); regression tests assert call order, destination, and error-path behavior (all passing, 352/352 full suite). Resolved via 04-03-PLAN.md (gap_closure plan). UAT-level re-verification of Test 2/Test 3 above still pending on a real device — those tests were reset to pending, not auto-passed, since router-navigation bugs of this class require real-browser confirmation beyond jsdom coverage."
  severity: major
  test: 2
  root_cause: "src/app/(auth)/login/page.tsx and src/app/(auth)/register/page.tsx both called router.push() right after authClient.signIn.email()/signUp.email() with no router.refresh() (or session-invalidating callback) in between. The destination route is gated by a server-side session check ((app)/layout.tsx's getSessionUser() + redirect('/login')); the stale client-side navigation re-resolved through the unauthenticated gate instead of committing to the authenticated page. Pre-existing since the Phase 01-02 tracer commit (db14032), unmodified by Phase 04 until this gap-closure plan — both login and register shared the identical anti-pattern."
  artifacts:
    - path: "src/app/(auth)/login/page.tsx"
      issue: "onSubmit now calls router.refresh() before router.push('/') after authClient.signIn.email() — FIXED"
    - path: "src/app/(auth)/register/page.tsx"
      issue: "onSubmit now calls router.refresh() before router.push('/onboarding') after authClient.signUp.email() — FIXED"
  resolved_by: "04-03-PLAN.md / 04-03-SUMMARY.md"
  debug_session: ".planning/debug/auth-no-redirect-standalone.md"
