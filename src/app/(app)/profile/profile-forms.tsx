"use client";

/**
 * Account forms for the profile page: photo, display name, email, password.
 *
 * Name, email and password go straight through `authClient` (the Better Auth
 * route handler), which keeps the signed session cookie cache in step. The
 * photo bytes go through `uploadAvatarAction`; only the short URL it returns
 * is written to `user.image`.
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@/lib/auth-client";
import { UserAvatar } from "@/components/user-avatar";
import { removeAvatarAction, uploadAvatarAction } from "@/app/actions/avatar";
import {
  emailInputSchema,
  nameInputSchema,
  passwordInputSchema,
  MAX_NAME_LENGTH,
  type EmailInput,
  type NameInput,
  type PasswordInput,
} from "@/lib/validation/profile";

const CARD =
  "flex flex-col gap-3 rounded-[12px] border border-[color:var(--color-tertiary-surface)] bg-[color:var(--color-secondary)] p-5";
const HEADING =
  "text-[length:var(--font-size-heading)] font-[number:var(--font-weight-heading)] text-[color:var(--color-text-primary)]";
const LABEL =
  "text-[length:var(--font-size-label)] font-[number:var(--font-weight-label)] text-[color:var(--color-text-primary)]";
const INPUT =
  "rounded-[8px] border border-[color:var(--color-tertiary-surface)] bg-[color:var(--color-dominant)] px-3 py-2 text-[color:var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]";
const PRIMARY_BUTTON =
  "rounded-[8px] bg-[color:var(--color-accent-button)] px-4 py-2 text-white font-semibold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]";
const SECONDARY_BUTTON =
  "rounded-[8px] border border-[color:var(--color-tertiary-surface)] px-4 py-2 text-[color:var(--color-text-primary)] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]";
const ERROR = "text-sm text-[color:var(--color-destructive)]";
const SUCCESS = "text-sm text-[color:var(--color-accent)]";

/** Better Auth answers in English; the codes the profile can hit, in Russian. */
const AUTH_ERRORS: Record<string, string> = {
  INVALID_PASSWORD: "Неверный текущий пароль",
  PASSWORD_TOO_SHORT: "Пароль слишком короткий",
  PASSWORD_TOO_LONG: "Пароль слишком длинный",
  CREDENTIAL_ACCOUNT_NOT_FOUND: "У аккаунта нет пароля",
  SESSION_NOT_FRESH: "Войдите заново, чтобы изменить эти данные",
};

function authErrorMessage(error: { code?: string } | null | undefined, fallback: string): string {
  return (error?.code && AUTH_ERRORS[error.code]) || fallback;
}

// ---------------------------------------------------------------------------
// AvatarForm
// ---------------------------------------------------------------------------

const AVATAR_SIZE = 256;

/** Center-crops the photo to a square and re-encodes it as a 256 px JPEG. */
async function downscaleToAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas 2d context unavailable");
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE,
    );
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))), "image/jpeg", 0.85),
    );
  } finally {
    bitmap.close();
  }
}

