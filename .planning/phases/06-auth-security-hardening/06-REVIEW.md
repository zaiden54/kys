---
phase: 06-auth-security-hardening
reviewed: 2026-09-01T23:45:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - scripts/verify-auth-security.mjs
  - src/app/(auth)/login/page.tsx
  - src/app/(auth)/login/page.render.test.tsx
  - package.json
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-09-01T23:45:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Re-review focused on confirming commit `64bdf3f` (fix WR-03: add a regression test for the
WR-01 network-failure `catch` branch), checking that fix for regressions, and re-confirming the
three INFO items (IN-01, IN-02, IN-03) that remain intentionally out of fix scope.

**WR-03 — confirmed resolved.** Commit `64bdf3f` adds a new `describe("LoginPage network
failure (WR-01)", ...)` block to `src/app/(auth)/login/page.render.test.tsx:171-185` that mocks
`authClient.signIn.email` with `mockRejectedValueOnce(new Error("network error"))`, submits the
form, and asserts the exact connectivity message
("Не удалось войти. Проверьте соединение и попробуйте снова.") from `page.tsx:42` is rendered,
and that `router.refresh()`/`router.push()` are *not* called on that path. This is the precise
behavior WR-01's fix was meant to guarantee, and the test now pins it: removing or breaking the
`try/catch` in `onSubmit` (`page.tsx:30-44`) would fail this test rather than silently regressing
to an unhandled promise rejection. The test correctly reuses the file's existing
`submitLoginForm()` helper and `waitFor` pattern, consistent with the other three
`describe` blocks in the file, and does not introduce any new mocking setup that could leak
state into other tests (it relies on the file's `beforeEach`, which clears and resets the
`authClient.signIn.email` mock before every test).

**No regressions.** Running `npx vitest run "src/app/(auth)/login/page.render.test.tsx"`
confirms **10 of 10 tests pass** — the 9 pre-existing tests plus the 1 new WR-03 regression test
— with no failures or new warnings. I traced the new test against `onSubmit` in `page.tsx` to
confirm it exercises the real `catch` path (not a false-positive assertion): `authClient.signIn
.email` rejecting is exactly what triggers `catch { setFormError(...); return; }` at
`page.tsx:41-44`, bypassing both `router.refresh()` and `router.push()` at `page.tsx:48-49`,
which the test explicitly asserts were not called.

IN-01, IN-02, and IN-03 were out of scope for this fix pass and remain unaddressed in the
current code. All three are re-confirmed below at their current (unchanged) line numbers.

## Info

### IN-01: Script verifies the raw Better Auth API, not the actual browser client code path

**File:** `scripts/verify-auth-security.mjs:33-48`
**Issue:** (Re-confirmed, unchanged — out of scope for this fix pass.) `postAuth()` hits
`/api/auth/sign-in/email` directly via `fetch`, constructing the request itself rather than
exercising `authClient.signIn.email` (the function `page.tsx` actually calls, from
`better-auth/react`'s generated client). This is a reasonable and valuable server-side check,
but it does not guarantee SEC-01 holds for the real production code path — if a future change to
`authClient`'s configuration (e.g., a custom `fetchOptions`, or switching `sign-in/email` to a
GET-based flow for some reason) leaked the password into a URL from the *client* side, this
script would not detect it, since it never invokes the client library.
**Fix:** Consider a browser-level check (Playwright request interception on the actual login
form submission) as a complement to this API-level script, to validate the real request the
browser sends.

### IN-02: Generic error message is not associated with the form for assistive tech

**File:** `src/app/(auth)/login/page.tsx:90`
**Issue:** (Re-confirmed, unchanged — out of scope for this fix pass.)
`{formError && <p className="text-sm text-red-600">{formError}</p>}` renders both the SEC-02
generic error and the WR-01 connectivity error as a plain paragraph with no
`role="alert"`/`aria-live` and is not referenced by `aria-describedby` on the form or inputs, so
screen reader users may not be notified when a login attempt fails for either reason.
**Fix:**
```tsx
{formError && (
  <p role="alert" className="text-sm text-red-600">
    {formError}
  </p>
)}
```

### IN-03: Blanket `catch` mislabels non-network exceptions as connectivity problems

**File:** `src/app/(auth)/login/page.tsx:41-44`
**Issue:** (Re-confirmed, unchanged — out of scope for this fix pass.) The `catch {}` block (no
bound error variable) treats every exception thrown by `authClient.signIn.email(...)` as a
connectivity failure and always shows "Не удалось войти. Проверьте соединение и попробуйте
снова." (roughly: "check your connection"). If the client library throws for a non-network
reason (e.g., a bug in request serialization, a CORS configuration error, or an unexpected
client-side validation throw), the user is shown a misleading "check your connection" message
instead of something reason-appropriate, which could make an unrelated bug harder to diagnose
from user reports. This is a minor UX/diagnosability issue, not a functional regression — the
fix correctly prevents the unhandled-rejection failure mode WR-01 identified, and is now covered
by the WR-03 regression test.
**Fix:** Optionally bind and log the error for diagnostics while keeping the generic
user-facing copy (avoids leaking details to the user while preserving debuggability):
```tsx
} catch (err) {
  console.error("sign-in request failed", err);
  setFormError("Не удалось войти. Проверьте соединение и попробуйте снова.");
  return;
}
```

---

_Reviewed: 2026-09-01T23:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
