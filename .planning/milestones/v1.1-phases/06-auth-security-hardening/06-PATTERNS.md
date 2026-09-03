# Phase 6: Auth Security Hardening - Pattern Map

**Mapped:** 2026-09-01
**Files analyzed:** 3 (1 modification, 2 creations)
**Analogs found:** 3 / 3

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/(auth)/login/page.tsx` | component | request-response | self (existing file) | exact |
| `scripts/verify-auth-security.mjs` | test/verification | request-response | `scripts/verify-auth-flow.mjs` | exact |
| `src/app/(auth)/login/page.render.test.tsx` | test | CRUD | self (existing test) | exact |

## Pattern Assignments

### `src/app/(auth)/login/page.tsx` (component, request-response)

**Analog:** Same file (existing form component)

**Current auth submission pattern** (lines 30-45):
```typescript
async function onSubmit(values: LoginInput) {
  setFormError(null);
  const { error } = await authClient.signIn.email({
    email: values.email,
    password: values.password,
  });
  if (error) {
    setFormError(error.message ?? "Не удалось войти");  // ← LINE 37: CHANGE THIS
    return;
  }
  // G-04-2: refresh before push so (app)/layout.tsx's server-side
  // getSessionUser() reads the just-set session cookie fresh, instead of
  // soft-navigating against stale pre-auth Server Component data.
  router.refresh();
  router.push("/");
}
```

**SEC-02 fix** (line 37 only):
Replace this single line:
```typescript
setFormError(error.message ?? "Не удалось войти");
```

With this hardcoded generic message:
```typescript
setFormError("Неверный email или пароль");
```

**Rationale:** Even though Better Auth returns `INVALID_EMAIL_OR_PASSWORD` for both "user not found" and "wrong password" cases server-side, the UI must not even inspect `error.message` or `error.code`. Always show the same generic Russian text to prevent account enumeration attacks.

**Form structure** (lines 58-93):
- Pattern: React Hook Form + Zod validation
- Field-level errors: Shown immediately below each input (email, password)
- Form-level errors: Shown below fields, above submit button
- Submit button: Disabled during `isSubmitting`, shows loading text "Входим…"
- Standalone hint: Conditionally rendered banner for PWA re-login scenario

---

### `scripts/verify-auth-security.mjs` (test/verification, request-response)

**Analog:** `scripts/verify-auth-flow.mjs`

**Existing verification script structure** (`scripts/verify-auth-flow.mjs` lines 1-50):
```javascript
#!/usr/bin/env node
import { neon } from "@neondatabase/serverless";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("FAIL [setup]: DATABASE_URL is required...");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

function fail(step, message) {
  console.error(`FAIL [${step}]: ${message}`);
  process.exit(1);
}

async function main() {
  // Numbered assertions (1, 2, 3, ...)
  // PASS [N] message
  // FAIL [N]: message (calls process.exit(1))
  
  console.log("verify-auth-flow: all assertions passed");
}

