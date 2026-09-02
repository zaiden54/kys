"use client";

/**
 * Reusable loading-skeleton placeholder (08-UI-SPEC.md § Loading Skeletons).
 * Matches the final layout's shape exactly (row count, card dimensions) —
 * never a generic spinner, never a layout shift when real content replaces
 * it. Rendered in tertiary-surface fill with the `skeleton-pulse` class
 * (globals.css: ~1s opacity pulse, disabled under
 * `prefers-reduced-motion: reduce`).
 *
 * Renders unconditionally (including during SSR/Suspense streaming) — no
 * non-deterministic value (no `Date.now()`/`Math.random()`) is used here, so
 * there is no hydration-mismatch risk to gate against. `bonuses/page.tsx` and
 * `vacations/page.tsx` wrap real async DB queries in
 * `<Suspense fallback={<SkeletonLoader .../>}>`, so the fallback must render
 * real markup on the server, not `null` (see 08-REVIEW.md WR-01).
 */

type SkeletonVariant = "bonus-row" | "vacation-row" | "payment-card" | "chart";

export function SkeletonLoader({
  count,
  variant,
}: {
  count: number;
  variant: SkeletonVariant;
}) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-live="polite">
      <span className="sr-only">Загрузка…</span>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="skeleton-pulse rounded-[12px] bg-[color:var(--color-tertiary-surface)]"
        >
          {variant === "bonus-row" && (
            <div className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-2 p-3 sm:grid-cols-[6rem_7rem_minmax(0,1fr)_auto] sm:items-center">
              <div className="h-5 w-12 rounded bg-[color:var(--color-secondary)]" />
              <div className="h-5 w-20 rounded bg-[color:var(--color-secondary)]" />
              <div className="col-span-2 h-4 w-40 rounded bg-[color:var(--color-secondary)] sm:col-span-1" />
              <div className="col-span-2 h-4 w-32 rounded bg-[color:var(--color-secondary)] sm:col-span-1" />
            </div>
          )}
          {variant === "vacation-row" && (
            <div className="grid grid-cols-[6rem_6rem_4rem_7rem_auto] items-center gap-3 p-3">
              <div className="h-5 w-12 rounded bg-[color:var(--color-secondary)]" />
              <div className="h-5 w-12 rounded bg-[color:var(--color-secondary)]" />
              <div className="h-5 w-8 rounded bg-[color:var(--color-secondary)]" />
              <div className="h-5 w-20 rounded bg-[color:var(--color-secondary)]" />
              <div className="h-4 w-24 rounded bg-[color:var(--color-secondary)]" />
            </div>
          )}
          {variant === "payment-card" && (
            <div className="flex flex-col gap-4 p-6">
              <div className="h-4 w-40 rounded bg-[color:var(--color-secondary)]" />
              <div className="h-4 w-48 rounded bg-[color:var(--color-secondary)]" />
              <div className="h-10 w-32 rounded bg-[color:var(--color-secondary)]" />
            </div>
          )}
          {variant === "chart" && (
            <div className="flex flex-col gap-4 p-4">
              <div className="h-4 w-32 rounded bg-[color:var(--color-secondary)]" />
              <div className="mx-auto h-40 w-40 rounded-full bg-[color:var(--color-secondary)]" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
