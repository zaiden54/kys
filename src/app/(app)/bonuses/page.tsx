import { Suspense } from "react";
import { BonusForm } from "./bonus-form";
import { BonusRow } from "./bonus-row";
import { listBonuses } from "@/lib/db/bonus-repository";
import { requireUserId } from "@/lib/session";
import { SkeletonLoader } from "@/components/skeleton-loader";

async function BonusListContent() {
  const userId = await requireUserId();
  const rows = await listBonuses(userId);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[length:var(--font-size-heading)] font-[number:var(--font-weight-heading)] text-[color:var(--color-text-primary)]">История бонусов</h2>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[12px] border border-[color:var(--color-tertiary-surface)] bg-[color:var(--color-secondary)] p-6 text-center">
          <h3 className="font-semibold text-[color:var(--color-text-primary)]">Пока нет бонусов</h3>
          <p className="text-sm text-[color:var(--color-text-secondary)]">Добавьте разовый бонус или компенсацию, привязав его к дате выплаты. Сумма будет включена в расчёт налога.</p>
          <a
            href="#bonus-form"
            className="rounded-[8px] bg-[color:var(--color-accent)] px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
          >
            Добавить бонус
          </a>
        </div>
      ) : (
        <div>
          <div className="hidden grid-cols-[6rem_7rem_minmax(0,1fr)_auto] gap-3 border-b border-[color:var(--color-tertiary-surface)] pb-2 text-xs font-medium text-[color:var(--color-text-secondary)] sm:grid">
            <span>Дата</span><span>Сумма</span><span>Заметка</span><span>Действия</span>
          </div>
          <ul>{rows.map((row) => <BonusRow key={row.id} bonus={row} />)}</ul>
        </div>
      )}
    </section>
  );
}

export default function BonusesPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-12">
      <h1 className="text-[length:var(--font-size-display)] font-[number:var(--font-weight-display)] text-[color:var(--color-text-primary)]">Бонусы и разовые выплаты</h1>
      <div id="bonus-form"><BonusForm /></div>
      <Suspense fallback={<SkeletonLoader count={3} variant="bonus-row" />}>
        <BonusListContent />
      </Suspense>
    </div>
  );
}
