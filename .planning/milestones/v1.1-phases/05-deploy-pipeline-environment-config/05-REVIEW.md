---
phase: 05-deploy-pipeline-environment-config
reviewed: 2026-09-01T18:30:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - .env.example
  - eslint.config.mjs
  - .github/workflows/ci.yml
  - package.json
  - README.md
  - src/app/actions/forecast.test.ts
  - src/app/(app)/bonuses/bonus-row.tsx
  - src/app/(app)/vacations/vacation-row.tsx
  - src/components/install-banner.tsx
  - src/env.ts
  - src/lib/auth-allowed-hosts.test.ts
  - src/lib/auth-allowed-hosts.ts
  - src/lib/auth.ts
  - src/lib/use-standalone.ts
findings:
  critical: 1
  warning: 1
  info: 6
  total: 8
status: issues_found
---

# Phase 05: Code Review Report (Re-review)

**Reviewed:** 2026-09-01T18:30:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

This is a fresh adversarial pass over the same 14-file scope as the prior `05-REVIEW.md` / `05-REVIEW-FIX.md` cycle. The previously-fixed `WR-01` (vacation-row.tsx unmatched-field-error-swallowing) is confirmed still fixed in current source (`vacation-row.tsx:54-65` has the `handled`-flag fallback). The 5 previously-deferred Info items remain present and unaddressed, as expected (they were explicitly out of the prior fix pass's scope).

This pass also found one new **Critical** issue by empirically testing the installed `better-auth@1.7.2` package's actual `matchesHostPattern`/`wildcardMatch` implementation against this project's own documented production hostnames (`.planning/phases/05-deploy-pipeline-environment-config/DEPLOYMENT.md`'s Environments table): the `ALLOWED_AUTH_HOSTS` wildcard pattern does **not** match two of the three live production domains, meaning Better Auth's dynamic `baseURL` resolution fails closed (throws) for real production traffic on those domains — this was not caught by the existing test suite because `auth-allowed-hosts.test.ts` never exercises those exact hostnames. One new Warning (unhandled `localStorage` access in `install-banner.tsx`) and one new Info (stale CI branch trigger) were also found.

## Critical Issues

### CR-01: `ALLOWED_AUTH_HOSTS` wildcard does not match 2 of the 3 documented production domains — breaks auth on production

**File:** `src/lib/auth-allowed-hosts.ts:18-22` (consumed by `src/lib/auth.ts:27`)
**Issue:**

The current allowlist is:
```ts
export const ALLOWED_AUTH_HOSTS: string[] = [
  "localhost:3000",
  "on-hands-*-careeremit-9861s-projects.vercel.app", // PR previews + staging alias
];
```

`.planning/phases/05-deploy-pipeline-environment-config/DEPLOYMENT.md`'s own Environments table (written during this same phase, "Live as of 2026-09-01") lists **three** production hostnames:

- `on-hands-three.vercel.app`
- `on-hands-careeremit-9861s-projects.vercel.app`
- `on-hands-git-main-careeremit-9861s-projects.vercel.app`

I verified empirically against the actual installed package (`better-auth@1.7.2`'s `matchesHostPattern`, which the project's own `auth-allowed-hosts.test.ts` also imports) whether each is matched by the configured pattern:

```
$ node -e '
const { matchesHostPattern } = require("better-auth");
const pattern = "on-hands-*-careeremit-9861s-projects.vercel.app";
for (const h of [
  "on-hands-three.vercel.app",
  "on-hands-careeremit-9861s-projects.vercel.app",
  "on-hands-git-main-careeremit-9861s-projects.vercel.app",
]) console.log(h, "=>", matchesHostPattern(h, pattern));
'
on-hands-three.vercel.app => false
on-hands-careeremit-9861s-projects.vercel.app => false
on-hands-git-main-careeremit-9861s-projects.vercel.app => true
```

Root cause: `better-auth`'s `wildcardMatch` (`node_modules/better-auth/dist/utils/wildcard.mjs`) compiles `*` into a regex wildcard that still requires the literal `-` characters immediately surrounding it to be present in the input. The pattern `on-hands-*-careeremit-9861s-projects.vercel.app` requires the matched host to contain **two** hyphens between `on-hands` and `careeremit` (one consumed by the `*`, one literal) — but `on-hands-careeremit-9861s-projects.vercel.app` (no branch/hash segment) has only **one**, and `on-hands-three.vercel.app` doesn't contain `careeremit` at all. Only the git-branch-alias-style hostname (`on-hands-git-main-...`, `on-hands-<hash>-...`) satisfies the pattern.

Since `src/lib/auth.ts:27` configures `baseURL: { allowedHosts: ALLOWED_AUTH_HOSTS }` with **no `fallback`** (deliberately, "fail-closed" per the comment on line 25-26), `resolveDynamicBaseURL` throws a `BetterAuthError` for any request whose `Host` header is `on-hands-three.vercel.app` or `on-hands-careeremit-9861s-projects.vercel.app` — i.e. real production traffic arriving via either of those two documented production domains gets every Better Auth-touching request (login, register, session check) failing with a thrown error instead of a resolved base URL. This is a production-breaking regression, not a preview-only edge case: `DEPLOYMENT.md` explicitly documents these as live production domains, and Vercel does not automatically redirect between a project's multiple assigned production domains.

This gap exists because `auth-allowed-hosts.test.ts` only exercises hash-style and branch-alias-style hostnames (`on-hands-6zdzwlrld-careeremit-...`, `on-hands-git-staging-careeremit-...`) — it never asserts against the two "bare" production hostnames that `DEPLOYMENT.md` itself documents as live, so this regression has no test coverage that would have caught it.

**Fix:** Add the two missing production hostnames as explicit exact entries (they're static, known values — no wildcard needed), and add regression tests pinned to the real documented hostnames so this can't silently regress again:

```ts
export const ALLOWED_AUTH_HOSTS: string[] = [
  "localhost:3000",
  "on-hands-*-careeremit-9861s-projects.vercel.app", // PR previews + staging/main branch aliases
  "on-hands-careeremit-9861s-projects.vercel.app", // production: team-scoped default domain (no branch segment)
  "on-hands-three.vercel.app", // production: project's short default domain
];
```

```ts
// auth-allowed-hosts.test.ts
it("matches both bare production domains documented in DEPLOYMENT.md", () => {
  expect(
    ALLOWED_AUTH_HOSTS.some((p) => matchesHostPattern("on-hands-three.vercel.app", p)),
  ).toBe(true);
  expect(
    ALLOWED_AUTH_HOSTS.some((p) =>
      matchesHostPattern("on-hands-careeremit-9861s-projects.vercel.app", p),
    ),
  ).toBe(true);
});
```

## Warnings

### WR-01: `install-banner.tsx` has no error handling around `localStorage` access — a thrown storage error crashes the render

**File:** `src/components/install-banner.tsx:11-35`
**Issue:**
```ts
function getDismissedSnapshot(): boolean {
  return window.localStorage.getItem(DISMISSED_KEY) === "1";
}
...
function setDismissedFlag(value: boolean) {
  if (value) {
    window.localStorage.setItem(DISMISSED_KEY, "1");
  } else {
    window.localStorage.removeItem(DISMISSED_KEY);
  }
  window.dispatchEvent(new Event(DISMISSED_CHANGED_EVENT));
}
```
`getDismissedSnapshot` is passed directly as the `getSnapshot` argument to `useSyncExternalStore`, and `setDismissedFlag` is called synchronously from an effect (`isStandalone` becoming true) and from the dismiss button's click handler. Neither call site wraps `localStorage` access in a `try`/`catch`. Safari (the explicit target platform per `.claude/CLAUDE.md`'s PWA constraint) can throw `SecurityError`/`QuotaExceededError` from `localStorage.getItem`/`setItem` when storage is restricted (e.g. "Block All Cookies" enabled, or genuinely full storage) — since `getDismissedSnapshot` runs on every `useSyncExternalStore` render pass, a throw here propagates as an uncaught exception during render, which (absent an error boundary around this component) takes down the entire page, not just the banner.
**Fix:** Wrap both localStorage accesses defensively and fail to a safe default (banner visible / dismiss no-op) rather than crashing:
```ts
function getDismissedSnapshot(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function setDismissedFlag(value: boolean) {
  try {
    if (value) {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } else {
      window.localStorage.removeItem(DISMISSED_KEY);
    }
  } catch {
    // storage unavailable — dismissal simply won't persist across reloads
  }
  window.dispatchEvent(new Event(DISMISSED_CHANGED_EVENT));
}
```

## Info

### IN-01: `useIsStandalone`'s hydration-safety fix has no regression test (carried forward, unresolved)

**File:** `src/lib/use-standalone.ts` (whole file)
**Issue:** The hook's stable-`false` initial `useState` value (the SSR-hydration-mismatch fix from an earlier review iteration) is not covered by a dedicated unit test asserting the hook's synchronous first-render value is `false` even when `detectStandalone()` would return `true`. A future refactor reintroducing a lazy `useState(detectStandalone)` initializer would not be caught by any test in this scope.
**Fix:** Add a unit test that mocks `matchMedia`/`navigator.standalone` to report standalone `true` before mount and asserts the hook's first returned value is still `false`.

### IN-02: Inconsistent dependency version pinning in `package.json` (carried forward, unresolved)

**File:** `package.json:26-28,46`
**Issue:** `next` (`16.3.3`) and `react`/`react-dom` (`19.2.8`) are pinned to exact versions with no comment explaining why, while every other dependency uses a caret range. `typescript` (`6.0.3`) is also pinned exactly but *is* documented (AGENTS.md explains the `typescript-eslint` 7.x incompatibility).
**Fix:** Add a short comment explaining the `next`/`react`/`react-dom` pins, or switch them to caret ranges if there's no reason to block patch upgrades.

### IN-03: `as Resolver<...>` type assertion around `zodResolver` in both edit-row components (carried forward, unresolved)

**File:** `src/app/(app)/bonuses/bonus-row.tsx:25`, `src/app/(app)/vacations/vacation-row.tsx:29`
**Issue:** Both components cast `zodResolver(...)`'s result with `as Resolver<...>`, silently suppressing whatever structural type mismatch triggered the need for the cast.
**Fix:** Isolate the cast in a single shared typed-resolver helper with an explanatory comment, rather than repeating an unexplained `as` cast in each row component.

### IN-04: `forecast.test.ts`'s `requireUserId` mock is never reset between tests (carried forward, unresolved)

**File:** `src/app/actions/forecast.test.ts:36`
**Issue:** `vi.mock("@/lib/session", () => ({ requireUserId: vi.fn() }))` is declared once at module scope with no `afterEach` reset. Only tests (12) and (18) depend on it and both set their own value immediately before use, so there's no current failure, but there's no isolation guarantee for tests added later in this file.
**Fix:** Add `afterEach(() => vi.mocked(requireUserId).mockReset())`.

### IN-05: README retains generic `create-next-app` boilerplate inconsistent with this project's actual workflow (carried forward, unresolved)

**File:** `README.md:14-45`
**Issue:** The "Getting Started" section still lists `yarn dev`/`pnpm dev`/`bun dev` as interchangeable alternatives to `npm run dev`, despite the repo having only a `package-lock.json` and CI exclusively using `npm ci`/`npm run ...`. The "Deploy on Vercel" section is also unmodified `create-next-app` boilerplate ("The easiest way to deploy... use the Vercel Platform") that doesn't reflect this project's actual, more specific release procedure (PR-preview manual check → branch-protected merge to `main`, documented in `.planning/phases/05-deploy-pipeline-environment-config/DEPLOYMENT.md`, which the README never references).
**Fix:** Trim the boilerplate package-manager alternatives down to the npm-only workflow already established in "Running locally", and either replace the "Deploy on Vercel" boilerplate with a short pointer to the project's actual release procedure or remove it.

### IN-06: CI workflow still triggers on pushes to a `staging` branch that no longer exists

**File:** `.github/workflows/ci.yml:9-10`
**Issue:**
```yaml
on:
  pull_request:
    branches: [main]
  push:
    branches: [main, staging]
```
Per this same phase's own `DEPLOYMENT.md` ("The `staging` git branch and its Neon branch were deleted after this decision"), the standalone `staging` branch concept was explicitly dropped during Phase 5 execution and the branch was deleted. The `push: branches: [main, staging]` trigger is now dead configuration — harmless (it simply never fires, since the branch doesn't exist), but misleading to a future reader who doesn't know to cross-reference `DEPLOYMENT.md` to learn the `staging` entry is stale.
**Fix:** Remove `staging` from the push trigger's branch list (`push: branches: [main]`), or add a one-line comment noting it's kept intentionally in case the branch is recreated.

---

_Reviewed: 2026-09-01T18:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
