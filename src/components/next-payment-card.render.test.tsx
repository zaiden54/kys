// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextPaymentCard } from "./next-payment-card";
import type { NextPaymentForecast } from "@/app/actions/forecast";

afterEach(cleanup);

describe("NextPaymentCard vacation disclosure", () => {
  it("always renders the exact simplified-calculation caption for a vacation-derived payment", () => {
    const forecast: NextPaymentForecast = {
      date: "2026-09-11",
      kind: "vacation",
      grossKopecks: 71_672_35,
      taxKopecks: 9_317_00,
      netKopecks: 62_355_35,
      baselineIsEstimated: false,
      vacationId: "vacation-1",
    };

    render(<NextPaymentCard forecast={forecast} />);

    expect(
      screen.getByText(
        "Расчёт не учитывает исключаемые периоды (больничный, прошлый отпуск и т.п.)",
      ),
    ).not.toBeNull();
  });
});
