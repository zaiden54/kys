"use server";

/**
 * Server Actions for the profile photo. They store the bytes in user_avatar
 * and return the short URL the client then writes into Better Auth's
 * `user.image` via `authClient.updateUser` — that call goes through the auth
 * route handler, which also refreshes the session cookie cache.
 */

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/session";
import { deleteAvatar, upsertAvatar } from "@/lib/db/avatar-repository";
import { validateAvatarBytes } from "@/lib/validation/profile";

export type AvatarActionResult =
  | { success: true; imageUrl: string }
  | { success: false; error: string };

export async function uploadAvatarAction(formData: FormData): Promise<AvatarActionResult> {
  const userId = await requireUserId();

  const file = formData.get("avatar");
  if (!(file instanceof Blob)) {
    return { success: false, error: "Выберите изображение" };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const validation = validateAvatarBytes(file.type, bytes);
  if (!validation.ok) {
    return { success: false, error: validation.error };
  }

  try {
    const row = await upsertAvatar(userId, validation.contentType, Buffer.from(bytes).toString("base64"));
    revalidatePath("/", "layout");
    return { success: true, imageUrl: `/api/avatar?v=${row.updatedAt.getTime()}` };
  } catch {
    return { success: false, error: "Не удалось сохранить фото. Попробуйте ещё раз." };
  }
}

export async function removeAvatarAction(): Promise<{ success: true }> {
  const userId = await requireUserId();
  await deleteAvatar(userId);
  revalidatePath("/", "layout");
  return { success: true };
}
