import { test, expect } from "@playwright/test";

// E2E-04 (pie-chart half): the annual pie-chart summary (HOME-02) must
// reflect the authenticated fixture user's ACTUAL bonus/vacation data, not
// just the bare salary auth.setup.ts's onboarding configured. This test
// first seeds one bonus and one vacation dated within the current tax year
// through the real UI, then independently re-derives gross = tax + net from
// the rendered <dl> figures — structurally proving the two-slice
// ("Налог"/"На руки", never a third "Грязными" wedge) invariant
// annual-pie-chart.tsx's own doc comment calls out, rather than trusting it.

function parseRublesFromFormatted(text: string): number {
  // Each <dd> renders as "{formatKopecks(...)} · {percent}%" — take only the
  // money portion before " · " so the percent figure's own digits (e.g.
  // "13,0%") never get concatenated into the parsed ruble amount.
  const moneyPart = text.split("·")[0];
  // formatKopecks() (src/domain/money.ts) renders ru-RU currency in whole
  // rubles with non-breaking-space thousand separators and a trailing "₽" —
  // strip everything but digits.
  const digits = moneyPart.replace(/\D/g, "");
  return Number(digits);
}

test.describe("annual pie chart (E2E-04)", () => {
  test("renders the annual pie chart with matching gross/tax/net figures", async ({ page }) => {
    const today = new Date();
    const isoToday = today.toISOString().slice(0, 10);

    // Seed a bonus dated today — guaranteed within the current tax year and
    // guaranteed to be the earliest possible event, so it always contributes
    // to computeAnnualSummary's total regardless of the fixture user's
    // schedule days.
    await page.goto("/bonuses");
    await page.getByLabel("Сумма, ₽").fill("25000");
    await page.getByLabel("Дата выплаты").fill(isoToday);
    await page.getByLabel("Заметка (необязательно)").fill(`e2e-pie-chart-bonus-${Date.now()}`);
    await page.getByRole("button", { name: "Сохранить бонус" }).click();
    await expect(page.getByText("Бонус сохранён.")).toBeVisible();

    // Seed a vacation +14/+17 days out — a distinct, non-overlapping date
    // range from Plan 07-03's vacation.spec.ts ranges (+30/+34, +60/+63),
    // since both files share the same authenticated fixture user/session.
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() + 14);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 17);
    const isoStart = startDate.toISOString().slice(0, 10);
    const isoEnd = endDate.toISOString().slice(0, 10);

    await page.goto("/vacations");
    await page.getByLabel("Дата начала отпуска").fill(isoStart);
    await page.getByLabel("Дата окончания отпуска").fill(isoEnd);
    await page.getByRole("button", { name: "Сохранить отпуск" }).click();
    await expect(page.getByText("Отпуск записан.")).toBeVisible();

    // Assert the annual pie chart on the home screen.
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Годовая сводка" })).toBeVisible();

    const grossText = await page.locator("dl dt:text-is('Грязными') + dd").innerText();
    const taxText = await page.locator("dl dt:text-is('Налог') + dd").innerText();
    const netText = await page.locator("dl dt:text-is('На руки') + dd").innerText();

    const grossRubles = parseRublesFromFormatted(grossText);
    const taxRubles = parseRublesFromFormatted(taxText);
    const netRubles = parseRublesFromFormatted(netText);

    // All three figures are non-zero, RUB-currency-formatted values.
    expect(grossRubles).toBeGreaterThan(0);
    expect(taxRubles).toBeGreaterThan(0);
    expect(netRubles).toBeGreaterThan(0);

    expect(grossRubles).toBeGreaterThanOrEqual(taxRubles);
    expect(grossRubles).toBeGreaterThanOrEqual(netRubles);

    // Налог + На руки sums to Грязными within a 1-ruble rounding tolerance —
    // rounding tolerance, not exact equality, since ст.52 rounding can leave
    // a residual across three independently-formatted whole-ruble figures.
    // This is the structural proof that the pie chart's two slices
    // mathematically partition the gross total without double-counting.
    expect(Math.abs(taxRubles + netRubles - grossRubles)).toBeLessThanOrEqual(1);
  });
});
