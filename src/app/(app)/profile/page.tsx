import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import {
  getActiveSalaryAt,
  getSchedule,
  getYtdBaseline,
  listSalaryHistory,
} from "@/lib/db/salary-repository";
import { formatKopecks, kopecksToRubles } from "@/domain/money";
import { todayIsoInMoscow } from "@/domain/time";
import { SalaryForm, ScheduleForm, YtdForm } from "@/components/pay-setup-forms";
import { SignOutButton } from "@/components/sign-out-button";
import { UserAvatar } from "@/components/user-avatar";
import { AvatarForm, EmailForm, NameForm, PasswordForm } from "./profile-forms";

const SECTION_TITLE =
  "text-[length:var(--font-size-label)] font-[number:var(--font-weight-label)] uppercase tracking-wide text-[color:var(--color-text-secondary)]";

// One place for everything the user can change: the account (photo, name,
// email, password) and every calculation input — salary, schedule, and the
// year-to-date baseline (D-10), plus the dated salary history (SAL-02).
export default async function ProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const today = todayIsoInMoscow();

  const [activeSalary, schedule, ytdBaseline, history] = await Promise.all([
    getActiveSalaryAt(user.id, today),
    getSchedule(user.id),
    getYtdBaseline(user.id),
    listSalaryHistory(user.id),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex items-center gap-4">
        <UserAvatar name={user.name} image={user.image} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-[family-name:var(--font-family-display)] text-[length:var(--font-size-display)] font-[number:var(--font-weight-display)] text-[color:var(--color-text-primary)]">
            {user.name}
          </h1>
          <p className="truncate text-sm text-[color:var(--color-text-secondary)]">{user.email}</p>
        </div>
        <span className="mobile-only">
          <SignOutButton />
        </span>
      </header>

      <section className="flex flex-col gap-4" aria-labelledby="account-title">
        <h2 id="account-title" className={SECTION_TITLE}>
          Аккаунт
        </h2>
        <AvatarForm name={user.name} image={user.image} />
        <NameForm defaultName={user.name} />
        <EmailForm defaultEmail={user.email} />
        <PasswordForm />
      </section>

      <section id="pay" className="flex scroll-mt-6 flex-col gap-4" aria-labelledby="pay-title">
        <h2 id="pay-title" className={SECTION_TITLE}>
          Оклад и график выплат
        </h2>

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

        <div className="flex flex-col gap-2">
          <h3 className="text-[length:var(--font-size-heading)] font-[number:var(--font-weight-heading)] text-[color:var(--color-text-primary)]">
            История окладов
          </h3>
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
        </div>
      </section>
    </div>
  );
}
