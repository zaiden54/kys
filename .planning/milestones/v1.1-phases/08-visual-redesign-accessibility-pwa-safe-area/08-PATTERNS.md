# Phase 8: Visual Redesign, Accessibility & PWA Safe-Area - Pattern Map

**Mapped:** 2026-09-02
**Files analyzed:** 17 new/modified
**Analogs found:** 16 / 17 exact matches (1 new component type)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/globals.css` | config | static | current file (expand) | exact |
| `src/app/layout.tsx` | layout | static | current file (verify) | exact |
| `src/app/(app)/layout.tsx` | layout | request-response | current file (add header) | exact |
| `src/components/install-banner.tsx` | component | request-response | current file (migrate dark:) | exact |
| `src/components/next-payment-card.tsx` | component | request-response | current file (restyle) | exact |
| `src/components/pay-setup-forms.tsx` | component | CRUD | current file (restyle) | exact |
| `src/components/annual-pie-chart.tsx` | component | request-response | current file (restyle) | exact |
| `src/app/(app)/bonuses/bonus-row.tsx` | component | CRUD | current file (restyle) | exact |
| `src/app/(app)/vacations/vacation-row.tsx` | component | CRUD | current file (restyle) | exact |
| `src/app/(app)/page.tsx` | page | request-response | current file (add error state) | exact |
| `src/app/(app)/bonuses/page.tsx` | page | request-response | current file (add loading skeleton) | exact |
| `src/app/(app)/vacations/page.tsx` | page | request-response | current file (add loading skeleton) | exact |
| `src/app/(app)/settings/salary/page.tsx` | page | request-response | `src/app/(app)/page.tsx` | role-match |
| `src/app/(auth)/login/page.tsx` | page | request-response | current file (restyle) | exact |
| `src/app/(auth)/register/page.tsx` | page | request-response | `src/app/(auth)/login/page.tsx` | exact |
| `src/components/skeleton-loader.tsx` | component | request-response | N/A (new pattern) | no-analog |
| `src/app/manifest.ts` | config | static | current file (verify) | exact |

---

## Pattern Assignments

### Global CSS Variables & Design Tokens (`src/app/globals.css`)

**Analog:** Current file (lines 1-27) — expand existing `:root`/`@media` pattern to include new tokens

**Current structure** (lines 1-27):
```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}
```

**Pattern to apply (08-UI-SPEC.md § Design System):**
- **Dark-base polarity:** `:root` declares dark-mode values as the default, `@media (prefers-color-scheme: light)` overrides for light mode (NOT the conventional light-base/dark-override pattern)
- **Color tokens** (add to `:root`):
  - `--color-dominant: #1a1a1a` (dark) / `#ffffff` (light) — primary background
  - `--color-secondary: #242424` (dark) / `#f9fafb` (light) — card surfaces
  - `--color-accent: #10b981` — emerald, identical both modes, for hero amounts and primary buttons
  - `--color-destructive: #ef4444` — identical both modes, for delete/error
  - `--color-text-primary: #f5f5f5` (dark) / `#171717` (light)
  - `--color-text-secondary: #9ca3af` (dark) / `#6b7280` (light)
  - `--color-tertiary-surface: #2d2d2d` (dark) / `#f3f4f6` (light) — dividers, borders, skeleton fill
- **Typography tokens** (add to `:root`):
  - `--font-size-body: 14px` / `--font-weight-body: 400` / `--line-height-body: 1.6`
  - `--font-size-label: 14px` / `--font-weight-label: 400` / `--line-height-label: 1.4`
  - `--font-size-heading: 18px` / `--font-weight-heading: 600` / `--line-height-heading: 1.3`
  - `--font-size-display: 28px` / `--font-weight-display: 600` / `--line-height-display: 1.2`
  - `--font-size-caption: 12px` / `--font-weight-caption: 400` / `--line-height-caption: 1.4`
- **Spacing tokens** (add to `:root`):
  - `--spacing-xs: 4px`
  - `--spacing-sm: 8px`
  - `--spacing-md: 16px`
  - `--spacing-lg: 24px`
  - `--spacing-xl: 32px`
  - `--spacing-2xl: 48px`
  - `--spacing-3xl: 64px`
- **Utility classes:**
  ```css
  .tabular-nums {
    font-variant-numeric: tabular-nums;
  }
  ```

---

### Root Layout Viewport (`src/app/layout.tsx`)

**Analog:** Current file (lines 29-36)

**Status:** `viewportFit: "cover"` already set on line 35. Verify no changes needed.

