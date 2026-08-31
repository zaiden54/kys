# Phase 4: Annual Overview & PWA Installability - Pattern Map

**Mapped:** 2026-08-31
**Files analyzed:** 10 new/modified files
**Analogs found:** 8 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/actions/annual-summary.ts` | service/action | CRUD (read-only) | `src/app/actions/forecast.ts` | exact |
| `src/app/(app)/components/annual-pie-chart.tsx` | component | request-response | `src/components/next-payment-card.tsx` | exact |
| `src/app/(app)/components/install-banner.tsx` | component | request-response | `src/components/ytd-estimate-banner.tsx` | role-match |
| `src/app/(auth)/login/page.tsx` | page | request-response | (existing file) | exact |
| `src/app/layout.tsx` | layout | static/config | (existing file) | exact |
| `app/manifest.ts` | config | static | Next.js App Router convention | role-match |
| `src/app/sw.ts` | middleware | event-driven | Service worker pattern | role-match |
| `next.config.ts` | config | static | (existing file) | exact |
| `public/icon-*.png` | static asset | static | N/A | N/A |
| `src/app/actions/annual-summary.test.ts` | test | test/automation | `src/app/actions/forecast.test.ts` | exact |

---

## Pattern Assignments

### `src/app/actions/annual-summary.ts` (service/action, CRUD read-only)

**Analog:** `src/app/actions/forecast.ts` (lines 1-61)

**Server-only guard pattern** (lines 1-15):
```typescript
// server-only guard equivalent: the `server-only` npm package isn't
// installed (new package installs require a human-verify checkpoint per
// executor deviation rules), so this throws immediately if the module is
// ever evaluated in a browser context, preventing it from reaching a client
// bundle. Matches the pattern established in src/lib/session.ts and
// src/lib/db/salary-repository.ts. Unlike src/app/actions/salary.ts, this
// module is never invoked as a Next.js Server Action from a client
// `<form action>` — it is called directly during a server component's
// render (see src/app/(app)/page.tsx) — so it carries no `"use server"`
// directive.
if (typeof window !== "undefined") {
  throw new Error(
    "src/app/actions/annual-summary.ts is server-only and must never be imported into a client component.",
  );
}
```

**Imports pattern** (lines 40-60):
```typescript
import { format } from "date-fns";
import type { Kopecks } from "@/domain/money";
import { calculateNdfl } from "@/domain/tax/calculate-ndfl";
import { halfSplitGross, type SalaryHistoryEntry } from "@/domain/pay/payment-accrual";
import { nowInMoscow, todayIsoInMoscow } from "@/domain/time";
import {
  calculateVacationPayGross,
  resolveVacationPaymentDate,
  toPremiumBonusEntries,
  type PremiumBonusEntry,
} from "@/domain/vacation/calculate-average-daily-earnings";
import { listBonuses } from "@/lib/db/bonus-repository";
import { listVacations } from "@/lib/db/vacation-repository";
import {
  computeCumulativeIncome,
  getActiveSalaryAt,
  getSchedule,
  getYtdBaseline,
  listSalaryHistory,
} from "@/lib/db/salary-repository";
```

**Function signature and return type pattern** (lines 62-84):
```typescript
export interface NextPaymentForecast {
  date: string;
  kind: PaymentKind | "bonus" | "vacation";
  grossKopecks: Kopecks;
  taxKopecks: Kopecks;
  netKopecks: Kopecks;
  baselineIsEstimated: boolean;
  breakdown?: { salaryOrAvansKopecks: Kopecks; bonusKopecks: Kopecks };
  vacationId?: string;
}

export type ForecastResult =
  | { configured: true; forecast: NextPaymentForecast }
  | { configured: false; missing: "salary" | "schedule" };
