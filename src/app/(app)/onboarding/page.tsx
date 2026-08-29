import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { getActiveSalaryAt, getSchedule, getYtdBaseline } from "@/lib/db/salary-repository";
import { kopecksToRubles } from "@/domain/money";
import { todayIsoInMoscow } from "@/domain/time";
import { SalaryForm, ScheduleForm, YtdForm } from "@/components/pay-setup-forms";

// First-run pay setup (SAL-01, SAL-02, SAL-03). The year-to-date question
// (YtdForm) is always rendered below, regardless of the current month — D-09
// removes any January-only special case, so there is no conditional around
// it here.
export default async function OnboardingPage() {
  const userId = await requireUserId();
  const today = todayIsoInMoscow();

  const [activeSalary, schedule, ytdBaseline] = await Promise.all([
    getActiveSalaryAt(userId, today),
    getSchedule(userId),
    getYtdBaseline(userId),
  ]);

  const hasSalaryAndSchedule = Boolean(activeSalary) && Boolean(schedule);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Настройка выплат</h1>
        <p className="text-sm text-zinc-600">
          Укажите оклад, график выплат и доход с начала года — это нужно, чтобы точно посчитать
          сумму на руки к ближайшей выплате.
        </p>
      </div>

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

      {hasSalaryAndSchedule && (
        <Link href="/" className="text-sm underline">
          Перейти на главный экран
        </Link>
      )}
    </div>
  );
}
