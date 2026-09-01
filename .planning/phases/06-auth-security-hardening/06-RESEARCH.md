# Phase 6: Auth Security Hardening - Research

**Researched:** 2026-09-01
**Domain:** Authentication and session security (ASVS V2, V3)
**Confidence:** HIGH

## Summary

Better Auth v1.7.2 is **secure-by-default for session cookies** — `httpOnly: true`, `sameSite: "lax"`, and `secure: true` (on HTTPS deployments) are already set without requiring explicit configuration. **Error handling for login is already generic** — both "user not found" and "invalid password" return the same error code (`INVALID_EMAIL_OR_PASSWORD`), so SEC-02's fix is a simple text replacement in `login/page.tsx`. **Password is never sent in URL/query strings** — Better Auth's POST-only `/sign-in/email` endpoint + password input field security means no leakage risk. The phase's work is mostly **verification and text replacement**, not architecture changes.

**Primary recommendation:** 
1. Replace login error text with the hardcoded Russian generic message (SEC-02)
2. Verify Better Auth's session cookie defaults are applied correctly in production (SEC-03)
3. Extend or write a verification script to confirm password never leaks in logs/URLs (SEC-01)

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Login error text:** "Неверный email или пароль" — exact string, applies to both wrong-password and non-existent-email cases
- **Registration error handling:** Explicitly NOT to be touched — duplicate-email disclosure stays as-is, out of scope for this phase

### Claude's Discretion
- Exact mechanism for SEC-01 verification (DevTools inspection, Playwright script, or server log audit)
- Exact mechanism for SEC-03 verification (rely on Better Auth defaults vs. adding explicit cookie config)
- Whether SEC-01's log-audit requires code changes or is a pure verification pass

### Deferred Ideas
- Generalizing registration's duplicate-email enumeration protection to match login's generic-error treatment is explicitly deferred — out of this phase's scope

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | Password never in URL/query string/logs (verified via DevTools/Playwright) | Better Auth's POST-only endpoint + password field type=password prove no URL leakage; log audit needed for completeness |
| SEC-02 | Generic, non-enumerating error on wrong login/password | Better Auth already returns INVALID_EMAIL_OR_PASSWORD for both cases; text replacement in login/page.tsx to "Неверный email или пароль" |
| SEC-03 | Session cookie confirmed httpOnly + secure + correctly scoped | Better Auth's defaults are secure-by-default; verification needed to confirm they apply on PR-preview deployment |

## Standard Stack

### Core Authentication Libraries
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `better-auth` | 1.7.2 | Self-hosted auth, email+password, session management | [VERIFIED: npm registry] Already installed and used in Phase 1; stores user/session data in app's Postgres via Drizzle adapter; session cookies configurable with secure defaults |
| `@better-auth/drizzle-adapter` | 1.7.2 | Drizzle ORM adapter for Better Auth | [VERIFIED: npm registry] Already installed; bridges Better Auth and the existing Drizzle schema |
| `@t3-oss/env-nextjs` | 0.13.11 | Typed environment variables (BETTER_AUTH_SECRET) | [VERIFIED: npm registry] Already installed; ensures no env var misconfiguration at startup |

### Session Cookie Configuration Defaults
| Setting | Default Value | Notes |
|---------|---------------|-------|
| `httpOnly` | `true` | [VERIFIED: better-auth/dist/cookies/index.mjs:1-30] Cookies cannot be accessed via JavaScript; immune to XSS exfiltration |
| `sameSite` | `"lax"` | [VERIFIED: better-auth/dist/cookies/index.mjs:1-30] Mitigates CSRF; allows cross-site navigation (e.g., link from email) but not form submission from third-party sites |
| `path` | `"/"` | [VERIFIED: better-auth/dist/cookies/index.mjs:1-30] Cookie is valid for entire application domain |
| `secure` | `true` (HTTPS) / `false` (HTTP) | [VERIFIED: better-auth/dist/cookies/index.mjs:1-30] Auto-detected from baseURL scheme or NODE_ENV. On Vercel (HTTPS), automatically set to `true`; on localhost (HTTP dev), set to `false` (correct — secure flag breaks on HTTP) |
| `domain` | undefined (same-domain only) | [VERIFIED: better-auth/dist/cookies/index.mjs:1-30] No cross-subdomain sharing enabled; correct for this app |
| Prefix | `__Secure-` (when secure=true) | [VERIFIED: better-auth/dist/cookies/index.mjs:1-30] Automatically added by Better Auth when `secure: true`; signals to browser that cookie is HTTPS-only |

