---
phase: 04-annual-overview-pwa-installability
plan: 02
subsystem: pwa
tags: [serwist, next-og, manifest, service-worker, standalone-mode, ios-safari]

# Dependency graph
requires:
  - phase: 04-annual-overview-pwa-installability
    provides: "04-01's home screen composition (src/app/(app)/page.tsx) that this plan's InstallBanner is wired into"
provides:
  - "manifest() (src/app/manifest.ts) served at /manifest.webmanifest — standalone display, three icon entries"
  - "AppleIcon (src/app/apple-icon.tsx) served at /apple-icon, statically executed at build time"
  - "GET /api/pwa-icon route with a size whitelist (192/512) closing a DoS vector"
  - "renderPwaIconMarkup/PWA_ICON_BACKGROUND_HEX (src/lib/pwa-icon.tsx) — single shared icon renderer"
  - "useIsStandalone() (src/lib/use-standalone.ts) — single shared standalone-detection hook"
  - "InstallBanner (src/components/install-banner.tsx) wired onto the home screen"
  - "Login screen re-login hint for standalone launches"
  - "src/app/sw.ts + next.config.ts's withSerwistInit — minimal Serwist service worker with a genuinely empty precache manifest"
affects: [any future phase touching src/app/layout.tsx metadata/viewport, the home screen's page.tsx composition, or the login page]

# Actuals (#2632)
actuals:
  tokens: 6113
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: [serwist@9.5.12, "@serwist/next@9.5.12"]
  patterns:
    - "Shared next/og satori renderer (renderPwaIconMarkup) used by both apple-icon.tsx (statically executed at build time, no request-time API) and api/pwa-icon/route.ts (request-time, size-whitelisted) — one glyph implementation, never duplicated."
    - "Shared useIsStandalone() hook consumed by both InstallBanner and LoginPage — single source of truth for navigator.standalone / matchMedia(display-mode:standalone) detection."
    - "next build must run with --webpack (not the Next 16 Turbopack default) because @serwist/next's InjectManifest plugin is webpack-only (github.com/serwist/serwist/issues/54); Turbopack hard-errors on a webpack config key with no matching turbopack config."

key-files:
  created:
    - src/lib/pwa-icon.tsx
    - src/app/apple-icon.tsx
    - src/app/api/pwa-icon/route.ts
    - src/app/api/pwa-icon/route.test.ts
    - src/app/manifest.ts
    - src/app/manifest.test.ts
    - src/app/sw.ts
    - src/lib/use-standalone.ts
    - src/components/install-banner.tsx
    - src/components/install-banner.render.test.tsx
    - src/app/(auth)/login/page.render.test.tsx
  modified:
    - package.json
    - package-lock.json
    - next.config.ts
    - src/app/layout.tsx
    - src/app/(app)/page.tsx
    - src/app/(auth)/login/page.tsx
    - vitest.config.ts
    - .gitignore

key-decisions:
  - "package.json's dev/build scripts pinned to `--webpack` (not the Next 16 Turbopack default) since @serwist/next's service-worker injection is webpack-plugin-based and has no Turbopack support yet (upstream issue #54, confirmed by a hard Next.js build error, not just a warning)."
  - "next.config.ts sets both `exclude: [/.*/]` (webpack build-asset exclusion) AND `globPublicPatterns: []` (skips @serwist/next's separate public/ directory scan) — exclude alone left 5 default public/*.svg files in the precache manifest, missing the plan's own must_haves.truths claim of a genuinely empty self.__SW_MANIFEST."
  - "vitest.config.ts passes `execArgv: [\"--no-experimental-webstorage\"]` to disable Node 22+'s built-in global localStorage, which otherwise silently shadows jsdom's window.localStorage in jsdom-environment tests (a real Node/jsdom/Vitest interaction on this Node version, not a project-specific bug) — needed for install-banner.render.test.tsx and any future localStorage-backed test."
  - "src/app/sw.ts needs `/// <reference lib=\"webworker\" />` + `/// <reference no-default-lib=\"true\" />` since the project's shared tsconfig.json only includes the `dom` lib, not `webworker` — the standard Serwist/Next.js pattern for isolating one file's global scope."
  - "public/sw.js (and .map) added to .gitignore — build artifact per the plan's own artifact note ('generated at build time, not committed source')."

patterns-established:
  - "Any future request-time-API-free icon/asset route (no searchParams/headers/cookies) is statically executed and build-time-cached by Next.js — a broken renderer fails the build loudly, which is why apple-icon.tsx's ASCII-not-Cyrillic glyph choice is load-bearing, not cosmetic."

requirements-completed: [PWA-01]

coverage:
  - id: D1
    description: "manifest() returns display:standalone, theme/background_color #18181b, short_name НаРуки, and exactly three icon entries (192/any, 512/any, 512/maskable), each image/png."
    requirement: "PWA-01"
    verification:
      - kind: unit
        ref: "src/app/manifest.test.ts#manifest() returns standalone display, theme/background colors, short_name, and three icon entries"
        status: pass
      - kind: manual_procedural
        ref: "npm run start -p 3111; fetch /manifest.webmanifest — 200 application/manifest+json, JSON body matches exactly"
        status: pass
    human_judgment: false
  - id: D2
    description: "GET /apple-icon and GET /api/pwa-icon?size=192|512(&maskable=1) render real, non-empty image/png responses; an out-of-range size (999999) is clamped, not passed through, closing T-04-03's DoS vector."
    requirement: "PWA-01"
    verification:
      - kind: unit
        ref: "src/app/api/pwa-icon/route.test.ts (4 tests: size=192, size=512, size=512&maskable=1, size=999999 clamped)"
        status: pass
      - kind: manual_procedural
        ref: "npm run start -p 3111; fetch /apple-icon (1266 bytes image/png), /api/pwa-icon?size=192 (1393 bytes), /api/pwa-icon?size=512&maskable=1 (7449 bytes)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The service worker (src/app/sw.ts, built via next.config.ts's withSerwistInit) has a genuinely empty precache manifest — no authenticated page or API response is ever cached client-side."
    requirement: "PWA-01"
    verification:
      - kind: manual_procedural
        ref: "rm public/sw.js; npm run build; grep the built public/sw.js — precacheEntries:[] confirmed (previously non-empty with 5 public/*.svg entries before the globPublicPatterns:[] fix in this session)"
        status: pass
    human_judgment: true
    rationale: "No automated regression test asserts self.__SW_MANIFEST/precacheEntries stays empty across future dependency or config changes — verified manually in this session by inspecting the built public/sw.js after a fresh build. A future session should consider adding a build-time test if this proves fragile."
  - id: D4
    description: "InstallBanner shows install instructions when not standalone and not dismissed, renders nothing (no DOM element) when standalone, and a dismissal persists via localStorage across a fresh mount while not standalone; wired onto the home screen in both configured and not-configured states."
    requirement: "PWA-01"
    verification:
      - kind: unit
        ref: "src/components/install-banner.render.test.tsx (4 tests: shows by default, hides on matchMedia-standalone, hides on navigator.standalone, dismiss persists across remount)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The login screen shows the re-login hint only when useIsStandalone() is true, with the existing email/password form and submit behavior unchanged."
    requirement: "PWA-01"
    verification:
      - kind: unit
        ref: "src/app/(auth)/login/page.render.test.tsx (3 tests: hint shown standalone, hint absent otherwise, form controls still render)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Real-device iPhone UAT: install to home screen via Safari's Add to Home Screen, launch in standalone display mode with its own icon, re-login once, data loads."
    verification: []
    human_judgment: true
    rationale: "iOS Safari's manual install flow and storage-jar behavior cannot be verified by any automated test in this sandbox — no real iPhone available (per 04-VALIDATION.md's own Manual-Only Verifications row and this plan's own flagged assumption). Recorded as an open unrun-verify item; a human must complete this before phase sign-off."

# Metrics
duration: 20min
completed: 2026-08-31
status: complete
---

# Phase 4 Plan 02: PWA Installability — Manifest, Icons, Service Worker, Standalone UX

**Web app manifest + three icon routes (shared next/og satori renderer) + a genuinely-empty-precache Serwist service worker + standalone-mode install banner/re-login hint, all wired end-to-end and confirmed live against a production build.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-31T10:38:00+03:00 (approx, following 04-01)
- **Completed:** 2026-08-31T10:57:17+03:00
- **Tasks:** 3
- **Files modified:** 19 (11 created, 8 modified)

## Accomplishments
- `manifest()` served at `/manifest.webmanifest`: standalone display, `#18181b` theme/background, `short_name` "НаРуки", and exactly three icon entries (192/any, 512/any, 512/maskable) — confirmed both by `manifest.test.ts` and a live fetch against a production build.
- A single shared icon renderer (`renderPwaIconMarkup`) powers both `apple-icon.tsx` (statically executed and build-time-cached, 180×180) and `GET /api/pwa-icon` (request-time, size-whitelisted to `{192, 512}` — closing T-04-03's DoS vector) — the ASCII "H" glyph choice (not Cyrillic "Н") is load-bearing since next/og's default font is Latin-subset only.
- `src/app/sw.ts` + `next.config.ts`'s `withSerwistInit`: a minimal Serwist service worker whose precache manifest is confirmed genuinely empty (`precacheEntries:[]` in the built `public/sw.js`) — required both `exclude:[/.*/]` (webpack build-asset exclusion) AND `globPublicPatterns:[]` (public/ directory scan skip), since the plan's original config only supplied the former and still leaked 5 default `public/*.svg` files into the manifest.
- `useIsStandalone()` — a single shared hook (navigator.standalone / matchMedia display-mode:standalone, re-evaluated on matchMedia "change") — consumed by both `InstallBanner` (home screen, shows/hides/persists-dismissal via localStorage, clears the dismissal once standalone is detected) and the login screen's re-login hint.
- `src/app/layout.tsx` gained a proper `export const viewport: Viewport` (theme-color, width/initialScale/maximumScale/userScalable/viewportFit) split out from `metadata`, plus `appleWebApp` metadata — per this Next.js version's actual convention (confirmed via `node_modules/next/dist/docs/`, not assumed).

## Task Commits

Each task was committed atomically:

1. **Task 1: Web app manifest, icon routes, minimal Serwist service worker** - `36ef124` (feat)
2. **Task 2: Standalone-mode detection hook + install banner** - `fb925b8` (feat)
3. **Task 3: Login screen re-login hint** - `4e67671` (feat)

**Deviation fix (discovered after Task 1, before this plan's metadata commit):** `1ef7329` (fix) — closed the public/ directory precache gap.

**Plan metadata:** (this commit) `docs(04-02): complete PWA installability plan`

_Note: all three tasks carried `tdd="true"` at the task level (not `type: tdd` at the plan level, matching 04-01's own precedent) — tests were written and run alongside implementation within each task's single commit, not as separate RED/GREEN commits._

## Files Created/Modified
- `src/lib/pwa-icon.tsx` - `renderPwaIconMarkup`, `PWA_ICON_BACKGROUND_HEX` — shared satori icon markup
- `src/app/apple-icon.tsx` - statically-executed 180×180 apple-touch-icon
- `src/app/api/pwa-icon/route.ts` - `GET` route, size whitelist `{192, 512}`
- `src/app/api/pwa-icon/route.test.ts` - 4 tests covering both sizes, maskable, and out-of-range clamping
- `src/app/manifest.ts` - `manifest()` default export, served at `/manifest.webmanifest`
- `src/app/manifest.test.ts` - shape assertions (display, colors, short_name, 3 icons)
- `src/app/sw.ts` - minimal Serwist service worker (`self.__SW_MANIFEST` injection point)
- `src/lib/use-standalone.ts` - `useIsStandalone()` + `Navigator.standalone` ambient type augmentation
- `src/components/install-banner.tsx` - `InstallBanner()` — show/hide/dismiss-persist
- `src/components/install-banner.render.test.tsx` - 4 tests
- `src/app/(auth)/login/page.render.test.tsx` - 3 tests
- `package.json` / `package-lock.json` - `serwist@9.5.12`, `@serwist/next@9.5.12` added; `dev`/`build` scripts use `--webpack`
- `next.config.ts` - `withSerwistInit` wiring (`exclude:[/.*/]`, `globPublicPatterns:[]`)
- `src/app/layout.tsx` - `viewport` export, `appleWebApp` metadata
- `src/app/(app)/page.tsx` - renders `InstallBanner` in both configured/not-configured branches
- `src/app/(auth)/login/page.tsx` - re-login hint gated on `useIsStandalone()`
- `vitest.config.ts` - `execArgv: ["--no-experimental-webstorage"]`
- `.gitignore` - `public/sw.js` / `public/sw.js.map` (build artifacts)

## Decisions Made
- `package.json`'s `dev`/`build` scripts pinned to `--webpack`, departing from Next 16's Turbopack default, because `@serwist/next`'s service-worker injection is webpack-plugin-only and Next.js hard-errors (not just warns) when a webpack config key exists with no matching Turbopack config — confirmed via a real build failure, then fixed per serwist's own printed guidance (one of its four documented workarounds).
- `globPublicPatterns: []` added alongside the plan's original `exclude: [/.*/]` — `exclude` only filters webpack-compiled build assets; `@serwist/next` separately globs `public/` (default `["**/*"]`) regardless of `exclude`, so the plan's own must_haves.truths claim of a genuinely empty precache manifest was not met until this fix.
- `vitest.config.ts` disables Node's built-in global `localStorage` via `execArgv: ["--no-experimental-webstorage"]` — a real Node 22+/jsdom/Vitest interaction (Node's own experimental Web Storage API silently shadows `window.localStorage` in jsdom-environment tests), not specific to this codebase, but this is the first test in the project to touch `localStorage`.
- `src/app/sw.ts` uses the standard Serwist/Next.js `/// <reference lib="webworker" />` + `/// <reference no-default-lib="true" />` pattern since the shared `tsconfig.json` only includes the `dom` lib.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `next build` hard-errored under Turbopack with a webpack config present**
- **Found during:** Task 1 (`npm run build` after wiring `withSerwistInit`)
- **Issue:** Next.js 16 defaults to Turbopack for both `next dev` and `next build`; `@serwist/next`'s `withSerwistInit` unconditionally adds a `webpack()` config function to `next.config.ts`. Next.js detects this mismatch and throws a hard build error ("This build is using Turbopack, with a `webpack` config and no `turbopack` config"), not just a warning — `@serwist/next` itself doesn't support Turbopack yet (tracked upstream at github.com/serwist/serwist/issues/54).
- **Fix:** Changed `package.json`'s `dev`/`build` scripts to `next dev --webpack` / `next build --webpack`, matching one of the four workarounds `@serwist/next`'s own console warning lists. Also required adding `/// <reference lib="webworker" />` + `/// <reference no-default-lib="true" />` to `src/app/sw.ts` to resolve a `ServiceWorkerGlobalScope` TypeScript error surfaced once the webpack build actually ran TypeScript checking on that file.
- **Files modified:** package.json, src/app/sw.ts
- **Verification:** `npm run build` succeeds; `public/sw.js` is generated with the expected Serwist bundle.
- **Committed in:** 36ef124 (Task 1 commit)

**2. [Rule 1 - Bug] Node's built-in global `localStorage` silently shadowed jsdom's `window.localStorage` in tests**
- **Found during:** Task 2 (`install-banner.render.test.tsx` first run)
- **Issue:** All 4 new install-banner tests failed with `Cannot read properties of undefined (reading 'getItem')` — Node 22+ (this environment runs Node v26) ships a built-in global Web Storage API that's enabled by default and takes precedence over jsdom's own `window.localStorage` implementation inside Vitest's jsdom test environment, leaving `window.localStorage` `undefined` unless `--localstorage-file` is provided.
- **Fix:** Added `execArgv: ["--no-experimental-webstorage"]` to `vitest.config.ts`'s top-level `test` options (Vitest 4 moved `execArgv` out of the removed `poolOptions` nesting), which lets jsdom's own `localStorage` implementation through to worker processes.
- **Files modified:** vitest.config.ts
- **Verification:** All 4 install-banner tests pass; full suite (346 tests) still green afterward.
- **Committed in:** fb925b8 (Task 2 commit)

**3. [Rule 1 - Bug] `exclude:[/.*/]` alone did not produce a genuinely empty precache manifest**
- **Found during:** Post-Task-3 verification pass, re-checking this plan's own `must_haves.truths` claim about an empty `self.__SW_MANIFEST`
- **Issue:** Manual inspection of the built `public/sw.js` after `npm run build` showed `precacheEntries` was NOT empty — it contained 5 entries (the default `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`). `exclude:[/.*/]` in `next.config.ts` only filters webpack-compiled build assets (JS/CSS chunks); `@serwist/next` separately globs the `public/` directory via `globPublicPatterns` (default `["**/*"]`), which `exclude` never touches.
- **Fix:** Added `globPublicPatterns: []` to `withSerwistInit`'s options, skipping the public-directory scan entirely.
- **Files modified:** next.config.ts
- **Verification:** Rebuilt after removing the stale `public/sw.js`; confirmed `precacheEntries:[]` in the freshly generated file via direct inspection.
- **Committed in:** 1ef7329 (standalone fix commit, after Task 3)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug/correctness against the plan's own stated truth). **Impact on plan:** All three were necessary to actually satisfy this plan's stated must_haves (a working production build, working localStorage-backed tests, and a genuinely empty precache manifest) rather than a config that merely looked correct. No scope creep — all fixes stayed within the files this plan's tasks already touched.

## Issues Encountered

None beyond the three deviations documented above (all resolved within this session).

## User Setup Required

None - no external service configuration required. `serwist@9.5.12` and `@serwist/next@9.5.12` were pre-vetted OK/Approved in 04-RESEARCH.md's Package Legitimacy Audit; no new checkpoint was required for their install.

## Next Phase Readiness

- PWA-01 is implemented and automated-test-covered everywhere the RSC/browser boundary allows: manifest shape, both icon routes (including the DoS-mitigation clamp), the service worker's empty precache manifest (manually verified against a real build), the install banner's full show/hide/dismiss-persist lifecycle, and the login screen's standalone-scoped re-login hint.
- Live-verified in this session against an actual `npm run start` production server: `/manifest.webmanifest` (200, correct JSON), `/apple-icon` (200, 1266-byte PNG), `/api/pwa-icon?size=192` and `?size=512&maskable=1` (200, non-empty PNGs), `/sw.js` (200, JS with `precacheEntries:[]`), and the login page's `<head>` correctly carrying the `apple-touch-icon` link, `manifest` link, and `theme-color` meta tag.
- **Real-device iPhone UAT remains the one explicitly-tracked, non-silently-dropped manual verification item before phase sign-off** (D6 above, `human_judgment: true`) — install to home screen via Safari's "Add to Home Screen," launch in standalone mode, confirm the app's own icon appears, re-login once, confirm data loads. Per 04-VALIDATION.md's own Manual-Only Verifications row; no emulator can substitute for this.
- Phase 4 is now fully implemented (both 04-01 and 04-02 complete): the annual overview chart (HOME-02) and PWA installability (PWA-01) are both done, pending only this one real-device manual verification.

---
*Phase: 04-annual-overview-pwa-installability*
*Completed: 2026-08-31*

## Self-Check: PASSED

All 11 created files verified present on disk (`[ -f ]`). All four commit hashes (`36ef124`, `fb925b8`, `4e67671`, `1ef7329`) verified present in `git log --oneline --all`. Full acceptance-criteria and plan-level `<verification>` commands re-run and confirmed passing immediately before this SUMMARY was written: `npm run test -- src/app/manifest.test.ts src/app/api/pwa-icon/route.test.ts src/components/install-banner.render.test.tsx src/app/(auth)/login/page.render.test.tsx` (12/12 passed), `npm run test` (full suite, 346/346 passed), `npm run build --webpack` (compiled cleanly, generated `public/sw.js` with `precacheEntries:[]`), `grep -c "beforeinstallprompt" src/app/api/pwa-icon/route.ts src/app/apple-icon.tsx src/app/manifest.ts` (all 0), plus a live `npm run start` verification of all five PWA endpoints and the login page's injected `<head>` tags.