**Current pattern** (lines 29-36):
```typescript
export const viewport: Viewport = {
  themeColor: "#18181b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};
```

**Note:** PWA-01 already complete. No changes required.

---

### App Layout with Persistent Navigation Header (`src/app/(app)/layout.tsx`)

**Analog:** Current file (lines 16-29) — existing header structure, add safe-area and home link

**Current structure** (lines 16-29):
```typescript
return (
  <div className="flex min-h-full flex-1 flex-col">
    <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
      <div className="flex items-center gap-4">
        <span className="text-sm text-zinc-600">{user.email}</span>
        <Link href="/bonuses" className="text-sm font-medium text-zinc-800 underline">Бонусы</Link>
        <Link href="/vacations" className="text-sm font-medium text-zinc-800 underline">Отпуска</Link>
      </div>
      <SignOutButton />
    </header>
    <main className="flex flex-1 flex-col">{children}</main>
  </div>
);
```

**Pattern to apply (UI-04, PWA-01):**
- Replace with persistent header design per 08-UI-SPEC.md § Persistent Nav Header:
  - App name "НаРуки" as tappable link to `/` (home) — primary element, not secondary nav
  - Secondary-surface background (`bg-[color:var(--color-secondary)]`)
  - 56px fixed height
  - 1px tertiary-surface bottom border
  - `pt-[env(safe-area-inset-top)]` on header wrapper (single source of truth for notch padding — PWA-02)
  - No other component applies safe-area padding
- Wrap main content with `pb-[env(safe-area-inset-bottom)]` to prevent overlap with home indicator

**Revised structure:**
```typescript
return (
  <div className="flex min-h-full flex-1 flex-col">
    <header 
      className="border-b border-[color:var(--color-tertiary-surface)] bg-[color:var(--color-secondary)]"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex h-14 items-center justify-between px-6">
        <Link href="/" className="text-lg font-semibold text-[color:var(--color-text-primary)]">
          НаРуки
        </Link>
        <SignOutButton />
      </div>
    </header>
    <main 
      className="flex flex-1 flex-col"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {children}
    </main>
  </div>
);
```

---

### Install Banner Dark Mode Migration (`src/components/install-banner.tsx`)

**Analog:** Current file (lines 75-93)

**Current pattern** (lines 75-93):
```typescript
return (
  <div className="w-full max-w-sm rounded border-l-4 border-zinc-900 bg-zinc-100 p-3 dark:bg-zinc-800">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold">Установить приложение</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          Поделиться → На экран «Домой»
        </p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Скрыть"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        ✕
      </button>
    </div>
  </div>
);
```

**Pattern to apply:**
- Replace raw Tailwind zinc utilities with CSS-variable-based tokens from `globals.css`
- `dark:bg-zinc-800` → `bg-[color:var(--color-secondary)]` (works in both modes via polarity)
- `text-zinc-600 dark:text-zinc-300` → `text-[color:var(--color-text-secondary)]`
- `text-zinc-900 dark:text-zinc-100` → `text-[color:var(--color-text-primary)]`
- Keep the left-border accent color as a secondary-surface variant or use `border-[color:var(--color-tertiary-surface)]`

**Revised pattern:**
```typescript
return (
  <div className="w-full max-w-sm rounded border-l-4 border-[color:var(--color-tertiary-surface)] bg-[color:var(--color-secondary)] p-3">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-[color:var(--color-text-primary)]">
          Установить приложение
        </h2>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
          Поделиться → На экран «Домой»
        </p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Скрыть"
        className="text-sm text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
      >
        ✕
      </button>
    </div>
  </div>
);
```

---

### Next Payment Card (`src/components/next-payment-card.tsx`)

**Analog:** Current file (lines 23-76)

**Current structure** (lines 23-76):
```typescript
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
    <p className="mt-1 text-sm text-zinc-500">придёт на руки</p>

    {forecast.kind === "vacation" ? (
      <div className="mt-6 flex flex-col gap-1 text-sm text-zinc-600">
        {/* breakdown */}
      </div>
    ) : (
      /* other breakdowns */
    )}

    <p className="mt-4 text-xs text-zinc-400">
      Это плановый расчёт для планирования бюджета — не официальная и не гарантированная сумма.
    </p>
  </section>
);
```

**Pattern to apply (UI-05, UI-06, 08-UI-SPEC.md § Hero Next-Payment Card):**
- Secondary-surface background (`bg-[color:var(--color-secondary)]`)
- 1px tertiary-surface border
- 12px corner radius (rounded-[12px])
- `lg` (24px) padding
- Subtle shadow in dark mode only (light mode relies on border for definition)
- Forecast amount in Display role (28px/600/Georgia serif) in accent emerald
- All other amounts stay Body/Caption at text-primary/text-secondary
- Apply `tabular-nums` class to all money/date formatting

