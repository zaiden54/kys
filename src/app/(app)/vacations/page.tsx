import { Suspense } from "react";
import { VacationForm } from "./vacation-form";
import { VacationRow } from "./vacation-row";
import { SkeletonLoader } from "@/components/skeleton-loader";
import { listVacations } from "@/lib/db/vacation-repository";
import { listSalaryHistory } from "@/lib/db/salary-repository";
import { listBonuses } from "@/lib/db/bonus-repository";
import {
  calculateVacationPayGross,
  toPremiumBonusEntries,
} from "@/domain/vacation/calculate-average-daily-earnings";
import { requireUserId } from "@/lib/session";

async function VacationListContent() {
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
  // Defensive premium filter (D-V03), shared via toPremiumBonusEntries
  // (closes WR-02, 03-REVIEW.md) rather than copy-pasted here.
  const premiumBonusEntries = toPremiumBonusEntries(bonuses);

  // Mirrors forecast.ts's "configured: false, missing: salary" guard (CR-01
  // there): a vacation resolved with zero salary-history rows must never
  // render a fabricated ₽0 payout as if it were a confirmed figure.
  const hasSalaryHistory = salaryHistoryEntries.length > 0;

  const rows = vacations.map((vacation) => ({
    vacation,
    grossKopecks: hasSalaryHistory
      ? calculateVacationPayGross(
          vacation.startDate,
          vacation.endDate,
          salaryHistoryEntries,
          premiumBonusEntries,
        ).grossKopecks
      : null, // null = "not yet computable", never a fabricated ₽0
  }));

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[length:var(--font-size-heading)] font-[number:var(--font-weight-heading)] text-[color:var(--color-text-primary)]">
        История отпусков
      </h2>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[12px] border border-[color:var(--color-tertiary-surface)] bg-[color:var(--color-secondary)] p-6 text-center">
          <h3 className="font-semibold text-[color:var(--color-text-primary)]">Пока нет отпусков</h3>
          <p className="text-sm text-[color:var(--color-text-secondary)]">
            Добавьте отпуск и система автоматически рассчитает сумму выплаты по формуле среднего
            дневного заработка.
          </p>
          <a
            href="#vacation-form"
            className="rounded-[8px] bg-[color:var(--color-accent-button)] px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
          >
            Добавить отпуск
          </a>
        </div>
      ) : (
        <div>
          <div className="hidden grid-cols-[6rem_6rem_4rem_7rem_auto] gap-3 border-b border-[color:var(--color-tertiary-surface)] pb-2 text-xs font-medium text-[color:var(--color-text-secondary)] sm:grid">
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
  );
}

export default async function VacationsPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-12">
      <h1 className="font-[family-name:var(--font-family-display)] text-[length:var(--font-size-display)] font-[number:var(--font-weight-display)] text-[color:var(--color-text-primary)]">
        Отпуска
      </h1>
      <div id="vacation-form"><VacationForm /></div>
      <Suspense fallback={<SkeletonLoader count={3} variant="vacation-row" />}>
        <VacationListContent />
      </Suspense>
    </div>
  );
}
