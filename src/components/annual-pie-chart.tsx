"use client";

/**
 * Renders the current calendar year's gross/tax/net breakdown as a Recharts
 * donut (HOME-02). Client component — Recharts needs the client runtime,
 * unlike the server-rendered NextPaymentCard, so this is the one place in
 * the home-screen composition that requires "use client".
 *
 * Renders EXACTLY two pie slices — Налог (tax) and На руки (net) — which
 * mathematically partition Грязными (gross) into 360°. A third "Грязными"
 * wedge would double-count the total and make displayed percentages sum to
 * 200% (04-RESEARCH.md flagged this as a bug in its own illustrative
 * example, not a spec requirement).
 */

import { Cell, Pie, PieChart } from "recharts";
import { formatKopecks } from "@/domain/money";
import Link from "next/link";
import type { AnnualSummary } from "@/app/actions/annual-summary";

const percentFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatPercent(part: number, whole: number): string {
  const percent = whole === 0 ? 0 : (part / whole) * 100;
  return `${percentFormatter.format(percent)}%`;
}

export function AnnualPieChart({ summary, taxYear }: { summary: AnnualSummary; taxYear: number }) {
  const { grossKopecks, taxKopecks, netKopecks, baselineIsEstimated } = summary;

  const data = [
    { name: "Налог", value: taxKopecks },
    { name: "На руки", value: netKopecks },
  ];

  return (
    <section className="w-full max-w-sm min-[1100px]:max-w-none rounded-[12px] border border-[color:var(--color-tertiary-surface)] bg-[color:var(--color-secondary)] p-4">
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

      {grossKopecks === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-[12px] border border-[color:var(--color-tertiary-surface)] bg-[color:var(--color-secondary)] p-6 text-center">
          <h3 className="font-semibold text-[color:var(--color-text-primary)]">
            Пока нет дохода в {taxYear} году
          </h3>
          <p className="text-sm text-[color:var(--color-text-secondary)]">
            Сводка появится, как только будет учтена первая выплата в этом году — аванс, зарплата, бонус или отпускные.
          </p>
          <Link
            href="/settings/salary"
            className="mt-2 rounded-[8px] bg-[color:var(--color-accent-button)] px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
          >
            Настроить оклад
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-4 flex justify-center">
            <PieChart width={200} height={200}>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                <Cell key="tax" fill="var(--color-destructive)" />
                <Cell key="net" fill="var(--color-accent)" />
              </Pie>
            </PieChart>
          </div>

          <p className="mt-4 text-lg font-semibold text-[color:var(--color-text-primary)]">
            <span className="tabular-nums">{formatKopecks(grossKopecks)}</span>{" "}
            <span className="text-sm font-normal text-[color:var(--color-text-secondary)]">Грязными</span>
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
        </>
      )}
    </section>
  );
}
