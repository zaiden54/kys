import { VacationForm } from "./vacation-form";
import { listVacations } from "@/lib/db/vacation-repository";
import { calculateVacationDays } from "@/domain/vacation/calculate-average-daily-earnings";
import { requireUserId } from "@/lib/session";

export default async function VacationsPage() {
  const userId = await requireUserId();
  const rows = await listVacations(userId);
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-12">
      <h1 className="text-2xl font-semibold">Отпуска</h1>
      <div id="vacation-form"><VacationForm /></div>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">История отпусков</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-600">Отпуска не добавлены</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li key={row.id} className="border-b border-zinc-200 py-2 text-sm">
                {row.startDate} — {row.endDate} ({calculateVacationDays(row.startDate, row.endDate)} дн.)
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
