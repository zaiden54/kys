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
