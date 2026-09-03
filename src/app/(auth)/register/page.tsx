"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

// D-05: email + password only. D-06: no email-verification interstitial.
const registerSchema = z.object({
  email: z.string().email("Введите корректный email"),
  password: z.string().min(8, "Пароль должен быть не короче 8 символов"),
});

type RegisterInput = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(values: RegisterInput) {
    setFormError(null);
    const { error } = await authClient.signUp.email({
      email: values.email,
      password: values.password,
      // No separate "name" field in the product — derive it from the email
      // local-part per the plan.
      name: values.email.split("@")[0],
    });
    if (error) {
      setFormError(error.message ?? "Не удалось зарегистрироваться");
      return;
    }
    // G-04-2: refresh before push so (app)/layout.tsx's server-side
    // getSessionUser() reads the just-set session cookie fresh, instead of
    // soft-navigating against stale pre-auth Server Component data.
    router.refresh();
    // D-09: land on /onboarding so the year-to-date question is presented
    // at signup, unconditionally of signup month.
    router.push("/onboarding");
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-16">
      <h1 className="font-[family-name:var(--font-family-display)] text-[length:var(--font-size-display)] font-[number:var(--font-weight-display)] text-[color:var(--color-text-primary)]">
        Регистрация
      </h1>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="email"
            className="text-[length:var(--font-size-label)] font-[number:var(--font-weight-label)] text-[color:var(--color-text-primary)]"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="rounded-[8px] border border-[color:var(--color-tertiary-surface)] bg-[color:var(--color-dominant)] px-3 py-2 text-[color:var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-sm text-[color:var(--color-destructive)]">{errors.email.message}</p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="password"
            className="text-[length:var(--font-size-label)] font-[number:var(--font-weight-label)] text-[color:var(--color-text-primary)]"
          >
            Пароль
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            className="rounded-[8px] border border-[color:var(--color-tertiary-surface)] bg-[color:var(--color-dominant)] px-3 py-2 text-[color:var(--color-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-sm text-[color:var(--color-destructive)]">{errors.password.message}</p>
          )}
        </div>
        {formError && <p className="text-sm text-[color:var(--color-destructive)]">{formError}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-[8px] bg-[color:var(--color-accent-button)] px-4 py-2 text-white font-semibold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
        >
          {isSubmitting ? "Создаём аккаунт…" : "Зарегистрироваться"}
        </button>
      </form>
      <p className="text-sm text-[color:var(--color-text-secondary)]">
        Уже есть аккаунт?{" "}
        <Link
          href="/login"
          className="text-[color:var(--color-accent)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
        >
          Войти
        </Link>
      </p>
    </main>
  );
}
