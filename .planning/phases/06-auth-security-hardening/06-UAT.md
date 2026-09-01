---
status: complete
phase: 06-auth-security-hardening
source: [06-VERIFICATION.md]
started: 2026-09-02T00:05:00Z
updated: 2026-09-02T00:12:00Z
---

## Current Test

number: 1
name: Task 3 Live HTTPS Cookie & Network Inspection
result: pass
expected: |
  Open PR #3's Vercel preview URL (https://on-hands-git-gsd-phase-06-auth-bca434-careeremit-9861s-projects.vercel.app) while logged into your Vercel account. Navigate to /login, open DevTools → Network tab.
  1. Submit the login form once with a wrong password for any account.
  2. Submit the login form once with an email that has never been registered.
  3. For each submission, inspect the POST request to /api/auth/sign-in/email — Request URL and Request payload/body.
  4. Perform one successful sign-in with correct credentials.
  5. Inspect the response headers (or DevTools → Application → Cookies) for the session cookie's flags.

  Expected:
  - (Steps 1-3) The password value never appears in the Request URL or any query string for either submission — only in the Request payload/POST body (SEC-01).
  - (Steps 1-3) Both wrong-password and non-existent-email submissions render the identical UI text "Неверный email или пароль" in the browser (SEC-02, browser confirmation).
  - (Steps 4-5) The session cookie is named with a __Secure- prefix and shows HttpOnly, Secure, and Path=/ all present in the Set-Cookie header or DevTools Application tab (SEC-03, HTTPS deployment confirmation).
awaiting: user response

## Tests

### 1. Task 3 Live HTTPS Cookie & Network Inspection
expected: Password never in URL/query string (SEC-01); identical generic error text for both failure cases (SEC-02); session cookie has __Secure- prefix + HttpOnly + Secure + Path=/ (SEC-03) — all confirmed on the live PR-preview deployment via DevTools.
result: pass — user confirmed all expected behaviors on the live PR #3 preview deployment 2026-09-02T00:12:00Z

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
