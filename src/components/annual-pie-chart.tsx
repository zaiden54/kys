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
import type { AnnualSummary } from "@/app/actions/annual-summary";

const TAX_COLOR = "#dc2626"; // Tailwind red-600
const NET_COLOR = "#16a34a"; // Tailwind green-600

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
    <section className="w-full max-w-sm rounded border border-zinc-300 p-4">
      <h2 className="text-lg font-semibold text-zinc-900">Годовая сводка</h2>
      <p className="mt-1 text-sm text-zinc-600">Доход и налоги в {taxYear} году</p>

      {baselineIsEstimated ? (
        <p className="mt-1 text-xs text-zinc-500">
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

      <p className="mt-4 text-lg font-semibold text-zinc-900">
        {formatKopecks(grossKopecks)} <span className="text-sm font-normal text-zinc-500">Грязными</span>
      </p>

      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-zinc-600">
        <dt>Грязными</dt>
        <dd className="text-right">
          {formatKopecks(grossKopecks)} · {formatPercent(grossKopecks, grossKopecks)}
        </dd>
        <dt>Налог</dt>
        <dd className="text-right">
          {formatKopecks(taxKopecks)} · {formatPercent(taxKopecks, grossKopecks)}
        </dd>
        <dt>На руки</dt>
        <dd className="text-right">
          {formatKopecks(netKopecks)} · {formatPercent(netKopecks, grossKopecks)}
        </dd>
      </dl>
    </section>
  );
}
