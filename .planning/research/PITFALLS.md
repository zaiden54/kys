# Pitfalls Research

**Domain:** Russian payroll/take-home-pay tracking PWA (НДФЛ progressive tax, otpusknye, iOS home-screen install)
**Researched:** 2026-08-28
**Confidence:** MEDIUM (tax/labor-law rules cross-verified across ConsultantPlus, Garant, nalog.gov.ru, Klerk; iOS PWA behavior cross-verified across MagicBell, Pushpad, Apple Developer Forums — no single source is a primary spec, so treat exact numeric constants as needing a final check against the current-year НК РФ/ТК РФ text before shipping tax code)

## Critical Pitfalls

### Pitfall 1: Treating the progressive НДФЛ scale as "whole payment taxed at the bracket's rate" instead of marginal/cumulative

**What goes wrong:**
A developer computes tax for a payment by looking at the employee's *current* cumulative annual income, finding which bracket it falls in, and applying that single rate to the *entire current payment*. This overtaxes (or undertaxes) any payment that straddles a bracket boundary, and produces wrong results for every payment once cumulative income crosses 2.4M ₽/year.

**Why it happens:**
The five brackets (13% / 15% / 18% / 20% / 22% for 2025, thresholds 2.4M / 5M / 20M / 50M ₽) look like flat marginal-rate tables you'd see for corporate tax, but the natural-seeming implementation is "if income > threshold, apply higher rate to it" rather than the correct method: tax on cumulative annual income is computed via the fixed-base formula (e.g. 15% bracket = 312,000 + 15% × (cumulative − 2,400,000)), and the tax **due at this payment** = tax(cumulative income through this payment) − tax already withheld this year. This "withhold the delta" method is the only correct approach for a per-payment, nарастающим итогом system.

**How to avoid:**
- Implement a single pure function `taxOnCumulative(annualIncomeToDate) -> tax` using the fixed-base-plus-marginal-excess formula, not a "multiply by bracket rate" function.
- Tax withheld at any given payment = `taxOnCumulative(cumulativeAfterThisPayment) - cumulativeTaxAlreadyWithheldThisYear`.
- Write unit tests with a payment that straddles a bracket boundary (e.g. cumulative goes from 2,390,000 to 2,420,000 in one payment) and assert the split is 13%/15%, not a single rate.
- Test against the 4 boundary values (2.4M, 5M, 20M, 50M) explicitly.

**Warning signs:**
- Tax code has an `if/else if` chain on the *payment amount* rather than on *cumulative* income.
- No function that computes "tax already withheld year-to-date" as an explicit running total.
- Rounding differences appear only for high earners near a bracket boundary.

**Phase to address:** Core tax-calculation engine phase (before any UI is built on top of it) — this must be a standalone, thoroughly unit-tested module.

---

### Pitfall 2: Ignoring the 2023 rule change that НДФЛ is withheld from every payment (including the аванс), based on actual payment date

**What goes wrong:**
Older payroll guides (pre-2023) describe income as "received" on the last calendar day of the month, with tax withheld once at month-end. Building the calculator around that model means the аванс (advance, typically ~mid-month) is shown as untaxed/gross, and the whole month's tax is dumped onto the second payment — which doesn't match how take-home pay actually lands in 2025+ and will make the app's forecast wrong for the first payment of every month.

**Why it happens:**
This is a genuinely confusing area of Russian payroll history — many Russian-language tutorials and even some accounting software still reference the pre-2023 "date of receipt = last day of month" rule because it applied for years and old content ranks well in search.

**How to avoid:**
- Model "date of income receipt" (дата фактического получения дохода) as the actual payment date for every payment type (salary tranche, аванс, premium, vacation pay). НК РФ ст. 223 п.1 + 263-ФЗ (effective 2023) confirm this.
- Each payment (аванс and зарплата) independently increases the cumulative annual base and independently triggers a withholding calculation at the moment it's paid — there is no "batch tax at month end" step.
- When seeding "график выплат" (аванс + зарплата), make sure both payment dates feed the same cumulative-income timeline in date order.

**Warning signs:**
- Code path that computes tax "once per month" rather than "once per payment event."
- Аванс always shown as a round, untaxed fraction of oklad (e.g. exactly 40%) with no tax line.

**Phase to address:** Core tax-calculation engine / payment schedule design phase.

---

