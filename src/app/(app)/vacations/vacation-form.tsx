"use client";

import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { saveVacationAction } from "@/app/actions/vacation";
import { todayIsoInMoscow } from "@/domain/time";
import { calculateVacationDays } from "@/domain/vacation/calculate-average-daily-earnings";
import { vacationInputSchema, type VacationInput } from "@/lib/validation/vacation";

const ISO_DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

function toFormData(values: VacationInput): FormData {
  const data = new FormData();
  data.set("startDate", values.startDate);
  data.set("endDate", values.endDate);
  return data;
}

export function VacationForm() {
  const today = todayIsoInMoscow();
  const { register, handleSubmit, reset, setError, watch, formState: { errors, isSubmitting } } =
    useForm<VacationInput>({
      resolver: zodResolver(vacationInputSchema) as Resolver<VacationInput>,
      defaultValues: { startDate: today, endDate: today },
    });
  const [message, setMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const startDate = watch("startDate");
  const endDate = watch("endDate");
  const dayCount =
    ISO_DATE_SHAPE.test(startDate ?? "") && ISO_DATE_SHAPE.test(endDate ?? "")
      ? calculateVacationDays(startDate, endDate)
      : null;

  async function onSubmit(values: VacationInput) {
    setMessage(null);
    setServerError(null);
    try {
      const result = await saveVacationAction(toFormData(values));
      if (!result.success) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          const message = messages?.join(" ");
          if (message && (field === "startDate" || field === "endDate")) {
            setError(field, { message });
          }
        }
        return;
      }
      setMessage("Отпуск записан.");
      reset({ startDate: todayIsoInMoscow(), endDate: todayIsoInMoscow() });
    } catch {
      setServerError("Не удалось сохранить отпуск. Попробуйте ещё раз.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
      <h2 className="text-lg font-semibold">Отпуск</h2>
      <div className="flex flex-col gap-1">
        <label htmlFor="startDate" className="text-sm font-medium">Дата начала отпуска</label>
        <input id="startDate" type="date" className="rounded border border-zinc-300 px-3 py-2"
          {...register("startDate")} />
        <p className="text-xs text-zinc-500">День, когда начинается отпуск</p>
        {errors.startDate && <p className="text-sm text-red-600">{errors.startDate.message}</p>}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="endDate" className="text-sm font-medium">Дата окончания отпуска</label>
        <input id="endDate" type="date" className="rounded border border-zinc-300 px-3 py-2"
          {...register("endDate")} />
        <p className="text-xs text-zinc-500">День, когда заканчивается отпуск</p>
        {errors.endDate && <p className="text-sm text-red-600">{errors.endDate.message}</p>}
        {dayCount !== null && (
          <p className="text-xs text-zinc-500">{dayCount} дней отпуска</p>
        )}
      </div>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}
      <button type="submit" disabled={isSubmitting}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {isSubmitting ? "Сохранение…" : "Сохранить отпуск"}
      </button>
    </form>
  );
}