```

**Core aggregation pattern** (lines 113-154):
```typescript
export async function forecastNextPayment(userId: string): Promise<ForecastResult> {
  // Fetched once, up front — including ytdBaseline — and threaded into
  // computeCumulativeIncome below instead of re-fetching all five rows a
  // second time
  const [schedule, bonusRows, vacationRows, salaryHistoryRows, ytdBaseline] = await Promise.all([
    getSchedule(userId),
    listBonuses(userId),
    listVacations(userId),
    listSalaryHistory(userId),
    getYtdBaseline(userId),
  ]);

  // Not configured check: same as forecastNextPayment
  if (!schedule || salaryHistoryRows.length === 0) {
    return { configured: false, missing: !schedule ? "schedule" : "salary" };
  }

  // Build event timeline
  const paymentEvent = schedule
    ? nextPaymentOnOrAfter(
        { avansDay: schedule.avansDay, salaryDay: schedule.salaryDay },
        nowInMoscow(),
      )
    : null;
  
  // ... resolve and tax each event ...
}
```

---

### `src/components/next-payment-card.tsx` (component, request-response)

**Analog:** `src/components/next-payment-card.tsx` (lines 1-78)

**Server component with formatKopecks pattern** (lines 1-15):
```typescript
/**
 * Displays the date and take-home amount of the user's next payment
 * (HOME-01). Server component — receives an already-computed
 * `NextPaymentForecast` and renders it; it performs no tax calculation of
 * its own (T-01-02: `calculateNdfl`/`taxOnCumulative` must never appear in
 * this file).
 *
 * The wording deliberately reads as a planning forecast the app computed,
 * never as a figure the employer has confirmed or an actual payslip amount.
 */

import { formatKopecks } from "@/domain/money";
import { formatIsoDateRu } from "@/domain/time";
import type { NextPaymentForecast } from "@/app/actions/forecast";
```

**Component structure with TypeScript props** (lines 23-78):
```typescript
export function NextPaymentCard({ forecast }: { forecast: NextPaymentForecast }) {
  return (
    <section className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
        Прогноз, а не подтверждённая работодателем сумма
      </p>
      <p className="mt-1 text-sm text-zinc-600">
        {KIND_LABELS[forecast.kind]} · {formatIsoDateRu(forecast.date)}
      </p>
      <p className="mt-4 text-3xl font-semibold text-zinc-900">
        {formatKopecks(forecast.netKopecks)}
      </p>
      {/* Conditional rendering of breakdown */}
      {forecast.kind === "vacation" ? (
        <div>...</div>
      ) : forecast.breakdown ? (
        <dl>...</dl>
      ) : (
        <dl>...</dl>
      )}
    </section>
  );
}
```

---

### `src/app/(app)/components/annual-pie-chart.tsx` (component, request-response)

**Analog:** `src/components/next-payment-card.tsx` + Next.js/Recharts patterns

**Uses the same imports and display pattern:**
```typescript
import { formatKopecks } from "@/domain/money";
import type { AnnualSummary } from "@/app/actions/annual-summary";
```

**Renders with Recharts library:**
```typescript
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";

