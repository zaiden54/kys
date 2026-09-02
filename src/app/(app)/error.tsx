"use client";

/**
 * Next.js file-convention error boundary for the whole `(app)` route
 * segment (home, bonuses, vacations, settings, onboarding). A general
 * safety net catching any unexpected render-time throw — not scoped
 * narrowly to the annual chart — matching Next.js's own idiomatic
 * per-segment error-boundary convention.
 */

export default function AppError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center"
    >
      <h1 className="text-[length:var(--font-size-display)] font-[number:var(--font-weight-display)] text-[color:var(--color-text-primary)]">
        Ошибка при загрузке сводки
      </h1>
      <p className="max-w-sm text-[color:var(--color-text-secondary)]">Попробуйте ещё раз</p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-2 rounded-lg bg-[color:var(--color-accent-button)] px-4 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
      >
        Повторить
      </button>
    </div>
  );
}
