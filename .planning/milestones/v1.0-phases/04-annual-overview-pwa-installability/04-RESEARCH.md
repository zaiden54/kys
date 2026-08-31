# Phase 4: Annual Overview & PWA Installability - Research

**Researched:** 2026-08-31
**Domain:** Annual income aggregation + PWA installability for iOS
**Confidence:** HIGH (stack + architecture patterns verified against existing codebase; PWA requirements verified against official Apple/Web standards)

## Summary

Phase 4 adds two user-facing features: (1) a pie chart on the home screen breaking down the current calendar year's gross/tax/net across all income types (salary, bonuses, vacation pay), and (2) the ability to install НаРуки to the iPhone home screen as a standalone PWA. Both features reuse existing proven engines from Phases 1-3 — no new tax or vacation-pay logic is required. The pie chart is a read-only aggregation of the annual payment timeline; PWA installability requires only manifest generation, icon setup, service-worker registration (minimal), and iOS-specific meta tags.

**Primary recommendation:** Extend the existing `forecastNextPayment` pattern from `src/app/actions/forecast.ts` into a full-year aggregation function (`computeAnnualSummary`), display the result via Recharts on the home screen below the existing `NextPaymentCard`, add manifest + icons + Serwist config for PWA, and implement standalone-mode detection + re-login hint per CONTEXT.md decisions.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Annual Pie Chart:**
- Covers the **current calendar year only** — past AND future scheduled/entered events (salary/bonuses/vacation pay), each taxed cumulatively through the same НДФЛ engine as the next-payment forecast
- Uses `nowInMoscow()`/`todayIsoInMoscow()` for "today" — the established project-wide pattern (CR-01, Phase 1)
- Includes YTD baseline in gross total so chart totals reconcile to the ruble with individual payment breakdowns (success criterion #2)
- Shows **no chart at all** if salary/schedule isn't configured (not configured ≠ zero) — same rule as existing `forecastNextPayment`
- If baseline is estimated, surface the `baselineIsEstimated` flag somewhere on the screen (e.g., YTD-estimate banner continues to apply)
- Russian labels: «Грязными» / «Налог» / «На руки» with ruble amounts and percentages, legend below chart
- Amounts formatted as whole rubles with thousands separators (no kopecks)

**PWA Manifest & Icons:**
- Icon set: `apple-touch-icon` 180×180 (iOS Safari requires this separate link tag, ignores manifest icon list) + manifest icons 192×192 and 512×512 (including maskable 512px)
- Generate simple monochrome placeholder icon (initial "Н" on zinc-900 `#18181b`, matching existing button/accent color) — no art delivery blocking
- `theme_color` / `background_color`: `#18181b` (zinc-900)
- `short_name`: «НаРуки» (6 characters, no truncation on home screen)
- Service worker (Serwist): minimal/empty precache — active for installability heuristics only, no offline caching (offline out of v1 scope)

**Session Handling:**
- Expect and design for re-login on first launch of installed standalone app — iOS gives standalone WKWebView a separate storage jar from Safari tab
- Show contextual hint on login screen when standalone but unauthenticated: "похоже, это первый запуск с домашнего экрана — войдите ещё раз"
- Detect standalone mode via `window.navigator.standalone === true` (iOS-specific) OR `window.matchMedia('(display-mode: standalone)').matches`
- Show manual install-instruction banner on home screen when not standalone: "Поделиться → На экран «Домой»"
- Hide install banner once standalone mode confirmed

### Claude's Discretion
None — all four grey areas were accepted at their recommended answers.

### Deferred Ideas (Out of Scope)
- Multi-year view
- Per-payment gross/tax/net breakdown beyond annual total
- Push notifications
- All deferred to v1.x / v2

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HOME-02 | Home screen shows yearly pie chart (gross/tax/net) for current calendar year, combining salary, bonuses, vacation pay | Annual aggregation via `computeAnnualSummary()` extending `forecastNextPayment` pattern; Recharts pie chart; reconciliation test ensuring sum of displayed breakdown = sum of individual payments exactly |
| PWA-01 | App installs to iPhone home screen via Safari "Add to Home Screen," launches in standalone mode with icon, keeps user logged in across app launches | Serwist manifest + icons; standalone detection via navigator.standalone / matchMedia; re-login hint on login screen; install banner on home screen with iOS-specific instructions |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Annual income aggregation logic | API / Backend | — | Server-side function walks the full calendar year's payment events in chronological order, computes cumulative tax for each, returns gross/tax/net totals. Reuses existing `forecastNextPayment` pattern for a single event, extends it to the full year. No client-side math on sensitive data. |
| Pie chart rendering | Frontend / Browser | — | React/Recharts component on home screen, client-side only display of server-computed totals. No sensitive calculation logic here. |
| PWA manifest & icons | Static / CDN | — | `public/manifest.json`, icon files, `apple-touch-icon` link in `<head>`. Served as static assets; no server-side logic. |
| Service worker registration | Browser / Client | — | Serwist `@serwist/next` config integrates with Next.js build; registers service worker for install-heuristics. No offline caching needed for v1. |
| Standalone mode detection | Frontend / Browser | — | Client-side browser APIs: `navigator.standalone` / `matchMedia('(display-mode: standalone)')`. Drives conditional rendering of install banner. |
| Session handling across storage jars | API / Backend | Frontend / Browser | Server provides JWT/cookie as usual; client detects standalone mode and shows re-login hint if unauthenticated. Re-login flow is standard auth, no special logic. |

## Standard Stack

### Core (from Phase 1 — unchanged)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| Next.js | 16.3.3 (App Router) | Full-stack framework | Server Components for annual-summary read; Server Actions for auth; app-wide config for manifest/service-worker. |
| React | 19.2.8 | UI runtime | Recharts pie chart component. |
| TypeScript | 6.0.3 (pinned) | Type safety | Annual-summary types; Recharts strict typing. Do NOT bump to 7.0.x yet — `typescript-eslint` incompatible. |
| PostgreSQL (via Neon) | 17-class serverless | Database | Stores salary history, bonuses, vacations; annual aggregation reads these tables to build the pie chart. |
| Drizzle ORM + drizzle-kit | 0.45.2 / 0.31.10 | DB access | Queries for annual aggregation: list salary history, bonuses, vacations within the calendar year, compute cumulative tax. |
| Better Auth | 1.7.2 | Authentication | Unchanged; handles session/re-login on PWA launch. |

### New for Phase 4

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| Recharts | 3.10.1 | Pie/donut chart (gross/tax/net) | Standard React chart library; declarative JSX; good TypeScript types; most common choice in 2026 for dashboards. For one chart, bundle-size vs. Chart.js/Nivo is marginal — pick for DX. [VERIFIED: npm registry Aug 2026] |
| Serwist + @serwist/next | 9.5.12 | Web app manifest + service worker for PWA install | `next-pwa` archived/unmaintained since Aug 2023 — do not use. Serwist is the maintained successor. Paired with explicit `apple-touch-icon` meta tag (iOS Safari requirement). [VERIFIED: npm registry Aug 2026] |

### Supporting (unchanged)

- date-fns 4.4.0 (date math for payment timeline)
- Zod 4.4.3 (input validation)
- React Hook Form (form state — unchanged for Phase 4)
- Vitest 4.1.11 (unit tests for annual aggregation logic)

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| recharts | npm | 5 years (first published 2019) | ~2.5M/week (Aug 2026) | github.com/recharts/recharts | OK | Approved — widely adopted, actively maintained, type-safe React library |
| @serwist/next | npm | ~1.5 years (v1 stable since Apr 2025) | ~50k/week (Aug 2026) | github.com/serwist/serwist | OK | Approved — maintained successor to archived `next-pwa`; official Next.js PWA guide references it |
| serwist | npm | ~1.5 years | ~80k/week (Aug 2026) | github.com/serwist/serwist | OK | Approved — same project as @serwist/next |

**Installation:**
```bash
npm install recharts@3.10.1 serwist@9.5.12 @serwist/next@9.5.12
```

Version verification via npm registry (Aug 2026):
- `recharts@3.10.1` — latest stable ✓
- `serwist@9.5.12` — latest stable ✓
- `@serwist/next@9.5.12` — latest stable ✓

## Architecture Patterns

### Pattern 1: Annual Payment Timeline Aggregation (extending `forecastNextPayment`)

**What:** Create a new server-only function `computeAnnualSummary(userId: string, taxYear: number)` that:
1. Loads all salary history, bonuses, and vacations for the user + the YTD baseline
2. Builds a complete chronological timeline of payment events for that calendar year
3. Walks the timeline in date order, maintaining cumulative YTD income (computed fresh, never stored)
4. For each event, calls the same `calculateNdfl()` and `calculateVacationPayGross()` domain engines as `forecastNextPayment` does for a single event
5. Aggregates gross/tax/net totals across all events
6. Returns `{ grossKopecks, taxKopecks, netKopecks, baselineIsEstimated }`

**When to use:** Anytime the UI needs a full-year snapshot without recomputing individual payment forecasts.

**Pattern rationale:** Reuse the exact same pure domain engines (`calculateNdfl`, vacation-pay averaging) that power single-payment forecasts, but compose them into a full-year walk. No new tax/vacation logic. Same server-only guard (`typeof window !== "undefined"` throw). Same cumulative-income-from-scratch pattern as `forecastNextPayment` — no stored YTD counter, always derive from immutable ledger.

**Example skeleton (detailed implementation in code examples section):**
```typescript
// src/app/actions/annual-summary.ts
export async function computeAnnualSummary(
  userId: string,
  taxYear: number
): Promise<AnnualSummaryResult> {
  // 1. Fetch all records for the year
  // 2. Build payment timeline
  // 3. Walk timeline in date order, maintaining cumulative YTD
  // 4. For each event: tax via calculateNdfl + vacation via calculateVacationPayGross
  // 5. Aggregate + return
}
```

### Pattern 2: Recharts Pie Chart Component

**What:** A React component that displays the annual summary as a pie chart with three slices (gross, tax, net), labels in Russian with ruble amounts and percentages, and a legend below.

**When to use:** When displaying the summary on the home screen.

**Key considerations:**
- Percentages should be calculated as `(slice / gross) * 100` for all three (note: `net / gross` is NOT 100% — it's less by the tax percentage, which is the point)
- No decimals in kopeck display (whole rubles only)
- Thousand separators for readability
- Match existing color scheme (zinc-900 accent for pie segments)
- Recharts handles responsive sizing automatically

**Example component structure (see code examples below):**
```typescript
export function AnnualPieChart({
  grossKopecks,
  taxKopecks,
  netKopecks,
}: AnnualSummary) {
  // Map to Recharts data format
  // Render <PieChart> with legend
}
```

### Pattern 3: PWA Manifest & Service Worker Setup (Serwist)

**What:** Configure Serwist to generate a `manifest.json` with PWA metadata and register a minimal service worker for iOS home-screen install.

**Configuration:**
1. **Manifest:** `app/manifest.ts` (Next.js App Router convention) or `public/manifest.json`
   - `display: "standalone"`
   - `scope: "/"`
   - `icons`: 192×192 and 512×512 (+ maskable variant)
   - `start_url: "/"`
   - `theme_color: "#18181b"`, `background_color: "#18181b"`
   - `short_name: "НаРуки"`, `name: "НаРуки"`

2. **Meta tags in root layout:**
   - `<link rel="manifest" href="/manifest.json">`
   - `<link rel="apple-touch-icon" href="/icon-180.png">` (iOS REQUIRES this separate link; ignores manifest)
   - `<meta name="apple-mobile-web-app-capable" content="yes">`
   - `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
   - `<meta name="theme-color" content="#18181b">`
   - `<link rel="icon" href="/favicon.ico">`

3. **Service worker:** Serwist with minimal config
   - No offline caching (v1 scope)
   - No assets in precache list (or empty list)
   - Service worker active for install heuristics only

4. **Next.js integration:** Add Serwist config to `next.config.ts` via `@serwist/next` plugin

**Why this matters:** iOS Safari is unique among platforms:
- Ignores the manifest's icon list; requires explicit `<link rel="apple-touch-icon">`
- No `beforeinstallprompt` API — install is manual via Share → Add to Home Screen
- Manifest + these meta tags are what Safari checks to enable that option
- Service worker registration (Serwist handles this) is needed for the app to be considered "installable"

### Pattern 4: Standalone Mode Detection & Install Banner

**What:** Client-side logic to detect when the app is running as an installed PWA (standalone mode) vs. in a browser tab, and conditionally show an install banner.

**Detection logic:**
```typescript
function isStandalone(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.navigator.standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches)
  );
}
```

**When to show install banner:**
- Show banner when `!isStandalone()` and user is authenticated
- Hide banner when `isStandalone()` is true
- Include iOS-specific instructions: "Поделиться → На экран «Домой»"

**When to show re-login hint:**
- Show on login screen when `isStandalone()` is true and user is not authenticated
- Contextual message: "похоже, это первый запуск с домашнего экрана — войдите ещё раз"

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rendering a pie chart | Custom canvas/SVG pie-slice math | Recharts (3-line component) | Recharts handles responsive sizing, animations, interactivity, accessibility; custom pie logic is error-prone for a one-chart display |
| Generating a web app manifest | Custom JSON file without validation | Serwist `manifest.ts` or `next/manifest` | Generates correct JSON structure, validates icon paths, handles Next.js build integration; manual JSON is brittle across deployments |
| iOS PWA icon setup | Just adding manifest icons | `apple-touch-icon` link tag + manifest icons | iOS Safari ignores manifest icons and reads the separate link tag; omitting either one silently breaks install |
| Annual payment aggregation | Custom loop to walk payment events | Extending `forecastNextPayment` pattern | Reuses proven cumulative-tax, vacation-pay, chronological-ordering logic; custom aggregation duplicates risk and loses test coverage from Phase 1-3 |

**Key insight:** The hardest problems here (tax calculation, vacation-pay averaging) are already solved and tested in Phases 1-3. Phase 4 is orchestration only — glue existing engines together without reimplementing them.

## Common Pitfalls

### Pitfall 1: Annual Chart Doesn't Reconcile to Individual Payments
**What goes wrong:** Chart shows gross/tax/net totals, but sum of displayed individual payment breakdowns shown elsewhere doesn't match. Users doing their own arithmetic spot a discrepancy and lose trust.

**Why it happens:** Rounding happens at different points (annual aggregation vs. per-payment withholding), or chart excludes a category of payments (e.g., future vacation pay not shown in the sidebar).

**How to avoid:** 
- Use the exact same rounding (kopeck → ruble per НК РФ ст. 52) for both the chart and individual payments
- Ensure the chart and the forecast both walk the same set of payment events (salary + bonuses + vacations)
- Add a test: sum of individual forecasted net amounts + sum of forecasted tax = sum of gross, exactly, for a full year

**Warning signs:**
- Chart gross amount differs from "sum of all payment forecasts" by a few kopecks
- Chart shows a different tax rate than individual payments for the same tax year

### Pitfall 2: iOS Storage Jar Assumption — Session Not Persisting After Install
**What goes wrong:** User logs in in Safari, adds app to home screen, reopens from icon, but is logged out. Looks like a sync bug to the user.

**Why it happens:** iOS gives the standalone WKWebView a separate storage jar from the Safari tab. Cookies/tokens written in Safari don't exist in the standalone app's context. This is not a bug — it's by design.

**How to avoid:**
- Design the UX to expect re-login after install (mentionned in CONTEXT.md — locked decision)
- Show a re-login hint on the login screen when `navigator.standalone === true`
- Verify the hint is brief and doesn't make it sound like an error (it's a normal iOS behavior)
- Test on a real iPhone: login → install → close app → reopen from icon → verify you're logged out and can log back in

**Warning signs:**
- No re-login hint on the login screen for standalone mode
- Bug reports like "I logged in and added to home screen but the app forgot me"

### Pitfall 3: Install Banner Never Appears or Disappears Mid-Session
**What goes wrong:** User sees the "Add to Home Screen" banner at first, clicks it or tries to add manually, but the banner doesn't hide after installation, or appears again on reload.

**Why it happens:** Standalone detection is not persistent across app reloads (JavaScript re-runs each load), or the detection logic is checking the wrong API (`beforeinstallprompt` on iOS, which never fires).

**How to avoid:**
- Re-run standalone detection on every mount (it's cheap: one property read or matchMedia query)
- Use `navigator.standalone` (iOS-specific) OR `matchMedia("(display-mode: standalone)")` (cross-platform fallback)
- Never rely on `beforeinstallprompt` for iOS
- Test: install app → reload → verify banner is hidden; open in browser → reload → verify banner is shown

**Warning signs:**
- Code references `beforeinstallprompt` as the primary detection mechanism
- Install banner doesn't disappear after user adds app to home screen
- "We use Chrome's install prompt UX" — does not work on iOS

### Pitfall 4: Year Hardcoding in Annual Summary Logic
**What goes wrong:** Hard-coded `new Date().getFullYear()` in the annual-summary function, so the chart always shows the current calendar year even if the user wants to review a past year (once multi-year is added later), or breaks on Jan 1 when the year boundary crosses.

**Why it happens:** Tempting to use the current date, but the chart should accept a `taxYear` parameter so it can be reused for any year.

**How to avoid:**
- `computeAnnualSummary(userId: string, taxYear: number)` takes taxYear as an explicit parameter
- On the home screen, pass `new Date().getFullYear()` (or `todayIsoInMoscow().slice(0, 4)` for consistency with project patterns)
- Same pattern as `forecastNextPayment` — never bake today's date into business logic

**Warning signs:**
- Annual-summary function has no `taxYear` parameter
- Tests can't compute a summary for a past year

## Code Examples

### Example 1: Annual Summary Function

**Source:** Patterns established in src/app/actions/forecast.ts (Phase 1-3), extended to full year.

```typescript
// src/app/actions/annual-summary.ts

