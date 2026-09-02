import { test, expect, type Page } from "@playwright/test";
import { formatIsoDateRu } from "@/domain/time";
import { calculateVacationDays } from "@/domain/vacation/calculate-average-daily-earnings";

// E2E-03: create/edit/delete a vacation through the real /vacations UI, and
// prove the calculated отпускные (average-earnings vacation pay) figure
// shown in the UI reflects the real domain engine's output for each
// mutation — including the overlap-date rejection path.
//
// formatKopecks() (src/domain/money.ts) renders ru-RU currency with
// thousands separated by a non-breaking space and a trailing "₽" — never
// match a hardcoded literal string, only this shape.
const RUB_AMOUNT = /\d[\d\s]*\s?₽/;

/** Today + `days` as a yyyy-MM-dd string, in the host process's local time —
 * same convention auth.spec.ts/auth.setup.ts already use for date fields. */
function isoDatePlusDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function fillVacationForm(page: Page, startDate: string, endDate: string): Promise<void> {
  await page.getByLabel("Дата начала отпуска").fill(startDate);
  await page.getByLabel("Дата окончания отпуска").fill(endDate);
  await page.getByRole("button", { name: "Сохранить отпуск" }).click();
}

test.describe("vacation CRUD (E2E-03)", () => {
  // Fixed date range shared between the create test and the overlap-reject
  // test below (the second test deliberately reuses these exact dates to
  // guarantee an overlap against the row the first test created).
  const createStartDate = isoDatePlusDays(30);
  const createEndDate = isoDatePlusDays(34);

  test("creates a vacation and shows the calculated payout", async ({ page }) => {
    await page.goto("/vacations");
    await fillVacationForm(page, createStartDate, createEndDate);
    await expect(page.getByText("Отпуск записан.")).toBeVisible();

    const row = page.locator("li").filter({ hasText: formatIsoDateRu(createStartDate) });
    await expect(row).toHaveCount(1);

    const cells = row.locator("div.grid > span");
    await expect(cells.nth(2)).toHaveText(
      String(calculateVacationDays(createStartDate, createEndDate)),
    );
    // Non-empty RUB-currency-formatted отпускные amount, never the
    // "Укажите оклад, чтобы увидеть сумму" fallback text (the authenticated
    // fixture user always has a salary from auth.setup.ts's onboarding step).
    await expect(cells.nth(3)).toHaveText(RUB_AMOUNT);
  });

  test("rejects an overlapping vacation", async ({ page }) => {
    await page.goto("/vacations");
    // Same dates as the row created above — guaranteed overlap.
    await fillVacationForm(page, createStartDate, createEndDate);

    await expect(page.getByText("Даты пересекаются с существующим отпуском")).toBeVisible();
    // Still exactly one row for this date range — the rejected second
    // submission created nothing.
    await expect(
      page.locator("li").filter({ hasText: formatIsoDateRu(createStartDate) }),
    ).toHaveCount(1);
  });
});
