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
      className="w-full max-w-sm rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <p>
        Прогноз пока считается так, будто с 1 января доход был нулевым — вы ещё не указали
        сумму дохода с начала года.
      </p>
      <p className="mt-1">
        <Link href="/settings/salary" className="font-medium underline">
          Указать доход с начала года
        </Link>
      </p>
    </div>
  );
}
