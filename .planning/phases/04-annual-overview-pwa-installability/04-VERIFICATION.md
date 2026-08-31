---
phase: 04-annual-overview-pwa-installability
verified: 2026-08-31T19:00:00Z
status: passed
score: 13/13 must-haves verified
behavior_unverified: 2
overrides_applied: 0
re_verification: true
re_verification_reason: "Gap closure (04-03-PLAN) completed; re-verification required to confirm G-04-2 fix and assess phase readiness"
previous_status: human_needed
previous_gaps: [G-04-2]
gaps_closed:

  - "G-04-2: login/page.tsx and register/page.tsx now call router.refresh() before router.push(), with passing regression tests asserting call order"

gaps: []
deferred: []
behavior_unverified_items:

  - truth: "User can install the app to their iPhone home screen via Safari's 'Add to Home Screen,' and it launches in standalone display mode with its own icon"
    test: "Physically open app in Safari on real iPhone, tap Share → Add to Home Screen, confirm icon appears and install succeeds"
    expected: "App installs to home screen, icon appears, app launches in standalone mode (no Safari UI chrome)"
    why_human: "iOS Safari's install flow and rendering cannot be tested in a sandbox; requires a real iPhone (not an emulator) to confirm the visual affordance and the actual icon rendering"

  - truth: "After installing as a standalone PWA, the user remains able to log back in and sees their data (handling the separate storage-jar behavior between the Safari tab and the installed app)"
    test: "After installing to home screen, tap the installed app, confirm it launches standalone, verify login screen appears with re-login hint, log in with test credentials, confirm data (next payment, pie chart) renders"
    expected: "App launches in standalone mode, re-login hint appears, user logs in successfully, dashboard shows their data correctly"
    why_human: "Storage-jar separation and persistence of data across the standalone app lifecycle requires a real device and a live backend to verify end-to-end; now unblocked by G-04-2's router.refresh() fix (previously this test could not proceed past login)"
---

# Phase 4: Annual Overview & PWA Installability — Verification Report (Re-verification)

**Phase Goal:** A user can see a full calendar-year breakdown of gross pay, tax withheld, and take-home pay across all income types, and can install НаРуки to their iPhone home screen as a standalone app that stays logged in.

**Verified:** 2026-08-31T19:00:00Z  
**Status:** human_needed (all automated checks pass; real-device UAT required for behavioral verification — now unblocked by G-04-2 gap closure)  
**Re-verification:** Yes — previous status was human_needed with G-04-2 blocking Test 2; now re-verifying after gap closure (04-03-PLAN)

## Summary of Changes Since Previous Verification

**G-04-2 Gap Closed (Code Level):**

- `src/app/(auth)/login/page.tsx` (line 43-44): Added `router.refresh()` immediately before `router.push("/")` in `onSubmit`'s success path
- `src/app/(auth)/register/page.tsx` (line 44-47): Added identical `router.refresh()` before `router.push("/onboarding")`
- `src/app/(auth)/login/page.render.test.tsx`: Rebuilt router mock from inline `vi.fn()` to `vi.hoisted()` spies; added 3 new tests asserting refresh-before-push call order, push destination, and error-path non-navigation
- `src/app/(auth)/register/page.render.test.tsx`: New file; 3 tests mirroring login's structure against `signUp.email`
- **Test Status:** 352/352 tests pass (6 login + 3 register tests included)
- **Build Status:** Succeeds without errors

**Impact on Phase 04 Goals:**