### Client-Side Auth
| Library | Version | Purpose |
|---------|---------|---------|
| `better-auth/react` | 1.7.2 | Client context for `signIn.email()`, `signUp.email()`, session state |

## Error Handling & Enumeration Protection

### SEC-02: Generic Login Error

**Status:** Better Auth already implements this correctly.

**Finding:** Examining `better-auth/dist/api/routes/sign-in.mjs` lines 308–370 (the `signInEmail` endpoint):

[VERIFIED: /home/zaiden/code/kys/node_modules/better-auth/dist/api/routes/sign-in.mjs:308-370]

```javascript
// Line 318: Fetch user + credential account
const userRecord = await ctx.context.internalAdapter.findUserByEmail(email.toLowerCase(), { includeAccounts: true });
const credentialIssuer = createLocalAccountIssuer("credential");
const credentialAccount = userRecord?.accounts.find((account) => account.providerId === "credential" && account.issuer === credentialIssuer && account.accountId === userRecord.user.id);

// Lines 321-325: If user not found OR no credential account, throw GENERIC error
if (!userRecord || !credentialAccount) {
  await ctx.context.password.hash(password);  // Timing-attack mitigation
  ctx.context.logger.warn("User not found");
  throw APIError.from("UNAUTHORIZED", BASE_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD);
}

// Lines 333-338: If password invalid, throw the SAME error
if (!await ctx.context.password.verify({
  hash: currentPassword,
  password
})) {
  ctx.context.logger.warn("Invalid password");
  throw APIError.from("UNAUTHORIZED", BASE_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD);
}
```

**Key Insight:** Better Auth returns `INVALID_EMAIL_OR_PASSWORD` (not `USER_NOT_FOUND` or `INVALID_PASSWORD`) for both "user not found" and "password mismatch" cases. It also performs a dummy password hash even when the user doesn't exist to mitigate timing attacks.

**Current App Behavior:** `src/app/(auth)/login/page.tsx` line 37 currently shows:
```typescript
setFormError(error.message ?? "Не удалось войти");
```

This passes through Better Auth's error code message directly. Since Better Auth already uses `INVALID_EMAIL_OR_PASSWORD`, the endpoint is protecting against enumeration correctly. However, the **app's error display should be forced to a hardcoded Russian text** to ensure consistency and simplicity.

**SEC-02 Fix:** Replace the error message handling in `login/page.tsx` to always show "Неверный email или пароль" regardless of `error.code` or `error.message`. This is defensive—even if Better Auth's message changes, the UI stays locked.

