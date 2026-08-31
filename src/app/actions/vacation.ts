"use server";

/** Ownership-scoped vacation mutation actions. No submitted values are logged. */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  checkOverlapVacations,
  createVacation,
  deleteVacationIfFuture,
  updateVacation,
} from "@/lib/db/vacation-repository";
import { requireUserId } from "@/lib/session";
import { vacationInputSchema } from "@/lib/validation/vacation";

export type VacationActionResult =
  | { success: true }
  | { success: false; fieldErrors: Record<string, string[]> };

function revalidateVacationPaths() {
  revalidatePath("/");
  revalidatePath("/vacations");
}

export async function saveVacationAction(formData: FormData): Promise<VacationActionResult> {
  const userId = await requireUserId();
  const parsed = vacationInputSchema.safeParse({
    id: formData.get("id") || undefined,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  if (!parsed.success) return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };

  const { id, startDate, endDate } = parsed.data;
  try {
    if (id) {
      const overlaps = await checkOverlapVacations(userId, startDate, endDate, id);
      if (overlaps) {
        return {
          success: false,
          fieldErrors: { endDate: ["Даты пересекаются с существующим отпуском"] },
        };
      }
      const updated = await updateVacation(userId, id, startDate, endDate);
      if (!updated) {
        return { success: false, fieldErrors: { endDate: ["Отпуск не найден"] } };
      }
    } else {
      const overlaps = await checkOverlapVacations(userId, startDate, endDate);
      if (overlaps) {
        return {
          success: false,
          fieldErrors: { endDate: ["Даты пересекаются с существующим отпуском"] },
        };
      }
      await createVacation(userId, startDate, endDate);
    }
  } catch {
    return {
      success: false,
      fieldErrors: { startDate: ["Не удалось сохранить отпуск. Попробуйте ещё раз."] },
    };
  }
  revalidateVacationPaths();
  return { success: true };
}

export async function deleteVacationAction(vacationId: string): Promise<VacationActionResult> {
  const userId = await requireUserId();
  const parsed = z.string().uuid().safeParse(vacationId);
  if (!parsed.success) {
    return { success: false, fieldErrors: { startDate: ["Отпуск не найден"] } };
  }
  try {
    const result = await deleteVacationIfFuture(userId, parsed.data);
    if (result.status === "blocked") {
      return {
        success: false,
        fieldErrors: {
          startDate: ["Нельзя удалять отпуска из прошлого. Вы можете изменить даты."],
        },
      };
    }
    if (result.status === "not-found") {
      return { success: false, fieldErrors: { startDate: ["Отпуск не найден"] } };
    }
  } catch {
    return {
      success: false,
      fieldErrors: { startDate: ["Не удалось удалить отпуск. Попробуйте ещё раз."] },
    };
  }
  revalidateVacationPaths();
  return { success: true };
}
