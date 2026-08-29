import { BonusForm } from "./bonus-form";
import { formatKopecks } from "@/domain/money";
import { listBonuses } from "@/lib/db/bonus-repository";
import { requireUserId } from "@/lib/session";

export default async function BonusesPage() {
  const userId = await requireUserId();
  const rows = await listBonuses(userId);
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-12">
      <h1 className="text-2xl font-semibold">Бонусы и разовые выплаты</h1>
      <BonusForm />
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">История бонусов</h2>
        {rows.length === 0 ? <p className="text-sm text-zinc-600">Бонусы не добавлены</p> : (
          <ul className="flex flex-col gap-1 text-sm">
            {rows.map((row) => (
              <li key={row.id} className="flex justify-between gap-4 border-b border-zinc-100 py-1">
                <span>{row.date}{row.note ? ` · ${row.note}` : ""}</span>
                <span className="shrink-0">{formatKopecks(row.amountKopecks)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
