"use server";

/** Ownership-scoped bonus mutation actions. No submitted values are logged. */
import { revalidatePath } from "next/cache";
import { rublesToKopecks } from "@/domain/money";
import { createBonus, deleteBonusIfFuture, updateBonus } from "@/lib/db/bonus-repository";
import { requireUserId } from "@/lib/session";
import { bonusInputSchema } from "@/lib/validation/bonus";
import { z } from "zod";

export type BonusActionResult =
  | { success: true }
  | { success: false; fieldErrors: Record<string, string[]> };

function revalidateBonusPaths() {
  revalidatePath("/");
  revalidatePath("/bonuses");
}

export async function saveBonusAction(formData: FormData): Promise<BonusActionResult> {
  const userId = await requireUserId();
  const parsed = bonusInputSchema.safeParse({
    id: formData.get("id") || undefined,
    amountRubles: formData.get("amountRubles"),
    date: formData.get("date"),
    note: formData.get("note"),
  });
  if (!parsed.success) return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    const amountKopecks = rublesToKopecks(parsed.data.amountRubles);
    if (parsed.data.id) {
      const updated = await updateBonus(
        userId, parsed.data.id, amountKopecks, parsed.data.date, parsed.data.note,
      );
      if (!updated) {
        return { success: false, fieldErrors: { amountRubles: ["Бонус не найден"] } };
      }
    } else {
      await createBonus(userId, amountKopecks, parsed.data.date, parsed.data.note);
    }
  } catch {
    return {
      success: false,
      fieldErrors: { amountRubles: ["Не удалось сохранить бонус. Попробуйте ещё раз."] },
    };
  }
  revalidateBonusPaths();
  return { success: true };
}

export async function deleteBonusAction(bonusId: string): Promise<BonusActionResult> {
  const userId = await requireUserId();
  const parsed = z.string().uuid().safeParse(bonusId);
  if (!parsed.success) {
    return { success: false, fieldErrors: { date: ["Бонус не найден"] } };
  }
  try {
    const result = await deleteBonusIfFuture(userId, parsed.data);
    if (result.status === "blocked") {
      return {
        success: false,
        fieldErrors: { date: ["Нельзя удалять бонусы из прошлого. Вы можете изменить сумму."] },
      };
    }
    if (result.status === "not-found") {
      return { success: false, fieldErrors: { date: ["Бонус не найден"] } };
    }
  } catch {
    return {
      success: false,
      fieldErrors: { date: ["Не удалось удалить бонус. Попробуйте ещё раз."] },
    };
  }
  revalidateBonusPaths();
  return { success: true };
}
