# Phase 6: Auth Security Hardening - Context

**Gathered:** 2026-09-01
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous)

<domain>
## Phase Boundary

Users can trust the login/registration flow — it never leaks a credential, never tells an attacker whether an account exists (via the login form specifically), and sets session cookies with the correct security flags.

Covers: SEC-01 (verify password never appears in URL/query string/logs, via DevTools/Playwright), SEC-02 (generic, non-enumerating error on wrong login/password), SEC-03 (session cookie confirmed httpOnly + secure + correctly scoped).

</domain>

<decisions>
## Grey Area: SEC-02 Error Messaging

- **Login errors (wrong password OR non-existent email):** collapse to a single generic message — "Неверный email или пароль" — replacing the current direct pass-through of Better Auth's `error.message` in `src/app/(auth)/login/page.tsx`. This is the literal SEC-02 requirement ("Ошибки аутентификации — обобщённые (без user enumeration) при неверном логине/пароле").
- **Registration's duplicate-email disclosure ("уже зарегистрирован"):** explicitly left AS-IS, out of scope for this phase. SEC-02's text is specifically about login, not registration. User confirmed this deliberately, to avoid silently expanding phase scope. Do not touch `src/app/(auth)/register/page.tsx`'s error-message behavior.

### Claude's Discretion
- Exact mechanism for SEC-01 verification (DevTools inspection vs. a Playwright script vs. server log inspection) — whichever is fastest/most reliable to prove.
- Exact mechanism for SEC-03 verification (Better Auth's session cookie defaults vs. explicit `advanced.cookies` config in `src/lib/auth.ts`) — currently no explicit cookie config exists; verify Better Auth's defaults are already correct, and only add explicit config if a gap is found.
- Whether SEC-01's log-audit needs new code changes or is a pure verification pass (likely: nothing currently logs password fields, but confirm rather than assume).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/(auth)/login/page.tsx` — client component, `authClient.signIn.email()`, currently `setFormError(error.message ?? "Не удалось войти")` — this is the exact line SEC-02's fix touches.
- `src/app/(auth)/register/page.tsx` — same pattern, `authClient.signUp.email()` — explicitly NOT to be touched per the decision above.
- `src/lib/auth.ts` — Better Auth server instance. `session: { expiresIn: 60*60*24*30, updateAge: 60*60*24*7 }`. No explicit `advanced.cookies` block — SEC-03 needs to confirm Better Auth's cookie defaults (httpOnly/secure/sameSite/path) are correct for this deployment, not necessarily add new config.
- `src/lib/auth-client.ts` — Better Auth client instance, consumed by both login/register pages.

### Established Patterns
- Both auth pages use `react-hook-form` + `zod` for field-level validation (email format, password length) — SEC-02's fix is specifically about the top-level `formError` state (server/auth-layer error), not the zod field-validation messages, which stay as-is (they're pre-submission client-side hints, not information about account existence).
- Russian-language UI copy throughout (`"Неверный email или пароль"` style — see existing `"Введите корректный email"`, `"Пароль должен быть не короче 8 символов"` for tone/register).

### Integration Points
- `src/lib/auth.ts` is the single Better Auth server config — any session/cookie config changes land here.
- `scripts/verify-auth-flow.mjs` (from Phase 1) already exercises register → sign-in → protected-route → duplicate-registration-rejected — a natural base to extend for SEC-01/SEC-02/SEC-03 verification rather than writing verification scripts from scratch.

</code_context>

<specifics>
## Specific Ideas

- Generic login error text: "Неверный email или пароль" (exact string, matches existing UI copy tone).

</specifics>

<deferred>
## Deferred Ideas

- Generalizing registration's duplicate-email enumeration protection to match login's generic-error treatment — explicitly deferred, out of this phase's scope per user decision. Revisit only if a future security review flags it.

</deferred>
