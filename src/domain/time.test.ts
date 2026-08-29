/**
 * Unit suite for src/domain/time.ts.
 *
 * Establishes this repo's first fake-timer convention: every test freezes
 * the clock via `vi.useFakeTimers()` + `vi.setSystemTime(...)` in
 * `beforeEach` and restores real timers in `afterEach`, so assertions are
 * deterministic regardless of when the suite actually runs.
 *
 * Frozen instants are chosen to pin the exact scenarios that motivated this
 * module: the 21:00-24:00 UTC gap window (Moscow is already "tomorrow"
 * while the host's UTC clock still reads "today"), the Dec31/Jan1 boundary
 * that mis-years the SAL-03 YTD baseline, and a no-disagreement control case
 * that proves the helper isn't blindly adding a day.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nowInMoscow, todayIsoInMoscow } from "./time";

describe("time (Moscow anchoring)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("todayIsoInMoscow: Dec31/Jan1 boundary — frozen at 2025-12-31T21:30:00Z (Moscow 2026-01-01 00:30) returns 2026-01-01", () => {
    vi.setSystemTime(new Date("2025-12-31T21:30:00Z"));
    expect(todayIsoInMoscow()).toBe("2026-01-01");
  });

  it("nowInMoscow: same frozen instant — local accessors read Moscow's wall clock, not the epoch value", () => {
    vi.setSystemTime(new Date("2025-12-31T21:30:00Z"));
    const now = nowInMoscow();
    expect(now.getFullYear()).toBe(2026);
    expect(now.getMonth()).toBe(0);
    expect(now.getDate()).toBe(1);
    expect(now.getHours()).toBe(0);
    expect(now.getMinutes()).toBe(30);
  });

  it("todayIsoInMoscow: mid-year gap window — frozen at 2026-06-15T22:15:00Z (Moscow 2026-06-16 01:15) returns 2026-06-16", () => {
    vi.setSystemTime(new Date("2026-06-15T22:15:00Z"));
    expect(todayIsoInMoscow()).toBe("2026-06-16");
  });

  it("todayIsoInMoscow: no-disagreement control — frozen at 2026-06-15T12:00:00Z (Moscow 15:00) returns 2026-06-15, proving the helper does not blindly add a day", () => {
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
    expect(todayIsoInMoscow()).toBe("2026-06-15");
  });

  it("applies the +3 offset unconditionally with no seasonal DST branch — frozen at 2026-03-08T00:30:00Z", () => {
    vi.setSystemTime(new Date("2026-03-08T00:30:00Z"));
    expect(todayIsoInMoscow()).toBe("2026-03-08");
    expect(nowInMoscow().getHours()).toBe(3);
  });

  it("todayIsoInMoscow: output shape is zero-padded yyyy-MM-dd, including single-digit month/day (January case)", () => {
    vi.setSystemTime(new Date("2026-01-05T10:00:00Z"));
    const result = todayIsoInMoscow();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result).toBe("2026-01-05");
  });

  it("src/domain/time.ts stays import-pure: no @/lib, next/, or react import", () => {
    const source = readFileSync(path.resolve(__dirname, "time.ts"), "utf-8");
    expect(source).not.toMatch(/from ["'](@\/lib|next\/|react)/);
  });
});
