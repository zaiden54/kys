import Link from "next/link";
import { getSessionUser, requireUserId } from "@/lib/session";
import { forecastNextPayment } from "@/app/actions/forecast";
import { computeAnnualSummary } from "@/app/actions/annual-summary";
import { getSchedule, listSalaryHistory } from "@/lib/db/salary-repository";
import { listBonuses } from "@/lib/db/bonus-repository";
import { listVacations } from "@/lib/db/vacation-repository";
import { NextPaymentCard } from "@/components/next-payment-card";
import { AnnualSummaryCard } from "@/components/annual-summary-card";
import { InstallBanner } from "@/components/install-banner";
import { SignOutButton } from "@/components/sign-out-button";
import { UserAvatar } from "@/components/user-avatar";
import { formatKopecks } from "@/domain/money";
import { daysBetweenIso, formatIsoDayMonthRu, todayIsoInMoscow } from "@/domain/time";
import { pluralizeRu } from "@/lib/pluralize-ru";

// HOME-01/HOME-02: one focal number (the next take-home payment), quick
// actions, the year at a glance, and entry points to the other sections.
// Every figure is computed server-side during this render — no forecast
// input or tax figure is passed to a client component for recomputation.
// Per D-15 there is deliberately no forward-looking salary-change notice.
const MISSING_COPY: Record<"salary" | "schedule", { title: string; body: string }> = {
  salary: {
    title: "Оклад ещё не указан",
    body: "Чтобы увидеть сумму и дату ближайшей выплаты, укажите оклад «грязными».",
  },
  schedule: {
    title: "График выплат ещё не настроен",
    body: "Чтобы увидеть сумму и дату ближайшей выплаты, укажите дни аванса и зарплаты.",
  },
};

type ForecastResult = Awaited<ReturnType<typeof forecastNextPayment>>;
type AnnualResult = Awaited<ReturnType<typeof computeAnnualSummary>>;

