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
import type { NextPaymentForecast } from "@/app/actions/forecast";

const KIND_LABELS: Record<NextPaymentForecast["kind"], string> = {
  avans: "Аванс",
  salary: "Зарплата",
  bonus: "Бонус или компенсация",
  vacation: "Отпускные",
};

function formatPaymentDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function NextPaymentCard({ forecast }: { forecast: NextPaymentForecast }) {
  return (
    <section className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
        Прогноз, а не подтверждённая работодателем сумма
      </p>
      <p className="mt-1 text-sm text-zinc-600">
        {KIND_LABELS[forecast.kind]} · {formatPaymentDate(forecast.date)}
      </p>

      <p className="mt-4 text-3xl font-semibold text-zinc-900">
        {formatKopecks(forecast.netKopecks)}
      </p>
      <p className="mt-1 text-sm text-zinc-500">придёт на руки</p>

      {forecast.kind === "vacation" ? (
        <div className="mt-6 flex flex-col gap-1 text-sm text-zinc-600">
          <div className="flex justify-between">
            <span>Отпускные</span>
            <span>{formatKopecks(forecast.grossKopecks)}</span>
          </div>
          <p className="text-xs text-zinc-500">
            Расчёт не учитывает исключаемые периоды (больничный, прошлый отпуск и т.п.)
          </p>
          <div className="flex justify-between">
            <span>Удержан НДФЛ</span>
            <span>{formatKopecks(forecast.taxKopecks)}</span>
          </div>
        </div>
      ) : forecast.breakdown ? (
        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-zinc-600">
          <dt className="col-span-2 font-medium">Состав выплаты:</dt>
          <dt>Оклад / Аванс</dt>
          <dd className="text-right">{formatKopecks(forecast.breakdown.salaryOrAvansKopecks)}</dd>
          <dt>Бонус</dt>
          <dd className="text-right">{formatKopecks(forecast.breakdown.bonusKopecks)}</dd>
          <dt className="font-semibold text-zinc-900">Итого (грязными)</dt>
          <dd className="text-right font-semibold text-zinc-900">{formatKopecks(forecast.grossKopecks)}</dd>
          <dt>Удержан НДФЛ</dt>
          <dd className="text-right">{formatKopecks(forecast.taxKopecks)}</dd>
        </dl>
      ) : (
        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-zinc-600">
          <dt>Начислено (грязными)</dt>
          <dd className="text-right">{formatKopecks(forecast.grossKopecks)}</dd>
          <dt>Удержан НДФЛ</dt>
          <dd className="text-right">{formatKopecks(forecast.taxKopecks)}</dd>
        </dl>
      )}

      <p className="mt-4 text-xs text-zinc-400">
        Это плановый расчёт для планирования бюджета — не официальная и не гарантированная сумма.
      </p>
    </section>
  );
}
