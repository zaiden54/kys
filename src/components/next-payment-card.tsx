/**
 * The home screen's focal block: the next payment's take-home amount, large
 * and centered, with its kind and date above (HOME-01). Server component —
 * receives an already-computed `NextPaymentForecast` and renders it; it
 * performs no tax calculation of its own (T-01-02: `calculateNdfl`/
 * `taxOnCumulative` must never appear in this file).
 *
 * The wording deliberately reads as a planning forecast the app computed,
 * never as a figure the employer has confirmed or an actual payslip amount.
 */

import { formatKopecks } from "@/domain/money";
import { daysBetweenIso, formatIsoDayMonthRu, todayIsoInMoscow } from "@/domain/time";
import { pluralizeRu } from "@/lib/pluralize-ru";
import type { NextPaymentForecast } from "@/app/actions/forecast";

const KIND_LABELS: Record<NextPaymentForecast["kind"], string> = {
  avans: "Аванс",
  salary: "Зарплата",
  bonus: "Бонус или компенсация",
  vacation: "Отпускные",
};

function relativeDay(dateIso: string): string {
  const days = daysBetweenIso(todayIsoInMoscow(), dateIso);
  if (days <= 0) return "сегодня";
  if (days === 1) return "завтра";
  return `через ${days} ${pluralizeRu(days, ["день", "дня", "дней"])}`;
}

export function NextPaymentCard({ forecast }: { forecast: NextPaymentForecast }) {
  return (
    <section aria-labelledby="next-payment-amount" className="flex w-full flex-col items-center text-center">
      <p className="status-pill">
        {KIND_LABELS[forecast.kind]} · <strong className="tabular-nums">{formatIsoDayMonthRu(forecast.date)}</strong> ·{" "}
        {relativeDay(forecast.date)}
      </p>

      <p id="next-payment-amount" className="hero-amount mt-4">
        {formatKopecks(forecast.netKopecks)}
      </p>
      <p className="mt-2 text-sm text-[color:var(--color-text-secondary)]">
        придёт на руки · из <span className="tabular-nums">{formatKopecks(forecast.grossKopecks)}</span>, НДФЛ{" "}
        <span className="tabular-nums">{formatKopecks(forecast.taxKopecks)}</span>
      </p>

      {forecast.kind === "vacation" ? (
        <p className="mt-3 max-w-xs text-[length:var(--font-size-caption)] text-[color:var(--color-text-secondary)]">
          Расчёт не учитывает исключаемые периоды (больничный, прошлый отпуск и т.п.)
        </p>
      ) : forecast.breakdown ? (
        <dl className="surface-card mt-5 grid w-full grid-cols-2 gap-x-4 gap-y-2 p-4 text-left text-sm">
          <dt className="text-[color:var(--color-text-secondary)]">Оклад / Аванс</dt>
          <dd className="text-right tabular-nums">{formatKopecks(forecast.breakdown.salaryOrAvansKopecks)}</dd>
          <dt className="text-[color:var(--color-text-secondary)]">Бонус</dt>
          <dd className="text-right tabular-nums">{formatKopecks(forecast.breakdown.bonusKopecks)}</dd>
          <dt className="font-bold">Итого (грязными)</dt>
          <dd className="text-right font-bold tabular-nums">{formatKopecks(forecast.grossKopecks)}</dd>
        </dl>
      ) : null}

      <p className="mt-3 text-xs text-[color:var(--color-text-secondary)]">
        Плановый расчёт, а не сумма, подтверждённая работодателем
      </p>
    </section>
  );
}
