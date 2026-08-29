import { BonusForm } from "./bonus-form";
import { BonusRow } from "./bonus-row";
import { listBonuses } from "@/lib/db/bonus-repository";
import { requireUserId } from "@/lib/session";

export default async function BonusesPage() {
  const userId = await requireUserId();
  const rows = await listBonuses(userId);
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-12">
      <h1 className="text-2xl font-semibold">Бонусы и разовые выплаты</h1>
      <div id="bonus-form"><BonusForm /></div>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">История бонусов</h2>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 p-6 text-center">
            <h3 className="font-semibold">Нет бонусов</h3>
            <p className="text-sm text-zinc-600">Добавьте разовый бонус или компенсацию, привязав его к дате выплаты. Сумма будет включена в расчёт налога.</p>
            <a href="#bonus-form" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white">Добавить бонус</a>
          </div>
        ) : (
          <div>
            <div className="hidden grid-cols-[6rem_7rem_minmax(0,1fr)_auto] gap-3 border-b border-zinc-200 pb-2 text-xs font-medium text-zinc-500 sm:grid">
              <span>Дата</span><span>Сумма</span><span>Заметка</span><span>Действия</span>
            </div>
            <ul>{rows.map((row) => <BonusRow key={row.id} bonus={row} />)}</ul>
          </div>
        )}
      </section>
    </div>
  );
}