**Key changes:**
```typescript
<section className="w-full max-w-sm rounded-[12px] border border-[color:var(--color-tertiary-surface)] bg-[color:var(--color-secondary)] p-6">
  {/* Header (uppercase caption) */}
  <p className="text-xs font-medium tracking-wide text-[color:var(--color-text-secondary)] uppercase">
    Прогноз, а не подтверждённая работодателем сумма
  </p>
  
  {/* Kind + Date (Body role) */}
  <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
    {KIND_LABELS[forecast.kind]} · <span className="tabular-nums">{formatIsoDateRu(forecast.date)}</span>
  </p>

  {/* HERO AMOUNT: Display role, emerald, Georgia serif, tabular-nums */}
  <p className="mt-4 font-georgia text-[28px] font-semibold leading-[1.2] text-[color:var(--color-accent)] tabular-nums">
    {formatKopecks(forecast.netKopecks)}
  </p>
  <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">придёт на руки</p>

  {/* Breakdown lines: Body text, text-secondary */}
  <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-[color:var(--color-text-secondary)]">
    <dt>Начислено (грязными)</dt>
    <dd className="text-right tabular-nums">{formatKopecks(forecast.grossKopecks)}</dd>
    <dt>Удержан НДФЛ</dt>
    <dd className="text-right tabular-nums">{formatKopecks(forecast.taxKopecks)}</dd>
  </dl>

  {/* Footer disclaimer: Caption role, text-secondary */}
  <p className="mt-4 text-xs text-[color:var(--color-text-secondary)]">
    Это плановый расчёт для планирования бюджета — не официальная и не гарантированная сумма.
  </p>
</section>
```

---

### Salary Confirmation Panel (`src/components/pay-setup-forms.tsx`)

**Analog:** Current file (lines 158-173)

**Current pattern** (lines 158-173):
```typescript
{pendingConfirmation && (
  <div className="rounded border border-amber-400 bg-amber-50 p-3 text-sm">
    <p>
      На {pendingConfirmation.effectiveFrom} уже сохранён оклад{" "}
      {pendingConfirmation.existingAmountRubles} ₽. Он будет безвозвратно заменён на{" "}
      {pendingConfirmation.submittedAmountRubles} ₽.
    </p>
    <button
      type="button"
      onClick={onConfirmReplace}
      disabled={confirming}
      className="mt-2 rounded bg-black px-3 py-1.5 text-white disabled:opacity-50"
    >
      {confirming ? "Заменяем…" : "Подтвердить и заменить"}
    </button>
  </div>
)}
```

**Pattern to apply (UI-03, 08-UI-SPEC.md § Confirmation Panel):**
- Old (existing) value: struck-through and text-secondary color
- New (submitted) value: text-primary weight-600, emerald accent **if an increase** over the old
- Both values use identical `tabular-nums` money formatting
- Confirm button uses accent-filled primary-button style (emerald background, white text)
- Cancel is implicit (editing the form again), no cancel button

**Revised pattern:**
```typescript
{pendingConfirmation && (
  <div className="rounded-[8px] border border-[color:var(--color-tertiary-surface)] bg-[color:var(--color-secondary)] p-4 text-sm">
    <p className="text-[color:var(--color-text-primary)]">
      На <span className="tabular-nums">{pendingConfirmation.effectiveFrom}</span> уже сохранён оклад{" "}
      <span className="tabular-nums line-through text-[color:var(--color-text-secondary)]">
        {pendingConfirmation.existingAmountRubles} ₽
      </span>
      . Он будет безвозвратно заменён на{" "}
      <span className={`tabular-nums font-semibold ${pendingConfirmation.submittedAmountRubles > pendingConfirmation.existingAmountRubles ? 'text-[color:var(--color-accent)]' : 'text-[color:var(--color-text-primary)]'}`}>
        {pendingConfirmation.submittedAmountRubles} ₽
      </span>
      .
    </p>
    <button
      type="button"
      onClick={onConfirmReplace}
      disabled={confirming}
      className="mt-3 rounded-[8px] bg-[color:var(--color-accent)] px-4 py-2 text-white font-semibold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
    >
      {confirming ? "Заменяем…" : "Подтвердить и заменить"}
    </button>
  </div>
)}
```

---

### Form Fields (Across `pay-setup-forms.tsx`, `bonus-row.tsx`, `vacation-row.tsx`, Auth Pages)

