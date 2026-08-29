/**
 * Integration suite proving the live-database check constraints
 * `salary_gross_amount_positive` and `ytd_amount_nonnegative` (WR-03) are
 * enforced by Postgres itself, not merely declared in TypeScript. Run
 * against the real database named by DATABASE_URL (same strategy as
 * src/lib/db/salary-repository.test.ts — no separate test DB / Neon branch
 * infrastructure for Phase 1).
 *
 * Every insert here goes directly through the Drizzle client, deliberately
 * bypassing every Zod schema in src/lib/validation/salary.ts — that bypass
 * is the whole point, since these constraints exist to protect against
 * future writers that never pass through a Server Action.
 *
 * No amount reaches a printed message: assertions check only that a write
 * rejects or resolves, per this codebase's no-logging-of-money convention.
 *
 * Isolation: each test creates its own throwaway `user` row with a random
 * id in `beforeEach` and deletes it (cascade) in `afterEach`.
 */

import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/db/auth-schema";
import { salaryHistory, ytdBaseline } from "@/lib/db/schema";

async function createThrowawayUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(user).values({
    id,
    name: "Test User",
    email: `schema-test-${id}@example.invalid`,
  });
  return id;
}

describe("schema check constraints", () => {
  let userId: string;

  beforeEach(async () => {
    userId = await createThrowawayUser();
  });

  afterEach(async () => {
    await db.delete(user).where(eq(user.id, userId));
  });

  describe("salary_gross_amount_positive", () => {
    it("rejects a negative gross", async () => {
      await expect(
        db.insert(salaryHistory).values({
          userId,
          grossAmountKopecks: -1,
          effectiveFrom: "2026-01-01",
        }),
      ).rejects.toBeTruthy();
    });

    it("rejects a zero gross", async () => {
      await expect(
        db.insert(salaryHistory).values({
          userId,
          grossAmountKopecks: 0,
          effectiveFrom: "2026-01-01",
        }),
      ).rejects.toBeTruthy();
    });

    it("accepts a gross of one kopeck", async () => {
      await expect(
        db.insert(salaryHistory).values({
          userId,
          grossAmountKopecks: 1,
          effectiveFrom: "2026-01-01",
        }),
      ).resolves.toBeTruthy();
    });
  });

  describe("ytd_amount_nonnegative", () => {
    it("rejects a negative amount", async () => {
      await expect(
        db.insert(ytdBaseline).values({
          userId,
          amountKopecks: -1,
          asOfDate: "2026-01-01",
          isEstimated: false,
        }),
      ).rejects.toBeTruthy();
    });

    it("accepts a zero amount, protecting D-11's skip path", async () => {
      await expect(
        db.insert(ytdBaseline).values({
          userId,
          amountKopecks: 0,
          asOfDate: "2026-01-01",
          isEstimated: true,
        }),
      ).resolves.toBeTruthy();
    });
  });
});
