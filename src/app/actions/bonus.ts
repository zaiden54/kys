"use server";

/** Ownership-scoped bonus mutation actions. No submitted values are logged. */
import { revalidatePath } from "next/cache";
import { rublesToKopecks } from "@/domain/money";
import { createBonus } from "@/lib/db/bonus-repository";
import { requireUserId } from "@/lib/session";
import { bonusInputSchema } from "@/lib/validation/bonus";

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
    amountRubles: formData.get("amountRubles"),
    date: formData.get("date"),
    note: formData.get("note"),
  });
  if (!parsed.success) return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await createBonus(
      userId,
      rublesToKopecks(parsed.data.amountRubles),
      parsed.data.date,
      parsed.data.note,
    );
  } catch {
    return {
      success: false,
      fieldErrors: { amountRubles: ["Не удалось сохранить бонус. Попробуйте ещё раз."] },
    };
  }
  revalidateBonusPaths();
  return { success: true };
}