**Analog:** Current file `src/components/pay-setup-forms.tsx` (lines 125-156) and `src/app/(auth)/login/page.tsx` (lines 63-89)

**Current pattern** (`pay-setup-forms.tsx` lines 128-157):
```typescript
<div className="flex flex-col gap-1">
  <label htmlFor="grossRubles" className="text-sm font-medium">
    Оклад «грязными», ₽
  </label>
  <input
    id="grossRubles"
    type="number"
    step="0.01"
    className="rounded border border-zinc-300 px-3 py-2"
    {...register("grossRubles")}
  />
  {errors.grossRubles && <p className="text-sm text-red-600">{errors.grossRubles.message}</p>}
</div>
```

**Pattern to apply (UI-07, 08-UI-SPEC.md § Form Fields):**
- Primary-surface background (`bg-[color:var(--color-dominant)]`)
- 1px tertiary-surface border
- 8px corner radius
- Focus state: 2px accent-color outline with visible offset (not just border-color change)
- Every input must have a real `<label>` with `htmlFor`/`id` (or `aria-label` if unlabeled today)
- Error text in destructive color

**Revised pattern:**
```typescript
<div className="flex flex-col gap-[var(--spacing-sm)]">
  <label htmlFor="grossRubles" className="text-[length:var(--font-size-label)] font-[number:var(--font-weight-label)] text-[color:var(--color-text-primary)]">
    Оклад «грязными», ₽
  </label>
  <input
    id="grossRubles"
    type="number"
    step="0.01"
    className="rounded-[8px] border border-[color:var(--color-tertiary-surface)] bg-[color:var(--color-dominant)] px-3 py-2 text-[color:var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
    {...register("grossRubles")}
  />
  {errors.grossRubles && (
    <p className="text-[length:var(--font-size-body)] text-[color:var(--color-destructive)]">
      {errors.grossRubles.message}
    </p>
  )}
</div>
```

---

### Bonus/Vacation Row Components (`src/app/(app)/bonuses/bonus-row.tsx`, `src/app/(app)/vacations/vacation-row.tsx`)

**Analog:** `src/app/(app)/bonuses/bonus-row.tsx` (lines 107-120 display mode, lines 81-103 edit mode)

**Display mode pattern** (lines 107-120):
```typescript
return (
  <li className="border-b border-zinc-200 py-3">
    <div className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-2 text-sm sm:grid-cols-[6rem_7rem_minmax(0,1fr)_auto] sm:items-center">
      <span>{formatIsoDateRu(bonus.date)}</span>
      <span className="font-semibold">{formatKopecks(bonus.amountKopecks)}</span>
      <span className="col-span-2 truncate text-zinc-600 sm:col-span-1" title={bonus.note ?? undefined}>{bonus.note || "—"}</span>
      <span className="col-span-2 flex justify-end gap-2 sm:col-span-1">
        <button type="button" onClick={() => setMode("editing")} className="text-zinc-700 underline">Изменить бонус</button>
        <button type="button" onClick={onDelete} disabled={pending} className="text-red-700 underline disabled:opacity-50">{pending ? "Удаляется…" : "Удалить бонус"}</button>
      </span>
    </div>
    {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
  </li>
);
```

**Pattern to apply (UI-07, 08-UI-SPEC.md):**
- Replace zinc utilities with CSS variables
- All money/date values use `tabular-nums` class
- Action links (Изменить/Удалить) get focus-visible outlines
- Destructive action (Удалить) uses destructive color
- Secondary colors for metadata (dates, notes)
- Truncated text still uses `title` tooltip for accessibility

**Revised display mode:**
```typescript
return (
  <li className="border-b border-[color:var(--color-tertiary-surface)] py-3">
    <div className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-2 text-sm text-[color:var(--color-text-primary)] sm:grid-cols-[6rem_7rem_minmax(0,1fr)_auto] sm:items-center">
      <span className="tabular-nums text-[color:var(--color-text-secondary)]">{formatIsoDateRu(bonus.date)}</span>
      <span className="font-semibold tabular-nums">{formatKopecks(bonus.amountKopecks)}</span>
      <span className="col-span-2 truncate text-[color:var(--color-text-secondary)] sm:col-span-1" title={bonus.note ?? undefined}>{bonus.note || "—"}</span>
      <span className="col-span-2 flex justify-end gap-2 sm:col-span-1">
        <button 
          type="button" 
          onClick={() => setMode("editing")} 
          className="text-[color:var(--color-text-primary)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
        >
          Изменить бонус
        </button>
        <button 
          type="button" 
          onClick={onDelete} 
          disabled={pending} 
          className="text-[color:var(--color-destructive)] underline disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-destructive)]"
        >
          {pending ? "Удаляется…" : "Удалить бонус"}
        </button>
      </span>
    </div>
    {error && <p className="mt-2 text-sm text-[color:var(--color-destructive)]">{error}</p>}
  </li>
);
```