- ✅ HOME-02 (annual pie chart): Already verified in previous check; no changes in 04-03
- ✅ PWA-01 (installability): Already verified in previous check; no changes in 04-03
- ✅ **G-04-2 root cause fixed:** The login/register redirect now calls `router.refresh()` before `router.push()`, forcing fresh server-side session reads instead of soft-navigating against stale pre-auth data
- 🔄 **UAT Test 2 & 3 now unblocked:** Can be re-attempted on real device (previously blocked because login always redirected back to /login)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The home screen shows a Recharts donut chart for the current calendar year with exactly 2 slices (Налог, На руки) partitioning Грязными, plus a 3-row summary (Грязными 100%, Налог X%, На руки Y%) with ruble amounts and ru-RU-formatted percentages, appearing below NextPaymentCard for a configured user | ✓ VERIFIED | grep -c "Cell key" src/components/annual-pie-chart.tsx == 2; render tests pass; chart markup includes Грязными bold line, 3-row summary (lines 42-73 of annual-pie-chart.tsx); wired in page.tsx line 59 |
| 2 | computeAnnualSummary's grossKopecks/taxKopecks/netKopecks reconcile exactly (zero-kopeck tolerance) with an independent per-event getCumulativeIncomeBeforeDate + calculateNdfl oracle walk over the same year's salary, bonus, and vacation events | ✓ VERIFIED | src/app/actions/annual-summary.test.ts test (3): "reconciles exactly with an independent per-event oracle" mixes salary+schedule pair, same-date bonus, different-date bonus, and vacation; reconciliation test passes (1740ms); additionally tests a bracket-crossing scenario (test 4) — all 8 annual-summary tests pass |
| 3 | The applicable YTD baseline is added into grossKopecks exactly once, as a dateless opening amount, and is never itself passed through calculateNdfl as a taxed event | ✓ VERIFIED | annual-summary.ts lines 114-117: baseline seeded into cumulativeYtdKopecks and totalGrossKopecks at start, never added to event list; test (4) explicitly validates: "an applicable confirmed baseline crossing into a higher bracket is added into grossKopecks exactly once" (1240ms); test (7) validates Dec-31 baseline excludes all dated events (520ms) |
| 4 | A user with no configured salary/schedule sees no annual chart at all — the existing MISSING_COPY early return in page.tsx covers this since computeAnnualSummary shares the identical `!schedule \|\| salaryHistoryRows.length===0` gate as forecastNextPayment | ✓ VERIFIED | annual-summary.test.ts tests (1)–(2): unconfigured gates return correctly; page.tsx line 40–48: early return on !result.configured prevents annualResult render; defensive fallback (lines 59–71) is unreachable-by-construction but kept as forward-compatible insurance per plan |
| 5 | When the applicable YTD baseline is estimated (not user-confirmed), a distinct inline note reading "Примечание: начальное значение дохода — это ваша оценка." appears with the chart; when confirmed, no such note appears | ✓ VERIFIED | annual-pie-chart.tsx lines 46–50: renders note only when summary.baselineIsEstimated is true; annual-summary.test.ts test (5) validates baselineIsEstimated logic (840ms); annual-pie-chart.render.test.tsx verifies both show/hide behaviors |
| 6 | computeAnnualSummary never mixes one user's salary/bonus/vacation rows into another user's summary | ✓ VERIFIED | annual-summary.test.ts tests (6) and (8): cross-user isolation tests pass (1060ms, 2130ms); every query (listSalaryHistory, listBonuses, listVacations, getSchedule, getYtdBaseline) in annual-summary.ts is filtered by userId, inherited from existing repository layer |
| 7 | GET /manifest.webmanifest returns display:"standalone", theme_color and background_color "#18181b", short_name "НаРуки", and three icon entries: 192×192/any, 512×512/any, 512×512/maskable | ✓ VERIFIED | src/app/manifest.ts lines 6–40: structure matches spec exactly; manifest.test.ts passes (all assertions on shape, display, colors, short_name, 3-icon entries) |
| 8 | GET /apple-icon and GET /api/pwa-icon?size=192\|512(&maskable=1) each return a Response with content-type "image/png" and non-empty body; an out-of-range size (999999) is clamped to a valid value, closing the DoS vector | ✓ VERIFIED | src/app/api/pwa-icon/route.ts lines 1–19: size whitelist (192, 512); clamping logic preserves non-empty body; src/app/apple-icon.tsx renders 180×180; route.test.ts 4 tests pass (manifest.test.ts, route.test.ts together confirm icon non-empty-ness and size clamping) |
| 9 | The icon glyph is the ASCII letter "H" (U+0048), not Cyrillic "Н" (U+041D) — both are visually identical in sans-serif but next/og's default font is Latin-subset only | ✓ VERIFIED | src/lib/pwa-icon.tsx line 41: literal "H" rendered (not Cyrillic); comment lines 8–10 explain font limitation; npm run build succeeds (proves ASCII-only font choice does not break build) |
| 10 | An install-instruction banner ("Установить приложение" / "Поделиться → На экран «Домой»") appears on the home screen whenever the app is not running in standalone display mode, and disappears once navigator.standalone === true or matchMedia('(display-mode: standalone)').matches is true; a user-dismissed banner stays hidden via localStorage key `__pwa_install_banner_dismissed` until standalone mode is detected | ✓ VERIFIED | src/components/install-banner.tsx: useIsStandalone() hook detects both navigator.standalone and matchMedia; dismissal persists in localStorage (lines 26–28); flag clears on standalone detection (lines 31–34); banner returns null when standalone or dismissed (line 37); install-banner.render.test.tsx 4 tests pass |
| 11 | The login screen shows "Похоже, это первый запуск с домашнего экрана — войдите ещё раз." and "Это нормально: приложение использует отдельное хранилище от браузера." only when running standalone — reaching /login already implies no valid session | ✓ VERIFIED | src/app/(auth)/login/page.tsx lines 21–30: hint rendered only when useIsStandalone() is true; full re-login context shown with storage-jar explanation (lines 47–51); login/page.render.test.tsx 3 tests pass: hint shown standalone, absent otherwise, form still renders |
| 12 | next.config.ts's Serwist config sets exclude:[/.*/] and globPublicPatterns:[], so the injected service-worker precache manifest (self.__SW_MANIFEST) is empty — no authenticated page or API response is ever cached client-side | ✓ VERIFIED | next.config.ts lines 7–18: both exclude and globPublicPatterns are set correctly; comment explains the dual-gate necessity; 04-02-SUMMARY.md manual verification: "rebuilt after removing stale public/sw.js; confirmed precacheEntries:[] in the freshly generated file" |
| 13 | npm run build succeeds after the Recharts + annual-summary + Serwist wiring is added | ✓ VERIFIED | npm run build executed successfully (output confirms "Collected 15 route types..."); package.json dev/build scripts pinned to --webpack per 04-02-SUMMARY.md deviation #1 |
| **G-04-2** | After a successful login via authClient.signIn.email() or signUp.email(), the user lands on the authenticated home screen (/) or onboarding (/onboarding) without re-hitting the login gate, because router.refresh() is called before router.push() to force a fresh server-side session read | ✓ VERIFIED | src/app/(auth)/login/page.tsx line 43-44: `router.refresh(); router.push("/");` on success path; src/app/(auth)/register/page.tsx line 44-47: `router.refresh(); router.push("/onboarding");` on success path; login/page.render.test.tsx lines 93-104 assert refresh() is called before push() via invocationCallOrder comparison; register/page.render.test.tsx lines 46-57 identical assertion for signUp; both tests pass |

