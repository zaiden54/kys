import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { forecastNextPayment } from "@/app/actions/forecast";
import { NextPaymentCard } from "@/components/next-payment-card";
import { YtdEstimateBanner } from "@/components/ytd-estimate-banner";

// HOME-01: shows only the next payment's date and take-home amount. The
// forecast is computed server-side (see src/app/actions/forecast.ts) during
// this render — no forecast input or tax figure is ever passed to a client
// component for recomputation. Per D-15, this screen deliberately carries
// no forward-looking salary-change notice; a future-dated salary change
// simply has no effect until a payment actually falls on/after its
// effective date.
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

export default async function HomePage() {
  const userId = await requireUserId();
  const result = await forecastNextPayment(userId);

  if (!result.configured) {
    const copy = MISSING_COPY[result.missing];
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">{copy.title}</h1>
        <p className="max-w-sm text-zinc-600">{copy.body}</p>
        <Link
          href="/onboarding"
          className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          Перейти к настройке
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-4 px-6 py-16">
      {result.forecast.baselineIsEstimated ? <YtdEstimateBanner /> : null}
      <NextPaymentCard forecast={result.forecast} />
    </div>
  );
}