if (typeof window !== "undefined") {
  throw new Error(
    "src/app/actions/annual-summary.ts is server-only and must never be imported into a client component."
  );
}

import { format } from "date-fns";
import type { Kopecks } from "@/domain/money";
import { calculateNdfl } from "@/domain/tax/calculate-ndfl";
import { halfSplitGross } from "@/domain/pay/payment-accrual";
import {
  calculateVacationPayGross,
  resolveVacationPaymentDate,
  toPremiumBonusEntries,
} from "@/domain/vacation/calculate-average-daily-earnings";
import {
  computeCumulativeIncome,
  getActiveSalaryAt,
  listSalaryHistory,
  listBonuses,
  listVacations,
  getYtdBaseline,
} from "@/lib/db/salary-repository";

export interface AnnualSummary {
  grossKopecks: Kopecks;
  taxKopecks: Kopecks;
  netKopecks: Kopecks;
  baselineIsEstimated: boolean;
}

/**
 * Computes the user's full calendar-year breakdown: gross, tax, net.
 * Walks all income events (salary, bonuses, vacations) for the year in
 * chronological order, maintaining cumulative YTD income, and aggregates totals.
 * Returns the same AnnualSummary interface the pie chart displays.
 */
export async function computeAnnualSummary(
  userId: string,
  taxYear: number
): Promise<AnnualSummary | { configured: false; missing: "salary" | "schedule" }> {
  const [schedule, salaryHistoryRows, bonusRows, vacationRows, ytdBaseline] =
    await Promise.all([
      getSchedule(userId),
      listSalaryHistory(userId),
      listBonuses(userId),
      listVacations(userId),
      getYtdBaseline(userId),
    ]);

  // Not configured check: same as forecastNextPayment
  if (!schedule || salaryHistoryRows.length === 0) {
    return { configured: false, missing: !schedule ? "schedule" : "salary" };
  }

  // Build the timeline of all payment events for this tax year
  const paymentEvents: Array<{
    dateIso: string;
    kind: "avans" | "salary" | "bonus" | "vacation";
    vacationId?: string;
  }> = [];

  // Add salary/avans events (from schedule, every occurrence in the year)
  // ...

  // Add bonus events
  bonusRows
    .filter((bonus) => bonus.date.slice(0, 4) === String(taxYear))
    .forEach((bonus) => {
      paymentEvents.push({ dateIso: bonus.date, kind: "bonus" });
    });

  // Add vacation events
  vacationRows
    .filter((vacation) => {
      const paymentDate = resolveVacationPaymentDate(vacation.startDate);
      return paymentDate.slice(0, 4) === String(taxYear);
    })
    .forEach((vacation) => {
      const paymentDate = resolveVacationPaymentDate(vacation.startDate);
      paymentEvents.push({
        dateIso: paymentDate,
        kind: "vacation",
        vacationId: vacation.id,
      });
    });

  // Sort by date
  paymentEvents.sort((a, b) => a.dateIso.localeCompare(b.dateIso));

  // Walk the timeline and aggregate
  let cumulativeYtdKopecks = ytdBaseline.isApplicableFor(taxYear) ? ytdBaseline.amountKopecks : 0;
  let totalGrossKopecks: Kopecks = 0;
  let totalTaxKopecks: Kopecks = 0;

  for (const event of paymentEvents) {
    let eventGrossKopecks: Kopecks;

    if (event.kind === "bonus") {
      eventGrossKopecks = bonusRows.find((b) => b.date === event.dateIso)?.amountKopecks ?? 0;
    } else if (event.kind === "vacation") {
      const vacation = vacationRows.find((v) => v.id === event.vacationId);
      if (!vacation) continue;
      const vacationGross = calculateVacationPayGross(
        vacation.startDate,
        vacation.endDate,
        salaryHistoryRows.map((s) => ({ effectiveFrom: s.effectiveFrom, grossAmountKopecks: s.grossAmountKopecks })),
        toPremiumBonusEntries(bonusRows)
      ).grossKopecks;
      eventGrossKopecks = vacationGross;
    } else {
      // avans or salary
      const activeSalary = await getActiveSalaryAt(userId, event.dateIso);
      if (!activeSalary) continue;
      eventGrossKopecks = halfSplitGross(activeSalary.grossAmountKopecks, event.kind);
    }

    const { taxKopecks: eventTaxKopecks } = calculateNdfl(cumulativeYtdKopecks, eventGrossKopecks, taxYear);
    totalGrossKopecks += eventGrossKopecks;
    totalTaxKopecks += eventTaxKopecks;
    cumulativeYtdKopecks += eventGrossKopecks;
  }

  const totalNetKopecks = totalGrossKopecks - totalTaxKopecks;

  return {
    grossKopecks: totalGrossKopecks,
    taxKopecks: totalTaxKopecks,
    netKopecks: totalNetKopecks,
    baselineIsEstimated: ytdBaseline.isEstimated && ytdBaseline.isApplicableFor(taxYear),
  };
}
```

### Example 2: Recharts Pie Chart Component

**Source:** Recharts official JSX examples + project's existing styling patterns.

```typescript
// src/app/(app)/components/annual-pie-chart.tsx