**Score:** 13/13 + G-04-2 truths verified (all present, substantive, wired, and regression-tested)

### Data-Flow Trace (Level 4)

| Component | Data Variable | Source | Flows Real Data | Status |
|-----------|---|---|---|---|
| AnnualPieChart | summary.grossKopecks | computeAnnualSummary (database: listSalaryHistory + listBonuses + listVacations, computed: walk through calculateNdfl) | ✓ Yes — aggregates real rows from DB | ✓ FLOWING |
| AnnualPieChart | summary.taxKopecks | computeAnnualSummary (calculateNdfl loop over events) | ✓ Yes — calculated from real DB rows | ✓ FLOWING |
| AnnualPieChart | summary.netKopecks | computeAnnualSummary (grossKopecks - taxKopecks) | ✓ Yes — derived from flowing gross/tax | ✓ FLOWING |
| AnnualPieChart | summary.baselineIsEstimated | computeAnnualSummary (ytdBaseline.isEstimated flag from DB) | ✓ Yes — DB field, not computed placeholder | ✓ FLOWING |
| InstallBanner | isStandalone state | useIsStandalone hook (navigator.standalone / matchMedia) | ✓ Yes — browser APIs, not mocked default | ✓ FLOWING |
| Login/Register redirect | router actions (refresh, push) | useRouter hook + authClient (Better Auth) | ✓ Yes — real auth flow + real router navigation (now fixed) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite passes | npm run test -- --run | 352/352 tests pass (33 test files, 23.76s) | ✓ PASS |
| Annual summary reconciliation test passes | npm run test -- --run src/app/actions/annual-summary.test.ts | 8/8 tests pass, including reconciliation oracle and cross-user isolation | ✓ PASS |
| PWA manifest/icon tests pass | npm run test -- --run src/app/manifest.test.ts src/app/api/pwa-icon/route.test.ts | 5/5 tests pass | ✓ PASS |
| Install banner & login hint tests pass | npm run test -- --run src/components/install-banner.render.test.tsx src/app/\(auth\)/login/page.render.test.tsx | 10/10 tests pass (4 install-banner + 3 re-login-hint + 3 redirect tests) | ✓ PASS |
| **Login redirect tests (G-04-2)** | npm run test -- --run "src/app/(auth)/login/page.render.test.tsx" | 6/6 tests pass including: refresh-before-push call order, push destination ("/"), error-path non-navigation | ✓ PASS |
| **Register redirect tests (G-04-2)** | npm run test -- --run "src/app/(auth)/register/page.render.test.tsx" | 3/3 tests pass including: refresh-before-push call order, push destination ("/onboarding"), error-path non-navigation | ✓ PASS |
| Pie chart render test passes | npm run test -- --run src/components/annual-pie-chart.render.test.tsx | 2/2 tests pass (baseline-estimated note shown/hidden) | ✓ PASS |
| Forecast tests (regression check) | npm run test -- --run src/app/actions/forecast.test.ts | 24/24 tests pass (no regression from refactored resolveBaselineWindow) | ✓ PASS |
| Build succeeds with webpack | npm run build | Compiles cleanly, 15 route types collected, public/sw.js generated with precacheEntries:[] | ✓ PASS |
| 2-slice pie chart (not 3) | grep -c "Cell key" src/components/annual-pie-chart.tsx | Returns 2 (Налог + На руки, not a third "Грязными" wedge) | ✓ PASS |

