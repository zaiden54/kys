import { Suspense } from "react";
import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { forecastNextPayment, type NextPaymentForecast } from "@/app/actions/forecast";
import { computeAnnualSummary, type AnnualSummary } from "@/app/actions/annual-summary";
import { NextPaymentCard } from "@/components/next-payment-card";
import { AnnualPieChart } from "@/components/annual-pie-chart";
import { YtdEstimateBanner } from "@/components/ytd-estimate-banner";
import { InstallBanner } from "@/components/install-banner";
import { SkeletonLoader } from "@/components/skeleton-loader";
import { todayIsoInMoscow } from "@/domain/time";

// HOME-01: shows only the next payment's date and take-home amount. The
// forecast is computed server-side (see src/app/actions/forecast.ts) during
// this render — no forecast input or tax figure is ever passed to a client
// component for recomputation. Per D-15, this screen deliberately carries
// no forward-looking salary-change notice; a future-dated salary change
// simply has no effect until a payment actually falls on/after its
// effective date.
const MISSING_COPY: Record<"salary" | "schedule", { title: string; body: string }> = {
  salary: {
    title: "Оклад ещё не указан",
    body: "Чтобы увидеть сумму и дату ближайшей выплаты, укажите оклад «грязными».",
  },
  schedule: {
    title: "График выплат ещё не настроен",
    body: "Чтобы увидеть сумму и дату ближайшей выплаты, укажите дни аванса и зарплаты.",
  },
};

type ForecastResult = Awaited<ReturnType<typeof forecastNextPayment>>;
type AnnualResult = Awaited<ReturnType<typeof computeAnnualSummary>>;

// Small async components exist so the Suspense boundaries below have a real
// place to attach (08-UI-SPEC.md's loading-state coverage for
// next-payment-card / annual-summary-chart). Data is already resolved by
// the Promise.all above by the time these render — they never re-fetch —
// so in practice the fallback skeletons never have time to paint on this
// server-rendered page; the boundaries exist for structural correctness,
// not to introduce an artificial loading delay.
async function NextPaymentSection({ forecast }: { forecast: NextPaymentForecast }) {
  return <NextPaymentCard forecast={forecast} />;
}

async function AnnualSummarySection({ summary, taxYear }: { summary: AnnualSummary; taxYear: number }) {
  return <AnnualPieChart summary={summary} taxYear={taxYear} />;
}

export default async function HomePage() {
  const userId = await requireUserId();
  const currentYear = Number(todayIsoInMoscow().slice(0, 4));

  let result: ForecastResult | null = null;
  let annualResult: AnnualResult | null = null;
  let fetchFailed = false;

  try {
    [result, annualResult] = await Promise.all([
      forecastNextPayment(userId),
      computeAnnualSummary(userId, currentYear),
    ]);
  } catch {
    fetchFailed = true;
  }

  if (fetchFailed || !result || !annualResult) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <InstallBanner />
        <h1 className="text-[length:var(--font-size-display)] font-[number:var(--font-weight-display)] text-[color:var(--color-text-primary)]">
          Не удалось загрузить данные
        </h1>
        <p className="max-w-sm text-[color:var(--color-text-secondary)]">
          Не удалось загрузить данные. Проверьте соединение и попробуйте ещё раз.
        </p>
        <Link
          href="/"
          className="mt-2 rounded-[8px] bg-[color:var(--color-accent)] px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
        >
          Обновить страницу
        </Link>
      </div>
    );
  }

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
      <Suspense fallback={<SkeletonLoader count={1} variant="payment-card" />}>
        <NextPaymentSection forecast={result.forecast} />
      </Suspense>
      {annualResult.configured ? (
        <Suspense fallback={<SkeletonLoader count={1} variant="chart" />}>
          <AnnualSummarySection summary={annualResult.summary} taxYear={currentYear} />
        </Suspense>
      ) : (
        // Defensive, forward-compatible fallback: unreachable-by-construction
        // today (computeAnnualSummary's not-configured gate is byte-for-byte
        // identical to forecastNextPayment's, and the `!result.configured`
        // early return above already covers it), but kept as cheap insurance
        // per 04-01-PLAN.md's "flagged_assumptions" — never a silent `null`.
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
}