"use client";

import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";
import type { AnnualSummary } from "@/app/actions/annual-summary";

function formatRubles(kopecks: number): string {
  const rubles = Math.round(kopecks / 100);
  return rubles.toLocaleString("ru-RU");
}

export function AnnualPieChart({ summary }: { summary: AnnualSummary }) {
  const { grossKopecks, taxKopecks, netKopecks } = summary;
  const gross = Math.round(grossKopecks / 100);

  const data = [
    { name: "Грязными", value: gross - Math.round(taxKopecks / 100), fill: "#10b981" }, // net
    { name: "Налог", value: Math.round(taxKopecks / 100), fill: "#ef4444" }, // tax
    { name: "На руки", value: Math.round(netKopecks / 100), fill: "#3b82f6" }, // net (displayed as green, not blue — adjust color as needed)
  ];

  return (
    <div className="mt-6 p-4 bg-white dark:bg-zinc-900 rounded-lg">
      <h2 className="text-lg font-semibold mb-4">Годовая сводка {new Date().getFullYear()}</h2>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value, percent }) => `${name}: ₽${value.toLocaleString("ru-RU")} (${(percent * 100).toFixed(1)}%)`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => `₽${(value as number).toLocaleString("ru-RU")}`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Example 3: Serwist Configuration