export function AvatarForm({ name, image }: { name: string; image: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setBusy("upload");
    try {
      let blob: Blob;
      try {
        blob = await downscaleToAvatar(file);
      } catch {
        setError("Не удалось прочитать изображение. Попробуйте другой файл.");
        return;
      }
      const formData = new FormData();
      formData.set("avatar", blob, "avatar.jpg");
      const result = await uploadAvatarAction(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      const { error: authError } = await authClient.updateUser({ image: result.imageUrl });
      if (authError) {
        setError("Не удалось сохранить фото. Попробуйте ещё раз.");
        return;
      }
      router.refresh();
    } catch {
      setError("Не удалось сохранить фото. Попробуйте ещё раз.");
    } finally {
      setBusy(null);
    }
  }

  async function onRemove() {
    setError(null);
    setBusy("remove");
    try {
      await removeAvatarAction();
      await authClient.updateUser({ image: null });
      router.refresh();
    } catch {
      setError("Не удалось удалить фото. Попробуйте ещё раз.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={CARD} aria-labelledby="avatar-heading">
      <h2 id="avatar-heading" className={HEADING}>
        Фото
      </h2>
      <div className="flex items-center gap-4">
        <UserAvatar name={name} image={image} size={72} />
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            id="avatar"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={onFileChange}
            aria-label="Выбрать фото"
          />
          <button
            type="button"
            className={PRIMARY_BUTTON}
            disabled={busy !== null}
            onClick={() => inputRef.current?.click()}
          >
            {busy === "upload" ? "Загружаем…" : image ? "Сменить фото" : "Загрузить фото"}
          </button>
          {image && (
            <button type="button" className={SECONDARY_BUTTON} disabled={busy !== null} onClick={onRemove}>
              {busy === "remove" ? "Удаляем…" : "Удалить"}
            </button>
          )}
        </div>
      </div>
      {error && <p className={ERROR}>{error}</p>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// NameForm
// ---------------------------------------------------------------------------

export function NameForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NameInput>({
    resolver: zodResolver(nameInputSchema),
    defaultValues: { name: defaultName },
  });
  const [message, setMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(values: NameInput) {
    setMessage(null);
    setServerError(null);
    const { error } = await authClient.updateUser({ name: values.name });
    if (error) {
      setServerError(authErrorMessage(error, "Не удалось сохранить имя. Попробуйте ещё раз."));
      return;
    }
    setMessage("Имя сохранено.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={CARD} noValidate>
      <h2 className={HEADING}>Имя</h2>
      <div className="flex flex-col gap-[var(--spacing-sm)]">
        <label htmlFor="name" className={LABEL}>
          Как к вам обращаться
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          maxLength={MAX_NAME_LENGTH}
          className={INPUT}
          {...register("name")}
        />
        {errors.name && <p className={ERROR}>{errors.name.message}</p>}
      </div>
      {serverError && <p className={ERROR}>{serverError}</p>}
      {message && <p className={SUCCESS}>{message}</p>}
      <button type="submit" disabled={isSubmitting} className={PRIMARY_BUTTON}>
        {isSubmitting ? "Сохраняем…" : "Сохранить имя"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// EmailForm
// ---------------------------------------------------------------------------

export function EmailForm({ defaultEmail }: { defaultEmail: string }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailInput>({
    resolver: zodResolver(emailInputSchema),
    defaultValues: { email: defaultEmail },
  });
  const [message, setMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(values: EmailInput) {
    setMessage(null);
    setServerError(null);
    const { error } = await authClient.changeEmail({ newEmail: values.email });
    if (error) {
      setServerError(
        error.message === "Email is the same"
          ? "Это ваш текущий адрес."
          : authErrorMessage(error, "Не удалось изменить почту. Попробуйте ещё раз."),
      );
      return;
    }
    // A taken address also answers "ok" without changing anything, so read
    // the user back to tell the two outcomes apart.
    const { data } = await authClient.getSession({ query: { disableCookieCache: true } });
    if (data?.user.email !== values.email) {
      setServerError("Этот адрес нельзя использовать — возможно, он уже занят.");
      return;
    }
    setMessage("Почта изменена. Используйте новый адрес для входа.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={CARD} noValidate>
      <h2 className={HEADING}>Почта</h2>
      <div className="flex flex-col gap-[var(--spacing-sm)]">
        <label htmlFor="email" className={LABEL}>
          Email для входа
        </label>
        <input id="email" type="email" autoComplete="email" className={INPUT} {...register("email")} />
        {errors.email && <p className={ERROR}>{errors.email.message}</p>}
      </div>
      {serverError && <p className={ERROR}>{serverError}</p>}
      {message && <p className={SUCCESS}>{message}</p>}
      <button type="submit" disabled={isSubmitting} className={PRIMARY_BUTTON}>
        {isSubmitting ? "Сохраняем…" : "Изменить почту"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// PasswordForm
// ---------------------------------------------------------------------------

export function PasswordForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordInput>({
    resolver: zodResolver(passwordInputSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const [message, setMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(values: PasswordInput) {
    setMessage(null);
    setServerError(null);
    const { error } = await authClient.changePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
      revokeOtherSessions: true,
    });
    if (error) {
      setServerError(authErrorMessage(error, "Не удалось изменить пароль. Попробуйте ещё раз."));
      return;
    }
    reset();
    setMessage("Пароль изменён. На других устройствах нужно будет войти заново.");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={CARD} noValidate>
      <h2 className={HEADING}>Пароль</h2>
      <div className="flex flex-col gap-[var(--spacing-sm)]">
        <label htmlFor="currentPassword" className={LABEL}>
          Текущий пароль
        </label>
        <input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          className={INPUT}
          {...register("currentPassword")}
        />
        {errors.currentPassword && <p className={ERROR}>{errors.currentPassword.message}</p>}
      </div>
      <div className="flex flex-col gap-[var(--spacing-sm)]">
        <label htmlFor="newPassword" className={LABEL}>
          Новый пароль
        </label>
        <input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          className={INPUT}
          {...register("newPassword")}
        />
        {errors.newPassword && <p className={ERROR}>{errors.newPassword.message}</p>}
      </div>
      <div className="flex flex-col gap-[var(--spacing-sm)]">
        <label htmlFor="confirmPassword" className={LABEL}>
          Повторите новый пароль
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          className={INPUT}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && <p className={ERROR}>{errors.confirmPassword.message}</p>}
      </div>
      {serverError && <p className={ERROR}>{serverError}</p>}
      {message && <p className={SUCCESS}>{message}</p>}
      <button type="submit" disabled={isSubmitting} className={PRIMARY_BUTTON}>
        {isSubmitting ? "Сохраняем…" : "Изменить пароль"}
      </button>
    </form>
  );
}
