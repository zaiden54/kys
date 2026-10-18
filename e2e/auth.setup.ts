import { test as setup } from "@playwright/test";
import { uniqueEmail } from "./fixtures";

// Registers one persistent fixture user through the real UI and saves its
// authenticated session to playwright/.auth/user.json, which the
// `authenticated` Playwright project (see playwright.config.ts) declares as
// its storageState — every later plan's bonus/vacation/pie-chart/pwa spec
// consumes this instead of re-implementing login.
//
// This file intentionally does NOT delete the created user in a
// finally/afterAll block: the account must remain valid for the whole test
// run since every dependent spec's storageState session references it.
// Local repeated runs accumulate one extra user per run — an accepted
// trade-off, since Plan 07-05's CI-isolated Neon branch makes this a
// non-issue there (the branch itself is thrown away after the run).
const AUTH_FILE = "playwright/.auth/user.json";

setup("authenticate", async ({ page }) => {
  const email = uniqueEmail("e2e-setup");
  const password = "correct-horse-battery-staple-1";

  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль").fill(password);
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();

  await page.waitForURL("/onboarding");

  const today = new Date().toISOString().slice(0, 10);
  await page.getByLabel("Оклад «грязными», ₽").fill("150000");
  await page.getByLabel("Дата вступления в силу").fill(today);
  await page.getByRole("button", { name: "Сохранить оклад" }).click();
  await page.getByText("Оклад сохранён.").waitFor();

  await page.getByLabel("День аванса (число месяца)").fill("20");
  await page.getByLabel("День зарплаты (число месяца)").fill("5");
  await page.getByRole("button", { name: "Сохранить график" }).click();
  await page.getByText("График сохранён.").waitFor();

  await page.getByRole("button", { name: "Пропустить" }).click();
  await page
    .getByText("Пропущено — доход с начала года считается нулевым до заполнения.")
    .waitFor();

  await page.context().storageState({ path: AUTH_FILE });
});