function Icon({ d }: { d: string }) {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d={d} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ICONS = {
  bonus: "M5 9h14v10H5V9Zm-1 0h16M12 9v10M8.5 6.2C8.5 5 9.3 4 10.3 4 11.4 4 12 5.6 12 9c-2.3 0-3.5-1.1-3.5-2.8Zm7 0c0-1.2-.8-2.2-1.8-2.2C12.6 4 12 5.6 12 9c2.3 0 3.5-1.1 3.5-2.8Z",
  vacation: "M4 20h16M7 20c0-5 2-9 5-11m0 0c-2-2-5-2-7-1m7 1c1-3 4-4 6-3m-6 3c3-1 6 0 7 2",
  salary: "M7 20V4h6a4 4 0 0 1 0 8H5m0 4h9",
  schedule: "M5 7h14v12H5V7Zm3-3v5m8-5v5M5 11h14",
} as const;

const QUICK_ACTIONS = [
  { href: "/bonuses", label: "Бонус", icon: ICONS.bonus },
  { href: "/vacations", label: "Отпуск", icon: ICONS.vacation },
  { href: "/settings/salary", label: "Оклад", icon: ICONS.salary },
  { href: "/settings/salary", label: "График", icon: ICONS.schedule },
] as const;

function LinkCard({
  href,
  title,
  description,
  icon,
  tint,
}: {
  href: string;
  title: string;
  description: string;
  icon: string;
  tint: string;
}) {
  return (
    <Link href={href} className="link-card">
      <span className="icon-tile" style={{ background: tint }}>
        <Icon d={icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{title}</span>
        <span className="mt-0.5 block truncate text-[13px] text-[color:var(--color-text-secondary)]">{description}</span>
      </span>
      <span aria-hidden="true" className="text-xl text-[color:var(--color-text-secondary)]">
        ›
      </span>
    </Link>
  );
}

function CenteredMessage({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <div className="surface-card mt-6 flex flex-col items-center gap-3 px-6 py-10 text-center">
      <h1 className="text-[length:var(--font-size-display)] font-[number:var(--font-weight-display)] leading-[var(--line-height-display)]">
        {title}
      </h1>
      <p className="max-w-sm text-[color:var(--color-text-secondary)]">{body}</p>
      <Link
        href={href}
        className="mt-2 rounded-full bg-[color:var(--color-accent-button)] px-5 py-2.5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
      >
        {cta}
      </Link>
    </div>
  );
}

export default async function HomePage() {
  const userId = await requireUserId();
  const user = await getSessionUser();
  const today = todayIsoInMoscow();
  const currentYear = Number(today.slice(0, 4));

  let result: ForecastResult | null = null;
  let annualResult: AnnualResult | null = null;
  let fetchFailed = false;

  try {
    [result, annualResult] = await Promise.all([
      forecastNextPayment(userId),
      computeAnnualSummary(userId, currentYear, today),
    ]);
  } catch {
    fetchFailed = true;
  }

  const topRow = (
    <div className="flex items-center gap-3">
      <UserAvatar name={user?.name ?? ""} />
      <p className="min-w-0 flex-1 truncate text-[17px] font-bold">{user?.name}</p>
      <span className="mobile-only">
        <SignOutButton />
      </span>
    </div>
  );

  if (fetchFailed || !result || !annualResult) {
    return (
      <div role="alert" className="mx-auto w-full max-w-xl px-4 py-4">
        {topRow}
        <CenteredMessage
          title="Не удалось загрузить данные"
          body="Проверьте соединение и попробуйте ещё раз."
          href="/"
          cta="Обновить страницу"
        />
      </div>
    );
  }

  if (!result.configured) {
    const copy = MISSING_COPY[result.missing];
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-4">
        {topRow}
        <InstallBanner />
        <CenteredMessage title={copy.title} body={copy.body} href="/onboarding" cta="Перейти к настройке" />
      </div>
    );
  }

  // Already fetched (and request-memoized) by the forecast above.
  const [bonuses, vacations, schedule, salaryHistory] = await Promise.all([
    listBonuses(userId),
    listVacations(userId),
    getSchedule(userId),
    listSalaryHistory(userId),
  ]);

  const nextBonus = bonuses.filter((bonus) => bonus.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
  const nextVacation = vacations
    .filter((vacation) => vacation.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const currentSalary = salaryHistory
    .filter((row) => row.effectiveFrom <= today)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];

  const vacationDays = nextVacation ? daysBetweenIso(nextVacation.startDate, nextVacation.endDate) + 1 : 0;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col px-4 py-4">
      {topRow}
      <InstallBanner />

      <div className="pt-10 pb-6">
        <NextPaymentCard forecast={result.forecast} />
      </div>

      <nav aria-label="Быстрые действия" className="flex justify-between px-1 pb-6">
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.label} href={action.href} className="quick-action">
            <span className="quick-action-icon">
              <Icon d={action.icon} />
            </span>
            {action.label}
          </Link>
        ))}
      </nav>

      <div className="flex flex-col gap-2.5">
        {annualResult.configured ? (
          <AnnualSummaryCard summary={annualResult.summary} taxYear={currentYear} />
        ) : null}

        <LinkCard
          href="/bonuses"
          title="Бонусы"
          description={
            nextBonus
              ? `Следующий — ${formatKopecks(nextBonus.amountKopecks)}, ${formatIsoDayMonthRu(nextBonus.date)}`
              : "Премии и компенсации"
          }
          icon={ICONS.bonus}
          tint="rgba(255, 153, 0, 0.16)"
        />
        <LinkCard
          href="/vacations"
          title="Отпуска"
          description={
            nextVacation
              ? `С ${formatIsoDayMonthRu(nextVacation.startDate)}, ${vacationDays} ${pluralizeRu(vacationDays, ["день", "дня", "дней"])}`
              : "Запланируйте отпуск и узнайте отпускные"
          }
          icon={ICONS.vacation}
          tint="rgba(46, 120, 255, 0.16)"
        />
        <LinkCard
          href="/settings/salary"
          title="Оклад и график"
          description={[
            currentSalary ? formatKopecks(currentSalary.grossAmountKopecks) : null,
            schedule ? `аванс ${schedule.avansDay}-го, зарплата ${schedule.salaryDay}-го` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          icon={ICONS.salary}
          tint="var(--color-accent-soft)"
        />
      </div>
    </div>
  );
}
