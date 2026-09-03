// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AnnualPieChart } from "./annual-pie-chart";
import type { AnnualSummary } from "@/app/actions/annual-summary";

afterEach(cleanup);

function makeSummary(overrides: Partial<AnnualSummary> = {}): AnnualSummary {
  return {
    grossKopecks: 1_000_000_00,
    taxKopecks: 130_000_00,
    netKopecks: 870_000_00,
    baselineIsEstimated: false,
    ...overrides,
  };
}

describe("AnnualPieChart baseline-estimated note", () => {
  it("renders the estimated-baseline note when summary.baselineIsEstimated is true", () => {
    render(<AnnualPieChart summary={makeSummary({ baselineIsEstimated: true })} taxYear={2026} />);
    expect(
      screen.getByText("Примечание: начальное значение дохода — это ваша оценка."),
    ).not.toBeNull();
  });

  it("renders no estimated-baseline note when summary.baselineIsEstimated is false", () => {
    render(<AnnualPieChart summary={makeSummary({ baselineIsEstimated: false })} taxYear={2026} />);
    expect(
      screen.queryByText("Примечание: начальное значение дохода — это ваша оценка."),
    ).toBeNull();
  });
});

describe("AnnualPieChart zero-income empty state", () => {
  it("renders the empty-state heading and no <svg> when grossKopecks is 0", () => {
    const { container } = render(
      <AnnualPieChart
        summary={makeSummary({ grossKopecks: 0, taxKopecks: 0, netKopecks: 0 })}
        taxYear={2026}
      />,
    );
    expect(screen.getByText("Пока нет дохода в 2026 году")).not.toBeNull();
    expect(container.querySelectorAll("svg").length).toBe(0);
  });

  it("does not render the empty-state heading and renders the pie chart <svg> when grossKopecks is nonzero", () => {
    const { container } = render(<AnnualPieChart summary={makeSummary()} taxYear={2026} />);
    expect(screen.queryByText("Пока нет дохода в 2026 году")).toBeNull();
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
  });
});
