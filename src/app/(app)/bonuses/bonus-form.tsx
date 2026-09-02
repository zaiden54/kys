"use client";

import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { saveBonusAction } from "@/app/actions/bonus";
import { todayIsoInMoscow } from "@/domain/time";
import { bonusInputSchema, type BonusInput } from "@/lib/validation/bonus";

function toFormData(values: BonusInput): FormData {
  const data = new FormData();
  data.set("amountRubles", String(values.amountRubles));
  data.set("date", values.date);
  data.set("note", values.note);
  data.set("type", values.type);
  return data;
}

export function BonusForm() {
  const today = todayIsoInMoscow();
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } =
    useForm<BonusInput>({
      resolver: zodResolver(bonusInputSchema) as Resolver<BonusInput>,
      defaultValues: { amountRubles: undefined, date: today, note: "", type: "premium" },
    });
  const [message, setMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(values: BonusInput) {
    setMessage(null);
    setServerError(null);
    try {
      const result = await saveBonusAction(toFormData(values));
      if (!result.success) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          const message = messages?.join(" ");
          if (message && (field === "amountRubles" || field === "date" || field === "note")) {
            setError(field, { message });
          }
        }
        return;
      }
      setMessage("Бонус сохранён.");
      reset({ amountRubles: undefined, date: todayIsoInMoscow(), note: "", type: "premium" });
    } catch {
      setServerError("Не удалось сохранить бонус. Попробуйте ещё раз.");
    }
  }

  const inputClassName =
    "rounded-[8px] border border-[color:var(--color-tertiary-surface)] bg-[color:var(--color-dominant)] px-3 py-2 text-[color:var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]";
  const labelClassName =
    "text-[length:var(--font-size-label)] font-[number:var(--font-weight-label)] text-[color:var(--color-text-primary)]";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
      <h2 className="text-[length:var(--font-size-heading)] font-[number:var(--font-weight-heading)] text-[color:var(--color-text-primary)]">Бонус или компенсация</h2>
      <div className="flex flex-col gap-[var(--spacing-sm)]">
        <label htmlFor="amountRubles" className={labelClassName}>Сумма, ₽</label>
        <input id="amountRubles" type="number" step="0.01" placeholder="Например, 10000"
          className={inputClassName} {...register("amountRubles")} />
        {errors.amountRubles && <p className="text-sm text-[color:var(--color-destructive)]">{errors.amountRubles.message}</p>}
      </div>
      <div className="flex flex-col gap-[var(--spacing-sm)]">
        <label htmlFor="date" className={labelClassName}>Дата выплаты</label>
        <input id="date" type="date" className={inputClassName}
          {...register("date")} />
        <p className="text-[length:var(--font-size-caption)] text-[color:var(--color-text-secondary)]">День, когда бонус будет выплачен</p>
        {errors.date && <p className="text-sm text-[color:var(--color-destructive)]">{errors.date.message}</p>}
      </div>
      <div className="flex flex-col gap-[var(--spacing-sm)]">
        <label htmlFor="note" className={labelClassName}>Заметка (необязательно)</label>
        <input id="note" type="text" placeholder={'Например, "13-я зарплата" или "бонус за проект"'}
          className={inputClassName} {...register("note")} />
        {errors.note && <p className="text-sm text-[color:var(--color-destructive)]">{errors.note.message}</p>}
      </div>
      <div className="flex flex-col gap-[var(--spacing-sm)]">
        <label htmlFor="type" className={labelClassName}>Тип выплаты</label>
        <select id="type" className={inputClassName} {...register("type")}>
          <option value="premium">Премия (учитывается при расчёте отпускных)</option>
          <option value="compensation">Компенсация — например, к отпуску (не учитывается при расчёте отпускных)</option>
        </select>
        {errors.type && <p className="text-sm text-[color:var(--color-destructive)]">{errors.type.message}</p>}
      </div>
      {serverError && <p className="text-sm text-[color:var(--color-destructive)]">{serverError}</p>}
      {message && <p className="text-sm text-[color:var(--color-accent)]">{message}</p>}
      <button type="submit" disabled={isSubmitting}
        className="rounded-lg bg-[color:var(--color-accent-button)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]">
        {isSubmitting ? "Сохранение…" : "Сохранить бонус"}
      </button>
    </form>
  );
}
