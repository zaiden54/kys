# Phase 7: E2E Test Suite - Pattern Map

**Mapped:** 2026-09-02
**Files analyzed:** 9 (2 configs, 3 utilities, 4 test specs)
**Analogs found:** 8 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `playwright.config.ts` | config | request-response | `vitest.config.ts` | role-match |
| `e2e/fixtures.ts` | utility | request-response | `scripts/verify-auth-security.mjs` | exact |
| `e2e/auth.spec.ts` (E2E-01) | test | request-response | `scripts/verify-auth-flow.mjs` | exact |
| `e2e/bonus.spec.ts` (E2E-02) | test | request-response | `src/app/actions/bonus.test.ts` | role-match |
| `e2e/vacation.spec.ts` (E2E-03) | test | request-response | `src/app/actions/vacation.test.ts` | role-match |
| `e2e/pie-chart.spec.ts` (E2E-04) | test | request-response | `src/app/actions/annual-summary.test.ts` | role-match |
| `.github/workflows/ci.yml` (modifications) | config | request-response | `.github/workflows/ci.yml` | exact |
| `package.json` (script addition) | config | request-response | `package.json` | exact |
| `.mcp.json` | config | request-response | (no analog — new pattern) | none |

## Pattern Assignments

### `playwright.config.ts` (config, request-response)

**Analog:** `vitest.config.ts` (test configuration pattern with environment, path aliases, and module resolution)

**Imports pattern** (lines 1-3):
```typescript
import { defineConfig } from "vitest/config";
import path from "node:path";
```

**Environment setup pattern** (lines 10-14):
```typescript
try {
  process.loadEnvFile(path.resolve(__dirname, ".env.local"));
} catch {
  // .env.local not present — fine for test suites that don't touch the DB.
}
```

**Path alias pattern** (lines 30-33):
```typescript
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
  },
},
```

