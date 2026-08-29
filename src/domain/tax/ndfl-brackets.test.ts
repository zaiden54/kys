/**
 * Unit suite for src/domain/tax/ndfl-brackets.ts, covering only what
 * calculate-ndfl.test.ts does not already assert: the ordering-assertion
 * guard itself (WR-04), a sweep over every registered scale, and this
 * module's own import purity. `bracketsForYear`'s supported-year boundary
 * behavior (2025/2026 resolve, 2024/2027 throw) is already exercised in
 * calculate-ndfl.test.ts and is not duplicated here.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertStrictlyAscending, NDFL_SCALES, type NdflBracket } from "./ndfl-brackets";

function bracket(fromKopecks: number): NdflBracket {
  return { fromKopecks, rateBasisPoints: 1300, baseTaxKopecks: 0 };
}

describe("assertStrictlyAscending", () => {
  it("throws for a two-element array whose second fromKopecks is lower than the first", () => {
    expect(() => assertStrictlyAscending([bracket(100), bracket(50)])).toThrow();
  });

  it("throws for a two-element array whose two fromKopecks values are equal", () => {
    expect(() => assertStrictlyAscending([bracket(100), bracket(100)])).toThrow();
  });

  it("throws for a five-element array that is ascending except for one transposed pair in the middle, naming the offending index", () => {
    const brackets = [bracket(0), bracket(100), bracket(300), bracket(200), bracket(400)];
    expect(() => assertStrictlyAscending(brackets)).toThrow(/3/);
  });

  it("does not throw for a correctly ascending array", () => {
    expect(() => assertStrictlyAscending([bracket(0), bracket(100), bracket(200)])).not.toThrow();
  });

  it("does not throw for a single-element array", () => {
    expect(() => assertStrictlyAscending([bracket(0)])).not.toThrow();
  });

  it("does not throw for an empty array", () => {
    expect(() => assertStrictlyAscending([])).not.toThrow();
  });

  it("does not throw for any registered scale in NDFL_SCALES", () => {
    for (const brackets of Object.values(NDFL_SCALES)) {
      expect(() => assertStrictlyAscending(brackets)).not.toThrow();
    }
  });
});

describe("module purity", () => {
  it("imports nothing from @/lib, next, or react", () => {
    const source = readFileSync(new URL("./ndfl-brackets.ts", import.meta.url), "utf-8");
    expect(source).not.toMatch(/from\s+["'](@\/lib|next|react)/);
  });
});
