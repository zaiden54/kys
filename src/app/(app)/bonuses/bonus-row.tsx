"use client";

import { useRef, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { deleteBonusAction, saveBonusAction } from "@/app/actions/bonus";
import { formatKopecks, kopecksToRubles } from "@/domain/money";
import { formatIsoDateRu } from "@/domain/time";
import type { BonusRow as BonusRowData } from "@/lib/db/bonus-repository";
import { bonusInputSchema, type BonusInput } from "@/lib/validation/bonus";

function toDefaults(bonus: BonusRowData): BonusInput {
  return {
    id: bonus.id, amountRubles: kopecksToRubles(bonus.amountKopecks),
    date: bonus.date, note: bonus.note ?? "", type: bonus.type,
  };
}

export function BonusRow({ bonus }: { bonus: BonusRowData }) {
  const [mode, setMode] = useState<"display" | "editing">("display");
  const [pending, setPending] = useState(false);
  const [error, setErrorMessage] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } =
    useForm<BonusInput>({
      resolver: zodResolver(bonusInputSchema) as Resolver<BonusInput>,
      values: toDefaults(bonus),
      resetOptions: { keepDirtyValues: true },
    });
  // Guards onEdit's async continuation against a superseded edit session:
  // bumped on every submit and on Cancel, so a stale in-flight save that
  // resolves after the user has moved on (cancelled + reopened, or
  // resubmitted) no-ops instead of clobbering the newer session.
  const editSessionRef = useRef(0);

  async function onEdit(values: BonusInput) {
    const session = ++editSessionRef.current;
    setErrorMessage(null);
    try {
      const data = new FormData();
      data.set("id", bonus.id); data.set("amountRubles", String(values.amountRubles));
      data.set("date", values.date); data.set("note", values.note); data.set("type", values.type);
      const result = await saveBonusAction(data);
      if (editSessionRef.current !== session) return; // superseded — do nothing
      if (result.success) {
        setMode("display");
        reset(values, { keepDirtyValues: false });
        return;
      }
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        if ((field === "amountRubles" || field === "date" || field === "note") && messages?.[0]) {
          setError(field, { message: messages.join(" ") });
        }
      }
    } catch {
      if (editSessionRef.current !== session) return; // superseded — do nothing
      setErrorMessage("Не удалось сохранить бонус. Попробуйте ещё раз.");
    }
  }

  async function onDelete() {
    if (!window.confirm(`Удалить бонус на сумму ${formatKopecks(bonus.amountKopecks)} от ${formatIsoDateRu(bonus.date)}?`)) return;
    setPending(true); setErrorMessage(null);
    try {
      const result = await deleteBonusAction(bonus.id);
      if (!result.success) setErrorMessage(Object.values(result.fieldErrors).flat().join(" "));
    } catch {
      setErrorMessage("Не удалось удалить бонус. Попробуйте ещё раз.");
    } finally { setPending(false); }
  }

  if (mode === "editing") {
    return (
      <li className="border-b border-zinc-200 py-3">
        <form onSubmit={(e) => handleSubmit(onEdit)(e)} className="grid gap-2" noValidate>
          <input type="hidden" {...register("id")} />
          <input type="date" className="rounded border border-zinc-300 px-3 py-2" {...register("date")} />
          {errors.date && <p className="text-sm text-red-600">{errors.date.message}</p>}
          <input type="number" step="0.01" className="rounded border border-zinc-300 px-3 py-2" {...register("amountRubles")} />
          {errors.amountRubles && <p className="text-sm text-red-600">{errors.amountRubles.message}</p>}
          <input type="text" className="rounded border border-zinc-300 px-3 py-2" {...register("note")} />
          {errors.note && <p className="text-sm text-red-600">{errors.note.message}</p>}
          <select aria-label="Тип выплаты" className="rounded border border-zinc-300 px-3 py-2" {...register("type")}>
            <option value="premium">Премия (учитывается при расчёте отпускных)</option>
            <option value="compensation">Компенсация — например, к отпуску (не учитывается при расчёте отпускных)</option>
          </select>
          {errors.type && <p className="text-sm text-red-600">{errors.type.message}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={isSubmitting} className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{isSubmitting ? "Сохранение…" : "Сохранить"}</button>
            <button type="button" onClick={() => { editSessionRef.current += 1; reset(toDefaults(bonus), { keepDirtyValues: false }); setMode("display"); }} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">Отмена</button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="border-b border-zinc-200 py-3">
      <div className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-2 text-sm sm:grid-cols-[6rem_7rem_minmax(0,1fr)_auto] sm:items-center">
        <span>{formatIsoDateRu(bonus.date)}</span>
        <span className="font-semibold">{formatKopecks(bonus.amountKopecks)}</span>
        <span className="col-span-2 truncate text-zinc-600 sm:col-span-1" title={bonus.note ?? undefined}>{bonus.note || "—"}</span>
        <span className="col-span-2 flex justify-end gap-2 sm:col-span-1">
          <button type="button" onClick={() => setMode("editing")} className="text-zinc-700 underline">Изменить бонус</button>
          <button type="button" onClick={onDelete} disabled={pending} className="text-red-700 underline disabled:opacity-50">{pending ? "Удаляется…" : "Удалить бонус"}</button>
        </span>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </li>
  );
}
