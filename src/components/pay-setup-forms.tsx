"use client";

/**
 * Shared salary / schedule / year-to-date form components, used by both the
 * first-run onboarding flow and the settings page (SAL-01, SAL-02, SAL-03).
 *
 * Each form uses react-hook-form with the matching Zod resolver, submits to
 * its Server Action as FormData, and renders the action's returned inline
 * field errors, confirmation prompt (D-14), or non-blocking warning (D-04).
 */

import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { todayIsoInMoscow } from "@/domain/time";
import {
  salaryInputSchema,
  scheduleInputSchema,
  ytdBaselineInputSchema,
  type SalaryInput,
  type ScheduleInput,
  type YtdBaselineInput,
} from "@/lib/validation/salary";
import {
  saveSalaryAction,
  saveScheduleAction,
  saveYtdBaselineAction,
  skipYtdBaselineAction,
  type SalaryActionResult,
  type ScheduleActionResult,
  type YtdBaselineActionResult,
} from "@/app/actions/salary";

function toFormData(values: Record<string, string | number | boolean>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, String(value));
  }
  return formData;
}

function joinFieldErrors(fieldErrors: Record<string, string[]>): string {
  return Object.values(fieldErrors).flat().join(" ");
}

// ---------------------------------------------------------------------------
// SalaryForm
// ---------------------------------------------------------------------------

export type SalaryFormProps = {
  defaultGrossRubles?: number;
  defaultEffectiveFrom?: string;
};