**Edit mode pattern** (lines 81-103):
- Keep existing form structure, replace zinc utilities with CSS variables
- Apply same focus-visible outlines to inputs and buttons
- Submit/Cancel buttons: Submit uses accent, Cancel uses neutral border

**Error state pattern** (lines 71-78, 97):
- Keep existing `window.confirm()` pattern — locked by Phase 7 E2E tests
- Error messages use destructive color, same as validation errors

---

### Home Page (`src/app/(app)/page.tsx`)

**Analog:** Current file (lines 37-82)

**Current pattern** (lines 37-82):
- Conditional render: if not configured, show missing-config message
- Otherwise, show `<InstallBanner />`, optional `<YtdEstimateBanner />`, `<NextPaymentCard />`, `<AnnualPieChart />`
- Missing-config case has a link to onboarding with black button

**Pattern to apply:**
- Keep conditional logic as-is
- Restyle all containers, text, buttons to use CSS variables
- Add error state handler at page level for any fetch failures (wrap promises, catch and render error message with retry)
- Restyle buttons: accent background for primary CTAs, neutral border for secondary

**Key changes:**
```typescript
const MISSING_COPY: Record<"salary" | "schedule", { title: string; body: string }> = {
  // Keep as-is
};

// Wrap Promise.all with error handling
const [result, annualResult] = await Promise.all([
  forecastNextPayment(userId),
  computeAnnualSummary(userId, currentYear),
]).catch(async () => {
  // Error state: render generic error message + retry link
  return [
    { configured: false, missing: "salary" as const },
    { configured: false },
  ];
});

if (!result.configured) {
  const copy = MISSING_COPY[result.missing];
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <InstallBanner />
      <h1 className="text-[length:var(--font-size-display)] font-[number:var(--font-weight-display)] text-[color:var(--color-text-primary)]">
        {copy.title}
      </h1>
      <p className="max-w-sm text-[color:var(--color-text-secondary)]">{copy.body}</p>
      <Link
        href="/onboarding"
        className="mt-2 rounded-[8px] bg-[color:var(--color-accent)] px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
      >
        Перейти к настройке
      </Link>
    </div>
  );
}

return (
  <div className="flex flex-1 flex-col items-center gap-4 px-6 py-16">
    <InstallBanner />
    {result.forecast.baselineIsEstimated ? <YtdEstimateBanner /> : null}
    <NextPaymentCard forecast={result.forecast} />
    {annualResult.configured ? (
      <AnnualPieChart summary={annualResult.summary} taxYear={currentYear} />
    ) : (
      <div className="w-full max-w-sm rounded-[12px] border border-[color:var(--color-tertiary-surface)] bg-[color:var(--color-secondary)] p-4 text-center">
        <h2 className="text-[length:var(--font-size-heading)] font-[number:var(--font-weight-heading)] text-[color:var(--color-text-primary)]">
          Сводка недоступна
        </h2>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
          Заполните оклад и график выплат, чтобы увидеть годовую сводку.
        </p>
        <Link
          href="/settings/salary"
          className="mt-3 inline-block rounded-[8px] bg-[color:var(--color-accent)] px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
        >
          Настроить оклад
        </Link>
      </div>
    )}
  </div>
);
```

---

### Bonus/Vacation List Pages with Loading Skeletons

**Bonuses page:** `src/app/(app)/bonuses/page.tsx`
**Vacations page:** `src/app/(app)/vacations/page.tsx`

**Analog:** Current files (lines 6-31 for bonuses, lines 12-77 for vacations)

**Current pattern:**
- Server component, fetches data, renders empty state or list of rows
- No loading skeleton or error state

**Pattern to apply (UI-01, 08-UI-SPEC.md § Loading Skeletons, Empty States, Error States):**
- Keep server-side data fetch as-is
- Add Suspense boundary around the list with `<SkeletonLoader />` fallback
- Empty state: "Пока нет {объект}" heading + body copy + primary CTA
- Error state: generic Russian message with retry, never raw exception text
- Skeleton loading component must match the final layout's shape exactly (row count, card dimensions, never a spinner)