### Pitfall 3: Computing each payment's tax independently instead of processing all income events for the year in strict chronological order

**What goes wrong:**
Because a user's income now includes salary payments, premii, and otpusknye — potentially added or edited out of order relative to when the calculator runs — a naive implementation might compute each event's tax "in isolation" (e.g. by month, or by type) rather than replaying the full chronological sequence of payments for the calendar year to build up the cumulative base. This breaks the "delta from previous cumulative tax" method in Pitfall 1 and produces incorrect splits when, say, a one-off premium is paid between the аванс and the зарплата, or vacation pay lands mid-month.

**Why it happens:**
It's tempting to calculate "this payment's tax" as a self-contained operation (nice for caching/memoization), but the progressive-cumulative model is fundamentally sequential and stateful across the whole tax year — the order of *all* payments (salary, premii, otpusknye) within the year determines which bracket each subsequent payment falls into.

**How to avoid:**
- Model the tax engine as: given a user + calendar year, gather *all* income events (salary tranches, premii, otpusknye) sorted by actual payment date, then fold over them sequentially maintaining a running cumulative-income and cumulative-tax-withheld state.
- Any edit to a past-dated event (backdated premium, changed vacation date) must invalidate and recompute the cumulative chain forward from that point, not just the single edited event.
- Never memoize/cache a payment's tax amount independent of its position in the year's sequence.

**Warning signs:**
- Tax calculation function signature takes only `(paymentAmount, priorCumulativeIncome)` without also considering *what already happened this year* being sourced from a live, correctly-ordered ledger.
- Editing an earlier-dated event doesn't visibly change later forecasted payments.

**Phase to address:** Core tax-calculation engine phase; revisit when premii and otpusknye features are added, since they inject extra events into the year's sequence.

---

### Pitfall 4: Computing otpusknye average daily earnings with a naive `totalEarnings / 12 / 29.3` and no exclusions/proration

**What goes wrong:**
ТК РФ ст. 139 + Постановление Правительства РФ №922 define средний дневной заработок as earnings over the preceding 12 calendar months divided by 12 and by 29.3 — but only when *all 12 months were fully worked and fully paid*. In practice: (a) employees with under 12 months of tenure need a different period (from hire date, or from the month worked), (b) months containing sick leave, other paid vacation, unpaid leave, or downtime must be excluded or prorated (`29.3 / daysInMonth × actualCalendarDaysWorked`), and (c) if a salary increase (indexation) happened during or right after the 12-month period, earlier months must be scaled up by a coefficient before averaging. A calculator that just sums 12 months of salary-history rows and divides by 12×29.3 will be measurably wrong for any user with a raise, a sick day, or under a year of tenure in the app.

**Why it happens:**
The "12 months / 29.3" formula is the one everyone quotes, but it's the *simple case* — the actual regulation (Order 922) is a dense set of exclusion rules that most blog-level sources gloss over or only partially list.