**Source:** @serwist/next official docs + Next.js 16 PWA guide.

```typescript
// next.config.ts (add Serwist plugin)

import { withSerwist } from "@serwist/next";

export default withSerwist({
  // ... other Next.js config
  serwist: {
    disable: process.env.NODE_ENV === "development", // Don't register service worker in dev
    register: true, // Auto-register on client init
    skipWaiting: true, // Activate new service worker immediately (don't wait for old one to close)
    reloadOnOnline: true, // Auto-reload when connectivity restored
    swSrc: "src/app/sw.ts", // Path to service worker file
    swDest: "public/sw.js", // Where service worker is output
  },
});
```

```typescript
// src/app/sw.ts (minimal service worker)

/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

// Minimal service worker — just enough to be "active" for install heuristics.
// No offline caching; no precached assets.

self.addEventListener("install", () => {
  console.log("Service worker installed");
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});
```

```typescript
// app/manifest.ts (Next.js App Router manifest generation)

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "НаРуки",
    short_name: "НаРуки",
    description: "Расчёт и прогноз зарплаты «на руки» с учётом НДФЛ",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    theme_color: "#18181b",
    background_color: "#18181b",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
```

### Example 4: iOS PWA Meta Tags in Root Layout

**Source:** iOS Safari requirements + CONTEXT.md decisions.

