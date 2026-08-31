# Phase 4: Annual Overview & PWA Installability - Context

**Gathered:** 2026-08-31
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous, batch table proposals — see CTRL-03: identical CONTEXT.md structure to gsd-discuss-phase, all 4 grey areas accepted at their recommended answers)

<domain>
## Phase Boundary

A signed-in user sees a full calendar-year breakdown of gross pay, tax withheld, and take-home pay
across all income types (salary, bonuses, vacation pay) as a pie chart on the home screen, and can
install НаРуки to their iPhone home screen as a standalone PWA that keeps them logged in across
launches (accepting one re-login immediately after install, per iOS storage-jar behavior).
Requirements: HOME-02, PWA-01. Depends on Phases 1-3 (salary/schedule, bonuses, vacation pay all
already implemented and taxed through the same cumulative НДФЛ engine).

</domain>

<decisions>
## Implementation Decisions

### Годовая сводка — источник данных и охват
- Pie chart covers the full current calendar year: past AND future scheduled events (avans/salary
  occurrences from the schedule, bonuses, vacation pay), each taxed cumulatively from Jan 1 — same
  event-taxation approach `forecastNextPayment` already uses for a single event, extended to walk
  every event in the year chronologically.
- "Today" for split past/future and for resolving the active salary at each event date uses
  `nowInMoscow()`/`todayIsoInMoscow()` (`src/domain/time`) — the established project-wide pattern
  (CR-01, Phase 1). No new "current date" logic.
