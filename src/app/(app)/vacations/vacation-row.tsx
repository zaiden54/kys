"use client";

import { useRef, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { deleteVacationAction, saveVacationAction } from "@/app/actions/vacation";
import { formatKopecks, type Kopecks } from "@/domain/money";
import { formatIsoDateRu } from "@/domain/time";
import { calculateVacationDays } from "@/domain/vacation/calculate-average-daily-earnings";
import type { VacationRow as VacationRowData } from "@/lib/db/vacation-repository";
import { vacationInputSchema, type VacationInput } from "@/lib/validation/vacation";

function toDefaults(vacation: VacationRowData): VacationInput {
  return { id: vacation.id, startDate: vacation.startDate, endDate: vacation.endDate };
}

export function VacationRow({
  vacation,
  grossKopecks,
}: {
  vacation: VacationRowData;
  grossKopecks: Kopecks | null;
}) {
  const [mode, setMode] = useState<"display" | "editing">("display");
  const [pending, setPending] = useState(false);
  const [error, setErrorMessage] = useState<string | null>(null);
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } =
    useForm<VacationInput>({
      resolver: zodResolver(vacationInputSchema) as Resolver<VacationInput>,
      values: toDefaults(vacation),
      resetOptions: { keepDirtyValues: true },
    });
  // Guards onEdit's async continuation against a superseded edit session:
  // bumped on every submit and on Cancel, so a stale in-flight save that
  // resolves after the user has moved on (cancelled + reopened, or
  // resubmitted) no-ops instead of clobbering the newer session.
  const editSessionRef = useRef(0);

  async function onEdit(values: VacationInput) {
    const session = ++editSessionRef.current;
    setErrorMessage(null);
    try {
      const data = new FormData();
      data.set("id", vacation.id);
      data.set("startDate", values.startDate);
      data.set("endDate", values.endDate);
      const result = await saveVacationAction(data);
      if (editSessionRef.current !== session) return; // superseded — do nothing
      if (result.success) {
        setMode("display");
        reset(values, { keepDirtyValues: false });
        return;
      }
      let handled = false;
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        if ((field === "startDate" || field === "endDate") && messages?.[0]) {
          setError(field, { message: messages.join(" ") });
          handled = true;
        }
      }
      if (!handled) {
        setErrorMessage(
          Object.values(result.fieldErrors).flat().join(" ") || "Не удалось сохранить отпуск.",
        );
      }
    } catch {
      if (editSessionRef.current !== session) return; // superseded — do nothing
      setErrorMessage("Не удалось сохранить отпуск. Попробуйте ещё раз.");
    }
  }

  async function onDelete() {
    if (
      !window.confirm(
        `Удалить отпуск с ${formatIsoDateRu(vacation.startDate)} по ${formatIsoDateRu(vacation.endDate)}?`,
      )
    ) {
      return;
    }
    setPending(true);
    setErrorMessage(null);
    try {
      const result = await deleteVacationAction(vacation.id);
      if (!result.success) setErrorMessage(Object.values(result.fieldErrors).flat().join(" "));
    } catch {
      setErrorMessage("Не удалось удалить отпуск. Попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  if (mode === "editing") {
    return (
      <li className="border-b border-[color:var(--color-tertiary-surface)] py-3">
        <form onSubmit={(e) => handleSubmit(onEdit)(e)} className="grid gap-2" noValidate>
          <input type="hidden" {...register("id")} />
          <input
            type="date"
            className="rounded-[8px] border border-[color:var(--color-tertiary-surface)] bg-[color:var(--color-dominant)] px-3 py-2 text-[color:var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
            {...register("startDate")}
          />
          {errors.startDate && <p className="text-sm text-[color:var(--color-destructive)]">{errors.startDate.message}</p>}
          <input
            type="date"
            className="rounded-[8px] border border-[color:var(--color-tertiary-surface)] bg-[color:var(--color-dominant)] px-3 py-2 text-[color:var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
            {...register("endDate")}
          />
          {errors.endDate && <p className="text-sm text-[color:var(--color-destructive)]">{errors.endDate.message}</p>}
          {error && <p className="text-sm text-[color:var(--color-destructive)]">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-[8px] bg-[color:var(--color-accent-button)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
            >
              {isSubmitting ? "Сохранение…" : "Сохранить"}
            </button>
            <button
              type="button"
              onClick={() => { editSessionRef.current += 1; reset(toDefaults(vacation), { keepDirtyValues: false }); setMode("display"); }}
              className="rounded-[8px] border border-[color:var(--color-tertiary-surface)] px-3 py-2 text-sm text-[color:var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
            >
              Отмена
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="border-b border-[color:var(--color-tertiary-surface)] py-3">
      <div className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-2 text-sm sm:grid-cols-[6rem_6rem_4rem_7rem_auto] sm:items-center">
        <span className="tabular-nums text-[color:var(--color-text-secondary)] font-[family-name:var(--font-family-caption)] text-[length:var(--font-size-caption)]">
          {formatIsoDateRu(vacation.startDate)}
        </span>
        <span className="tabular-nums text-[color:var(--color-text-secondary)] font-[family-name:var(--font-family-caption)] text-[length:var(--font-size-caption)]">
          {formatIsoDateRu(vacation.endDate)}
        </span>
        <span className="text-[color:var(--color-text-secondary)]">
          {calculateVacationDays(vacation.startDate, vacation.endDate)}
        </span>
        <span className="font-semibold text-[color:var(--color-text-primary)] tabular-nums">
          {grossKopecks === null ? (
            <span className="font-normal text-[color:var(--color-text-secondary)]">Укажите оклад, чтобы увидеть сумму</span>
          ) : (
            formatKopecks(grossKopecks)
          )}
        </span>
        <span className="col-span-2 flex justify-end gap-2 sm:col-span-1">
          <button
            type="button"
            onClick={() => setMode("editing")}
            className="text-[color:var(--color-text-primary)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
          >
            Изменить отпуск
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="text-[color:var(--color-destructive)] underline disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-destructive)]"
          >
            {pending ? "Удаляется…" : "Удалить отпуск"}
          </button>
        </span>
      </div>
      {error && <p className="mt-2 text-sm text-[color:var(--color-destructive)]">{error}</p>}
    </li>
  );
}