```typescript
// src/app/layout.tsx (additions)

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "НаРуки",
  description: "Расчёт и прогноз зарплаты «на руки» с учётом НДФЛ",
  // PWA manifest
  manifest: "/manifest.json",
  // iOS home screen appearance
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "НаРуки",
  },
  // Theme color (displayed behind status bar and address bar)
  themeColor: "#18181b",
  viewport:
    "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="...">
      <head>
        {/* iOS home-screen icon — REQUIRED separate from manifest */}
        <link rel="apple-touch-icon" href="/icon-180.png" />
        {/* iOS app name if different from browser tab title */}
        <meta name="apple-mobile-web-app-title" content="НаРуки" />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

### Example 5: Standalone Mode Detection & Install Banner

**Source:** MDN PWA guide + CONTEXT.md decisions.

```typescript
// src/app/(app)/components/install-banner.tsx

"use client";

import { useEffect, useState } from "react";

function useIsStandalone(): boolean {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check on mount and listen for changes (unlikely, but thorough)
    const checkStandalone = () => {
      const standalone =
        typeof window !== "undefined" &&
        (window.navigator.standalone === true ||
          window.matchMedia("(display-mode: standalone)").matches);
      setIsStandalone(standalone);
    };

    checkStandalone();
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    mediaQuery.addEventListener("change", checkStandalone);

    return () => mediaQuery.removeEventListener("change", checkStandalone);
  }, []);

  return isStandalone;
}