- The YTD baseline (income before the user started using the app, from `getYtdBaseline`) is
  included in the year's gross total as a dateless starting amount — required for the chart's
  totals to reconcile exactly to the ruble with the sum of individual payment breakdowns
  (success criterion #2). If it's estimated (not user-confirmed), the existing
  `baselineIsEstimated`/YTD-estimate-banner treatment should still surface somewhere relevant to
  this screen — do not silently treat an estimated baseline as confirmed on the annual chart.
- If salary or schedule isn't configured (SAL-03 unconfigured state), the pie chart is not shown at
  all — same "not configured, not a zero" pattern already used in `forecastNextPayment` (home) and
  `/vacations` (Phase 1 & 3 Key Decisions; PROJECT.md explicitly flagged this rule for reuse in the
  Phase 4 pie chart).

### Расположение и вид диаграммы
- Chart lives on the home screen (`/`), below the existing `NextPaymentCard` — HOME-02 requires the
  home screen specifically, not a separate route.
- Russian labels: «Грязными» / «Налог» / «На руки», each with a ruble amount and percentage; legend
  below the chart (Recharts `Legend`).
- Current calendar year only, no year switcher — multi-year is out of scope for v1 per
  REQUIREMENTS.md.
- Amounts formatted as whole rubles with thousands separators (no kopecks) — same display
  convention already used on `NextPaymentCard`.

### PWA-манифест и иконки
- Icon set: `apple-touch-icon` 180×180 (mandatory — iOS Safari ignores the manifest's icon list and
  requires this separate link tag) plus manifest icons 192×192 and 512×512 (including a maskable
  512). No existing brand art — generate a simple monochrome placeholder icon (initial "Н" on
  zinc-900 `#18181b`, matching the app's existing button/accent color) rather than blocking the
  phase on art delivery.
- `theme_color` / `background_color`: `#18181b` (zinc-900) — matches the existing accent color.
- `short_name`: «НаРуки» (6 characters, won't be truncated on the home screen).
- Service worker (Serwist): minimal/empty precache — only enough to be "active" for installability
  heuristics; no offline caching logic, since offline is explicitly out of v1 scope
  (STACK.md / PROJECT.md constraints).

### Сессия при установке на домашний экран (storage-jar)
- Expect and design for a re-login on first launch of the installed standalone app — iOS gives the
  standalone WKWebView a separate storage jar from the Safari tab it was installed from, so cookies
  set in-tab do not carry over on first standalone open. This is normal, not a bug to "fix" by
  passing tokens through URLs (rejected in PITFALLS.md as insecure).
- Show a short contextual hint on the login screen when the app detects it's running standalone but
  unauthenticated ("похоже, это первый запуск с домашнего экрана — войдите ещё раз"), per
  PITFALLS.md Pitfall 6's explicit recommendation.
- Detect standalone mode via `window.navigator.standalone === true` (iOS-specific) OR
  `window.matchMedia('(display-mode: standalone)').matches` — the documented pattern from
  ARCHITECTURE.md/PITFALLS.md. No `beforeinstallprompt` exists on iOS Safari — don't build around it.
- Show a manual install-instruction banner ("Поделиться → На экран «Домой»") on the home screen when
  not already running standalone; hide it once `navigator.standalone`/`matchMedia` confirms
  standalone mode.

### Claude's Discretion
None — all four grey areas were accepted at their recommended answers with no changes.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/domain/time` — `nowInMoscow()` / `todayIsoInMoscow()`, the sole source of "today" project-wide.
- `src/domain/tax/calculate-ndfl.ts` — progressive НДФЛ bracket calculation, already proven exhaustively tested.
- `src/domain/pay/payment-accrual.ts` — `halfSplitGross` and salary-history-aware accrual logic.
- `src/domain/vacation/calculate-average-daily-earnings.ts` — `calculateVacationPayGross`, `resolveVacationPaymentDate`, `toPremiumBonusEntries`.
- `src/lib/db/salary-repository.ts` — `computeCumulativeIncome`, `getActiveSalaryAt`, `getSchedule`, `getYtdBaseline`, `listSalaryHistory`.
- `src/lib/db/bonus-repository.ts` (`listBonuses`) and `src/lib/db/vacation-repository.ts` (`listVacations`).
- `src/app/actions/forecast.ts` — the exact chronological accrual/taxation pattern (single next event) to generalize into a whole-year walk; same server-only guard convention to follow for the new annual aggregation module.
- `NextPaymentCard`, `YtdEstimateBanner` components — existing visual/formatting conventions (`formatKopecks`-style whole-ruble display) to match in the new pie chart.

### Established Patterns
- Server-only domain/orchestration modules guarded by a `typeof window !== "undefined"` throw (no `server-only` package installed), never carrying `"use server"` unless invoked as a form action.
- "Not configured" is always a distinct explicit state, never a computed zero — enforced in two independent places already (home forecast, vacations list); the annual chart is explicitly called out in PROJECT.md as the next place this rule applies.
- React Hook Form `values` (not `defaultValues`) + explicit `reset()` for any form that edits an already-mounted row (not directly relevant to Phase 4's read-only chart, but applies if any settings form touches PWA-related state).

### Integration Points
- Home screen (`src/app/(app)/page.tsx`) gains the new pie-chart component below `NextPaymentCard`.
- Root layout (`src/app/layout.tsx`) needs manifest link, apple-touch-icon, apple-mobile-web-app-* meta tags, and theme-color meta.
- New `public/manifest.json` (or `app/manifest.ts` per Next.js App Router convention) + generated icon files.
- New Serwist service worker registration (`@serwist/next` Next.js config integration) — no existing service worker in the project.
- Login screen (`src/app/(auth)/login/page.tsx`) gains the standalone-mode-detected re-login hint.

</code_context>

<specifics>
## Specific Ideas

No specific pixel-level design references given — visual detail (exact chart styling, banner
placement/copy polish) is left to the UI-SPEC step. The functional/data-reconciliation and
PWA-behavior decisions above are binding; presentation details within them are Claude's discretion
during planning and UI design.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Multi-year view, push notifications, and per-payment
gross/tax/net breakdown beyond the annual total are already tracked as v1.x/v2 differentiators in
REQUIREMENTS.md — DIFF-02, EXT-05 — not re-raised here.)

</deferred>
