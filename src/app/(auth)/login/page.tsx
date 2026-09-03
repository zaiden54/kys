"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { useIsStandalone } from "@/lib/use-standalone";

// D-05: email + password only. D-08: no password-reset affordance.
const loginSchema = z.object({
  email: z.string().email("Введите корректный email"),
  password: z.string().min(1, "Введите пароль"),
});

type LoginInput = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const isStandalone = useIsStandalone();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    try {
      const { error } = await authClient.signIn.email({
        email: values.email,
        password: values.password,
      });
      if (error) {
        setFormError("Неверный email или пароль");
        return;
      }
    } catch {
      setFormError("Не удалось войти. Проверьте соединение и попробуйте снова.");
      return;
    }
    // G-04-2: refresh before push so (app)/layout.tsx's server-side
    // getSessionUser() reads the just-set session cookie fresh, instead of
    // soft-navigating against stale pre-auth Server Component data.
    router.refresh();
    router.push("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-[length:var(--font-size-display)] font-[number:var(--font-weight-display)] text-[color:var(--color-text-primary)]">
        Вход
      </h1>
      {isStandalone && (
        <div className="rounded-[8px] border border-[color:var(--color-tertiary-surface)] bg-[color:var(--color-secondary)] p-3 text-sm text-[color:var(--color-text-primary)]">
          <p>Похоже, это первый запуск с домашнего экрана — войдите ещё раз.</p>
          <p className="mt-1">
            Это нормально: приложение использует отдельное хранилище от браузера.
          </p>
        </div>
      )}
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
            autoComplete="current-password"
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
          {isSubmitting ? "Входим…" : "Войти"}
        </button>
      </form>
      <p className="text-sm text-[color:var(--color-text-secondary)]">
        Нет аккаунта?{" "}
        <Link
          href="/register"
          className="text-[color:var(--color-accent)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)]"
        >
          Зарегистрироваться
        </Link>
      </p>
    </main>
  );
}