**Bonuses page revised structure:**
```typescript
import { Suspense } from 'react';
import { BonusForm } from "./bonus-form";
import { BonusRow } from "./bonus-row";
import { SkeletonLoader } from "@/components/skeleton-loader";
import { listBonuses } from "@/lib/db/bonus-repository";
import { requireUserId } from "@/lib/session";

async function BonusListContent() {
  const userId = await requireUserId();
  const rows = await listBonuses(userId);
  
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[length:var(--font-size-heading)] font-[number:var(--font-weight-heading)] text-[color:var(--color-text-primary)]">
        История бонусов
      </h2>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[12px] border border-[color:var(--color-tertiary-surface)] bg-[color:var(--color-secondary)] p-6 text-center">
          <h3 className="font-semibold text-[color:var(--color-text-primary)]">Пока нет бонусов</h3>
          <p className="text-sm text-[color:var(--color-text-secondary)]">
            Добавьте разовый бонус или компенсацию, привязав его к дате выплаты. Сумма будет включена в расчёт налога.
          </p>
          <a 
            href="#bonus-form" 
            className="rounded-[8px] bg-[color:var(--color-accent)] px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
          >
            Добавить бонус
          </a>
        </div>
      ) : (
        <div>
          <div className="hidden grid-cols-[6rem_7rem_minmax(0,1fr)_auto] gap-3 border-b border-[color:var(--color-tertiary-surface)] pb-2 text-xs font-medium text-[color:var(--color-text-secondary)] sm:grid">
            <span>Дата</span><span>Сумма</span><span>Заметка</span><span>Действия</span>
          </div>
          <ul>{rows.map((row) => <BonusRow key={row.id} bonus={row} />)}</ul>
        </div>
      )}
    </section>
  );
}

export default async function BonusesPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-12">
      <h1 className="text-[length:var(--font-size-display)] font-[number:var(--font-weight-display)] text-[color:var(--color-text-primary)]">
        Бонусы и разовые выплаты
      </h1>
      <div id="bonus-form"><BonusForm /></div>
      <Suspense fallback={<SkeletonLoader count={3} variant="bonus-row" />}>
        <BonusListContent />
      </Suspense>
    </div>
  );
}
```

---

### Skeleton Loading Component (`src/components/skeleton-loader.tsx`)

**Analog:** None (new component type)

**Pattern to establish (08-UI-SPEC.md § Loading Skeletons):**
- Match the final layout's shape exactly (row count, card dimensions)
- Tertiary-surface fill color (`bg-[color:var(--color-tertiary-surface)]`)
- Subtle ~1s opacity pulse animation looping
- `prefers-reduced-motion: reduce` disables the pulse (static fill instead)
- Never a generic spinner
- Never a layout shift when real content replaces it