export function AnnualPieChart({ summary }: { summary: AnnualSummary }) {
  const { grossKopecks, taxKopecks, netKopecks } = summary;
  const gross = Math.round(grossKopecks / 100);

  const data = [
    { name: "Грязными", value: gross - Math.round(taxKopecks / 100), fill: "#10b981" },
    { name: "Налог", value: Math.round(taxKopecks / 100), fill: "#ef4444" },
    { name: "На руки", value: Math.round(netKopecks / 100), fill: "#3b82f6" },
  ];

  return (
    <div className="mt-6 p-4 bg-white dark:bg-zinc-900 rounded-lg">
      <h2 className="text-lg font-semibold mb-4">Годовая сводка</h2>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value">
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

### `src/app/(app)/components/install-banner.tsx` (component, request-response)

**Analog:** `src/components/ytd-estimate-banner.tsx` (lines 1-34) for banner structure

**Banner structure pattern:**
```typescript
/**
 * Persistent warning banner following the same pattern as YtdEstimateBanner.
 * Shows install instructions when not in standalone mode.
 *
 * Client component with useEffect/useState for runtime detection.
 */

import { useEffect, useState } from "react";

export function InstallBanner() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Runtime check for standalone mode
    const standalone =
      typeof window !== "undefined" &&
      (window.navigator.standalone === true ||
        window.matchMedia("(display-mode: standalone)").matches);
    setIsStandalone(standalone);
  }, []);

  if (isStandalone || dismissed) {
    return null;
  }

  return (
    <div className="w-full max-w-sm rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-900">
      <p>Установить приложение</p>
      <p className="text-xs text-gray-600">Поделиться → На экран «Домой»</p>
      <button onClick={() => setDismissed(true)}>✕</button>
    </div>
  );
}
```

---

### `src/app/(auth)/login/page.tsx` (page, request-response) — MODIFY

**Analog:** Existing file at `src/app/(auth)/login/page.tsx` (lines 1-89)

**Existing form pattern to extend** (lines 1-40):
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

const loginSchema = z.object({
  email: z.string().email("Введите корректный email"),
  password: z.string().min(1, "Введите пароль"),
});

type LoginInput = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  // ... form implementation ...
}
```

**Add standalone detection hook to detect re-login scenario:**
```typescript
// Add at top of component:
const [isStandalone, setIsStandalone] = useState(false);

useEffect(() => {
  const standalone =
    typeof window !== "undefined" &&
    (window.navigator.standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches);
  setIsStandalone(standalone);
}, []);

// Add this banner before the form:
{isStandalone && (
  <div className="bg-amber-50 dark:bg-amber-900 p-3 rounded mb-4 text-sm">
    похоже, это первый запуск с домашнего экрана — войдите ещё раз
  </div>
)}
```

---

### `src/app/layout.tsx` (layout, static/config) — MODIFY

**Analog:** Existing file at `src/app/layout.tsx` (lines 1-30)

**Existing metadata pattern** (lines 15-18):
```typescript
export const metadata: Metadata = {
  title: "НаРуки",
  description: "Расчёт и прогноз зарплаты «на руки» с учётом НДФЛ",
};
```

**Extend metadata object with PWA properties:**
```typescript
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
  // Theme color
  themeColor: "#18181b",
  viewport:
    "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
};
```

**Add to `<head>` in the JSX:**
```typescript
<head>
  {/* iOS home-screen icon — REQUIRED separate from manifest */}
  <link rel="apple-touch-icon" href="/icon-180.png" />
  {/* iOS app name if different from browser tab title */}
  <meta name="apple-mobile-web-app-title" content="НаРуки" />
</head>
```

---

### `app/manifest.ts` (config, static) — NEW

**Analog:** Next.js 16 App Router convention (no direct analog in repo)

**Return type and structure:**
```typescript
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

---

### `src/app/sw.ts` (middleware, event-driven) — NEW

**Analog:** Service worker pattern (standard Web API, no direct analog in repo)

**Minimal service worker for PWA install heuristics:**
```typescript
/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

// Minimal service worker — just enough to be "active" for install heuristics.
// No offline caching; no precached assets.

self.addEventListener("install", () => {
  console.log("Service worker installed");
  // No skipWaiting or waitUntil needed for minimal setup
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});
```

---

### `next.config.ts` (config, static) — MODIFY

**Analog:** Existing file at `next.config.ts` (lines 1-8)

**Add Serwist plugin to existing config:**
```typescript
import type { NextConfig } from "next";
import { withSerwist } from "@serwist/next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSerwist({
  ...nextConfig,
  serwist: {
    disable: process.env.NODE_ENV === "development",
    register: true,
    skipWaiting: true,
    reloadOnOnline: true,
    swSrc: "src/app/sw.ts",
    swDest: "public/sw.js",
  },
});
```

---

### `src/app/actions/annual-summary.test.ts` (test, test/automation) — NEW

**Analog:** `src/app/actions/forecast.test.ts` (lines 1-100)