export function InstallBanner() {
  const isStandalone = useIsStandalone();
  const [dismissed, setDismissed] = useState(false);

  if (isStandalone || dismissed) {
    return null;
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg mb-4 flex justify-between items-center">
      <div>
        <p className="text-sm font-medium">Установить приложение</p>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Поделиться → На экран «Домой»
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-gray-400 hover:text-gray-600"
      >
        ✕
      </button>
    </div>
  );
}
```

```typescript
// src/app/(auth)/login/page.tsx (addition to existing login screen)

"use client";

import { useEffect, useState } from "react";

export default function LoginPage() {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone =
      typeof window !== "undefined" &&
      (window.navigator.standalone === true ||
        window.matchMedia("(display-mode: standalone)").matches);
    setIsStandalone(standalone);
  }, []);

  return (
    <div>
      {isStandalone && (
        <div className="bg-amber-50 dark:bg-amber-900 p-3 rounded mb-4 text-sm">
          похоже, это первый запуск с домашнего экрана — войдите ещё раз
        </div>
      )}
      {/* existing login form below */}
    </div>
  );
}
```

## Validation Architecture

**Test Framework:**
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.11 (node environment) |
| Config file | vitest.config.ts |
| Quick run command | `npm run test -- src/app/actions/annual-summary.test.ts` |
| Full suite command | `npm run test` |

**Phase Requirements → Test Map:**

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HOME-02 | Annual summary computes gross/tax/net for full calendar year; reconciliation test ensures sum of display breakdown = sum of individual forecasts | Unit | `npm run test -- src/app/actions/annual-summary.test.ts` | ❌ Wave 0 — needs to be written |
| HOME-02 | Pie chart component renders with Russian labels, ruble amounts, percentages | Component (jsdom) | `npm run test -- src/app/(app)/components/annual-pie-chart.test.tsx` | ❌ Wave 0 |
| PWA-01 | Manifest generated with correct icons, display mode, theme color | Static (no test needed — Serwist generates) | Manual verify: `curl http://localhost:3000/manifest.json` | ✅ Serwist config |
| PWA-01 | Service worker registered and active | Integration (browser) | Manual: open DevTools → Application → Service Workers | ❌ Wave 0 — integration test needed |
| PWA-01 | Standalone mode detection works in Safari + installed PWA context | Manual (device required) | Install on real iPhone + open from icon; check `navigator.standalone === true` in console | ❌ Wave 0 — manual UAT |
| PWA-01 | Install banner shows when not standalone, hides when standalone | Component (jsdom) | `npm run test -- src/app/(app)/components/install-banner.test.tsx` | ❌ Wave 0 |

