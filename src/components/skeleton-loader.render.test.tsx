// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { SkeletonLoader } from "./skeleton-loader";

afterEach(cleanup);

describe("SkeletonLoader", () => {
  it("renders exactly 2 top-level skeleton blocks for count=2 variant=bonus-row, each with 4 inner placeholder rects", () => {
    const { container } = render(<SkeletonLoader count={2} variant="bonus-row" />);

    const blocks = container.querySelectorAll(":scope > div > .skeleton-pulse");
    expect(blocks).toHaveLength(2);

    for (const block of blocks) {
      const innerRects = block.querySelectorAll(":scope > div > div");
      expect(innerRects).toHaveLength(4);
    }
  });

  it("renders exactly 1 skeleton block for count=1 variant=payment-card, shaped as 3 stacked placeholder rects", () => {
    const { container } = render(<SkeletonLoader count={1} variant="payment-card" />);

    const blocks = container.querySelectorAll(":scope > div > .skeleton-pulse");
    expect(blocks).toHaveLength(1);

    const innerRects = blocks[0].querySelectorAll(":scope > div > div");
    expect(innerRects).toHaveLength(3);
  });

  it("every rendered skeleton block carries the skeleton-pulse class", () => {
    const { container } = render(<SkeletonLoader count={3} variant="chart" />);

    const blocks = container.querySelectorAll(":scope > div > div");
    expect(blocks).toHaveLength(3);
    for (const block of blocks) {
      expect(block.classList.contains("skeleton-pulse")).toBe(true);
    }
  });
});