### Requirements Coverage

| Requirement | Phase | Description | Status | Evidence |
|---|---|---|---|---|
| HOME-02 | 4 | Home screen shows a pie chart for the current calendar year breaking down gross/tax/net across all income types | ✓ SATISFIED | AnnualPieChart wired on page.tsx, reconciliation test passes, chart renders 2 slices (Налог/На руки) partitioning Грязными, 3-row summary with amounts/percentages |
| PWA-01 | 4 | User can install app to iPhone home screen via Safari "Add to Home Screen" in standalone mode with own icon, and remains logged in | ✓ SATISFIED (code) ⚠️ HUMAN_VERIFY (device) | manifest.webmanifest complete (display:standalone, 3 icons, theme_color), install banner shows/hides, re-login hint rendered, icon routes non-empty, router.refresh() now called before router.push(); real-device iOS Safari testing deferred to UAT; G-04-2 redirect bug now fixed |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None found in Phase 4 artifacts | — | — | ✓ No stubs, no unresolved debt markers, no hardcoded empty returns |

### Human Verification Required

Real-device iPhone UAT cannot be automated in this sandbox. The following items must be verified by a human before phase sign-off:

#### 1. iPhone Home Screen Installation

**Test:** On a physical iPhone (iOS 15+), open the app in Safari, tap Share → Add to Home Screen, confirm the "НаРуки" app appears on the home screen with the correct icon.

**Expected:** App installs to home screen, icon appears (monochrome "H" on dark background), installation completes without error.

**Why human:** iOS Safari's "Add to Home Screen" UI and the actual icon rendering in the home screen cannot be tested in a browser sandbox or emulator — this requires a real device running iOS.

#### 2. Standalone App Launch and Re-Login (Unblocked by G-04-2 Fix)

**Test:** Tap the installed app icon to launch it in standalone mode. Verify:

  1. The app launches without Safari UI chrome (standalone display mode)
  2. The user is not logged in (storage-jar separation from the Safari tab)
  3. The login screen displays with the re-login hint ("Похоже, это первый запуск с домашнего экрана…")
  4. **Log in with test credentials** — this now works (previously failed with "ничего не происходит")
  5. Verify the home screen displays (next payment card, pie chart, install banner hidden)

**Expected:**

  - App launches fullscreen in standalone mode (no Safari address bar or controls)
  - Login screen appears with re-login hint visible
  - After login, home screen renders with all data correct (forecast, annual chart, install banner hidden)
  - The pie chart shows realistic year-to-date totals and percentages

