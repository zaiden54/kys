import { requireUserId } from "@/lib/session";
import {
  getActiveSalaryAt,
  getSchedule,
  getYtdBaseline,
  listSalaryHistory,
} from "@/lib/db/salary-repository";
import { formatKopecks, kopecksToRubles } from "@/domain/money";
import { todayIsoInMoscow } from "@/domain/time";
import { SalaryForm, ScheduleForm, YtdForm } from "@/components/pay-setup-forms";

// Post-signup editing surface (D-10): available unconditionally, at any
// time, for salary, schedule, and the year-to-date baseline. Also renders
// the dated salary history list required by SAL-02.
export default async function SalarySettingsPage() {
  const userId = await requireUserId();
  const today = todayIsoInMoscow();

  const [activeSalary, schedule, ytdBaseline, history] = await Promise.all([
    getActiveSalaryAt(userId, today),
    getSchedule(userId),
    getYtdBaseline(userId),
    listSalaryHistory(userId),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-12">
      <h1 className="text-[length:var(--font-size-display)] font-[number:var(--font-weight-display)] text-[color:var(--color-text-primary)]">
        Оклад и график выплат
      </h1>

      <SalaryForm
        defaultGrossRubles={
          activeSalary ? kopecksToRubles(activeSalary.grossAmountKopecks) : undefined
        }
        defaultEffectiveFrom={activeSalary?.effectiveFrom}
      />

      <ScheduleForm defaultAvansDay={schedule?.avansDay} defaultSalaryDay={schedule?.salaryDay} />

      <YtdForm
        defaultAmountRubles={kopecksToRubles(ytdBaseline.amountKopecks)}
        defaultAsOfDate={ytdBaseline.asOfDate}
        isEstimated={ytdBaseline.isEstimated}
      />

      <section className="flex flex-col gap-2">
        <h2 className="text-[length:var(--font-size-heading)] font-[number:var(--font-weight-heading)] text-[color:var(--color-text-primary)]">
          История окладов
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-[color:var(--color-text-secondary)]">
            Пока нет сохранённых значений оклада.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {history.map((row) => (
              <li
                key={row.id}
                className="flex justify-between border-b border-[color:var(--color-tertiary-surface)] py-1"
              >
                <span className="tabular-nums">{row.effectiveFrom}</span>
                <span className="tabular-nums">{formatKopecks(row.grossAmountKopecks)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
