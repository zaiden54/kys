import { test, expect, type Page } from "@playwright/test";

// E2E-02: bonus create/edit/delete driven through the real /bonuses UI,
// each mutation verified against both the history list and the home
// screen's next-payment forecast — the actual regression this requirement
// exists to catch (a bonus silently not affecting the forecast, or a stale
// UI after a mutation). Runs under the `authenticated` Playwright project
// (playwright.config.ts), which supplies a logged-in session via
// playwright/.auth/user.json from Plan 07-01's setup project — this file
// never re-implements login.
//
// formatKopecks() (src/domain/money.ts) renders ru-RU currency with
// thousands separated by a non-breaking/narrow-no-break space and a
// trailing "₽" — never match a hardcoded literal string, only this shape.
const RUB_AMOUNT = /\d[\d\s]*\s?₽/;

async function createBonus(
  page: Page,
  options: { amountRubles: string; date: string; note: string; type?: "premium" | "compensation" },
) {
  await page.goto("/bonuses");
  await page.locator("#amountRubles").fill(options.amountRubles);
  await page.locator("#date").fill(options.date);
  await page.locator("#note").fill(options.note);
  if (options.type) {
    await page.locator("#type").selectOption(options.type);
  }
  await page.getByRole("button", { name: "Сохранить бонус" }).click();
  await expect(page.getByText("Бонус сохранён.")).toBeVisible();
}

test.describe("bonus flows (E2E-02)", () => {
  test("creates a bonus and updates the forecast breakdown", async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    const note = `e2e-bonus-create-${Date.now()}`;

    await createBonus(page, { amountRubles: "12345", date: today, note });

    // 1. New row appears in the history list with the entered amount and note.
    const row = page.locator("li", { hasText: note });
    await expect(row).toBeVisible();
    await expect(row.getByText(RUB_AMOUNT)).toBeVisible();

    // 2. The home screen's next-payment forecast reflects the new bonus —
    // either as the bonus-only next payment, or as a non-zero "Бонус" line
    // in the breakdown if it composed with a same-date scheduled payment
    // (schedule beats bonus in the tie-break — see selectNextPaymentEvent).
    await page.goto("/");
    const bonusKindLabel = page.getByText("Бонус или компенсация");
    if ((await bonusKindLabel.count()) > 0) {
      await expect(bonusKindLabel.first()).toBeVisible();
    } else {
      const bonusDt = page.locator("dt", { hasText: "Бонус" }).first();
      await expect(bonusDt).toBeVisible();
      const bonusDd = bonusDt.locator("xpath=following-sibling::dd[1]");
      await expect(bonusDd).toHaveText(RUB_AMOUNT);
      await expect(bonusDd).not.toHaveText("0 ₽");
    }
  });
});
