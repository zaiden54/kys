/**
 * Validation for the profile surface: display name, email, password, and
 * the avatar upload. Shared by the client forms and the avatar Server Action.
 */

import { z } from "zod";

export const MAX_NAME_LENGTH = 60;
/** Mirrors Better Auth's default minPasswordLength. */
export const MIN_PASSWORD_LENGTH = 8;
/** Mirrors Better Auth's default maxPasswordLength. */
export const MAX_PASSWORD_LENGTH = 128;

/** The browser re-encodes the photo to a 256 px square well under this. */
export const MAX_AVATAR_BYTES = 200 * 1024;
export const AVATAR_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AvatarContentType = (typeof AVATAR_CONTENT_TYPES)[number];

export const nameInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Введите имя")
    .max(MAX_NAME_LENGTH, `Имя должно быть не длиннее ${MAX_NAME_LENGTH} символов`),
});
export type NameInput = z.infer<typeof nameInputSchema>;

export const emailInputSchema = z.object({
  email: z.string().trim().toLowerCase().email("Введите корректный email"),
});
export type EmailInput = z.infer<typeof emailInputSchema>;

export const passwordInputSchema = z
  .object({
    currentPassword: z.string().min(1, "Введите текущий пароль"),
    newPassword: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`)
      .max(MAX_PASSWORD_LENGTH, `Пароль должен быть не длиннее ${MAX_PASSWORD_LENGTH} символов`),
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    message: "Новый пароль совпадает с текущим",
    path: ["newPassword"],
  });
export type PasswordInput = z.infer<typeof passwordInputSchema>;

export function isAvatarContentType(value: string): value is AvatarContentType {
  return (AVATAR_CONTENT_TYPES as readonly string[]).includes(value);
}

/**
 * Checks the declared type, the size, and the leading magic bytes, so a
 * renamed non-image never gets stored and later served as an image.
 */
export function validateAvatarBytes(
  contentType: string,
  bytes: Uint8Array,
): { ok: true; contentType: AvatarContentType } | { ok: false; error: string } {
  if (!isAvatarContentType(contentType)) {
    return { ok: false, error: "Поддерживаются только JPEG, PNG и WebP" };
  }
  if (bytes.length === 0) {
    return { ok: false, error: "Файл пустой" };
  }
  if (bytes.length > MAX_AVATAR_BYTES) {
    return { ok: false, error: "Файл слишком большой" };
  }
  const startsWith = (signature: number[], offset = 0) =>
    signature.every((byte, index) => bytes[offset + index] === byte);
  const matches =
    (contentType === "image/jpeg" && startsWith([0xff, 0xd8, 0xff])) ||
    (contentType === "image/png" && startsWith([0x89, 0x50, 0x4e, 0x47])) ||
    (contentType === "image/webp" &&
      startsWith([0x52, 0x49, 0x46, 0x46]) &&
      startsWith([0x57, 0x45, 0x42, 0x50], 8));
  if (!matches) {
    return { ok: false, error: "Файл не похож на изображение" };
  }
  return { ok: true, contentType };
}
