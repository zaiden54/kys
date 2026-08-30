import { VacationForm } from "./vacation-form";
import { VacationRow } from "./vacation-row";
import { listVacations } from "@/lib/db/vacation-repository";
import { listSalaryHistory } from "@/lib/db/salary-repository";
import { listBonuses } from "@/lib/db/bonus-repository";
import { calculateVacationPayGross } from "@/domain/vacation/calculate-average-daily-earnings";
import { requireUserId } from "@/lib/session";

export default async function VacationsPage() {
  const userId = await requireUserId();
  const [vacations, salaryHistory, bonuses] = await Promise.all([
    listVacations(userId),
    listSalaryHistory(userId),
    listBonuses(userId),
  ]);

  const salaryHistoryEntries = salaryHistory.map((row) => ({
    effectiveFrom: row.effectiveFrom,
    grossAmountKopecks: row.grossAmountKopecks,
  }));
  // Defensive premium filter (D-V03), matching the identical filter already
  // established in getCumulativeIncomeBeforeDate and forecastNextPayment.
  const premiumBonusEntries = bonuses
    .filter((bonus) => bonus.type !== "compensation")
    .map((bonus) => ({ date: bonus.date, amountKopecks: bonus.amountKopecks }));

  const rows = vacations.map((vacation) => ({
    vacation,
    grossKopecks: calculateVacationPayGross(
      vacation.startDate,
      vacation.endDate,
      salaryHistoryEntries,
      premiumBonusEntries,
    ).grossKopecks,
  }));

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-12">
      <h1 className="text-2xl font-semibold">Отпуска</h1>
      <div id="vacation-form"><VacationForm /></div>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">История отпусков</h2>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 p-6 text-center">
            <h3 className="font-semibold">Нет отпусков</h3>
            <p className="text-sm text-zinc-600">
              Добавьте отпуск и система автоматически рассчитает сумму выплаты по формуле среднего
              дневного заработка.
            </p>
            <a href="#vacation-form" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
              Добавить отпуск
            </a>
          </div>
        ) : (
          <div>
            <div className="hidden grid-cols-[6rem_6rem_4rem_7rem_auto] gap-3 border-b border-zinc-200 pb-2 text-xs font-medium text-zinc-500 sm:grid">
              <span>Дата начала</span><span>Дата окончания</span><span>Дни</span><span>Отпускные</span><span>Действия</span>
            </div>
            <ul>
              {rows.map(({ vacation, grossKopecks }) => (
                <VacationRow key={vacation.id} vacation={vacation} grossKopecks={grossKopecks} />
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
