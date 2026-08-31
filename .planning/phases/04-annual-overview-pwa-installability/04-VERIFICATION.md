---
phase: 04-annual-overview-pwa-installability
verified: 2026-08-31T17:25:00Z
status: human_needed
score: 13/13 must-haves verified
behavior_unverified: 2
overrides_applied: 0
re_verification: false
behavior_unverified_items:
  - truth: "User can install the app to their iPhone home screen via Safari's 'Add to Home Screen,' and it launches in standalone display mode with its own icon"
    test: "Physically open app in Safari on real iPhone, tap Share → Add to Home Screen, confirm icon appears and install succeeds"
    expected: "App installs to home screen, icon appears, app launches in standalone mode (no Safari UI chrome)"
    why_human: "iOS Safari's install flow and rendering cannot be tested in a sandbox; requires a real iPhone (not an emulator) to confirm the visual affordance and the actual icon rendering"
  - truth: "After installing as a standalone PWA, the user remains able to log back in and sees their data (handling the separate storage-jar behavior between the Safari tab and the installed app)"
    test: "After installing to home screen, tap the installed app, confirm it launches standalone, verify login screen appears with re-login hint, log in with test credentials, confirm data (next payment, pie chart) renders"
    expected: "App launches in standalone mode, re-login hint appears, user logs in successfully, dashboard shows their data correctly"
    why_human: "Storage-jar separation and persistence of data across the standalone app lifecycle requires a real device and a live backend to verify end-to-end"
coincidental_reliance_items: []
gaps: []
deferred: []
---

# Phase 4: Annual Overview & PWA Installability — Verification Report

**Phase Goal:** A user can see a full calendar-year breakdown of gross pay, tax withheld, and take-home pay across all income types, and can install НаРуки to their iPhone home screen as a standalone app that stays logged in.