**Implementation pattern:**
```typescript
"use client";

import { useEffect, useState } from "react";

interface SkeletonLoaderProps {
  count: number;
  variant: "bonus-row" | "vacation-row" | "payment-card" | "chart";
}

export function SkeletonLoader({ count, variant }: SkeletonLoaderProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // avoid hydration mismatch with animation state
  }

  const skeletons = Array.from({ length: count }).map((_, i) => (
    <div
      key={i}
      className={`animate-pulse rounded-[12px] bg-[color:var(--color-tertiary-surface)]`}
      style={{
        animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      }}
    >
      {variant === "bonus-row" && (
        <div className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-2 p-3 sm:grid-cols-[6rem_7rem_minmax(0,1fr)_auto] sm:items-center">
          <div className="h-5 w-12 rounded" />
          <div className="h-5 w-20 rounded" />
          <div className="col-span-2 h-4 w-40 rounded sm:col-span-1" />
          <div className="col-span-2 h-4 w-32 rounded sm:col-span-1" />
        </div>
      )}
      {variant === "vacation-row" && (
        <div className="grid grid-cols-[6rem_6rem_4rem_7rem_auto] gap-3 p-3 items-center">
          <div className="h-5 w-12 rounded" />
          <div className="h-5 w-12 rounded" />
          <div className="h-5 w-8 rounded" />
          <div className="h-5 w-20 rounded" />
          <div className="h-4 w-24 rounded" />
        </div>
      )}
      {variant === "payment-card" && (
        <div className="flex flex-col gap-4 p-6">
          <div className="h-4 w-40 rounded" />
          <div className="h-4 w-48 rounded" />
          <div className="h-10 w-32 rounded" />
        </div>
      )}
      {variant === "chart" && (
        <div className="flex flex-col gap-4 p-4">
          <div className="h-4 w-32 rounded" />
          <div className="mx-auto h-40 w-40 rounded-full" />
        </div>
      )}
    </div>
  ));

  return (
    <div className="flex flex-col gap-2">
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .animate-pulse {
            animation: none;
            opacity: 0.5;
          }
        }
      `}</style>
      {skeletons}
    </div>
  );
}
```

---

### Auth Pages (`src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx`)

**Analog:** `src/app/(auth)/login/page.tsx` (lines 20-107)

**Current pattern** (lines 52-107):
- Form with email/password inputs, form-level error, submit button
- Inline blue info banner for standalone mode
- Links to register/login

**Pattern to apply:**
- Replace zinc utilities with CSS variables
- Apply form-field pattern to all inputs (label, border, focus outline)
- Form-level error message uses destructive color
- Submit button uses accent background
- Info banner uses secondary-surface background with accent text or text-secondary

**Revised login form pattern:**
```typescript
<main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-16">
  <h1 className="text-[length:var(--font-size-display)] font-[number:var(--font-weight-display)] text-[color:var(--color-text-primary)]">
    Вход
  </h1>
  {isStandalone && (
    <div className="rounded-[8px] bg-[color:var(--color-secondary)] p-3 text-sm text-[color:var(--color-text-primary)] border border-[color:var(--color-tertiary-surface)]">
      <p>Похоже, это первый запуск с домашнего экрана — войдите ещё раз.</p>
      <p className="mt-1">
        Это нормально: приложение использует отдельное хранилище от браузера.
      </p>
    </div>
  )}
  <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
    <div className="flex flex-col gap-[var(--spacing-sm)]">
      <label htmlFor="email" className="text-[length:var(--font-size-label)] font-[number:var(--font-weight-label)] text-[color:var(--color-text-primary)]">
        Email
      </label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        className="rounded-[8px] border border-[color:var(--color-tertiary-surface)] bg-[color:var(--color-dominant)] px-3 py-2 text-[color:var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
        {...register("email")}
      />
      {errors.email && <p className="text-sm text-[color:var(--color-destructive)]">{errors.email.message}</p>}
    </div>
    <div className="flex flex-col gap-[var(--spacing-sm)]">
      <label htmlFor="password" className="text-[length:var(--font-size-label)] font-[number:var(--font-weight-label)] text-[color:var(--color-text-primary)]">
        Пароль
      </label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        className="rounded-[8px] border border-[color:var(--color-tertiary-surface)] bg-[color:var(--color-dominant)] px-3 py-2 text-[color:var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
        {...register("password")}
      />
      {errors.password && <p className="text-sm text-[color:var(--color-destructive)]">{errors.password.message}</p>}
    </div>
    {formError && <p className="text-sm text-[color:var(--color-destructive)]">{formError}</p>}
    <button
      type="submit"
      disabled={isSubmitting}
      className="rounded-[8px] bg-[color:var(--color-accent)] px-4 py-2 text-white font-semibold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
    >
      {isSubmitting ? "Входим…" : "Войти"}
    </button>
  </form>
  <p className="text-sm text-[color:var(--color-text-secondary)]">
    Нет аккаунта?{" "}
    <Link 
      href="/register" 
      className="text-[color:var(--color-accent)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
    >
      Зарегистрироваться
    </Link>
  </p>
</main>
```

---

### Annual Pie Chart (`src/components/annual-pie-chart.tsx`)

**Analog:** Current file (lines 33-81)

**Current pattern** (lines 33-81):
- Section container with border/padding
- Heading + metadata
- Recharts PieChart component
- Breakdown table with gross/tax/net

**Pattern to apply:**
- Secondary-surface background
- Tertiary-surface border
- 12px corner radius
- Text colors use CSS variables
- All money amounts use `tabular-nums`
- Tax/Net colors stay as-is (red-600, green-600 — hardcoded for chart compatibility)

**Revised pattern:**
```typescript
return (
  <section className="w-full max-w-sm rounded-[12px] border border-[color:var(--color-tertiary-surface)] bg-[color:var(--color-secondary)] p-4">
    <h2 className="text-[length:var(--font-size-heading)] font-[number:var(--font-weight-heading)] text-[color:var(--color-text-primary)]">
      Годовая сводка
    </h2>
    <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
      Доход и налоги в {taxYear} году
    </p>

    {baselineIsEstimated ? (
      <p className="mt-1 text-xs text-[color:var(--color-text-secondary)]">
        Примечание: начальное значение дохода — это ваша оценка.
      </p>
    ) : null}

    <div className="mt-4 flex justify-center">
      <PieChart width={200} height={200}>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
          <Cell key="tax" fill={TAX_COLOR} />
          <Cell key="net" fill={NET_COLOR} />
        </Pie>
      </PieChart>
    </div>

    <p className="mt-4 text-lg font-semibold text-[color:var(--color-text-primary)]">
      <span className="tabular-nums">{formatKopecks(grossKopecks)}</span> <span className="text-sm font-normal text-[color:var(--color-text-secondary)]">Грязными</span>
    </p>

    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-[color:var(--color-text-secondary)]">
      <dt>Грязными</dt>
      <dd className="text-right tabular-nums">
        {formatKopecks(grossKopecks)} · {formatPercent(grossKopecks, grossKopecks)}
      </dd>
      <dt>Налог</dt>
      <dd className="text-right tabular-nums">
        {formatKopecks(taxKopecks)} · {formatPercent(taxKopecks, grossKopecks)}
      </dd>
      <dt>На руки</dt>
      <dd className="text-right tabular-nums">
        {formatKopecks(netKopecks)} · {formatPercent(netKopecks, grossKopecks)}
      </dd>
    </dl>
  </section>
);
```

---

### Manifest & PWA Metadata (`src/app/manifest.ts`)

**Analog:** Current file

**Status:** Review for consistency with the visual redesign:
- `name`, `short_name`: unchanged
- `background_color`: should match `--color-dominant` dark value (`#1a1a1a`) or light value (`#ffffff`) — consider system preference
- `theme_color`: update to match `--color-secondary` if appropriate
- `display`: `"standalone"` — unchanged
- Icons: verify high-contrast against new dark-first color palette

