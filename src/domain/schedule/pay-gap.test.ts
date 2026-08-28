import { describe, expect, it } from "vitest";
import { MAX_PAY_GAP_DAYS, exceedsMaxPayGap, payGapDays } from "./pay-gap";

describe("MAX_PAY_GAP_DAYS", () => {
  it("is 15", () => {
    expect(MAX_PAY_GAP_DAYS).toBe(15);
  });
});

describe("payGapDays", () => {
  it("returns 15 for (20, 5), the balanced mid-month split", () => {
    expect(payGapDays(20, 5)).toBe(15);
  });

  it("returns 15 for (10, 25), the balanced mid-month split reversed", () => {
    expect(payGapDays(10, 25)).toBe(15);
  });

  it("returns 19 for (1, 20)", () => {
    expect(payGapDays(1, 20)).toBe(19);
  });

  it("returns 29 for (5, 6) — a one-day gap on one side means a 29-day gap on the other", () => {
    expect(payGapDays(5, 6)).toBe(29);
  });
});

describe("exceedsMaxPayGap", () => {
  it("does not exceed for (20, 5)", () => {
    expect(exceedsMaxPayGap(20, 5)).toBe(false);
  });

  it("does not exceed for (10, 25)", () => {
    expect(exceedsMaxPayGap(10, 25)).toBe(false);
  });

  it("exceeds for (1, 20)", () => {
    expect(exceedsMaxPayGap(1, 20)).toBe(true);
  });

  it("exceeds for (5, 6)", () => {
    expect(exceedsMaxPayGap(5, 6)).toBe(true);
  });

  it("is strictly greater-than: a gap exactly at the max does not exceed", () => {
    expect(exceedsMaxPayGap(20, 5)).toBe(false);
    expect(payGapDays(20, 5)).toBe(MAX_PAY_GAP_DAYS);
  });
});
