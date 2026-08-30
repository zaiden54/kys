"use server";

/** Ownership-scoped vacation mutation actions. No submitted values are logged. */
import { revalidatePath } from "next/cache";
import { checkOverlapVacations, createVacation } from "@/lib/db/vacation-repository";
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

  const { startDate, endDate } = parsed.data;
  try {
    const overlaps = await checkOverlapVacations(userId, startDate, endDate);
    if (overlaps) {
      return {
        success: false,
        fieldErrors: { endDate: ["Даты пересекаются с существующим отпуском"] },
      };
    }
    await createVacation(userId, startDate, endDate);
  } catch {
    return {
      success: false,
      fieldErrors: { startDate: ["Не удалось сохранить отпуск. Попробуйте ещё раз."] },
    };
  }
  revalidateVacationPaths();
  return { success: true };
}