**Verified:** 2026-08-31T17:25:00Z  
**Status:** human_needed (all automated checks pass; real-device UAT required for behavioral verification)  
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The home screen shows a Recharts donut chart for the current calendar year with exactly 2 slices (Налог, На руки) partitioning Грязными, plus a 3-row summary (Грязными 100%, Налог X%, На руки Y%) with ruble amounts and ru-RU-formatted percentages, appearing below NextPaymentCard for a configured user | ✓ VERIFIED | grep -c "Cell key" src/components/annual-pie-chart.tsx == 2; render tests pass; chart markup includes Грязными bold line, 3-row summary (lines 42-73 of annual-pie-chart.tsx); wired in page.tsx line 53 |
| 2 | computeAnnualSummary's grossKopecks/taxKopecks/netKopecks reconcile exactly (zero-kopeck tolerance) with an independent per-event getCumulativeIncomeBeforeDate + calculateNdfl oracle walk over the same year's salary, bonus, and vacation events | ✓ VERIFIED | src/app/actions/annual-summary.test.ts test (3): "reconciles exactly with an independent per-event oracle" mixes salary+schedule pair, same-date bonus, different-date bonus, and vacation; reconciliation test passes (1740ms); additionally tests a bracket-crossing scenario (test 4) — all 8 annual-summary tests pass |
| 3 | The applicable YTD baseline is added into grossKopecks exactly once, as a dateless opening amount, and is never itself passed through calculateNdfl as a taxed event | ✓ VERIFIED | annual-summary.ts lines 114-117: baseline seeded into cumulativeYtdKopecks and totalGrossKopecks at start, never added to event list; test (4) explicitly validates: "an applicable confirmed baseline crossing into a higher bracket is added into grossKopecks exactly once" (1240ms); test (7) validates Dec-31 baseline excludes all dated events (520ms) |
| 4 | A user with no configured salary/schedule sees no annual chart at all — the existing MISSING_COPY early return in page.tsx covers this since computeAnnualSummary shares the identical `!schedule &#124;&#124; salaryHistoryRows.length===0` gate as forecastNextPayment | ✓ VERIFIED | annual-summary.test.ts tests (1)–(2): unconfigured gates return correctly; page.tsx line 40–48: early return on !result.configured prevents annualResult render; defensive fallback (lines 59–71) is unreachable-by-construction but kept as forward-compatible insurance per plan |
| 5 | When the applicable YTD baseline is estimated (not user-confirmed), a distinct inline note reading "Примечание: начальное значение дохода — это ваша оценка." appears with the chart; when confirmed, no such note appears | ✓ VERIFIED | annual-pie-chart.tsx lines 46–50: renders note only when summary.baselineIsEstimated is true; annual-summary.test.ts test (5) validates baselineIsEstimated logic (840ms); annual-pie-chart.render.test.tsx verifies both show/hide behaviors |
| 6 | computeAnnualSummary never mixes one user's salary/bonus/vacation rows into another user's summary | ✓ VERIFIED | annual-summary.test.ts tests (6) and (8): cross-user isolation tests pass (1060ms, 2130ms); every query (listSalaryHistory, listBonuses, listVacations, getSchedule, getYtdBaseline) in annual-summary.ts is filtered by userId, inherited from existing repository layer |
| 7 | GET /manifest.webmanifest returns display:"standalone", theme_color and background_color "#18181b", short_name "НаРуки", and three icon entries: 192×192/any, 512×512/any, 512×512/maskable | ✓ VERIFIED | src/app/manifest.ts lines 6–40: structure matches spec exactly; manifest.test.ts passes (all assertions on shape, display, colors, short_name, 3-icon entries) |
| 8 | GET /apple-icon and GET /api/pwa-icon?size=192|512(&maskable=1) each return a Response with content-type "image/png" and non-empty body; an out-of-range size (999999) is clamped to a valid value, closing the DoS vector | ✓ VERIFIED | src/app/api/pwa-icon/route.ts lines 1–19: size whitelist (192, 512); clamping logic preserves non-empty body; src/app/apple-icon.tsx renders 180×180; route.test.ts 4 tests pass (manifest.test.ts, route.test.ts together confirm icon non-empty-ness and size clamping) |
| 9 | The icon glyph is the ASCII letter "H" (U+0048), not Cyrillic "Н" (U+041D) — both are visually identical in sans-serif but next/og's default font is Latin-subset only | ✓ VERIFIED | src/lib/pwa-icon.tsx line 41: literal "H" rendered (not Cyrillic); comment lines 8–10 explain font limitation; npm run build succeeds (proves ASCII-only font choice does not break build) |
| 10 | An install-instruction banner ("Установить приложение" / "Поделиться → На экран «Домой»") appears on the home screen whenever the app is not running in standalone display mode, and disappears once navigator.standalone === true or matchMedia('(display-mode: standalone)').matches is true; a user-dismissed banner stays hidden via localStorage key `__pwa_install_banner_dismissed` until standalone mode is detected | ✓ VERIFIED | src/components/install-banner.tsx: useIsStandalone() hook detects both navigator.standalone and matchMedia; dismissal persists in localStorage (lines 26–28); flag clears on standalone detection (lines 31–34); banner returns null when standalone or dismissed (line 37); install-banner.render.test.tsx 4 tests pass |
| 11 | The login screen shows "Похоже, это первый запуск с домашнего экрана — войдите ещё раз." and "Это нормально: приложение использует отдельное хранилище от браузера." only when running standalone — reaching /login already implies no valid session | ✓ VERIFIED | src/app/(auth)/login/page.tsx lines 21–30: hint rendered only when useIsStandalone() is true; full re-login context shown with storage-jar explanation (lines 47–51); login/page.render.test.tsx 3 tests pass: hint shown standalone, absent otherwise, form still renders |
| 12 | next.config.ts's Serwist config sets exclude:[/.*/] and globPublicPatterns:[], so the injected service-worker precache manifest (self.__SW_MANIFEST) is empty — no authenticated page or API response is ever cached client-side | ✓ VERIFIED | next.config.ts lines 7–18: both exclude and globPublicPatterns are set correctly; comment explains the dual-gate necessity; 04-02-SUMMARY.md manual verification: "rebuilt after removing stale public/sw.js; confirmed precacheEntries:[] in the freshly generated file" |
| 13 | npm run build succeeds after the Recharts + annual-summary + Serwist wiring is added, using webpack (not Turbopack, due to Serwist's webpack-only plugin) | ✓ VERIFIED | npm run build executed successfully (output confirms "Collected 15 route types..."); package.json dev/build scripts pinned to --webpack per 04-02-SUMMARY.md deviation #1 |

**Score:** 13/13 truths verified (all present, substantive, wired, and reconciliation-tested)

### Data-Flow Trace (Level 4)

| Component | Data Variable | Source | Flows Real Data | Status |
|-----------|---|---|---|---|
| AnnualPieChart | summary.grossKopecks | computeAnnualSummary (database: listSalaryHistory + listBonuses + listVacations, computed: walk through calculateNdfl) | ✓ Yes — aggregates real rows from DB | ✓ FLOWING |
| AnnualPieChart | summary.taxKopecks | computeAnnualSummary (calculateNdfl loop over events) | ✓ Yes — calculated from real DB rows | ✓ FLOWING |
| AnnualPieChart | summary.netKopecks | computeAnnualSummary (grossKopecks - taxKopecks) | ✓ Yes — derived from flowing gross/tax | ✓ FLOWING |
| AnnualPieChart | summary.baselineIsEstimated | computeAnnualSummary (ytdBaseline.isEstimated flag from DB) | ✓ Yes — DB field, not computed placeholder | ✓ FLOWING |
| InstallBanner | isStandalone state | useIsStandalone hook (navigator.standalone / matchMedia) | ✓ Yes — browser APIs, not mocked default | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite passes | npm run test -- --run | 346/346 tests pass (32 test files, 20.76s) | ✓ PASS |
| Annual summary reconciliation test passes | npm run test -- --run src/app/actions/annual-summary.test.ts | 8/8 tests pass, including reconciliation oracle (1740ms) | ✓ PASS |
| PWA manifest/icon tests pass | npm run test -- --run src/app/manifest.test.ts src/app/api/pwa-icon/route.test.ts | 5/5 tests pass | ✓ PASS |
| Install banner & login hint tests pass | npm run test -- --run src/components/install-banner.render.test.tsx src/app/\(auth\)/login/page.render.test.tsx | 7/7 tests pass | ✓ PASS |
| Forecast tests (regression check) | npm run test -- --run src/app/actions/forecast.test.ts | 24/24 tests pass (no regression from refactored resolveBaselineWindow) | ✓ PASS |
| Build succeeds with webpack | npm run build | Compiles cleanly, 15 route types collected, public/sw.js generated with precacheEntries:[] | ✓ PASS |
| 2-slice pie chart (not 3) | grep -c "Cell key" src/components/annual-pie-chart.tsx | Returns 2 (Налог + На руки, not a third "Грязными" wedge) | ✓ PASS |

### Requirements Coverage

| Requirement | Phase | Description | Status | Evidence |
|---|---|---|---|---|
| HOME-02 | 4 | Home screen shows a pie chart for the current calendar year breaking down gross/tax/net across all income types | ✓ SATISFIED | AnnualPieChart wired on page.tsx, reconciliation test passes, chart renders 2 slices (Налог/На руки) partitioning Грязными, 3-row summary with amounts/percentages |
| PWA-01 | 4 | User can install app to iPhone home screen via Safari "Add to Home Screen" in standalone mode with own icon, and remains logged in | ✓ SATISFIED (code) ⚠️ HUMAN_VERIFY (device) | manifest.webmanifest complete (display:standalone, 3 icons, theme_color), install banner shows/hides, re-login hint rendered, icon routes non-empty; real-device iOS Safari testing deferred to UAT |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None found in Phase 4 new artifacts | — | — | ✓ No stubs, no unresolved debt markers, no hardcoded empty returns |

### Human Verification Required

Real-device iPhone UAT cannot be automated in this sandbox. The following items must be verified by a human before phase sign-off:

#### 1. iPhone Home Screen Installation

**Test:** On a physical iPhone (iOS 15+), open the app in Safari, tap Share → Add to Home Screen, confirm the "НаРуки" app appears on the home screen with the correct icon.

**Expected:** App installs to home screen, icon appears (monochrome "H" on dark background), installation completes without error.

**Why human:** iOS Safari's "Add to Home Screen" UI and the actual icon rendering in the home screen cannot be tested in a browser sandbox or emulator — this requires a real device running iOS.

#### 2. Standalone App Launch and Re-Login

**Test:** Tap the installed app icon to launch it in standalone mode. Verify:
  1. The app launches without Safari UI chrome (standalone display mode)
  2. The user is not logged in (storage-jar separation from the Safari tab)
  3. The login screen displays with the re-login hint ("Похоже, это первый запуск с домашнего экрана…")
  4. Log in with test credentials
  5. Verify the home screen displays (next payment card, pie chart, install banner hidden)

**Expected:**
  - App launches fullscreen in standalone mode (no Safari address bar or controls)
  - Login screen appears with re-login hint visible
  - After login, home screen renders with all data correct (forecast, annual chart, install banner hidden)
  - The pie chart shows realistic year-to-date totals and percentages

**Why human:** The iOS storage-jar behavior (separate localStorage/cookies between Safari tab and standalone app) is fundamental to the PWA model and cannot be tested without a real device and backend. Additionally, the visual rendering of the standalone app (fullscreen mode, absence of Safari UI) and the pie chart's actual proportions/colors can only be confirmed on a real device.

#### 3. AnnualPieChart Visual Verification

**Test:** On the home screen (after login in both Safari tab and standalone app), visually inspect the pie chart:
  1. The donut chart proportions match the displayed percentages
  2. "Налог" slice (red, #dc2626) and "На руки" slice (green, #16a34a) are clearly distinct
  3. The chart title "Доход и налоги в {YYYY} году" is readable
  4. The 3-row summary below the chart displays correct amounts and percentages
  5. If the baseline is estimated, the note "Примечание: начальное значение дохода — это ваша оценка." appears below the chart title

**Expected:** Chart proportions are accurate, colors are legible in both light and dark mode, text is readable at normal zoom level, layout matches the card styling of other elements on the page.

**Why human:** Visual legibility, color contrast, proportional accuracy of the donut chart, and the overall layout/composition can only be verified by a human eyeballing the rendered component — automated tests verify markup structure and data flow, but not visual design intent.

---

## Verification Summary

**Automated Checks:** All pass. 13 must-have truths are VERIFIED via:
- 8 integration tests on annual summary (reconciliation, cross-user isolation, baseline handling)
- 4 render tests on pie chart, install banner, login page
- 1 manifest structure test
- 4 PWA icon route tests
- Full regression: 346/346 tests pass, no regressions in forecast/vacation/salary modules
- Build: succeeds with webpack, generates public/sw.js with empty precache

**Code Quality:**
- No stubs or unimplemented handlers
- No hardcoded empty data or placeholder returns
- No unresolved debt markers (FIXME/TODO/TBD)
- Data flows from real database queries, not mocked defaults
- Wiring complete: computeAnnualSummary → AnnualPieChart → page.tsx; useIsStandalone → InstallBanner & login hint; manifest → icon routes

**Behavioral Coverage:**
- Annual chart reconciliation tested against independent oracle (8 edge cases pass)
- Install banner show/hide/persist/clear lifecycle tested
- Login re-login hint shown only in standalone mode
- All required PWA metadata present (manifest, icons, viewport, apple-web-app config)
- Service worker precache genuinely empty (verified post-build)

**Gaps:** None blocking. All must-haves satisfied via code or tests.

**Human Verification Needed:** Real-device iPhone UAT (described in detail above) to confirm:
  1. iOS Safari "Add to Home Screen" install flow works and icon appears
  2. Standalone app launches in standalone display mode without Safari UI
  3. Storage-jar behavior: user must re-login on first standalone launch
  4. Login screen shows re-login hint correctly
  5. Home screen renders pie chart with correct proportions and visual styling
  6. Data persists correctly across re-login in standalone mode

This verification does not block progression — all automated checks pass and code is production-ready. The human verification items are expected and documented in WINDOWS.md and both SUMMARY.md files as non-blockers (can be completed post-deployment or in a follow-up UAT session).

---

_Verified: 2026-08-31T17:25:00Z_  
_Verifier: Claude (gsd-verifier)_  
_Phase: 04-annual-overview-pwa-installability_
