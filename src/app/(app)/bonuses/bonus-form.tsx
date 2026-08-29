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
  return data;
}

export function BonusForm() {
  const today = todayIsoInMoscow();
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } =
    useForm<BonusInput>({
      resolver: zodResolver(bonusInputSchema) as Resolver<BonusInput>,
      defaultValues: { amountRubles: undefined, date: today, note: "" },
    });
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(values: BonusInput) {
    setMessage(null);
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
    reset({ amountRubles: undefined, date: todayIsoInMoscow(), note: "" });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
      <h2 className="text-lg font-semibold">Бонус или компенсация</h2>
      <div className="flex flex-col gap-1">
        <label htmlFor="amountRubles" className="text-sm font-medium">Сумма, ₽</label>
        <input id="amountRubles" type="number" step="0.01" placeholder="Например, 10000"
          className="rounded border border-zinc-300 px-3 py-2" {...register("amountRubles")} />
        {errors.amountRubles && <p className="text-sm text-red-600">{errors.amountRubles.message}</p>}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="date" className="text-sm font-medium">Дата выплаты</label>
        <input id="date" type="date" className="rounded border border-zinc-300 px-3 py-2"
          {...register("date")} />
        <p className="text-xs text-zinc-500">День, когда бонус будет выплачен</p>
        {errors.date && <p className="text-sm text-red-600">{errors.date.message}</p>}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="note" className="text-sm font-medium">Заметка (необязательно)</label>
        <input id="note" type="text" placeholder={'Например, "13-я зарплата" или "бонус за проект"'}
          className="rounded border border-zinc-300 px-3 py-2" {...register("note")} />
        {errors.note && <p className="text-sm text-red-600">{errors.note.message}</p>}
      </div>
      {message && <p className="text-sm text-green-700">{message}</p>}
      <button type="submit" disabled={isSubmitting}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {isSubmitting ? "Сохранение…" : "Сохранить бонус"}
      </button>
    </form>
  );
}