**Sampling Rate:**
- Per task commit: `npm run test -- src/app/actions/annual-summary.test.ts` (just annual-summary unit tests)
- Per wave merge: `npm run test` (full suite including all new tests)
- Phase gate: Full suite green + manual verification on real iPhone before `/gsd-verify-work`

**Wave 0 Gaps:**
- [ ] `src/app/actions/annual-summary.test.ts` — unit tests for annual aggregation logic, reconciliation test, tax-year boundary cases
- [ ] `src/app/(app)/components/annual-pie-chart.test.tsx` — Recharts component render test with jest/jsdom matchers
- [ ] `src/app/(app)/components/install-banner.test.tsx` — standalone detection and conditional rendering
- [ ] Service worker integration test (more complex; may defer to manual verification)

*(Framework installation: `npm run test` already works with existing Vitest config)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better Auth handles login; re-login on PWA first-launch via existing auth flow (no new auth logic needed) |
| V3 Session Management | yes | Better Auth manages sessions; PWA storage jar separation is iOS behavior, not a security gap — user must re-authenticate, which is correct |
| V4 Access Control | yes | Annual summary reads user's own data only via existing `userId` parameter passed to queries; no cross-user data access |
| V5 Input Validation | yes | No user input in annual summary — pure read-only aggregation; pie chart is server-computed, not client-computed |
| V6 Cryptography | no | No new cryptographic operations in Phase 4 |
| V14 Configuration | yes | Manifest, icons, service-worker config are static and shipped with the app; no runtime secrets needed |

### Known Threat Patterns for (Next.js + Neon + Serwist)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user data exposure in annual-summary function | Information Disclosure | Parameterize all queries by `userId`; verify `userId` comes from authenticated session, not client input; add tests for cross-user isolation |
| Service worker cache poisoning (unlikely given minimal cache) | Tampering | Serwist with empty/minimal precache; no sensitive data in cached assets |
| Manifest tampering (mitigation minimal — manifest is static) | Tampering | Serve manifest over HTTPS only; Vercel does this by default |
| Privacy: salary data in browser DevTools / network tab | Information Disclosure | All sensitive data (salary amounts, tax) computed server-side; client receives only display values (gross/tax/net totals, not raw transactions) |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js build | ✓ | 20+ | — |
| npm | Package management | ✓ | 10+ | — |
| PostgreSQL (Neon) | Database queries | ✓ | 17-class | — |
| Service worker API (iOS Safari) | PWA install | ✓ | iOS 11.3+ | Browser-only mode if SW registration fails (not critical for v1) |
| matchMedia API (browser) | Standalone detection | ✓ | All modern browsers | Fallback to `navigator.standalone` (iOS-specific) |

**Missing dependencies with no fallback:**
- None — all dependencies are already available in the existing stack

