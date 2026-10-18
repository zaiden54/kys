/**
 * Persistent (never dismissible) warning that the next-payment forecast is
 * assuming zero income since 1 January because the year-to-date baseline
 * has not been entered (D-11, SAL-03).
 *
 * Server component. Deliberately has no dismiss control and stores no
 * dismissal state anywhere (no `localStorage`/`sessionStorage`) — D-11
 * requires this to stay on screen until the baseline is no longer flagged
 * estimated, not disappear after a one-time acknowledgement. The caller
 * (src/app/(app)/page.tsx) renders this only while
 * `forecast.baselineIsEstimated` is true.
 */

import Link from "next/link";

export function YtdEstimateBanner() {
  return (
    <div
      role="status"
      className="w-full max-w-sm min-[1100px]:max-w-none rounded-lg border border-[color:var(--color-tertiary-surface)] bg-[color:var(--color-secondary)] px-4 py-3 text-sm text-[color:var(--color-text-primary)]"
    >
      <p>
        Прогноз пока считается так, будто с 1 января доход был нулевым — вы ещё не указали
        сумму дохода с начала года.
      </p>
      <p className="mt-1">
        <Link
          href="/settings/salary"
          className="font-medium text-[color:var(--color-accent)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
        >
          Указать доход с начала года
        </Link>
      </p>
    </div>
  );
}
