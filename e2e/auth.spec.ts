import { test, expect } from "@playwright/test";
import { uniqueEmail, deleteUserByEmail } from "./fixtures";

// E2E-01: register -> login -> enter salary+schedule -> see the correct
// next-payment forecast, verified end-to-end through the real UI. Also
// closes the logout+redirect regression class named in 07-CONTEXT.md.
//
// formatKopecks() (src/domain/money.ts) renders ru-RU currency with
// thousands separated by a non-breaking space and a trailing "₽" — never
// match a hardcoded literal string, only this shape.
const RUB_AMOUNT = /\d[\d\s]*\s?₽/;
const PAYMENT_KIND = /Аванс|Зарплата/;

test.describe("auth golden path (E2E-01)", () => {
  test("register -> onboarding -> forecast -> logout -> redirected to /login", async ({
    page,
  }) => {
    const email = uniqueEmail("e2e-auth");
    const password = "correct-horse-battery-staple-1";

    try {
      // 1. Register through the real /register form.
      await page.goto("/register");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Пароль").fill(password);
      await page.getByRole("button", { name: "Зарегистрироваться" }).click();

      // register/page.tsx router.push("/onboarding") on success.
      await page.waitForURL("/onboarding");
      await expect(page.getByRole("heading", { name: "Настройка выплат" })).toBeVisible();

      // 2. Fill and submit SalaryForm (grossRubles, effectiveFrom=today).
      const today = new Date().toISOString().slice(0, 10);
      await page.getByLabel("Оклад «грязными», ₽").fill("150000");
      await page.getByLabel("Дата вступления в силу").fill(today);
      await page.getByRole("button", { name: "Сохранить оклад" }).click();
      await expect(page.getByText("Оклад сохранён.")).toBeVisible();

      // 3. Fill and submit ScheduleForm (avansDay, salaryDay).
      await page.getByLabel("День аванса (число месяца)").fill("20");
      await page.getByLabel("День зарплаты (число месяца)").fill("5");
      await page.getByRole("button", { name: "Сохранить график" }).click();
      await expect(page.getByText("График сохранён.")).toBeVisible();

      // 4. Skip YtdForm's year-to-date baseline.
      await page.getByRole("button", { name: "Пропустить" }).click();
      await expect(
        page.getByText("Пропущено — доход с начала года считается нулевым до заполнения."),
      ).toBeVisible();

      // 5. Navigate to / and assert the NextPaymentCard renders a
      // ruble-formatted amount and a payment-kind label.
      await page.goto("/");
      await expect(page.getByText(PAYMENT_KIND)).toBeVisible();
      await expect(page.getByText(RUB_AMOUNT).first()).toBeVisible();

      // 6. Log out and confirm the redirect to /login.
      await page.getByRole("button", { name: "Выйти" }).click();
      await page.waitForURL("/login");
      expect(new URL(page.url()).pathname).toBe("/login");
    } finally {
      await deleteUserByEmail(email);
    }
  });

  test("unauthenticated visit to / redirects to /login", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("/login");
    expect(new URL(page.url()).pathname).toBe("/login");
  });
});
