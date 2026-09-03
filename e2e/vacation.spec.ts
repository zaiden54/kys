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

// This sandbox's network path to the Neon database occasionally adds several
// seconds of latency to a single Server Action round trip (observed on the
// shared `authenticated` project's setup step too) — generous beyond the
// default 5s so a real regression still fails fast, not so long it masks one.
const SUBMIT_TIMEOUT = 15_000;

/** Today + `days` as a yyyy-MM-dd string, in the host process's local time —
 * same convention auth.spec.ts/auth.setup.ts already use for date fields. */
function isoDatePlusDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Removes every non-digit character (₽, non-breaking spaces, etc.) from a
 * formatKopecks() output so two rendered amounts can be compared as numbers. */
function parseRubles(text: string): number {
  return Number(text.replace(/\D/g, ""));
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
    await expect(page.getByText("Отпуск записан.")).toBeVisible({ timeout: SUBMIT_TIMEOUT });

    const row = page.locator("main li").filter({ hasText: formatIsoDateRu(createStartDate) });
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

    await expect(page.getByText("Даты пересекаются с существующим отпуском")).toBeVisible({
      timeout: SUBMIT_TIMEOUT,
    });
    // Still exactly one row for this date range — the rejected second
    // submission created nothing.
    await expect(
      page.locator("main li").filter({ hasText: formatIsoDateRu(createStartDate) }),
    ).toHaveCount(1);
  });
});

test.describe("vacation edit and delete (E2E-03)", () => {
  test("edits a vacation's dates and updates the payout", async ({ page }) => {
    await page.goto("/vacations");
    const startDate = isoDatePlusDays(60);
    const initialEndDate = isoDatePlusDays(63);
    const extendedEndDate = isoDatePlusDays(66);

    await fillVacationForm(page, startDate, initialEndDate);
    await expect(page.getByText("Отпуск записан.")).toBeVisible({ timeout: SUBMIT_TIMEOUT });

    // listVacations orders by startDate desc, so the vacation just created
    // (the largest startDate so far in this run) is always the first <li>
    // within the vacation history list. Scoped to `main` since the
    // sidebar/mobile-header navigation also renders <li> nav items earlier
    // in the DOM, which an unscoped `li` locator would otherwise match.
    const row = page.locator("main li").first();
    await expect(row).toContainText(formatIsoDateRu(startDate));

    const initialAmountText = await row.locator("div.grid > span").nth(3).innerText();
    const initialDayCount = calculateVacationDays(startDate, initialEndDate);
    await expect(row.locator("div.grid > span").nth(2)).toHaveText(String(initialDayCount));

    await row.getByRole("button", { name: "Изменить отпуск" }).click();
    // Edit-mode inputs carry no id/label (only the create form's inputs
    // do) — scope to this row's two date inputs by position so the
    // create form's identically-named startDate/endDate fields are never
    // accidentally targeted.
    const dateInputs = row.locator('input[type="date"]');
    await dateInputs.nth(1).fill(extendedEndDate);
    await row.getByRole("button", { name: "Сохранить" }).click();

    const expectedDayCount = calculateVacationDays(startDate, extendedEndDate);
    expect(expectedDayCount).toBeGreaterThan(initialDayCount);
    await expect(row.locator("div.grid > span").nth(2)).toHaveText(String(expectedDayCount), {
      timeout: SUBMIT_TIMEOUT,
    });

    const updatedAmountText = await row.locator("div.grid > span").nth(3).innerText();
    expect(updatedAmountText).toMatch(RUB_AMOUNT);
    expect(parseRubles(updatedAmountText)).toBeGreaterThan(parseRubles(initialAmountText));
  });

  test("deletes a future vacation", async ({ page }) => {
    await page.goto("/vacations");
    const startDate = isoDatePlusDays(90);
    const endDate = isoDatePlusDays(93);

    await fillVacationForm(page, startDate, endDate);
    await expect(page.getByText("Отпуск записан.")).toBeVisible({ timeout: SUBMIT_TIMEOUT });

    const row = page.locator("main li").first();
    await expect(row).toContainText(formatIsoDateRu(startDate));

    // Register the dialog-accept handler BEFORE triggering the delete
    // click — vacation-row.tsx's onDelete calls a synchronous
    // window.confirm(...) that Playwright never auto-accepts.
    page.on("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: "Удалить отпуск" }).click();

    await expect(
      page.locator("main li").filter({ hasText: formatIsoDateRu(startDate) }),
    ).toHaveCount(0, { timeout: SUBMIT_TIMEOUT });
  });
});