**Key configuration principles:**
- Load `.env.local` if available (for DATABASE_URL/BETTER_AUTH_SECRET during setup/teardown phases)
- Define `@` alias for imports to match app structure
- Configure for Node.js environment (not browser/jsdom for Playwright — that's handled by the browser itself)

---

### `e2e/fixtures.ts` (utility, request-response)

**Primary Analog:** `scripts/verify-auth-security.mjs`

**Unique email generation pattern** (lines 25-26 of verify-auth-security.mjs):
```typescript
function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}
```

**Database cleanup pattern** (lines 29-31):
```typescript
async function deleteUsersByEmail(email) {
  await sql`delete from "user" where email = ${email}`;
}
```

**Error classification pattern** (lines 17-23):
```typescript
class VerificationFailure extends Error {}

function fail(step, message) {
  console.error(`FAIL [${step}]: ${message}`);
  process.exitCode = 1;
  throw new VerificationFailure(message);
}
```

**Finally-block cleanup pattern** (lines 154-163):
```typescript
.finally(async () => {
  for (const email of createdEmails) {
    try {
      await deleteUsersByEmail(email);
    } catch (cleanupErr) {
      console.error(`cleanup failed for ${email}:`, cleanupErr);
      process.exitCode = 1;
    }
  }
});
```

**Secondary Analog:** `scripts/verify-auth-flow.mjs`

**Custom Error class pattern** (line 19):
```typescript
function fail(step, message) {
  console.error(`FAIL [${step}]: ${message}`);
  process.exit(1);
}
```

**What fixtures.ts should export:**
- `uniqueEmail(prefix)` — generates disposable test user email with timestamp + random suffix
- `sql` or a database helper for cleanup operations during `afterAll()` / `afterEach()`
- Type: `SessionState` for Playwright `storageState` (session cookie + localStorage state after login)
- Helper to create a test user and return both the disposable email and a structured session state object

---

### `e2e/auth.spec.ts` (test, request-response) — E2E-01

**Analog:** `scripts/verify-auth-flow.mjs` (register→login→redirect flow verification)

**Test structure pattern** (lines 50-123):
```typescript
async function main() {
  const email = uniqueEmail("verify-auth");
  const password = "correct-horse-battery-staple-1";
  
  // 1. Anonymous GET / redirects to /login.
  const anonRes = await fetch(`${BASE_URL}/`, { redirect: "manual" });
  if (anonRes.status < 300 || anonRes.status >= 400) {
    fail("1", `expected a 3xx redirect for anonymous GET /, got ${anonRes.status}`);
  }
  // ...
  
  // 2. Fresh sign-up succeeds and returns a session cookie.
  const signUpRes = await signUp(email, password);
  if (!signUpRes.ok) {
    fail("2", `sign-up failed with status ${signUpRes.status}`);
  }
  const setCookie = signUpRes.headers.getSetCookie?.() ?? [];
  // ...
  
  // 3. Authenticated GET / returns 200 and renders the registered email.
  const homeRes = await fetch(`${BASE_URL}/`, { headers: { cookie: cookieHeader } });
  if (homeRes.status !== 200) {
    fail("3", `expected 200 for authenticated GET /, got ${homeRes.status}`);
  }
  const homeBody = await homeRes.text();
  if (!homeBody.includes(email)) {
    fail("3", "authenticated home page body did not contain the registered email");
  }
}
```

**Better Auth CSRF header pattern** (lines 43-49):
```typescript
async function signUp(email, password) {
  return fetch(`${BASE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    // Better Auth's CSRF check requires an Origin header matching a trusted origin
    headers: { "content-type": "application/json", origin: BASE_URL },
    body: JSON.stringify({ email, password, name: email.split("@")[0] }),
  });
}
```

**Playwright test spec pattern (apply to this file):**
- Use `test()` from `@playwright/test` with descriptive names
- Each test should cover a specific golden path: register → login → forecasted payment → logout + redirect
- Reuse the same fixtures pattern: unique email, create user via form submission, verify DOM content
- Close session/logout before test ends to verify redirect-to-login behavior

---

### `e2e/bonus.spec.ts` (test, request-response) — E2E-02

**Analog:** `src/app/actions/bonus.test.ts` (CRUD action testing pattern)

**Test structure pattern** (lines 25-72):
```typescript
describe("bonus actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUserId.mockResolvedValue("user-01");
    mocks.createBonus.mockResolvedValue({});
  });

  it("creates when id is absent", async () => {
    expect(await saveBonusAction(formData())).toEqual({ success: true });
    expect(mocks.createBonus).toHaveBeenCalledWith(...);
  });

  it("updates when id is present", async () => {
    expect(await saveBonusAction(formData(bonusId))).toEqual({ success: true });
    expect(mocks.updateBonus).toHaveBeenCalledWith(...);
  });

  it("returns not found without revalidation", async () => {
    mocks.updateBonus.mockResolvedValue(null);
    expect(await saveBonusAction(formData(bonusId))).toEqual({
      success: false,
      fieldErrors: { amountRubles: ["Бонус не найден"] }
    });
  });

  it("hides repository errors", async () => {
    mocks.createBonus.mockRejectedValue(new Error("leaked-secret"));
    const result = await saveBonusAction(formData());
    expect(result).toEqual({
      success: false,
      fieldErrors: { amountRubles: ["Не удалось сохранить бонус. Попробуйте ещё раз."] }
    });
    expect(JSON.stringify(result)).not.toContain("leaked-secret");
  });
});
```

**FormData builder pattern** (lines 17-23):
```typescript
function formData(id?: string, type?: string): FormData {
  const data = new FormData();
  if (id) data.set("id", id);
  data.set("amountRubles", "25000");
  data.set("date", "2026-09-02");
  data.set("note", "Проект");
  data.set("type", type ?? "premium");
  return data;
}
```

**Apply to E2E context:**
- Replace mocked `saveBonusAction` with real Playwright form submission
- Verify both create and update flows: fill form → submit → check for success toast/redirect
- Verify error cases: invalid amount → check error message displayed in UI
- Verify delete flow: delete bonus → confirm deletion → verify list updated
- Use same StorageState (logged-in session) for all bonus tests after initial login

---

### `e2e/vacation.spec.ts` (test, request-response) — E2E-03

**Analog:** `src/app/actions/vacation.test.ts` (CRUD action testing with overlap validation)

**Test structure pattern** (lines 25-107):
```typescript
describe("vacation actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUserId.mockResolvedValue("user-01");
    mocks.createVacation.mockResolvedValue({});
    mocks.checkOverlapVacations.mockResolvedValue(false);
  });

  it("creates when id is absent", async () => {
    expect(await saveVacationAction(formData())).toEqual({ success: true });
    expect(mocks.checkOverlapVacations).toHaveBeenCalledWith("user-01", "2026-09-10", "2026-09-15");
    expect(mocks.createVacation).toHaveBeenCalledWith("user-01", "2026-09-10", "2026-09-15");
  });

  it("returns the exact overlap message and never calls create/update", async () => {
    mocks.checkOverlapVacations.mockResolvedValue(true);
    expect(await saveVacationAction(formData())).toEqual({
      success: false,
      fieldErrors: { endDate: ["Даты пересекаются с существующим отпуском"] },
    });
    expect(mocks.createVacation).not.toHaveBeenCalled();
  });

  it("returns the exact blocked-delete message", async () => {
    mocks.deleteVacationIfFuture.mockResolvedValue({ status: "blocked" });
    expect(await deleteVacationAction(vacationId)).toEqual({
      success: false,
      fieldErrors: { startDate: ["Нельзя удалять отпуска из прошлого. Вы можете изменить даты."] },
    });
  });
});
```

**FormData builder pattern** (lines 17-23):
```typescript
function formData(id?: string, startDate = "2026-09-10", endDate = "2026-09-15"): FormData {
  const data = new FormData();
  if (id) data.set("id", id);
  data.set("startDate", startDate);
  data.set("endDate", endDate);
  return data;
}
```

**Apply to E2E context:**
- Drive vacation form through the real UI (same pattern as bonus tests)
- Test overlap validation: create two overlapping vacations → verify error message
- Test create/update/delete flows
- Verify forecast updates when vacation is added (vacation pay calculation reflects in next payment card)
- Use same StorageState (logged-in session) for all vacation tests

---

### `e2e/pie-chart.spec.ts` (test, request-response) — E2E-04

**Analog:** `src/app/actions/annual-summary.test.ts` (annual summary computation with complex tax calculation)

**Example structure from unit tests:**
The test pattern for complex business logic:
- Setup test user with specific salary/bonus/vacation scenarios
- Call the action/endpoint
- Verify the computed result matches expected values
- Check edge cases: zero income, max tax rate, etc.

**Apply to E2E context:**
- Navigate to pie-chart summary view after adding salary + bonuses + vacations
- Verify pie-chart renders correctly (gross/tax/net segments)
- Verify tooltip values match expected calculations
- Verify PWA install prompt is visible (or not, depending on device/browser state)
- Verify manifest.json is served and contains correct metadata (name, display: "standalone", etc.)

---

### `.github/workflows/ci.yml` (modifications, config, request-response)

**Analog:** Existing `.github/workflows/ci.yml` (CI job structure and environment setup)

**Existing job structure pattern** (lines 16-77):
```yaml
jobs:
  ci:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22.x
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Configure environment
        run: |
          echo "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres" >> "$GITHUB_ENV"
          echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" >> "$GITHUB_ENV"

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run typecheck

      - name: Unit tests
        run: |
          npm test -- \
            --exclude '**/schema.test.ts' \
            ...

      - name: Build
        run: npm run build