---

## Shared Patterns

### Color Token Injection via CSS Custom Properties

**Apply to:** All files that render styled elements

**Pattern:** Replace Tailwind utility class chains with `[color:var(--color-*)]` and `[length:var(--spacing-*)]` inline `style` or `className` attribute chains.

**Example transformation:**
```typescript
// Before (zinc utilities)
className="text-sm text-zinc-600 bg-white border border-zinc-300 p-4"

// After (CSS variables)
className="text-[length:var(--font-size-body)] text-[color:var(--color-text-secondary)] bg-[color:var(--color-dominant)] border border-[color:var(--color-tertiary-surface)] p-[var(--spacing-md)]"
```

### Tabular Numerals for Money & Dates

**Apply to:** Every instance of `formatKopecks()` and `formatIsoDateRu()`, and any numeric/date text

**Pattern:** Add `tabular-nums` class (defined in `globals.css`) to the element wrapping the formatted output

**Example:**
```typescript
<span className="tabular-nums">{formatKopecks(bonus.amountKopecks)}</span>
```

### Focus-Visible Outline Pattern

**Apply to:** All interactive elements (buttons, links, form inputs)

**Pattern:** Add to className:
```
focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]
```

(Accent color for primary actions/links, destructive color for delete actions)

### Safe-Area Inset Handling

**Apply to:** Persistent navigation header and main content wrapper in `src/app/(app)/layout.tsx`

**Pattern:**
- Header: `pt-[env(safe-area-inset-top)]`
- Main content: `pb-[env(safe-area-inset-bottom)]`
- Nowhere else applies safe-area padding (single source of truth)

### Error/Empty/Loading State Copy

**Apply to:** All screens that fetch data or accept user input

**Error copy:** "Не удалось загрузить {data}. Проверьте соединение и попробуйте ещё раз." or "Не удалось сохранить {object}. Попробуйте ещё раз."

**Empty copy:** "Пока нет {объект}" (heading) + body copy pointing to primary CTA

**Loading:** Skeleton component matching final layout shape, never a spinner

### Form Submission Loading State

**Apply to:** All forms (`pay-setup-forms.tsx`, `bonus-form.tsx`, `vacation-form.tsx`, auth forms)

**Pattern:** Keep existing `isSubmitting` state → disabled button + label swap pattern. Example: "Сохраняем…" instead of "Сохранить"

---

## No Analog Found

No files in this phase have zero pattern analogs. All files either are being restyled (analog = current state) or follow an established pattern from similar components in the codebase.

The only new component type is `skeleton-loader.tsx`, which has no existing analog but follows a clear structural pattern defined in 08-UI-SPEC.md § Loading Skeletons.

---

## Metadata

**Analog search scope:** `src/app/`, `src/components/`, `src/lib/`
**Files scanned:** 17 primary files + 5 supporting files
**Pattern extraction date:** 2026-09-02
**Key insight:** Phase 8 is a restyling phase where nearly every existing UI file is modified in place. The closest analog for each file is almost always the file itself in its current state, with CSS variables and design tokens substituted for raw Tailwind utilities and hardcoded colors. The only net-new component is `skeleton-loader.tsx`.
