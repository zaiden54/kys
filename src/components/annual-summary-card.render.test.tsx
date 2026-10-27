// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AnnualSummaryCard } from "./annual-summary-card";
import type { AnnualSummary } from "@/app/actions/annual-summary";

afterEach(cleanup);

const base: AnnualSummary = {
  grossKopecks: 1_200_000_00,
  taxKopecks: 156_000_00,
  netKopecks: 1_044_000_00,
  earnedGrossKopecks: 1_000_000_00,
  upcomingGrossKopecks: 200_000_00,
  upcomingTaxKopecks: 26_000_00,
  upcomingNetKopecks: 174_000_00,
  baselineAsOfDate: "2026-10-28",
  baselineIsEstimated: false,
};

describe("AnnualSummaryCard", () => {
  it("shows earned-so-far separately from what is still ahead, plus whole-year totals", () => {
    render(<AnnualSummaryCard summary={base} taxYear={2026} />);

    expect(screen.getByText("Начислено по сегодня")).not.toBeNull();
    expect(screen.getByText("Ещё придёт на руки")).not.toBeNull();
    expect(screen.getByText("НДФЛ с будущих выплат")).not.toBeNull();
    expect(screen.getByText(/включает доход до 28 октября/)).not.toBeNull();

    for (const term of ["Грязными", "Налог", "На руки"]) {
      const dt = screen.getByText(term, { selector: "dt" });
      expect(dt.nextElementSibling?.tagName).toBe("DD");
    }
  });

  it("asks for the year-to-date income while the baseline is only an estimate", () => {
    render(<AnnualSummaryCard summary={{ ...base, baselineIsEstimated: true }} taxYear={2026} />);

    expect(screen.getByText(/Доход с начала года не указан/)).not.toBeNull();
    expect(screen.queryByText(/включает доход до/)).toBeNull();
  });

  it("renders the empty state instead of the breakdown when the year has no income", () => {
    render(
      <AnnualSummaryCard
        summary={{ ...base, grossKopecks: 0, taxKopecks: 0, netKopecks: 0, earnedGrossKopecks: 0 }}
        taxYear={2026}
      />,
    );

    expect(screen.getByText("Пока нет дохода в 2026 году")).not.toBeNull();
    expect(screen.queryByText("Начислено по сегодня")).toBeNull();
  });
});
