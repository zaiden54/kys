// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import AppError from "./error";

afterEach(cleanup);

describe("AppError", () => {
  it("renders the heading and body, and clicking the retry button calls reset exactly once", () => {
    const resetMock = vi.fn();
    render(<AppError error={new Error("boom")} reset={resetMock} />);

    expect(screen.getByText("Ошибка при загрузке сводки")).not.toBeNull();
    expect(screen.getByText("Попробуйте ещё раз")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(resetMock).toHaveBeenCalledTimes(1);
  });
});