**How to avoid:**
- Explicitly scope v1: decide whether excluded periods (sick leave, other leave, downtime) and indexation coefficients are modeled, or explicitly deferred with a documented "assumes no gaps/no mid-period raises" caveat surfaced to the user (e.g. a disclaimer on the otpusknye estimate).
- If deferred, still handle the *tenure-under-12-months* case correctly (it's the most common real edge case for a first-year product) — don't let it silently divide by a wrong denominator or throw.
- If salary history is tracked (per PROJECT.md's "хранит историю окладов"), that history is the natural data source for reconstructing which months are affected — use it rather than assuming a flat rate for the whole lookback window.
- Write test cases: (a) full 12 months no changes, (b) mid-period raise, (c) employee with 4 months of tenure, (d) a month partially worked.

**Warning signs:**
- Otpusknye formula is a single one-liner with no reference to salary-history rows or excluded-period data.
- No handling for `< 12 months of history` — either a crash, a NaN, or a silently wrong number.

**Phase to address:** Otpusknye feature phase — flag explicitly for deeper research/scoping decision before implementation (this is the single most legally complex calculation in the product).

---

### Pitfall 5: Building around iOS PWA install/session assumptions that don't hold — no install prompt, no reliable "installed" detection, and standalone-only push

**What goes wrong:**
Unlike Android/Chrome, iOS Safari has no automatic "Install this app" banner — users must manually use Share → Add to Home Screen, and that option silently disappears if the site is opened inside an in-app browser (e.g. from a link shared in Telegram/Instagram). Teams often build an "install CTA" assuming they can trigger a native prompt (`beforeinstallprompt` — not fired on iOS Safari at all) and are surprised when nothing happens. Separately, any future push-notification feature (e.g. "payment coming up") requires iOS 16.4+, the app already added to home screen, `display: standalone` or `fullscreen` in the manifest, and a permission prompt triggered by a real user gesture (not on page load) — none of which work from a plain browser tab.

**Why it happens:**
Cross-platform PWA tutorials describe the Android/Chrome install flow as if it's universal; iOS's manual, share-sheet-based flow and its push-notification gating are easy to miss until testing on a real iPhone.

**How to avoid:**
- Design the install UX around manual instructions ("Tap Share, then Add to Home Screen") with iOS-specific copy/screenshots, detected via UA sniffing or `navigator.standalone` — don't rely on `beforeinstallprompt`.
- Detect standalone mode via `window.navigator.standalone === true` (iOS-specific) or `window.matchMedia('(display-mode: standalone)').matches`, and gate any "add to home screen" nudge on *not* already being standalone.
- If the app is ever opened from an in-app browser (Telegram, Instagram, etc.), detect this and tell the user to open in Safari first, since Add to Home Screen is unavailable there.
- Since v1 has no push-notification requirement (per PROJECT.md), defer push entirely rather than half-building it — but if it's added later, budget for the "must already be installed + iOS 16.4+" gate as a hard blocker, not an edge case.

**Warning signs:**
- Code references `beforeinstallprompt` as the primary install trigger.
- No iOS-specific onboarding copy/screenshot for "Add to Home Screen."
- No real-device (or at least iOS Simulator) testing pass before considering the PWA phase done.

**Phase to address:** PWA installability phase (manifest, icons, standalone mode) — the install-instructions UI and standalone detection should ship together with the manifest/icons work, not be an afterthought.

---

### Pitfall 6: Assuming client-side auth/session state survives reliably across iOS standalone-app launches and reinstalls

**What goes wrong:**
Because this product is multi-user with cloud sync and a real backend (per PROJECT.md — not local-only storage), the actual data lives server-side, which is the right call. But if any part of the auth flow (e.g. token caching, "remember me") relies on `localStorage`/cookies written while the site was open in a regular Safari tab, that data is subject to Safari's 7-day ITP script-writable-storage cap. A web app added to the Home Screen gets its own separate WKWebView storage jar (not subject to the 7-day cap, since it has its own usage-based counter) — but only *after* installation, and only for storage written *inside* the standalone context. A common bug: user logs in inside Safari, then adds to Home Screen — the standalone instance starts with a **different, empty storage jar** and the user has to log in again, which looks like "sync is broken" if not designed for.
Additionally, if the user later removes and re-adds the icon, the standalone WKWebView data store is wiped, silently logging them out.

**Why it happens:**
Developers test primarily in a regular browser tab during development and only discover the storage-jar split when testing the actual "Add to Home Screen → open from icon" flow late in the process.

**How to avoid:**
- Design the auth flow so that "install to Home Screen" is presented as a step users take *after* first launching from the icon (or explicitly re-authenticate once after installing) rather than assuming session continuity across the Safari-tab → standalone-app boundary.
- Keep the source of truth server-side (already the plan) and treat any client-stored token purely as a cache that can be safely lost — never store data that can't be re-fetched from the server after a silent local wipe.
- If using OAuth/third-party login, verify the redirect flow completes *inside* the standalone context and doesn't bounce the user out to Safari (which can break the perceived "installed app" experience and sometimes strands the session in the wrong storage jar).
- Test explicitly: login → add to home screen → close app → reopen from icon after several days, and login → remove icon → re-add icon → reopen.

**Warning signs:**
- No test pass covering "reopen from home screen icon after N days."
- Auth relies solely on `localStorage` token with no silent-refresh-from-server path.

**Phase to address:** Auth/cloud-sync phase, cross-checked during the PWA installability phase.

---

### Pitfall 7: Getting kopeck-level rounding wrong, causing forecasted "на руки" amounts to visibly drift from what the user actually receives

**What goes wrong:**
НК РФ ст. 52 requires tax amounts to be rounded to whole rubles per payment (under 50 kopecks dropped, 50+ rounds up) — not carried in fractional rubles internally. If the calculator instead keeps tax as a float and rounds only for display, or rounds inconsistently (e.g. always floors, or rounds at the annual level only), the sum of individually-rounded "on-hand" amounts across a year won't match `gross − totalTaxDisplayed` exactly, and users doing their own arithmetic will notice a few-ruble discrepancy and lose trust in the tool.

**Why it happens:**
Floating-point arithmetic and "round at the end" habits are the default in most calculators; the specific per-payment rounding rule for Russian tax withholding is a legal requirement most generic finance-app patterns don't anticipate.

**How to avoid:**
- Work in integer kopecks (or minor units) internally, never floats, for all money math.
- Apply the ст. 52 rounding rule (round to nearest ruble, .5 rounds up) at the point tax is withheld for *each payment*, matching how an actual employer's payroll system would compute and display it — this is also what makes the cumulative-delta method in Pitfall 1 well-defined (rounding must happen on cumulative tax, then take the delta, to avoid compounding rounding error across payments).
- Add a reconciliation test: sum of net amounts shown across a full year's payments + sum of tax shown should equal the sum of gross amounts, exactly, to the ruble.

**Warning signs:**
- Money represented as JS `number`/floating decimal anywhere in the tax engine.
- No test asserting the annual gross/tax/net pie chart totals reconcile exactly with the sum of individual payment breakdowns.

**Phase to address:** Core tax-calculation engine phase.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Hardcode 2025 НДФЛ bracket thresholds/rates as constants with no "effective year" versioning | Faster to ship v1 | Brackets are set by law and can change year to year (they did in 2021 and again in 2025); a hardcoded table silently miscalculates every January if not revisited | Acceptable for v1 only if the constants live in one clearly-named, dated module and a manual review is scheduled each January |
| Skip otpusknye exclusion-period/indexation logic, average blindly over 12 months | Ships the otpusknye feature much faster | Wrong numbers for anyone with sick leave, other vacation, or a raise in the lookback window — likely a large share of real users within a year | Acceptable only if explicitly disclosed to the user as an approximation, and salary-history data model still supports adding exclusions later without a schema rewrite |
| Store money as floating-point numbers in the DB/API layer | Simpler to wire up initial CRUD | Rounding drift compounds across a year of cumulative tax calculations (see Pitfall 7) | Never acceptable for the tax engine; tolerable only for pure UI display formatting downstream of integer math |
| Treat "Add to Home Screen" as equivalent to a native install with reliable session persistence | Simpler auth flow in early testing | Breaks on real iPhones when storage jars diverge or icon is removed/re-added (Pitfall 6) | Acceptable only if tested on-device before considering the PWA phase complete |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| iOS Safari "Add to Home Screen" | Assuming a JS-triggerable install prompt exists (`beforeinstallprompt`) | Show manual iOS-specific instructions; detect standalone mode via `navigator.standalone` / `matchMedia('(display-mode: standalone)')` |
| Web App Manifest on iOS | Relying only on `manifest.json` for icons/splash/theme color | Also add `apple-touch-icon`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` meta tags — iOS historically ignores or partially supports manifest-only config |
| Cloud auth (any provider) opened inside the standalone PWA | OAuth redirect flow bounces the user into Safari and back, landing outside the standalone storage context | Verify the redirect completes inside the standalone WKWebView; prefer flows that don't require leaving the app shell (e.g. an in-app web view / native-feeling redirect handling), and treat any resulting session token as re-derivable from the server, not sacred |
| Service worker / app updates on iOS | Deploying a new build and assuming users get it immediately — iOS caches aggressively and standalone apps have no visible "reload" chrome | Use `skipWaiting()` + `clients.claim()` in the service worker and a visible in-app "update available, tap to refresh" affordance, since users can't pull-to-refresh a stale standalone shell the way they would a browser tab |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Recomputing the full year's cumulative tax chain from scratch on every read (e.g. every dashboard load re-folds all events for the year) | Dashboard/forecast screen feels slow as a user accumulates a year of salary + premii + otpusknye events | Cache the cumulative-tax-to-date snapshot per user per year, invalidated only when an earlier-dated event is added/edited (see Pitfall 3) | Noticeable once a user has a full year of biweekly payments (~24+ events) plus several premii/otpusknye entries — still small-N for a single user, so this is a low-severity trap for v1's scale, but worth a cache from day one since the fix is cheap |
| Fetching full salary/payment history from the backend on every screen just to render "next payment" | Unnecessary network/data volume as history grows across years | Serve a purpose-built "next payment + current year summary" endpoint rather than shipping the full ledger to the client for every view | Not urgent at single-user-history scale, but establishes a bad pattern once yearly pie-chart and multi-year history accumulate |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting client-submitted gross salary/tax figures for cross-user data (e.g. multi-tenant queries without server-side ownership checks) | One user could read or forecast another user's salary/tax data via a manipulated request, since this is explicitly multi-user with cloud sync | Enforce ownership checks server-side on every read/write of salary, payment, premium, and vacation records — never trust a client-supplied user ID |
| Performing tax calculations client-side only, treating the client-computed number as authoritative and syncing it as-is | A modified client could sync fabricated "net pay" figures that then get treated as truth by other devices/views | Compute (or at minimum re-validate) tax figures server-side before persisting/syncing, even if the client also computes them for responsiveness |
| Storing salary/income data (sensitive personal financial data) without encryption at rest or without restricting export/logging | Salary data leak is high-impact for individual users (income data is sensitive under Russian personal data law — 152-ФЗ) | Encrypt sensitive fields at rest where the backend supports it, avoid logging raw salary amounts, and be mindful of 152-ФЗ data-residency implications if using a non-Russian cloud backend for a Russian user base |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Showing "на руки" amounts as if they're guaranteed/final rather than a forecast | Users budget against a number that assumes no exclusion periods, no indexation edge cases, no employer rounding quirks — a mismatch on payday erodes trust | Label estimates as forecasts, and where a calculation relies on simplifying assumptions (e.g. otpusknye without exclusion-period modeling), surface that plainly near the number, not buried in help text |
| No visible explanation of *why* a payment's tax rate looks different from the last one (bracket crossing) | User sees an unexpected tax jump on a bonus or high-earning month and assumes a bug | Show a breakdown (e.g. "of this payment, X ₽ taxed at 13%, Y ₽ taxed at 15%") rather than just a single blended number, at least on a details/expand view |
| Silent zero/blank otpusknye estimate for a user with under 12 months of history | Feature looks broken for a large share of first-year users | Explicitly handle short-tenure users with a clearly labeled partial-period calculation rather than erroring or showing nothing |
| Prompting "Add to Home Screen" while opened inside an in-app browser (Telegram/Instagram link) | The instructions reference a Share-sheet option that isn't available in that context, confusing the user | Detect in-app browser UAs and tell the user to open in Safari first |

## "Looks Done But Isn't" Checklist

- [ ] **Progressive tax calculation:** Often looks done after testing only round, single-bracket salaries — verify a payment that straddles a bracket boundary produces a split-rate result, not a single-rate result.
- [ ] **Otpusknye calculation:** Often looks done after testing only a "clean" 12-month history with no gaps — verify behavior for under-12-months tenure and for a mid-period salary raise.
- [ ] **PWA installability:** Often looks done after testing "Add to Home Screen" once in Safari — verify standalone-mode detection, icon/splash rendering on an actual iPhone (not just Chrome DevTools device emulation, which does not reproduce iOS Safari's manifest quirks), and behavior when opened from an in-app browser link.
- [ ] **Cloud sync across devices:** Often looks done after testing sync between two open browser tabs — verify the standalone home-screen app instance actually receives the same synced state as a browser tab, given the separate storage jar (Pitfall 6).
- [ ] **Annual gross/tax/net pie chart:** Often looks done once it renders *a* number — verify it reconciles exactly (to the ruble) with the sum of the individual payment breakdowns shown elsewhere in the app (Pitfall 7).
- [ ] **Salary history / raise handling:** Often looks done once a new oklad value can be saved — verify that a raise mid-year does not reset the cumulative annual tax base (it must continue accumulating, not restart) and correctly feeds into future otpusknye averaging.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| Marginal tax calc bug shipped (Pitfall 1) | MEDIUM | Isolate the pure tax function, add the boundary-straddling test cases that would have caught it, patch, then re-derive all previously-stored/synced payment records for affected users going forward (don't silently rewrite past displayed figures without a changelog note) |
| Otpusknye formula missing exclusions/indexation (Pitfall 4) | MEDIUM–HIGH | Ship as an explicitly-labeled approximation first; track it as a known-gap in the roadmap and design the salary-history data model up front so exclusions/indexation can be layered in without a data migration |
| iOS storage-jar/session pitfall discovered late (Pitfall 6) | LOW–MEDIUM | Since the source of truth is server-side, recovery is mostly UX: add a "you may need to log in again after installing" notice and a smoother re-auth path, no data loss risk if designed correctly from the start |
| Float-based money math causing rounding drift (Pitfall 7) | HIGH | Requires migrating the money representation (float → integer minor units) throughout the tax engine and any persisted records — best avoided entirely rather than recovered from, since it touches the core data model |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Marginal/cumulative tax miscalculation (P1) | Core tax-calculation engine phase | Unit tests covering all 4 bracket boundaries with straddling payments |
| Pre-2023 "tax at month-end" model (P2) | Core tax-calculation engine / payment schedule phase | Аванс payments show correct withheld tax, not zero |
| Non-chronological cumulative processing (P3) | Core tax-calculation engine phase; revisited at premii and otpusknye phases | Backdated/edited event correctly recomputes all later payments in the year |
| Naive otpusknye averaging (P4) | Otpusknye feature phase (flagged for deeper research before implementation) | Test cases for short tenure, mid-period raise, partially-worked month |
| iOS install-prompt/detection assumptions (P5) | PWA installability phase | Manual QA on a real iPhone: install flow, standalone detection, in-app-browser fallback |
| iOS session/storage-jar assumptions (P6) | Auth/cloud-sync phase, cross-checked in PWA installability phase | On-device test: login → install → reopen after days; remove/re-add icon |
| Rounding/float drift (P7) | Core tax-calculation engine phase | Reconciliation test: sum of displayed net amounts + displayed tax = displayed gross, exactly, across a full year |

## Sources

- [Прогрессивная шкала НДФЛ с 2025 года — Garant](https://www.garant.ru/1c-wiseadvice/guide/progressivnaya-shkala-ndfl-s-2025-goda/) — MEDIUM confidence (cross-checked)
- [Прогрессивная шкала НДФЛ с 2025 года: расчет по новым ставкам — Astral](https://astral.ru/aj/elem/progressivnaya-shkala-ndfl/) — MEDIUM confidence (cross-checked)
- [Новый порядок удержания НДФЛ в 2023 году — ФНС](https://www.nalog.gov.ru/) — MEDIUM confidence, official tax-authority source
- [Как удерживать НДФЛ с аванса в 2023 году — Garant news](https://www.garant.ru/news/1560509/) — MEDIUM confidence (cross-checked)
- [Округление НДФЛ до рублей — КонсультантПлюс](https://www.consultant.ru/law/podborki/ndfl_okruglenie_do_rublej/) — MEDIUM confidence, legal reference aggregator
- [ПОРЯДОК РАСЧЕТА СРЕДНЕЙ ЗАРАБОТНОЙ ПЛАТЫ — КонсультантПлюс](https://www.consultant.ru/document/cons_doc_LAW_283050/291547ebc44b6879b3770b58c8d9e065c430ee4e/) — MEDIUM confidence, primary legal text reference
- [Расчет отпускных в 2026 году — Контур.Экстерн](https://kontur.ru/extern/spravka/50486-raschet_otpusknyh) — MEDIUM confidence (cross-checked)
- [Как рассчитать отпускные, если в расчетном периоде не было начислений — Garant](https://www.garant.ru/consult/work_law/1862842/) — MEDIUM confidence
- [PWA iOS Limitations and Safari Support — MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) — MEDIUM confidence (cross-checked)
- [iOS special requirements for web push notifications — Pushpad](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications) — MEDIUM confidence (cross-checked)
- [iOS Safari PWA limitations on cross origin iframes / localStorage / cookies — Apple Developer Forums](https://developer.apple.com/forums/thread/125109) — MEDIUM confidence, primary-vendor forum
- [Safari 13.1 / iOS 13.4 7-day storage deletion — iTnews](https://www.itnews.com.au/news/apple-cops-flak-for-deleting-local-browser-storage-after-7-days-539833) — MEDIUM confidence (cross-checked against Apple Developer Forums discussion)
- General domain knowledge synthesis on Russian payroll accounting practice and PWA architecture patterns (LOW-to-MEDIUM confidence where not independently web-verified — flagged inline above)

---
*Pitfalls research for: Russian salary/take-home-pay tracking PWA (НаРуки)*
*Researched: 2026-08-28*
