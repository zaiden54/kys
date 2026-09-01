---
phase: 06-auth-security-hardening
reviewed: 2026-09-01T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - scripts/verify-auth-security.mjs
  - src/app/(auth)/login/page.tsx
  - src/app/(auth)/login/page.render.test.tsx
  - package.json
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-09-01T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the login-page generic-error UI (`page.tsx`), its render test, the auth security
verification script (`verify-auth-security.mjs`), and `package.json`'s wiring for the new
`verify:auth-security` script.

`page.tsx`'s core SEC-02 logic is sound: `onSubmit` never inspects `error.message` or
`error.code` for display — it always renders the fixed string `"Неверный email или пароль"`
whenever `authClient.signIn.email` returns any truthy `error`, so there is no code path by
which Better Auth's real error payload can currently leak into the UI, even if Better Auth's
message content changes in the future. Good.

However, the `onSubmit` handler has no `try/catch` around the `authClient.signIn.email` call.
I traced this into `@better-fetch/fetch` (the HTTP layer under `better-auth/react`'s client) and
confirmed that `fetch()` failures (e.g., the user is offline — relevant for a PWA target) are
**not** caught into `{ data, error }` by default; they reject the promise. Since
`react-hook-form`'s `handleSubmit` re-throws any exception from `onValid` after resetting
`isSubmitting`, this becomes an unhandled promise rejection with no user-facing error message.

`verify-auth-security.mjs`'s test-account cleanup logic is reliable: the disposable account's
email is recorded before the sign-up call, cleanup runs in a `.finally()` block so it executes
on both the pass and fail paths, `VerificationFailure` is deliberately swallowed by `.catch()`
(already logged by `fail()`) so it doesn't block cleanup, and the DB schema
(`src/lib/db/auth-schema.ts`) has `onDelete: "cascade"` from `session`/`account` to `user.id`,
so a single `delete from "user"` correctly removes associated session/credential rows too. No
bug found there.

The script's SEC-02 assertion (step 4), however, only compares HTTP status and the `code` field
between the wrong-password and unknown-email responses — it never compares the `message` field
or full response body. A regression where Better Auth (or a future customization) returns
different `message` text for "wrong password" vs. "unknown email" while keeping the same `code`
would silently pass this check, defeating the phase's stated goal of an identical **server
response**, not just an identical UI string.

## Warnings

### WR-01: No error handling around `authClient.signIn.email` — network failures produce an unhandled rejection and no user feedback

**File:** `src/app/(auth)/login/page.tsx:30-39`
**Issue:** `onSubmit` awaits `authClient.signIn.email(...)` with no `try/catch`. I confirmed in
`node_modules/@better-fetch/fetch/dist/index.js:628` (`let response = await fetch(context.url, context);`)
that this call is not wrapped in error-catching at the fetch layer by default (`catchAllError`
is opt-in and not set by `better-auth/react`'s client), so a genuine network failure (offline
device, DNS failure, CORS error) causes the returned promise to reject rather than resolve with
`{ error }`. `react-hook-form`'s `handleSubmit` (`node_modules/react-hook-form/dist/index.esm.mjs:3201-3224`)
catches this internally only long enough to reset `isSubmitting`, then re-throws — producing an
unhandled promise rejection in the browser and leaving the user with no error message at all
(the form simply re-enables with no feedback). This matters more than usual here because the
app is a PWA explicitly built for installs on a home screen with potentially flaky connectivity.
**Fix:**
```tsx
async function onSubmit(values: LoginInput) {
  setFormError(null);
  try {
    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    });
    if (error) {
      setFormError("Неверный email или пароль");
      return;
    }
  } catch {
    setFormError("Не удалось войти. Проверьте соединение и попробуйте снова.");
    return;
  }
  router.refresh();
  router.push("/");
}
```

### WR-02: verify-auth-security.mjs's SEC-02 check does not compare full server response, only `code`

**File:** `scripts/verify-auth-security.mjs:85-97`
**Issue:** The equality check for the wrong-password vs. unknown-email responses is:
```js
const wrongCode = wrongPasswordResult.jsonBody?.code;
const unknownCode = unknownEmailResult.jsonBody?.code;
if (
  wrongPasswordResult.response.status !== unknownEmailResult.response.status ||
  typeof wrongCode !== "string" ||
  wrongCode !== unknownCode
) { ... }
```
This only asserts that HTTP status and the `code` field match. It never compares `message` (or
the full `rawBody`/`jsonBody`). If Better Auth (now or after a future change) returns the same
`code` but a different human-readable `message` for the two cases — e.g.
`"Invalid password"` vs. `"No account found for this email"` — this script will still report
PASS, even though an attacker inspecting the raw HTTP response (not just the rendered UI) could
enumerate accounts from the `message` text. This directly undercuts the phase's SEC-02
requirement that the **server response**, not only the client UI, be identical.
**Fix:** Compare the full parsed body (or at minimum `message`) for equality, and fail loudly if
either side is missing a body to compare:
```js
const wrongBody = JSON.stringify(wrongPasswordResult.jsonBody);
const unknownBody = JSON.stringify(unknownEmailResult.jsonBody);
if (
  wrongPasswordResult.response.status !== unknownEmailResult.response.status ||
  typeof wrongCode !== "string" ||
  wrongCode !== unknownCode ||
  wrongBody !== unknownBody
) {
  fail(
    "4",
    `login failures differed: status ${wrongPasswordResult.response.status}/${unknownEmailResult.response.status}, body ${wrongBody}/${unknownBody}`,
  );
}
```

## Info

### IN-01: Script verifies the raw Better Auth API, not the actual browser client code path

**File:** `scripts/verify-auth-security.mjs:33-48`
**Issue:** `postAuth()` hits `/api/auth/sign-in/email` directly via `fetch`, constructing the
request itself rather than exercising `authClient.signIn.email` (the function `page.tsx` actually
calls, from `better-auth/react`'s generated client). This is a reasonable and valuable
server-side check, but it does not guarantee SEC-01 holds for the real production code path —
if a future change to `authClient`'s configuration (e.g., a custom `fetchOptions`, or switching
`sign-in/email` to a GET-based flow for some reason) leaked the password into a URL from the
*client* side, this script would not detect it, since it never invokes the client library.
**Fix:** Consider a browser-level check (Playwright request interception on the actual login form
submission) as a complement to this API-level script, to validate the real request the browser
sends.

### IN-02: Generic error message is not associated with the form for assistive tech

**File:** `src/app/(auth)/login/page.tsx:85`
**Issue:** `{formError && <p className="text-sm text-red-600">{formError}</p>}` renders the
generic error as a plain paragraph with no `role="alert"`/`aria-live` and is not referenced by
`aria-describedby` on the form or inputs, so screen reader users may not be notified when a
login attempt fails.
**Fix:**
```tsx
{formError && (
  <p role="alert" className="text-sm text-red-600">
    {formError}
  </p>
)}
```

---

_Reviewed: 2026-09-01T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
