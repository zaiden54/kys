---
phase: 05-deploy-pipeline-environment-config
reviewed: 2026-09-01T00:00:00Z
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
  warning: 4
  info: 4
  total: 9
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-09-01T00:00:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed the deploy-pipeline/environment-config phase's file set: CI workflow, env validation, the dynamic Better Auth host allowlist (SEC-04), a large integration test suite for `forecastNextPayment`, two nearly-identical bonus/vacation edit-row client components, the PWA install banner + standalone-detection hook, and project docs/config.

The dynamic host-allowlist mechanism (`src/lib/auth-allowed-hosts.ts` + `src/lib/auth.ts`) is the security-critical centerpiece of this phase and is undermined by an overly broad wildcard that trusts far more than "this project's deployments," as its own comment claims — flagged as Critical below. Two further Warning-level correctness bugs were found outside the security surface: a client/server hydration mismatch in the PWA standalone-detection hook (ironic, since this is the exact primary use case the app targets), and a silently-swallowed server validation error path in the bonus edit form. The remaining findings are CI/process/doc hygiene items.

## Critical Issues

### CR-01: `ALLOWED_AUTH_HOSTS` wildcard trusts any Vercel-hosted app, not just this project's deployments

**File:** `src/lib/auth-allowed-hosts.ts:14` (consumed by `src/lib/auth.ts:27`)
**Issue:**
```ts
export const ALLOWED_AUTH_HOSTS: string[] = ["localhost:3000", "*.vercel.app"];
```
The file's own docstring claims `*.vercel.app` "covers every Vercel-hosted deployment **for this project**" — but the pattern is not scoped to this project at all. `*.vercel.app` matches literally any hostname on Vercel's shared apex domain, including deployments belonging to completely unrelated Vercel accounts/projects (anyone can claim a free `<anything>.vercel.app` subdomain instantly, with no relationship to this codebase).

This allowlist feeds `betterAuth`'s dynamic `baseURL` resolution (`auth.ts:27`), which determines the trusted origin used to build auth callback/verification URLs and to validate the request. `auth.ts`'s own comment states the `fallback` was *deliberately* omitted so an unrecognized `Host` header "throws instead of silently resolving to a default trusted origin (fail-closed)" — but the wildcard's breadth defeats that fail-closed intent: an incoming request whose `Host` header is any `*.vercel.app` string (not just this project's known deployment hostnames) is accepted as trusted, regardless of whether it actually belongs to this project. If the Host header used for this decision can be influenced by a client (a common risk pattern on CDNs/edge platforms that forward the raw `Host` header rather than validating it against the routing/SNI domain), this allows Host-header-driven trust confusion for a financial application's auth surface (session/callback URL generation).

Notably, `auth-allowed-hosts.test.ts:41-45` ("never matches an untrusted host") only exercises `evil.com` against each pattern — it never asserts that an arbitrary *other* `*.vercel.app` hostname (e.g. `evil-project.vercel.app`, which the wildcard *would* match) is rejected. The test suite as written cannot catch a regression toward, or already-present over-permissiveness of, this exact risk.

**Fix:** Scope the wildcard to this project's actual deployment naming convention instead of the whole `vercel.app` TLD, e.g.:
```ts
export const ALLOWED_AUTH_HOSTS: string[] = [
  "localhost:3000",
  "on-hands-*-careeremit-9861s-projects.vercel.app", // PR previews + staging alias
  // add the production custom domain here once one exists, per this file's own comment
];
```
and add a regression test asserting `matchesHostPattern("evil-project.vercel.app", pattern)` is `false` for every configured pattern, alongside the existing `evil.com` case, to actually prove the allowlist doesn't trust unrelated Vercel deployments.

## Warnings

### WR-01: `useIsStandalone` hydration mismatch defeats its own purpose on first paint

