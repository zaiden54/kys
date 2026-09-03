---
audit_acknowledged:
  milestone: v1.1
  at: 2026-09-03
  status: unknown
---

# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## password-visible-devtools — Password shown in browser DevTools request payload

- **Date:** 2026-09-01
- **Error patterns:** plaintext password, browser DevTools Request Payload, POST /api/auth/sign-in/email, registration flow
- **Root cause(s):** Misinterpretation of the browser DevTools Request Payload: it displays the plaintext application payload on the local client before TLS encryption. The deployment enforces HTTPS (HTTP 308 redirect plus HSTS), so this observation is not plaintext credential transport.
- **Fix:** No application code change is required. Continue using HTTPS endpoints and never log, URL-encode, or cache passwords; do not add client-side password encryption or hashing as a transport substitute.
- **Files changed:** none
- **Why not caught:** No gate existed for this specific misunderstanding class; existing auth-security tests and deployment-header checks already cover the underlying credential-handling and transport requirements.
- **Recurrence guard:** Knowledge-base pattern in this file plus the existing auth-security verification script: distinguish local pre-TLS inspection from URL/log/response leakage and verify HTTPS enforcement.

---
