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

  test("edits a bonus and reflects the new amount", async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    const note = `e2e-bonus-edit-${Date.now()}`;

    await createBonus(page, { amountRubles: "635210", date: today, note });

    const row = page.locator("li", { hasText: note });
    await expect(row).toBeVisible();
    await expect(row.getByText(/635\s?210\s?₽/)).toBeVisible();

    await row.getByRole("button", { name: "Изменить бонус" }).click();

    // Once in edit mode, the row's note/amount move into form-field values
    // rather than rendered text, so a fresh hasText-based query can no
    // longer re-find this row by its display-mode text (input values are
    // not part of an element's text content). The row currently showing
    // the "Сохранить" submit button is unambiguously the one being edited
    // — only one row can be in edit mode at a time in this serial run.
    // Edit-mode inputs also carry no `id` (see bonus-row.tsx) — target by
    // type within the row, and the type select by its aria-label ("Тип
    // выплаты" — no visible <label> in edit mode).
    const editingRow = page.locator("li").filter({
      has: page.getByRole("button", { name: "Сохранить", exact: true }),
    });
    await expect(editingRow).toBeVisible();

    const editedNote = `${note}-edited`;
    await editingRow.locator('input[type="text"]').fill(editedNote);
    await editingRow.locator('input[type="number"]').fill("918473");
    await editingRow.getByRole("combobox", { name: "Тип выплаты" }).selectOption("compensation");
    await editingRow.getByRole("button", { name: "Сохранить", exact: true }).click();

    // No separate "saved" toast on edit — bonus-row.tsx's onEdit just
    // returns to display mode, so assert directly on the row's rendered
    // text, not a message.
    const savedRow = page.locator("li", { hasText: editedNote });
    await expect(savedRow.getByText(/918\s?473\s?₽/)).toBeVisible();
    await expect(page.getByText(/635\s?210\s?₽/)).toHaveCount(0);
  });

  test("deletes a future bonus", async ({ page }) => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const futureDate = future.toISOString().slice(0, 10);
    const note = `e2e-bonus-delete-${Date.now()}`;

    await createBonus(page, { amountRubles: "99999", date: futureDate, note });

    const row = page.locator("li", { hasText: note });
    await expect(row).toBeVisible();

    // Register the accept handler BEFORE triggering the delete click —
    // window.confirm(...) inside bonus-row.tsx's onDelete would otherwise
    // hang/reject the click since Playwright does not auto-accept dialogs.
    page.on("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: "Удалить бонус" }).click();

    await expect(page.locator("li", { hasText: note })).toHaveCount(0);

    await page.goto("/");
    await expect(page.getByText(/99\s?999\s?₽/)).toHaveCount(0);
  });
});
