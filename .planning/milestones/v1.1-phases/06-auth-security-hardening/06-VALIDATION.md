---
phase: 6
slug: auth-security-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-01
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.11 + jsdom (existing) |
| **Config file** | vitest.config.ts (existing) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test -- --coverage` |
| **Estimated runtime** | ~25 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd-verify-work`:** Full CI suite must be green; SEC-01/SEC-03 manually verified on a real PR-preview deployment
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 0 | SEC-02 | T-06-01 | Login shows identical generic error ("Неверный email или пароль") for wrong-password and non-existent-email | unit | `npm test` (login page test) | ❌ W0 (new test) | ⬜ pending |
| 06-01-02 | 01 | 0 | SEC-01, SEC-03 | T-06-02, T-06-03 | Password never appears in URL/query/logs; session cookie has httpOnly+secure+correct scope | manual + script | `scripts/verify-auth-security.mjs` (new) against a live PR-preview | ❌ W0 (new script) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*(Task IDs/waves are seeded from research's requirement→test map and refined during planning.)*

---

## Wave 0 Requirements

- [ ] `scripts/verify-auth-security.mjs` — curl/script-based SEC-01 (no password in query/logs) and SEC-03 (Set-Cookie header flags) verification against a live deployment
- [ ] Unit test covering login/page.tsx's generic-error behavior (SEC-02)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Password never visible in browser DevTools Network tab (URL/query string) during login/register | SEC-01 | Requires a real browser session against a live deployment, not reproducible in a unit test | Open DevTools Network tab, submit login/register, inspect the request — confirm password appears only in the POST body, never in the URL |
| Session cookie inspected in DevTools Application tab shows httpOnly+secure+correct path/domain | SEC-03 | Cookie flags are only meaningfully observable against a real HTTPS deployment (secure flag only applies over HTTPS) | On a PR-preview deployment, log in, open DevTools Application → Cookies, confirm the session cookie has HttpOnly ✓, Secure ✓, correct Path |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