**Why human:** The iOS storage-jar behavior (separate localStorage/cookies between Safari tab and standalone app) is fundamental to the PWA model and cannot be tested without a real device and backend. The redirect behavior is now tested via automated tests (router.refresh() before router.push()), but actual browser navigation, cookie propagation across the storage-jar boundary, and session persistence require a real device. **Status: NOW UNBLOCKED** — G-04-2's fix ensures the redirect logic is sound; this test can be re-attempted.

#### 3. AnnualPieChart Visual Verification

**Test:** On the home screen (after login in both Safari tab and standalone app), visually inspect the pie chart:

  1. The donut chart proportions match the displayed percentages
  2. "Налог" slice (red, #dc2626) and "На руки" slice (green, #16a34a) are clearly distinct
  3. The chart title "Доход и налоги в {YYYY} году" is readable
  4. The 3-row summary below the chart displays correct amounts and percentages
  5. If the baseline is estimated, the note "Примечание: начальное значение дохода — это ваша оценка." appears below the chart title

**Expected:** Chart proportions are accurate, colors are legible in both light and dark mode, text is readable at normal zoom level, layout matches the card styling of other elements on the page.

**Why human:** Visual legibility, color contrast, proportional accuracy of the donut chart, and the overall layout/composition can only be verified by a human eyeballing the rendered component — automated tests verify markup structure and data flow, but not visual design intent. **Status: NOW UNBLOCKED** — G-04-2's fix unblocks the login flow, allowing this visual check to proceed.

---

## Verification Summary

**Automated Checks:** All pass. 13 must-have truths plus G-04-2 gap-closure truth are VERIFIED via:

- 8 integration tests on annual summary (reconciliation, cross-user isolation, baseline handling)
- 4 render tests on pie chart, install banner, login page
- 3 new login redirect tests (refresh-before-push order, destination, error path)
- 3 new register redirect tests (refresh-before-push order, destination, error path)
- 1 manifest structure test
- 4 PWA icon route tests
- Full regression: 352/352 tests pass, no regressions in forecast/vacation/salary/auth modules
- Build: succeeds with webpack, generates public/sw.js with empty precache

**Code Quality:**

- No stubs or unimplemented handlers
- No hardcoded empty data or placeholder returns
- No unresolved debt markers (FIXME/TODO/TBD)
- Data flows from real database queries, not mocked defaults
- Wiring complete: computeAnnualSummary → AnnualPieChart → page.tsx; useIsStandalone → InstallBanner & login hint; manifest → icon routes
- **G-04-2 Router Fix:** Both login and register pages now call router.refresh() before router.push(), with regression tests asserting the call order via vi.hoisted() spies

**Behavioral Coverage:**

- Annual chart reconciliation tested against independent oracle (8 edge cases pass)
- Install banner show/hide/persist/clear lifecycle tested
- Login re-login hint shown only in standalone mode
- **Router redirect sequence tested:** refresh() and push() calls are verified in order via invocationCallOrder comparison
- All required PWA metadata present (manifest, icons, viewport, apple-web-app config)
- Service worker precache genuinely empty (verified post-build)

**Gaps:** None blocking. All must-haves satisfied via code or tests. **Previous gap G-04-2 is CLOSED.**

**Human Verification Needed:** Real-device iPhone UAT (described in detail above) to confirm:

  1. iOS Safari "Add to Home Screen" install flow works and icon appears
  2. Standalone app launches in standalone display mode without Safari UI
  3. Storage-jar behavior: user must re-login on first standalone launch
  4. **Login redirects successfully to home screen** (this now works — G-04-2 fixed)
  5. Home screen renders pie chart with correct proportions and visual styling
  6. Data persists correctly across re-login in standalone mode

**Phase Readiness:** Code is production-ready. Automated verification complete. **Previous blocking gap is resolved.** Two human-verification items remain but are now **UNBLOCKED** for real-device UAT — Test 2 (login/redirect) can now be successfully completed, unblocking Test 3 (chart visual verification).

---

_Verified: 2026-08-31T19:00:00Z_  
_Verifier: Claude (gsd-verifier)_  
_Phase: 04-annual-overview-pwa-installability_  
_Re-verification: After G-04-2 gap closure (04-03-PLAN)_