**File:** `src/lib/use-standalone.ts:13-19,27`
**Issue:**
```ts
function detectStandalone(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.navigator.standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches)
  );
}

export function useIsStandalone(): boolean {
  const [isStandalone, setIsStandalone] = useState(detectStandalone);
  ...
```
`useState(detectStandalone)` runs the lazy initializer on every fresh render pass, including both the server render of this `"use client"` component and the client's hydration render. On the server `window` is undefined, so `detectStandalone()` always returns `false`; on the client, if the app is actually running standalone (the app's primary target scenario per CLAUDE.md — "PWA, устанавливаемое на домашний экран iPhone"), the same initializer returns `true` during hydration. This is the exact class of bug React's own docs warn against (window-dependent state must not be read directly in a lazy `useState` initializer for SSR'd client components) — it produces a client/server output mismatch, causing a hydration error/flash for `InstallBanner` (which renders full banner markup vs. `null` depending on this value) precisely for users running the app as an installed PWA, i.e. the app's flagship use case. Notably, the sibling `dismissed` state in `install-banner.tsx` already handles this correctly via `useSyncExternalStore` with a distinct `getServerSnapshot`; `isStandalone` does not follow the same pattern.

**Fix:** Initialize to a stable `false` and compute the real value only after mount:
```ts
export function useIsStandalone(): boolean {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsStandalone(detectStandalone());
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    function handleChange() {
      setIsStandalone(detectStandalone());
    }
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isStandalone;
}
```
or migrate to `useSyncExternalStore` for consistency with the dismissed-flag implementation in the same feature.

### WR-02: Bonus edit form silently drops server validation errors for the `type` field

**File:** `src/app/(app)/bonuses/bonus-row.tsx:49-53`
**Issue:**
```ts
for (const [field, messages] of Object.entries(result.fieldErrors)) {
  if ((field === "amountRubles" || field === "date" || field === "note") && messages?.[0]) {
    setError(field, { message: messages.join(" ") });
  }
}
```
`type` is a registered, user-editable field in this form (`<select ... {...register("type")}>`, `toDefaults` includes `type: bonus.type`), but it is excluded from the field-error allowlist above. If `saveBonusAction` ever returns `result.fieldErrors.type` (e.g. schema drift, an unexpected enum value), this loop does nothing with it. Unlike `onDelete` (which surfaces every message via `Object.values(result.fieldErrors).flat().join(" ")`), `onEdit`'s failure path (`result.success === false`) has **no fallback path that sets the top-level `error` state** — that state is only set in the `catch` block for thrown exceptions. The net effect: a save can fail with zero visible feedback — no field error, no banner error, button just stops showing "Сохранение…" — leaving the user unsure whether anything happened. `vacation-row.tsx`'s equivalent loop correctly enumerates all of its editable fields (`startDate`, `endDate`), so this is an inconsistency specific to the bonus row.

**Fix:** Either include `"type"` in the allowlist, or (more robust against future field additions) fall back to a generic message for any unmatched field, mirroring `onDelete`:
```ts
let handled = false;
for (const [field, messages] of Object.entries(result.fieldErrors)) {
  if ((field === "amountRubles" || field === "date" || field === "note" || field === "type") && messages?.[0]) {
    setError(field as keyof BonusInput, { message: messages.join(" ") });
    handled = true;
  }
}
if (!handled) {
  setErrorMessage(Object.values(result.fieldErrors).flat().join(" ") || "Не удалось сохранить бонус.");
}
```

### WR-03: CI workflow does not set an explicit least-privilege `permissions` block

**File:** `.github/workflows/ci.yml:1-14`
**Issue:** The workflow has no top-level `permissions:` key, so the `GITHUB_TOKEN` used by `actions/checkout`/`actions/setup-node` gets whatever default scope the repository/org settings grant (which can be broader than `contents: read`, e.g. `write` on some org defaults). None of the steps in this workflow need anything beyond read access to check out the repo.
**Fix:**
```yaml
permissions:
  contents: read
```
added at the workflow (or job) level, per standard GitHub Actions hardening guidance.

### WR-04: README's local setup instructions omit the Node.js version requirement needed to actually run the test suite