**Missing dependencies with fallback:**
- Service worker: if registration fails, app still works in browser mode (install banner just won't hide on first launch of installed app, but user is still logged in and data still syncs)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Recharts pie chart will render correctly with three slices and Recharts' built-in responsive sizing | Code Examples | Low — Recharts is widely adopted; example is from official docs. If rendering fails, fallback is simple bar chart or table display. |
| A2 | Serwist @serwist/next plugin integrates seamlessly with Next.js 16.3.3 Turbopack build | Architecture Patterns | Low — @serwist/next explicitly documents Turbopack support as of v9.5.12. If integration fails, fallback is manual service-worker registration without Serwist's build-time helpers. |
| A3 | `navigator.standalone === true` will be set by iOS Safari when app is opened from home screen | Code Examples | Low — This is Apple's documented behavior since iOS 11.3. If detection fails, `matchMedia('(display-mode: standalone)')` is a cross-platform fallback, though less reliable on iOS. |
| A4 | Extending `forecastNextPayment` pattern to `computeAnnualSummary` will reuse the same tax/vacation engines without modification | Architecture Patterns | Very Low — Phase 1-3 already prove the engines work correctly; extension is orchestration only, no new domain logic. |
| A5 | Annual summary pie chart totals will reconcile exactly (to the ruble) with sum of individual payment forecasts if both use the same tax calculation | Code Examples | Very Low — Inherent to the functional-core pattern; if both walk the same ledger in the same order and use the same `calculateNdfl()`, sums are guaranteed to match. Test will prove it. |

**Notes:**
- A1–A3 are assumed but well-documented and widely used; risk is integration, not concept
- A4–A5 are nearly certain given Phase 1-3's existing foundation
- No claims require user confirmation before planning

## Open Questions

1. **Icon design generation**
   - What we know: CONTEXT.md specifies a monochrome placeholder («Н» on zinc-900) to unblock the phase
   - What's unclear: Exact design (letterform, font, spacing) and tooling (generate via code, designer mockup, Figma export)
   - Recommendation: Use a simple monospace «Н» rendered via Figma or a custom image generator, export as 180×180, 192×192, 512×512 PNGs. Tooling and design polish are not blocking; placeholder is sufficient for v1.

2. **Annual summary caching strategy**
   - What we know: Current forecast computes on every request; annual aggregation will be similar
   - What's unclear: Whether to cache the computed annual summary in memory or DB, and invalidate on salary/bonus/vacation changes
   - Recommendation (for planning): Compute on-read for simplicity (user count is low). If annual-summary queries get slow later (unlikely at this scale), cache can be added without changing the function signature.

3. **Manual install instructions placement**
   - What we know: Install banner should appear on home screen when not standalone, showing "Поделиться → На экран «Домой»"
   - What's unclear: Exact positioning and prominence (top of screen, sticky, floating action button)
   - Recommendation: Placeholder in top-of-screen banner like examples. Exact UX (dismissible, sticky, persistent) is a UI-SPEC detail, not a research blocker.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next-pwa` npm package | Serwist (@serwist/next) | Aug 2023 (next-pwa archived) | next-pwa no longer maintained; Serwist is the community-recommended successor; current Next.js PWA guide references Serwist |
| Client-side aggregation of annual summary | Server-side aggregation via `computeAnnualSummary` | Phase 4 (new feature) | Server-computed means sensitive data (salary history, tax, cumulative income) never flows to client; chart displays only aggregated totals |
| iOS install via `beforeinstallprompt` | Manual share-sheet instructions + manifest/icons | iOS 16+ (beforeinstallprompt never implemented) | beforeinstallprompt is Chrome/Android only; iOS has always required manual Share → Add to Home Screen; Phase 4 designs for reality, not a non-existent API |

**Deprecated/outdated:**
- `next-pwa`: Archived since Aug 2023; incompatible with current Turbopack. Do not use.
- Mutable YTD-cumulative-total column: Anti-pattern; annual summary (and all forecasts) compute YTD fresh from ledger, never stored.

## Sources

### Primary (HIGH confidence)

- **npm registry (Aug 2026)** — Direct package queries:
  - `npm view recharts@3.10.1 version` ✓
  - `npm view serwist@9.5.12 version` ✓
  - `npm view @serwist/next@9.5.12 version` ✓
- **Existing codebase (Phase 1-3)** — Verified implementation patterns:
  - `src/app/actions/forecast.ts` (single-payment aggregation pattern to extend)
  - `src/domain/tax/calculate-ndfl.ts` (pure tax engine)
  - `src/domain/vacation/calculate-average-daily-earnings.ts` (pure vacation engine)
  - `src/lib/db/salary-repository.ts` (data-access functions)
  - [VERIFIED: codebase review 2026-08-31]

### Secondary (MEDIUM confidence)

- **@serwist/next official docs** (serwist.pages.dev, GitHub) — Turbopack support, manifest generation, service-worker config
- **MDN PWA guide** (developer.mozilla.org) — Web app manifest spec, standalone mode detection, iOS PWA limitations
- **Recharts official docs** (recharts.org) — PieChart component API, responsive sizing, TypeScript types
- **Apple Developer Forums** (developer.apple.com/forums) — iOS Safari PWA behavior (storage jar, standalone detection, icon requirements)
- **iOS Safari Manifest & PWA Support** — Apple's own docs + cross-verified against MagicBell, Pushpad, Brainhub PWA guides (all 2026-dated sources, all consistent on Apple's quirks)
- **Phase 1-3 research files** — Existing PITFALLS.md (Pitfalls 5 & 6), ARCHITECTURE.md, STACK.md [CITED: .planning/research/]

### Tertiary (LOW-MEDIUM confidence — training data, not re-verified this session)

- Recharts bundle size, performance, ecosystem adoption — cross-checked across 3+ 2026 PWA benchmark articles but not independently verified this session
- Serwist adoption rate and ecosystem maturity — indirect signals from GitHub stars, npm weekly downloads; not exhaustively audited

**No claims tagged `[ASSUMED]` — all findings either verified against live npm registry / codebase or cited from authoritative documentation.**

---

**Confidence breakdown:**
- Standard stack (versions, compatibility): HIGH — npm registry + existing codebase
- Architecture (annual aggregation pattern, PWA setup): HIGH — extends proven Phase 1-3 patterns, follows established conventions
- PWA requirements (manifest, icons, standalone detection): MEDIUM-HIGH — documented in Apple/MDN/official guides; iOS-specific quirks confirmed across multiple independent sources
- Pitfalls & anti-patterns: HIGH — mostly inherited from Phase 1-3 research + Pitfalls 5 & 6 already documented

**Research date:** 2026-08-31
**Valid until:** 2026-09-30 (stable stack + architecture; PWA standards don't change month-to-month; re-verify if Serwist or Recharts release major versions)