export function SalaryForm({ defaultGrossRubles, defaultEffectiveFrom }: SalaryFormProps) {
  const today = todayIsoInMoscow();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SalaryInput>({
    // zod4's z.coerce.number() types its *input* as `unknown` (pre-coercion),
    // which zodResolver correctly reflects but which useForm's defaultValues
    // (typed against the *output* SalaryInput) then rejects. Cast to the
    // known output-typed Resolver — the runtime coercion is unaffected.
    resolver: zodResolver(salaryInputSchema) as Resolver<SalaryInput>,
    defaultValues: {
      grossRubles: defaultGrossRubles,
      effectiveFrom: defaultEffectiveFrom ?? today,
    },
  });
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    existingAmountRubles: number;
    effectiveFrom: string;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  async function submit(values: SalaryInput, confirm: boolean) {
    setMessage(null);
    setServerError(null);
    try {
      const result: SalaryActionResult = await saveSalaryAction(
        toFormData({ ...values, confirm }),
      );
      if (result.success) {
        setPendingConfirmation(null);
        setMessage("Оклад сохранён.");
        return;
      }
      if (result.needsConfirmation) {
        setPendingConfirmation({
          existingAmountRubles: result.existingAmountRubles,
          effectiveFrom: result.effectiveFrom,
        });
        return;
      }
      setServerError(joinFieldErrors(result.fieldErrors));
    } catch {
      setServerError("Не удалось сохранить оклад. Попробуйте ещё раз.");
    }
  }

  async function onSubmit(values: SalaryInput) {
    await submit(values, false);
  }

  async function onConfirmReplace() {
    await submit(getValues(), true);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
      <h2 className="text-lg font-semibold">Оклад</h2>
      <div className="flex flex-col gap-1">
        <label htmlFor="grossRubles" className="text-sm font-medium">
          Оклад «грязными», ₽
        </label>
        <input
          id="grossRubles"
          type="number"
          step="0.01"
          className="rounded border border-zinc-300 px-3 py-2"
          {...register("grossRubles")}
        />
        {errors.grossRubles && <p className="text-sm text-red-600">{errors.grossRubles.message}</p>}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="effectiveFrom" className="text-sm font-medium">
          Дата вступления в силу
        </label>
        <input
          id="effectiveFrom"
          type="date"
          className="rounded border border-zinc-300 px-3 py-2"
          {...register("effectiveFrom")}
        />
        <p className="text-xs text-zinc-500">
          Можно указать дату в прошлом — например, чтобы исправить ранее введённое значение.
        </p>
        {errors.effectiveFrom && (
          <p className="text-sm text-red-600">{errors.effectiveFrom.message}</p>
        )}
      </div>
      {pendingConfirmation && (
        <div className="rounded border border-amber-400 bg-amber-50 p-3 text-sm">
          <p>
            На {pendingConfirmation.effectiveFrom} уже сохранён оклад{" "}
            {pendingConfirmation.existingAmountRubles} ₽. Сохранение заменит это значение без
            возможности восстановить его.
          </p>
          <button
            type="button"
            onClick={onConfirmReplace}
            disabled={isSubmitting}
            className="mt-2 rounded bg-black px-3 py-1.5 text-white disabled:opacity-50"
          >
            Подтвердить и заменить
          </button>
        </div>
      )}
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {isSubmitting ? "Сохраняем…" : "Сохранить оклад"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// ScheduleForm
// ---------------------------------------------------------------------------

export type ScheduleFormProps = {
  defaultAvansDay?: number;
  defaultSalaryDay?: number;
};

export function ScheduleForm({ defaultAvansDay, defaultSalaryDay }: ScheduleFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ScheduleInput>({
    // See the SalaryForm resolver comment above for why this cast is needed.
    resolver: zodResolver(scheduleInputSchema) as Resolver<ScheduleInput>,
    defaultValues: {
      avansDay: defaultAvansDay ?? 20,
      salaryDay: defaultSalaryDay ?? 5,
    },
  });
  const [warning, setWarning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(values: ScheduleInput) {
    setMessage(null);
    setWarning(null);
    setServerError(null);
    const result: ScheduleActionResult = await saveScheduleAction(toFormData(values));
    if (result.success) {
      setMessage("График сохранён.");
      setWarning(result.warning);
      return;
    }
    setServerError(joinFieldErrors(result.fieldErrors));
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
      <h2 className="text-lg font-semibold">График выплат</h2>
      <div className="flex flex-col gap-1">
        <label htmlFor="avansDay" className="text-sm font-medium">
          День аванса (число месяца)
        </label>
        <input
          id="avansDay"
          type="number"
          min={1}
          max={31}
          className="rounded border border-zinc-300 px-3 py-2"
          {...register("avansDay")}
        />
        {errors.avansDay && <p className="text-sm text-red-600">{errors.avansDay.message}</p>}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="salaryDay" className="text-sm font-medium">
          День зарплаты (число месяца)
        </label>
        <input
          id="salaryDay"
          type="number"
          min={1}
          max={31}
          className="rounded border border-zinc-300 px-3 py-2"
          {...register("salaryDay")}
        />
        {errors.salaryDay && <p className="text-sm text-red-600">{errors.salaryDay.message}</p>}
      </div>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}
      {warning && <p className="text-sm text-amber-700">{warning}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {isSubmitting ? "Сохраняем…" : "Сохранить график"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// YtdForm
// ---------------------------------------------------------------------------

export type YtdFormProps = {
  defaultAmountRubles?: number;
  defaultAsOfDate?: string;
  isEstimated?: boolean;
};

export function YtdForm({ defaultAmountRubles, defaultAsOfDate, isEstimated }: YtdFormProps) {
  // The as-of date is the exact boundary the accrual engine
  // (src/domain/pay/payment-accrual.ts, via getCumulativeIncomeBeforeDate)
  // starts counting scheduled payments from. A caller-supplied
  // `defaultAsOfDate` is only trustworthy as the pre-fill when it reflects a
  // real, previously-confirmed baseline (`isEstimated` false) -- both
  // `getYtdBaseline`'s synthesized default and `skipYtdBaselineAction`
  // always store a 1-January `asOfDate` alongside `isEstimated: true`, so
  // pre-filling that stale start-of-year date for a user who has not yet
  // entered a real baseline would make a mid-year amount they type in cover
  // only through 1 January, double-counting every scheduled payment
  // received between 1 January and today when accrual adds them back on
  // top (SAL-03). For that case the default is today in Moscow instead.
  const resolvedDefaultAsOfDate =
    !isEstimated && defaultAsOfDate ? defaultAsOfDate : todayIsoInMoscow();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<YtdBaselineInput>({
    // See the SalaryForm resolver comment above for why this cast is needed.
    resolver: zodResolver(ytdBaselineInputSchema) as Resolver<YtdBaselineInput>,
    defaultValues: {
      amountRubles: defaultAmountRubles ?? 0,
      asOfDate: resolvedDefaultAsOfDate,
    },
  });
  const [message, setMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [skipping, setSkipping] = useState(false);

  async function onSubmit(values: YtdBaselineInput) {
    setMessage(null);
    setServerError(null);
    const result: YtdBaselineActionResult = await saveYtdBaselineAction(toFormData(values));
    if (result.success) {
      setMessage("Сумма нарастающим итогом сохранена.");
      return;
    }
    setServerError(joinFieldErrors(result.fieldErrors));
  }

  async function onSkip() {
    setMessage(null);
    setServerError(null);
    setSkipping(true);
    try {
      await skipYtdBaselineAction();
      setMessage("Пропущено — доход с начала года считается нулевым до заполнения.");
    } finally {
      setSkipping(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
      <h2 className="text-lg font-semibold">Доход с начала года</h2>
      <p className="text-xs text-zinc-500">
        Нужно, чтобы правильно посчитать НДФЛ нарастающим итогом, если вы регистрируетесь не в
        январе.
      </p>
      {isEstimated && (
        <p className="text-sm text-amber-700">
          Сейчас используется нулевое значение по умолчанию — прогноз может быть неточным, пока вы
          не укажете реальную сумму.
        </p>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="amountRubles" className="text-sm font-medium">
          Сумма дохода с 1 января, ₽
        </label>
        <input
          id="amountRubles"
          type="number"
          step="0.01"
          min={0}
          className="rounded border border-zinc-300 px-3 py-2"
          {...register("amountRubles")}
        />
        {errors.amountRubles && (
          <p className="text-sm text-red-600">{errors.amountRubles.message}</p>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="asOfDate" className="text-sm font-medium">
          По состоянию на
        </label>
        <input
          id="asOfDate"
          type="date"
          className="rounded border border-zinc-300 px-3 py-2"
          {...register("asOfDate")}
        />
        <p className="text-xs text-zinc-500">
          Сумма выше — это доход с 1 января по указанную дату включительно. Выплаты по графику
          после этой даты добавляются автоматически.
        </p>
        {errors.asOfDate && <p className="text-sm text-red-600">{errors.asOfDate.message}</p>}
      </div>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {isSubmitting ? "Сохраняем…" : "Сохранить"}
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={skipping}
          className="rounded border border-zinc-300 px-4 py-2 disabled:opacity-50"
        >
          {skipping ? "…" : "Пропустить"}
        </button>
      </div>
    </form>
  );
}