**File:** `README.md:1-9`
**Issue:** `.github/workflows/ci.yml:20-25` documents in detail that this project's test suite requires **Node 22.4+** because `vitest.config.ts` passes `--no-experimental-webstorage`, which Node 20 rejects outright ("Next.js 16 itself only requires Node 20+, but this project's test suite needs 22+"). The README's "Running locally" section (steps 1-4) never mentions a Node version requirement at all. A contributor following just the README on Node 20/21 (satisfying Next.js's own stated minimum) would hit a confusing worker crash the first time they run `npm test`, with no clue from project docs about why.
**Fix:** Add a Node version line to the README's setup steps, e.g. "Requires Node.js 22.4+ (see `.github/workflows/ci.yml` for why)", or add an `"engines"` field to `package.json` so `npm install`/`npm ci` warn/fail loudly instead of failing silently at test time.

## Info

### IN-01: Inconsistent dependency version pinning in `package.json`

**File:** `package.json:26-28,46`
**Issue:** `next` (`16.3.3`), `react`/`react-dom` (`19.2.8`), and `typescript` (`6.0.3`) are pinned to exact versions while every other dependency uses a caret range (`^...`). For `typescript` this is clearly intentional (AGENTS.md explicitly calls out staying on the `6.0.x` line until `typescript-eslint` supports 7.x), but `next`/`react`/`react-dom` have no such documented rationale in this file, making the inconsistency look accidental rather than deliberate.
**Fix:** Either add a short comment explaining the exact pins (consistent with the `typescript` precedent) or switch them to caret ranges if there's no reason to block patch upgrades.

### IN-02: `as Resolver<...>` type assertion around `zodResolver` in both edit-row components

**File:** `src/app/(app)/bonuses/bonus-row.tsx:25`, `src/app/(app)/vacations/vacation-row.tsx:29`
**Issue:** `resolver: zodResolver(bonusInputSchema) as Resolver<BonusInput>` (and the vacation equivalent) casts around a type mismatch between the resolver's inferred type and the form's `BonusInput`/`VacationInput` type rather than resolving it structurally. This is a common `react-hook-form` + `zod` v4 friction point, but as written it silently suppresses whatever real mismatch triggered the need for the cast, and would mask a genuine field-shape drift between the zod schema and the form type in the future.
**Fix:** If the mismatch is a known library-type limitation, consider isolating it in a single shared typed-resolver helper (`function typedResolver<T>(schema) { ... }`) with an explanatory comment, rather than repeating an unexplained `as` cast in each row component.

### IN-03: `forecast.test.ts`'s `requireUserId` mock is never reset between tests

**File:** `src/app/actions/forecast.test.ts:36`
**Issue:** `vi.mock("@/lib/session", () => ({ requireUserId: vi.fn() }))` is declared once at module scope with no `afterEach(() => vi.clearAllMocks())`/`mockReset()`. Only tests (12) and (18) actually depend on this mock, and both correctly set their own `mockResolvedValue` immediately before use, so there's no current failure — but the mock's return value silently persists across all other tests in the file with no test-order independence guarantee if a future test is added that relies on this mock's default (unset) state.
**Fix:** Add `afterEach(() => vi.mocked(requireUserId).mockReset())` (or a file-level `afterEach(() => vi.clearAllMocks())`) for test isolation hygiene going forward.

### IN-04: README retains generic `create-next-app` boilerplate inconsistent with this project's npm-only workflow

**File:** `README.md:14-22`
**Issue:** The "Getting Started" section still lists `yarn dev` / `pnpm dev` / `bun dev` as interchangeable alternatives to `npm run dev`, despite the repo only having a `package-lock.json` (no `yarn.lock`/`pnpm-lock.yaml`/`bun.lockb`) and CI exclusively using `npm ci`/`npm run ...`. A contributor who follows the yarn/pnpm/bun path would get a lockfile out of sync with what CI and other contributors use.
**Fix:** Trim the boilerplate "Getting Started"/"Learn More"/"Deploy on Vercel" sections down to the npm-only workflow already established in the project-specific "Running locally" section at the top, or explicitly note npm as the only supported package manager.

---

_Reviewed: 2026-09-01T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