main()
  .catch((err) => {
    console.error("FAIL [unexpected]:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Cleanup...
  });
```

**Key patterns:**
- Shebang: `#!/usr/bin/env node`
- Environment: `BASE_URL` defaults to `http://localhost:3000`; `DATABASE_URL` is required
- Failure handling: Helper `fail(step, message)` that logs and exits with code 1
- Success output: `PASS [step] message` to stdout; script ends with "verify-auth-*: all assertions passed"
- Cleanup: `.finally()` block to clean up test data
- CSRF: Remember to set `origin: BASE_URL` header in fetch requests to Better Auth endpoints (line 47 of existing script)

**SEC-01 verification** (password never in URL/logs):
- Check that password doesn't appear in any request URL
- Confirm password is sent in POST body, not query string
- Verify server logs don't contain plaintext password

**SEC-03 verification** (session cookie flags):
- After successful sign-in, inspect `Set-Cookie` response headers
- Verify presence of `HttpOnly`, `SameSite=Lax`, and `Path=/`
- On HTTPS deployments (Vercel), verify `Secure` flag is present
- Check for `__Secure-` prefix on HTTPS deployments

**Expected patterns in Set-Cookie header:**
```
On Vercel (HTTPS):
Set-Cookie: __Secure-better-auth.session_token=<token>; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=2592000

On localhost (HTTP dev):
Set-Cookie: better-auth.session_token=<token>; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000
```

---

### `src/app/(auth)/login/page.render.test.tsx` (test, CRUD)

**Analog:** Same file (existing test suite)

**Current test setup** (lines 1-51):
```typescript
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { pushMock, refreshMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      email: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

import LoginPage from "./page";
import { authClient } from "@/lib/auth-client";

beforeEach(() => {
  mockMatchMedia(false);
  mockNavigatorStandalone(undefined);
  pushMock.mockClear();
  refreshMock.mockClear();
  vi.mocked(authClient.signIn.email).mockClear();
  vi.mocked(authClient.signIn.email).mockResolvedValue({ error: null });
});

afterEach(cleanup);
```

**Existing error handling test** (lines 115-128):
```typescript
it("does not call router.refresh() or router.push() when sign-in errors", async () => {
  vi.mocked(authClient.signIn.email).mockResolvedValueOnce({
    error: { message: "Неверный email или пароль" },
  });

  await submitLoginForm();

  await waitFor(() => {
    expect(screen.getByText("Неверный email или пароль")).not.toBeNull();
  });

  expect(refreshMock).not.toHaveBeenCalled();
  expect(pushMock).not.toHaveBeenCalled();
});
```

**SEC-02 test pattern** (to add/enhance):
- Mock `authClient.signIn.email` to return an error with any code/message
- Verify the UI displays the hardcoded generic message "Неверный email или пароль" (not `error.message`)
- Test both "user not found" and "invalid password" scenarios; both should show the same message
- Verify error is displayed and router navigation is blocked

**Form submission helper** (lines 57-66):
```typescript
async function submitLoginForm() {
  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "user@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Пароль"), {
    target: { value: "any-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Войти" }));
}
```

---

## Shared Patterns

### Client Component Form Error Handling
**Source:** `src/app/(auth)/login/page.tsx` (lines 23-45)
**Apply to:** All auth-related client components with form submission

Pattern structure:
```typescript
"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// 1. Define schema with field-level validation messages
const schema = z.object({
  email: z.string().email("Введите корректный email"),
  password: z.string().min(1, "Введите пароль"),
});

export default function FormComponent() {
  // 2. Form-level error state (for server/auth errors only, not field validation)
  const [formError, setFormError] = useState<string | null>(null);
  
  // 3. React Hook Form setup with Zod resolver
  const { register, handleSubmit, formState: { errors, isSubmitting } } = 
    useForm({ resolver: zodResolver(schema) });

  // 4. On error, set form-level error to a HARDCODED message (no direct error.message pass-through)
  async function onSubmit(values) {
    setFormError(null);
    const { error } = await authClient.signIn.email(values);
    if (error) {
      setFormError("Hardcoded generic message here");  // ← Never use error.message directly
      return;
    }
    // proceed...
  }

  // 5. Render field errors below inputs, form errors in a separate section
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* field-level errors */}
      {errors.email && <p>{errors.email.message}</p>}
      {/* form-level errors */}
      {formError && <p>{formError}</p>}
    </form>
  );
}
```

### Verification Script Pattern
**Source:** `scripts/verify-auth-flow.mjs` (entire file)
**Apply to:** All verification/E2E assertion scripts

- Shebang + imports
- Environment setup with defaults
- Helper function `fail(step, message)` for consistent error output
- Numbered assertions with `PASS [N]` / `FAIL [N]` logging
- Main async function containing ordered test steps
- Cleanup in `.finally()` block
- Process exit with code 0 on success, 1 on failure

### Unit Test Pattern (Vitest)
**Source:** `src/app/(auth)/login/page.render.test.tsx` (entire file)
**Apply to:** All client component tests

- Directive: `// @vitest-environment jsdom`
- Mocks: `vi.hoisted()` for early mock setup, then `vi.mock()` for module mocks
- Setup: `beforeEach()` for mock reset, `afterEach(cleanup)` for cleanup
- Helpers: Extract repeated test setup into helper functions (e.g., `submitLoginForm()`)
- Assertions: Use `waitFor()` for async operations, `expect()` for assertions
- Structure: `describe()` blocks by feature, `it()` tests by behavior

---

## No Analog Found

None — all files have exact or close analogs in the existing codebase.

## Metadata

**Analog search scope:**
- `/home/zaiden/code/kys/src/app/(auth)` — auth pages and components
- `/home/zaiden/code/kys/scripts` — verification scripts
- `/home/zaiden/code/kys/src/app/(app)` — other form components for comparison
- `/home/zaiden/code/kys/src/lib` — auth configuration and utilities

**Files scanned:** 15+
**Pattern extraction date:** 2026-09-01

**Key findings:**
1. `login/page.tsx` error handling (line 37) is the exact point to modify for SEC-02; pattern is straightforward
2. `verify-auth-flow.mjs` is an ideal template for the new `verify-auth-security.mjs` script
3. Existing `login/page.render.test.tsx` already has a partial test for error handling; can be enhanced for SEC-02 verification
4. No explicit cookie config needed in `src/lib/auth.ts` — Better Auth's defaults are secure-by-default (research verified)
