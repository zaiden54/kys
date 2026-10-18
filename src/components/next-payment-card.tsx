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

const KIND_LABELS: Record<NextPaymentForecast["kind"], string> = {
  avans: "Аванс",
  salary: "Зарплата",
  bonus: "Бонус или компенсация",
  vacation: "Отпускные",
};

export function NextPaymentCard({ forecast }: { forecast: NextPaymentForecast }) {
  return (
    <section className="next-payment-card w-full max-w-sm min-[1100px]:max-w-none rounded-[12px] border border-[color:var(--color-tertiary-surface)] bg-[color:var(--color-secondary)] p-6">
      <p className="text-xs font-medium tracking-wide text-[color:var(--color-text-secondary)] uppercase">
        Прогноз, а не подтверждённая работодателем сумма
      </p>
      <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
        {KIND_LABELS[forecast.kind]} ·{" "}
        <span className="font-[family-name:var(--font-family-caption)] text-[length:var(--font-size-caption)] tabular-nums">
          {formatIsoDateRu(forecast.date)}
        </span>
      </p>

      <p className="mt-4 font-[family-name:var(--font-family-display)] text-[42px] font-[number:var(--font-weight-display)] leading-[var(--line-height-display)] text-[color:var(--color-accent)] tabular-nums">
        {formatKopecks(forecast.netKopecks)}
      </p>
      <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">придёт на руки</p>

      {forecast.kind === "vacation" ? (
        <div className="mt-10 flex flex-col gap-1 text-sm text-[color:var(--color-text-secondary)]">
          <div className="flex justify-between">
            <span>Отпускные</span>
            <span className="tabular-nums">{formatKopecks(forecast.grossKopecks)}</span>
          </div>
          <p className="font-[family-name:var(--font-family-caption)] text-[length:var(--font-size-caption)] text-[color:var(--color-text-secondary)]">
            Расчёт не учитывает исключаемые периоды (больничный, прошлый отпуск и т.п.)
          </p>
          <div className="flex justify-between">
            <span>Удержан НДФЛ</span>
            <span className="tabular-nums">{formatKopecks(forecast.taxKopecks)}</span>
          </div>
        </div>
      ) : forecast.breakdown ? (
        <dl className="mt-10 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-[color:var(--color-text-secondary)]">
          <dt className="col-span-2 font-medium">Состав выплаты:</dt>
          <dt>Оклад / Аванс</dt>
          <dd className="text-right tabular-nums">{formatKopecks(forecast.breakdown.salaryOrAvansKopecks)}</dd>
          <dt>Бонус</dt>
          <dd className="text-right tabular-nums">{formatKopecks(forecast.breakdown.bonusKopecks)}</dd>
          <dt className="font-semibold text-[color:var(--color-text-primary)]">Итого (грязными)</dt>
          <dd className="text-right font-semibold tabular-nums text-[color:var(--color-text-primary)]">
            {formatKopecks(forecast.grossKopecks)}
          </dd>
          <dt>Удержан НДФЛ</dt>
          <dd className="text-right tabular-nums">{formatKopecks(forecast.taxKopecks)}</dd>
        </dl>
      ) : (
        <dl className="mt-10 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-[color:var(--color-text-secondary)]">
          <dt>Начислено (грязными)</dt>
          <dd className="text-right tabular-nums">{formatKopecks(forecast.grossKopecks)}</dd>
          <dt>Удержан НДФЛ</dt>
          <dd className="text-right tabular-nums">{formatKopecks(forecast.taxKopecks)}</dd>
        </dl>
      )}

      <p className="mt-4 text-xs text-[color:var(--color-text-secondary)]">
        Это плановый расчёт для планирования бюджета — не официальная и не гарантированная сумма.
      </p>
    </section>
  );
}