**Test setup pattern with throwaway users:**
```typescript
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/db/auth-schema";

vi.mock("@/lib/session", () => ({ requireUserId: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

async function createThrowawayUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(user).values({
    id,
    name: "Test User",
    email: `annual-test-${id}@example.invalid`,
  });
  return id;
}

describe("computeAnnualSummary", () => {
  let userId: string;

  beforeEach(async () => {
    userId = await createThrowawayUser();
  });

  afterEach(async () => {
    await db.delete(user).where(eq(user.id, userId));
  });

  it("(1) annual summary gross/tax/net reconciles exactly to individual payment forecasts", async () => {
    // Setup: salary, schedule, bonuses, vacations for a full year
    // Assert: sum of individual forecasts == annual summary totals
  });

  it("(2) annual summary respects configured/unconfigured state for salary/schedule", async () => {
    // Empty schedule/salary should return { configured: false }
  });

  it("(3) baselineIsEstimated flag is set correctly", async () => {
    // Test with estimated baseline, assert flag is true
  });
});
```

---

## Shared Patterns

### Server-Only Modules
**Source:** `src/app/actions/forecast.ts` (lines 1-15)
**Apply to:** `src/app/actions/annual-summary.ts`, all new server actions
```typescript
if (typeof window !== "undefined") {
  throw new Error(
    "src/app/actions/annual-summary.ts is server-only and must never be imported into a client component.",
  );
}
```

### Money Formatting (Kopecks → Rubles Display)
**Source:** `src/domain/money.ts` (lines 35-42)
**Apply to:** `annual-pie-chart.tsx`, any component displaying monetary values
```typescript
import { formatKopecks } from "@/domain/money";

// Usage:
<span>{formatKopecks(forecast.netKopecks)}</span>
```

### Not-Configured Pattern (No Zero Placeholder)
**Source:** `src/app/actions/forecast.ts` (lines 82-84)
**Apply to:** `annual-summary.ts`, annual pie chart component
```typescript
export type Result =
  | { configured: true; data: AnnualSummary }
  | { configured: false; missing: "salary" | "schedule" };
```

### Client Component Hooks for Runtime Detection
**Source:** `src/app/(auth)/login/page.tsx` (lines 1-40)
**Apply to:** `install-banner.tsx`, any client component needing runtime state
```typescript
"use client";

import { useEffect, useState } from "react";

export function InstallBanner() {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone =
      typeof window !== "undefined" &&
      (window.navigator.standalone === true ||
        window.matchMedia("(display-mode: standalone)").matches);
    setIsStandalone(standalone);
  }, []);

  if (isStandalone) return null;
  // ... render ...
}
```

### Vitest Test Pattern with Database Isolation
**Source:** `src/app/actions/forecast.test.ts` (lines 11-61)
**Apply to:** `annual-summary.test.ts`
```typescript
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/db/auth-schema";

beforeEach(async () => {
  userId = await createThrowawayUser();
});

afterEach(async () => {
  await db.delete(user).where(eq(user.id, userId));
});
```

---

## No Analog Found

Files with no existing analog in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `app/manifest.ts` | config | static | Next.js 16 App Router convention; no legacy manifest in this repo yet |
| `src/app/sw.ts` | middleware | event-driven | Service worker pattern; no existing SW in this project |
| `public/icon-*.png` | static asset | static | Generated images; no reference icons in repo |

---

## Metadata

**Analog search scope:** `src/app/`, `src/components/`, `src/app/actions/`, `src/domain/`
**Files scanned:** ~50 relevant files
**Pattern extraction date:** 2026-08-31
**High-confidence analogs:** 8 (forecast.ts, next-payment-card.tsx, ytd-estimate-banner.tsx, login/page.tsx, layout.tsx, forecast.test.ts, money.ts, time.ts)
**Medium-confidence analogs:** 2 (manifest.ts from Next.js convention, sw.ts from Web API standard)
