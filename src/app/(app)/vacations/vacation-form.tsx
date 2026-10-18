"use client";

import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { saveVacationAction } from "@/app/actions/vacation";
import { todayIsoInMoscow } from "@/domain/time";
import { calculateVacationDays } from "@/domain/vacation/calculate-average-daily-earnings";
import { pluralizeRu } from "@/lib/pluralize-ru";
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
  // Guards the live preview on the same startDate <= endDate ordering the
  // zod schema's cross-field refinement enforces (only run through
  // handleSubmit/the resolver, not on every keystroke) — without this, a
  // very ordinary transient mid-edit state (e.g. editing endDate first)
  // renders a zero/negative day count before the user finishes typing or
  // submits (closes WR-03, 03-REVIEW.md).
  const dayCount =
    ISO_DATE_SHAPE.test(startDate ?? "") &&
    ISO_DATE_SHAPE.test(endDate ?? "") &&
    endDate >= startDate
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
      <h2 className="text-[length:var(--font-size-heading)] font-[number:var(--font-weight-heading)] text-[color:var(--color-text-primary)]">Отпуск</h2>
      <div className="flex flex-col gap-[var(--spacing-sm)]">
        <label htmlFor="startDate" className="text-[length:var(--font-size-label)] font-[number:var(--font-weight-label)] text-[color:var(--color-text-primary)]">Дата начала отпуска</label>
        <input
          id="startDate"
          type="date"
          className="rounded-[8px] border border-[color:var(--color-tertiary-surface)] bg-[color:var(--color-dominant)] px-3 py-2 text-[color:var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
          {...register("startDate")}
        />
        <p className="text-[length:var(--font-size-caption)] text-[color:var(--color-text-secondary)]">День, когда начинается отпуск</p>
        {errors.startDate && <p className="text-sm text-[color:var(--color-destructive)]">{errors.startDate.message}</p>}
      </div>
      <div className="flex flex-col gap-[var(--spacing-sm)]">
        <label htmlFor="endDate" className="text-[length:var(--font-size-label)] font-[number:var(--font-weight-label)] text-[color:var(--color-text-primary)]">Дата окончания отпуска</label>
        <input
          id="endDate"
          type="date"
          className="rounded-[8px] border border-[color:var(--color-tertiary-surface)] bg-[color:var(--color-dominant)] px-3 py-2 text-[color:var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
          {...register("endDate")}
        />
        <p className="text-[length:var(--font-size-caption)] text-[color:var(--color-text-secondary)]">День, когда заканчивается отпуск</p>
        {errors.endDate && <p className="text-sm text-[color:var(--color-destructive)]">{errors.endDate.message}</p>}
        {dayCount !== null && (
          <p className="text-[length:var(--font-size-caption)] text-[color:var(--color-text-secondary)]">
            {dayCount} {pluralizeRu(dayCount, ["день", "дня", "дней"])} отпуска
          </p>
        )}
      </div>
      {serverError && <p className="text-sm text-[color:var(--color-destructive)]">{serverError}</p>}
      {message && <p className="text-sm text-[color:var(--color-accent)]">{message}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-[8px] bg-[color:var(--color-accent-button)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
      >
        {isSubmitting ? "Сохранение…" : "Сохранить отпуск"}
      </button>
    </form>
  );
}