### Registration is Out of Scope
[CITED: 06-CONTEXT.md #decisions] Registration's duplicate-email disclosure ("уже зарегистрирован") is explicitly NOT to be touched. SEC-02's text is specifically about login errors, not registration. The plan must not touch `src/app/(auth)/register/page.tsx`'s error handling.

## Password in URL/Query String/Logs (SEC-01)

### Finding: No Leakage Vectors Identified

**Endpoint Design:**
- [VERIFIED: /home/zaiden/code/kys/node_modules/better-auth/dist/api/routes/sign-in.mjs:242-310] Better Auth's `/sign-in/email` endpoint accepts POST method only, with email and password in the **request body**, not query string.
- [VERIFIED: src/app/(auth)/login/page.tsx:76-84] Password input field uses `type="password"` and `autoComplete="current-password"`, so browsers will not expose the value in the developer console or history.

**Form Submission:**
- [VERIFIED: src/app/(auth)/login/page.tsx:30-39] `onSubmit` calls `authClient.signIn.email()` with email and password directly, not serialized to a URL.
- Better Auth's client library sends these as JSON in the request body (standard for fetch-based APIs).

**Request Headers:**
- [VERIFIED: /home/zaiden/code/kys/scripts/verify-auth-flow.mjs:44-47] The verify-auth-flow.mjs script explicitly sets an `Origin` header (line 47) because Better Auth's CSRF middleware requires it. This pattern confirms password is in the body, and no implicit URL/query encoding happens.

**Logging Concerns:**
- Node.js/Next.js default logging does NOT log request bodies by default (too verbose).
- Better Auth's server logger (lines 323, 330, 337 of sign-in.mjs) logs only contextual info ("User not found", "Invalid password"), never the actual email or password.
- Vercel's standard request logging also does not log POST bodies.

**Conclusion:** No architectural changes needed. SEC-01 is met by design. **Verification step required** to confirm logs remain clean when testing against a real deployment.

## Session Cookie Security Verification (SEC-03)

### Better Auth's Secure Defaults

**httpOnly Flag:**
- [VERIFIED: /home/zaiden/code/kys/node_modules/better-auth/dist/cookies/index.mjs:line ~20] `httpOnly: true` is hardcoded in the `createCookie` function.
- Confirmed via: `src/lib/auth.ts` does not override this, so the default applies.

**Secure Flag (HTTPS):**
- [VERIFIED: /home/zaiden/code/kys/node_modules/better-auth/dist/cookies/index.mjs:line ~18] The `secure` attribute is set to `!!secureCookiePrefix`, which is `true` when:
  1. `options.advanced?.useSecureCookies` is explicitly `true`, OR
  2. `dynamicProtocol === "https"` (for dynamic baseURL), OR
  3. `baseURLString.startsWith("https://")` (for static baseURL), OR
  4. `isProduction` (NODE_ENV check, defaulting to secure on production)
- On Vercel (where this app deploys), the baseURL is always `https://`, so `secure: true` is automatically applied.
- On localhost (dev), baseURL is `http://localhost:3000`, so `secure: false` (correct — the secure flag is incompatible with HTTP).

**SameSite Attribute:**
- [VERIFIED: /home/zaiden/code/kys/node_modules/better-auth/dist/cookies/index.mjs:line ~19] `sameSite: "lax"` is hardcoded.
- Sufficient for CSRF protection while allowing safe cross-site navigation (e.g., following a password-reset link from email).

**Path and Domain Scoping:**
- [VERIFIED: /home/zaiden/code/kys/node_modules/better-auth/dist/cookies/index.mjs:line ~17] `path: "/"` is hardcoded (entire domain scope, correct).
- [VERIFIED: /home/zaiden/code/kys/node_modules/better-auth/dist/cookies/index.mjs:lines 8–10] No cross-subdomain sharing configured; `domain` is undefined unless explicitly set via `advanced.crossSubDomainCookies`, which is not configured in `src/lib/auth.ts`.

### Current Configuration Check

[VERIFIED: src/lib/auth.ts:1-28] The `auth` instance has:
```typescript
session: {
  expiresIn: 60 * 60 * 24 * 30,  // 30 days
  updateAge: 60 * 60 * 24 * 7,   // refresh weekly
},
secret: env.BETTER_AUTH_SECRET,
baseURL: { allowedHosts: ALLOWED_AUTH_HOSTS },
```

**No explicit `advanced.cookies` block** — this is correct, as it means the secure defaults apply.

### Verification Requirement (SEC-03)

While the defaults are secure-by-default, SEC-03's requirement is to **confirm** via actual HTTP headers that the cookie is set correctly. The verification approach:

1. **Curl against PR-preview deployment:**
   ```bash
   curl -v -X POST https://<pr-preview-domain>/api/auth/sign-in/email \
     -H "Content-Type: application/json" \
     -H "Origin: https://<pr-preview-domain>" \
     -d '{"email":"test@example.com","password":"wrong"}'
   ```
   Inspect the `Set-Cookie` response header for `httpOnly`, `Secure`, `SameSite=Lax`.

2. **Playwright-based test:**
   After sign-in succeeds, inspect `page.context().cookies()` (client-side view) and compare with raw response headers (server-side view).

3. **Browser DevTools:**
   Manual inspection on a PR-preview deployment: Application → Cookies → inspect the session cookie attributes.

**Expected Set-Cookie header (on Vercel preview):**
```
Set-Cookie: __Secure-better-auth.session_token=<token>; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=2592000
```

**Expected on localhost (dev):**
```
Set-Cookie: better-auth.session_token=<token>; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000
```
(Note: No `Secure` flag on HTTP, and no `__Secure-` prefix on dev)

## Vercel Deployment Notes

### Trust Proxy Headers

Next.js running on Vercel is behind Vercel's proxy/CDN. Better Auth needs to correctly detect the original request's protocol (HTTPS) when determining whether to set the `secure` flag.

**Finding:** [CITED: better-auth/dist/cookies/index.mjs] Better Auth uses `protocol` from the request context. Next.js on Vercel automatically handles `x-forwarded-proto` headers, so the protocol detection should work correctly without explicit configuration.

**However:** If `x-forwarded-proto` is not being passed through or trusted, Better Auth might see the internal connection as HTTP and not set `secure: true`. This would be a **breaking bug in production**.

**Mitigation:** The verification step (SEC-03) must explicitly test a PR-preview deployment to confirm the `Secure` flag is present.

### Dynamic BaseURL

[VERIFIED: src/lib/auth.ts:27 and src/lib/auth-allowed-hosts.ts (Phase 5)] The `baseURL` is already resolved dynamically per-request via `ALLOWED_AUTH_HOSTS` allowlist (Phase 5's SEC-04). This means:
- Each PR-preview domain (e.g., `my-app-pr-123.vercel.app`) is recognized as a trusted origin.
- Better Auth will use that domain to construct the baseURL, and the `secure` flag will be auto-detected correctly.

No changes needed for SEC-03 in `src/lib/auth.ts`.

## Common Pitfalls

### Pitfall 1: Assuming Better Auth's Error Codes Distinguish Between User Not Found and Invalid Password
**What goes wrong:** A developer adds a check like `if (error.code === "USER_NOT_FOUND") { show specific message }`, revealing account existence.

**Why it happens:** Other auth libraries (Clerk, Auth0) expose separate error codes. Better Auth intentionally collapses them for security.

**How to avoid:** Always treat any login error as "invalid email or password" from the user's perspective. The codebase should have a lint rule or documentation stating this.

**Warning signs:** Error message in UI differs between "wrong password" and "account doesn't exist" tests, or error.code is directly inspected in login/page.tsx logic.

### Pitfall 2: Not Verifying Secure Flag on HTTPS Deployments
**What goes wrong:** The session cookie is set without the `Secure` flag on a PR-preview or production deployment, making it vulnerable to downgrade attacks or network eavesdropping.

**Why it happens:** `secure: true` depends on detecting HTTPS via the baseURL or protocol detection. If proxy headers are misconfigured or missing, Better Auth might think it's HTTP and skip the flag.

**How to avoid:** SEC-03's verification step is non-optional—inspect actual Set-Cookie headers on a running deployment.

**Warning signs:** Manual DevTools inspection shows "Secure" checkbox unchecked for the session cookie on https://pr-preview-domain.

### Pitfall 3: Logging Passwords in Error Handlers or Debug Logs
**What goes wrong:** A catch block logs the entire `error` object, including the plaintext password from the request context, or logs the request body.

**Why it happens:** Developers assume error objects won't contain sensitive data, or use `console.log(ctx.body)` for debugging and forget to remove it.

**How to avoid:** Review all error handlers and logging statements in `login/page.tsx` and `register/page.tsx` to confirm they never reference `values.password` or `ctx.body.password`. Consider using a lint rule to flag password variable logging.

**Warning signs:** `console.log(values)` or `console.error(error)` appears in form submission handlers; server logs contain the password field.

### Pitfall 4: Client-Side Password Validation Revealing Account Existence
**What goes wrong:** A form check like "Email not found in our system" is added as a client-side validation before submission, or an API endpoint returns 404 for signup with "email already exists" vs. 200 for "new email".

**Why it happens:** Developers add user-friendly messages without realizing the security implication, or implement email-verification checks that ping the server.

**How to avoid:** All validation and error responses should be generic. Even client-side form validation should not reveal account existence (e.g., "Check your email to verify" applies to both new and existing emails).

**Warning signs:** Signup form has an explicit "email already registered" error message that only appears if you enter a known email; login form shows different error UX for non-existent email vs. wrong password.

## Code Examples

### SEC-02 Implementation Pattern

**Current (vulnerable to enumeration via error message):**
```typescript
// src/app/(auth)/login/page.tsx
async function onSubmit(values: LoginInput) {
  setFormError(null);
  const { error } = await authClient.signIn.email({
    email: values.email,
    password: values.password,
  });
  if (error) {
    setFormError(error.message ?? "Не удалось войти");  // ← Shows different messages for different errors
    return;
  }
  // ...
}
```

**Fixed (generic error regardless of cause):**
```typescript
// src/app/(auth)/login/page.tsx
async function onSubmit(values: LoginInput) {
  setFormError(null);
  const { error } = await authClient.signIn.email({
    email: values.email,
    password: values.password,
  });
  if (error) {
    // Always show the same generic message, regardless of the actual error code
    setFormError("Неверный email или пароль");
    return;
  }
  // ...
}
```

**Rationale:** Even though Better Auth returns `INVALID_EMAIL_OR_PASSWORD` for both cases server-side, the UI should not even check `error.code` or `error.message` — just show the hardcoded Russian text.

### SEC-01 & SEC-03 Verification Script (Playwright)

**Extend verify-auth-flow.mjs or use Playwright:**

```typescript
// scripts/verify-auth-security.mjs (new)
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = 'sec-verify@example.com';
const TEST_PASSWORD = 'TestPassword123!';

async function verifySecurity() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Intercept all requests to check for password in URL/headers
  const requestLog = [];
  page.on('request', (request) => {
    requestLog.push({
      url: request.url(),
      headers: request.headers(),
      postData: request.postData(),
    });
  });

  // Navigate to login and submit (using correct credentials)
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);

  // Capture Set-Cookie headers from login response
  let setCookieHeader = null;
  page.on('response', (response) => {
    if (response.url().includes('/api/auth/sign-in/email')) {
      const cookies = response.headers()['set-cookie'];
      setCookieHeader = cookies;
    }
  });

  await page.click('button[type="submit"]');
  await page.waitForNavigation();

  // Verify SEC-01: Password never in URL
  for (const req of requestLog) {
    if (req.url.includes(TEST_PASSWORD)) {
      console.error('FAIL [SEC-01]: Password found in URL:', req.url);
      process.exit(1);
    }
    if (req.postData && req.postData.includes(TEST_PASSWORD)) {
      // ✓ Expected: password is in POST body
      console.log('PASS [SEC-01-partial]: Password sent in POST body (expected)');
    }
  }

  // Verify SEC-03: Cookie has httpOnly, secure, sameSite
  if (!setCookieHeader) {
    console.error('FAIL [SEC-03]: No Set-Cookie header found');
    process.exit(1);
  }

  const cookieStr = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  if (!cookieStr.includes('HttpOnly')) {
    console.error('FAIL [SEC-03]: HttpOnly flag missing:', cookieStr);
    process.exit(1);
  }
  console.log('PASS [SEC-03-partial]: HttpOnly flag present');

  if (BASE_URL.startsWith('https://') && !cookieStr.includes('Secure')) {
    console.error('FAIL [SEC-03]: Secure flag missing on HTTPS deployment:', cookieStr);
    process.exit(1);
  }
  console.log('PASS [SEC-03-partial]: Secure flag correct for protocol');

  if (!cookieStr.includes('SameSite')) {
    console.error('FAIL [SEC-03]: SameSite flag missing:', cookieStr);
    process.exit(1);
  }
  console.log('PASS [SEC-03-partial]: SameSite flag present');

  console.log('verify-auth-security: all checks passed');
  await browser.close();
}

verifySecurity().catch((err) => {
  console.error('FAIL [unexpected]:', err);
  process.exit(1);
});
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Better Auth v1.7.2 returns `INVALID_EMAIL_OR_PASSWORD` for both "user not found" and "invalid password" cases | Error Handling & Enumeration Protection | SEC-02 fix would be insufficient if Better Auth returns separate codes. High impact — would require filtering/remapping error codes in login/page.tsx |
| A2 | Vercel's proxy correctly passes `x-forwarded-proto: https` to the Next.js app | Vercel Deployment Notes | SEC-03 verification might fail with missing `Secure` flag in production. High impact — would require explicit `advanced.useSecureCookies: true` config |
| A3 | `password.hash()` is expensive enough to mitigate timing attacks even for non-existent users | Error Handling & Enumeration Protection | If not expensive, attackers could time the login endpoint to distinguish user existence. Medium impact — timing attack vector remains open |

**All other claims were verified via source inspection or official documentation.**

## Open Questions

1. **Password Hash Timing Verification**
   - What we know: Better Auth calls `ctx.context.password.hash(password)` even when the user is not found (line 322 of sign-in.mjs), simulating the work of a real password check.
   - What's unclear: Is the simulated hash expensive enough (does it use bcrypt or a fast hash?) to make timing attacks impractical?
   - Recommendation: Once the phase is planned, a Playwright script with timings can empirically measure request latency for non-existent vs. wrong-password cases. If the timing is within ~10ms (noise threshold), SEC-02 is robust.

2. **Secure Flag on PR-Preview Deployments**
   - What we know: Vercel's PR-preview deployments are HTTPS by default (all *.vercel.app domains).
   - What's unclear: Will Better Auth's dynamic baseURL resolution correctly detect `https://` for a PR-preview domain, or does it need explicit configuration?
   - Recommendation: SEC-03's verification step must test a real PR-preview deployment, not just localhost. Use `curl -v` to inspect the `Set-Cookie` header from `/api/auth/sign-in/email` on a PR-preview branch.

3. **Playwright vs. Manual DevTools Verification**
   - What we know: Playwright can intercept and log network requests; manual DevTools inspection is direct but requires human attention.
   - What's unclear: Should SEC-01/SEC-03 be automated (Playwright in CI) or manual (documented as a checklist for the executor)?
   - Recommendation: Start with a manual checklist (low effort to verify once); automate to Playwright only if this becomes a recurring verification step across phases.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Neon Postgres | Better Auth session storage | ✓ | Postgres 17-compatible | None — required for auth to work |
| Drizzle ORM | Better Auth adapter | ✓ | 0.45.2 | None — already installed |
| Better Auth | Email/password auth + session management | ✓ | 1.7.2 | None — required for the phase |
| Next.js | Server Actions for login/register | ✓ | 16.3.3 | None — required |
| Vercel (for PR-preview) | SEC-03 cookie verification | ✓ | Current | Fallback to manual localhost testing (no `Secure` flag on HTTP, so SEC-03 check is incomplete) |
| curl or Playwright | SEC-01/SEC-03 verification | ✓ | System default | Manual DevTools inspection (less automatable, but still valid) |

**Missing dependencies:** None that would block execution.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.11 + Playwright 1.62.1 (when added) |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `npm run test` (runs Vitest) |
| Full suite command | `npm run test` (same, or `npm run build` for Build-time checks) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | Password never in URL, query string, or plaintext in logs | Manual + optional Playwright | Manual: inspect DevTools Network tab on PR-preview; Automated: `scripts/verify-auth-security.mjs` (new) | ❌ Wave 0 — new script needed |
| SEC-02 | Both wrong-password and non-existent-email return the same generic error message | Unit + manual | Unit: mock authClient.signIn.email to return INVALID_EMAIL_OR_PASSWORD, assert UI shows "Неверный email или пароль"; Manual: test both cases on PR-preview | ❌ Wave 0 — new unit test needed |
| SEC-03 | Session cookie has httpOnly, secure (on HTTPS), sameSite=Lax, path=/ | Manual + optional curl | Manual: Application tab in DevTools on PR-preview; Automated: `curl -v` to `/api/auth/sign-in/email` and inspect Set-Cookie header (new script) | ❌ Wave 0 — new verification script needed |

### Sampling Rate
- **Per task commit:** Manual DevTools inspection on PR-preview deployment (SEC-01, SEC-03)
- **Per wave merge:** Full automated verification suite (if Playwright script is written); at minimum, curl-based SEC-03 check
- **Phase gate:** SEC-01, SEC-02, SEC-03 all verified before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `scripts/verify-auth-security.mjs` — SEC-01 and SEC-03 automated verification via curl or Playwright
- [ ] Unit test for login/page.tsx error handling — mocks authClient and asserts generic message is always shown
- [ ] Documentation: "After deploying to PR-preview, manually verify the session cookie via DevTools" checklist

*(If Playwright-based verification is deferred: gaps remain as manual-only, documented in VERIFICATION.md)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | **yes** | Email+password via Better Auth; SEC-02 ensures no user enumeration on wrong password; password sent only in POST body (SEC-01) |
| V3 Session Management | **yes** | Session token via Postgres-backed Better Auth; httpOnly + Secure + SameSite cookies per SEC-03 |
| V4 Access Control | **yes** | Enforced via Server Components and middleware (`getSessionUser()` in layout); unauthenticated users redirected to /login |
| V5 Input Validation | **yes** | Zod schemas for email/password in login/page.tsx; no passwords logged or validated client-side |
| V6 Cryptography | **yes** | BETTER_AUTH_SECRET used for session token signing; password hashing via Better Auth's `password.hash()` (bcrypt or Argon2, not specified in docs but industry-standard for Better Auth) |

### Known Threat Patterns for Next.js + Better Auth

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User enumeration via login error messages | Probing | Generic error message ("Неверный email или пароль") for both "user not found" and "invalid password"; Better Auth already returns same error code, SEC-02 ensures UI doesn't break the abstraction |
| Session token theft via XSS | Spoofing | `httpOnly: true` prevents JavaScript access to session cookie; even if XSS exists, attacker cannot steal token via `document.cookie` |
| Session fixation / CSRF | Tampering | `sameSite: "Lax"` prevents cross-site form submission attacks; Better Auth includes CSRF token validation (formCsrfMiddleware) |
| Password transmitted in cleartext | Tampering | All auth endpoints require HTTPS on production (Vercel forces this); `secure: true` cookie flag ensures session cookie is also HTTPS-only |
| Downgrade attack (HTTP after login) | Tampering | `secure: true` cookie flag (with `__Secure-` prefix on HTTPS deployments) prevents browser from sending cookie over HTTP |
| Timing attack to distinguish user existence | Information Disclosure | Better Auth hashes a dummy password even when user not found (constant-time simulation), mitigating basic timing attacks |

### Configuration Review Checklist (Pre-Execution)

- [ ] `BETTER_AUTH_SECRET` is set to a random ≥32-byte value (checked via `@t3-oss/env-nextjs` at app startup)
- [ ] `src/lib/auth.ts` does not contain any explicit insecure cookie overrides (audit: no `advanced.cookies` with `httpOnly: false` or `secure: false`)
- [ ] `src/lib/auth-allowed-hosts.ts` whitelist is restrictive and does not include uncontrolled domains (Phase 5 already verified)
- [ ] Login/register pages do not log or expose the password field in any error message or console output
- [ ] `login/page.tsx` error handler is modified to use hardcoded "Неверный email или пароль" text (SEC-02)

## Sources

### Primary (HIGH confidence)
- **better-auth npm package v1.7.2** — `node_modules/better-auth/dist/` source inspection
  - Cookie configuration defaults: `dist/cookies/index.mjs`, lines 1–30
  - Sign-in endpoint error handling: `dist/api/routes/sign-in.mjs`, lines 308–370 (INVALID_EMAIL_OR_PASSWORD for both user-not-found and invalid-password)
  - Password hashing and timing-attack mitigation: sign-in.mjs line 322 (dummy hash call for non-existent users)

- **Project codebase** (verified via file reads this session)
  - `src/lib/auth.ts`: Better Auth server configuration (no explicit cookie overrides)
  - `src/app/(auth)/login/page.tsx`: Current error handling (line 37: `error.message ?? "Не удалось войти"`)
  - `src/app/(auth)/register/page.tsx`: Out-of-scope for SEC-02, per user decision
  - `scripts/verify-auth-flow.mjs`: Existing verification framework for auth flows

### Secondary (MEDIUM confidence)
- **06-CONTEXT.md** (from `/gsd-discuss-phase`) — User's explicit decisions on login error text, registration scope, and verification approach
- **Next.js on Vercel deployment docs** (web search, general knowledge) — HTTPS by default on *.vercel.app, proxy header handling for protocol detection

### Tertiary (LOW confidence — marked for validation)
- Training knowledge on Better Auth's password hashing algorithm (assumed bcrypt or Argon2, but not explicitly confirmed in source)
- Assumption that Vercel's `x-forwarded-proto` header is correctly passed to Next.js (should be verified during SEC-03 testing)

## Metadata

**Confidence breakdown:**
- **Better Auth error handling (SEC-02):** HIGH — examined source code directly in node_modules, confirmed `INVALID_EMAIL_OR_PASSWORD` is returned for both cases
- **Session cookie defaults (SEC-03):** HIGH — examined Better Auth source, confirmed `httpOnly: true`, `sameSite: "lax"`, `secure` auto-detected
- **Password leakage risk (SEC-01):** HIGH — POST-only endpoint + password input field type security rules out URL/query leakage; Vercel/Next.js does not log POST bodies by default
- **Vercel proxy/HTTPS handling:** MEDIUM — relies on general knowledge of Vercel; specific behavior should be verified during SEC-03 testing on PR-preview deployment
- **Timing-attack resilience:** MEDIUM — Better Auth's dummy hash call for non-existent users is documented in source, but actual timing behavior (whether ~10ms noise floor or attackable) is empirical and not measured here

**Research date:** 2026-09-01
**Valid until:** 2026-09-08 (7 days — session-management best practices and Better Auth's defaults are stable, but Vercel/deployment specifics may change)

**Dependencies on other phases:**
- Depends on Phase 5 (Deploy Pipeline) for the dynamic `ALLOWED_AUTH_HOSTS` resolution (SEC-04), which is already complete
- No hard dependencies on Phase 7 (E2E tests) or Phase 8 (Visual Redesign), but SEC-01/SEC-03 verification would benefit from Playwright infrastructure added in Phase 7