```

**Environment variables pattern:**
- The CI already sets dummy DATABASE_URL for build phase
- For E2E testing, the new `playwright-setup.ts` globalSetup will create a real Neon branch and override DATABASE_URL
- BETTER_AUTH_SECRET is already set (random base64); reuse as-is for E2E

**New E2E job addition (add after Build step, not as separate job per CONTEXT.md DEPLOY-05):**
```yaml
      - name: E2E tests (with isolated Neon branch)
        run: npm run test:e2e
        env:
          # NEON_API_KEY and NEON_PROJECT_ID required for globalSetup to create/delete branch
          NEON_API_KEY: ${{ secrets.NEON_API_KEY }}
          NEON_PROJECT_ID: ${{ secrets.NEON_PROJECT_ID }}
```

---

### `package.json` (script addition, config, request-response)

**Analog:** Existing `package.json` (lines 5-14)

**Current scripts pattern:**
```json
{
  "scripts": {
    "dev": "next dev --webpack",
    "build": "next build --webpack",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "next typegen && tsc --noEmit",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "test": "vitest run",
    "verify:auth-security": "node scripts/verify-auth-security.mjs"
  }
}
```

**Script to add:**
```json
{
  "scripts": {
    "test:e2e": "playwright test"
  }
}
```

**Key principle:** Keep `test` script as `vitest run` only (unit tests). E2E tests run under a separate `test:e2e` command, matching the separation established in Phase 5 CI where DB-touching tests are excluded from the main test run.

---

### `.mcp.json` (config, request-response)

**No existing analog in codebase** — this is a new standard configuration file for Playwright MCP server integration.

**Purpose (per CONTEXT.md E2E-05):** Document `npx @playwright/mcp@latest` configuration for future interactive test authoring/debugging by developers, not part of CI suite itself.

**Minimal configuration:**
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

Or, if using a global install or development dependency:
```json
{
  "mcpServers": {
    "playwright": {
      "command": "node",
      "args": ["node_modules/@playwright/mcp"]
    }
  }
}
```

**This file is optional for CI** (CI doesn't use MCP) but valuable for local developer experience. It documents to future maintainers how to use Playwright's MCP for interactive test generation/debugging against the running dev server.

---

## Shared Patterns

### Test Setup & Teardown (applies to all E2E test files)

**Neon branch isolation pattern** (from CONTEXT.md decision on E2E-06):
- `playwright-setup.ts` (globalSetup) creates one Neon branch for the entire CI run
- All tests share this single branch (serial execution, `workers: 1`)
- `playwright-teardown.ts` (globalTeardown) deletes the branch after all tests complete
- Local development: reuse `scripts/verify-auth-security.mjs` pattern (fetch against real server, cleanup in `finally` block)

**Disposable test user pattern** (all E2E test files):
```typescript
// From fixtures.ts:
const email = uniqueEmail("e2e-test");
// In test:
await registerUser(email, password);
// In cleanup (afterAll):
await deleteUserByEmail(email);
```

### StorageState (session persistence) pattern

**Per CONTEXT.md decision #5:**
- One `auth-setup` test project logs in once and saves `storageState` to a file
- All other test projects depend on that setup project and reuse the saved session state
- This avoids re-authenticating before every single test, keeping tests fast
- Session state includes both the HTTP session cookie and any localStorage values

**Playwright config structure:**
```typescript
projects: [
  {
    name: "auth-setup",
    testMatch: /auth\.setup\.ts/,
  },
  {
    name: "golden-path",
    testMatch: /(?<!setup)\.spec\.ts$/,
    dependencies: ["auth-setup"],
    use: {
      storageState: "playwright/.auth/user.json",
    },
  },
]
```

### Better Auth CSRF requirement

**Pattern from verify-auth-flow.mjs (line 43-46):**
All POST requests to `/api/auth/*` endpoints must include `origin` header matching the BASE_URL. Browsers send this automatically; Playwright (being headless) sends it only if the request goes through the page context (normal form submission or `page.request()` after page navigation). Explicit fetch-based tests need to set it.

```typescript
headers: {
  "content-type": "application/json",
  origin: new URL(BASE_URL).origin  // e.g., "http://localhost:3000"
}
```

### Error message verification

**Exact error message pattern (from bonus.test.ts & vacation.test.ts):**
Unit tests verify exact error messages returned by Server Actions. E2E tests should verify those same messages appear in the UI after form submission:
- Invalid amount → "Не удалось сохранить бонус. Попробуйте ещё раз."
- Overlap dates → "Даты пересекаются с существующим отпуском"
- Not found → "Бонус не найден" / "Отпуск не найден"

Look for these strings in the DOM or toast notifications after form submission.

---

## No Analog Found

No files in Phase 7 are truly without analogs. All patterns are derived from existing code:

| File | Role | Reason | Reference |
|------|------|--------|-----------|
| `.mcp.json` | config | MCP is a new tool integration standard; no existing `.mcp.json` in repo | Standard from Anthropic's MCP ecosystem |

---

## Metadata

**Analog search scope:**
- `.github/workflows/` — CI job patterns
- `scripts/` — disposable-user and API-test patterns
- `src/app/actions/` — Server Action test patterns (mocking, FormData, error handling)
- `src/components/` — UI interaction test patterns
- `src/lib/` — auth and session patterns
- `vitest.config.ts` — test config patterns
- `package.json` — script organization

**Files scanned:** 14 source files + 1 config file

**Pattern extraction date:** 2026-09-02

**Key insights:**
1. Disposable-user pattern is proven locally in verify-auth-*.mjs scripts; E2E-06 validates it in CI
2. Neon branch creation/deletion is new but decision already locked (CONTEXT.md DECISION, not research)
3. StorageState reuse is Playwright best practice for speed; CONTEXT.md PITFALLS.md #5 explicitly mentions it
4. Server Action tests use mocking; E2E tests drive real UI without mocking (different role, same error messages)
5. All tests follow async/await + error-first pattern; no callback-based APIs in test suites
