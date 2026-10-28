/**
 * The current calendar year at a glance (HOME-02): a stacked bar splitting
 * the year's gross into what has already been accrued (including income
 * entered as the year-to-date baseline), what is still ahead on hand, and
 * the НДФЛ still to be withheld, followed by the whole-year totals.
 *
 * Server component — plain markup, no chart library.
 */

import Link from "next/link";
import { formatKopecks } from "@/domain/money";
import { formatIsoDayMonthRu } from "@/domain/time";
import type { AnnualSummary } from "@/app/actions/annual-summary";

function share(part: number, whole: number): string {
  return whole > 0 ? `${(part / whole) * 100}%` : "0%";
}

function LegendItem({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[13px] text-[color:var(--color-text-secondary)]">
        <span aria-hidden="true" className="inline-block size-2 flex-none rounded-full" style={{ background: color }} />
        {label}
      </p>
      <p className="mt-0.5 font-bold tabular-nums">{formatKopecks(value)}</p>
    </div>
  );
}

export function AnnualSummaryCard({ summary, taxYear }: { summary: AnnualSummary; taxYear: number }) {
  const { grossKopecks, taxKopecks, netKopecks, earnedGrossKopecks, upcomingNetKopecks, upcomingTaxKopecks } =
    summary;

  return (
    <section className="surface-card w-full p-4" aria-labelledby="annual-summary-heading">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="annual-summary-heading" className="text-base font-bold">
          Годовая сводка
        </h2>
        <span className="text-[13px] text-[color:var(--color-text-secondary)]">{taxYear} год</span>
      </div>

      {grossKopecks === 0 ? (
        <div className="mt-3 flex flex-col items-start gap-2">
          <p className="font-semibold">Пока нет дохода в {taxYear} году</p>
          <p className="text-sm text-[color:var(--color-text-secondary)]">
            Сводка появится, как только будет учтена первая выплата в этом году — аванс, зарплата, бонус или отпускные.
          </p>
          <Link
            href="/profile#pay"
            className="mt-1 rounded-full bg-[color:var(--color-accent-button)] px-4 py-2 text-sm font-semibold text-white"
          >
            Настроить оклад
          </Link>
        </div>
      ) : (
        <>
          <div
            className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-[color:var(--color-chip)]"
            role="img"
            aria-label="Доля начисленного, будущего дохода на руки и будущего НДФЛ за год"
          >
            <div style={{ width: share(earnedGrossKopecks, grossKopecks), background: "var(--color-muted-fill)" }} />
            <div style={{ width: share(upcomingNetKopecks, grossKopecks), background: "var(--color-accent)" }} />
            <div style={{ width: share(upcomingTaxKopecks, grossKopecks), background: "var(--color-destructive)" }} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
            <LegendItem color="var(--color-muted-fill)" label="Начислено по сегодня" value={earnedGrossKopecks} />
            <LegendItem color="var(--color-accent)" label="Ещё придёт на руки" value={upcomingNetKopecks} />
            <LegendItem color="var(--color-destructive)" label="НДФЛ с будущих выплат" value={upcomingTaxKopecks} />
          </div>

          {summary.baselineAsOfDate && !summary.baselineIsEstimated ? (
            <p className="mt-3 text-[13px] text-[color:var(--color-text-secondary)]">
              «Начислено» включает доход до {formatIsoDayMonthRu(summary.baselineAsOfDate)}, указанный при настройке.
            </p>
          ) : (
            <p className="mt-3 text-[13px] text-[color:var(--color-text-secondary)]">
              Доход с начала года не указан — налог может быть посчитан неточно.{" "}
              <Link href="/profile#pay" className="font-semibold text-[color:var(--color-accent)]">
                Указать
              </Link>
            </p>
          )}

          <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-[color:var(--color-tertiary-surface)] pt-3 text-sm">
            <div>
              <dt className="text-[13px] text-[color:var(--color-text-secondary)]">Грязными</dt>
              <dd className="font-bold tabular-nums">{formatKopecks(grossKopecks)}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-[color:var(--color-text-secondary)]">Налог</dt>
              <dd className="font-bold tabular-nums">{formatKopecks(taxKopecks)}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-[color:var(--color-text-secondary)]">На руки</dt>
              <dd className="font-bold tabular-nums">{formatKopecks(netKopecks)}</dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );
}
