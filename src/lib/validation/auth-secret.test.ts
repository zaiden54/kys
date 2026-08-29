import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  AUTH_SECRET_MIN_LENGTH,
  betterAuthSecretSchema,
  isPlaceholderSecret,
} from "@/lib/validation/auth-secret";

/** The exact value previously shipped in .env.example — must always be rejected. */
const SHIPPED_TEMPLATE_VALUE = "generate-with-openssl-rand-base64-32";

/** A realistic secret shaped like `openssl rand -base64 32`'s output. */
function generateRealisticSecret(): string {
  return randomBytes(32).toString("base64");
}

/** A candidate that is long and diverse enough to isolate the length rule alone. */
const thirtyOneDiverseChars = generateRealisticSecret().slice(0, 31);

const rejectedCases: Array<[label: string, value: string]> = [
  ["empty string", ""],
  ["31-character string (one short of the minimum)", thirtyOneDiverseChars],
  ["the exact value previously shipped in .env.example", SHIPPED_TEMPLATE_VALUE],
  ["a change-me marker", "please-change-me-before-you-deploy-this-app-12345"],
  ["a your-secret marker", "insert-your-secret-value-right-here-1234567890123"],
  ["a placeholder marker", "this-is-just-a-placeholder-value-1234567890123456"],
  ["a replace-me marker", "replace-me-with-a-real-generated-secret-1234567890"],
  ["an example-secret marker", "this-is-an-example-secret-not-a-real-one-123456789"],
  ["a secret-here marker", "put-your-secret-here-before-starting-the-app-12345"],
  ["a dummy-secret marker", "this-dummy-secret-is-only-for-local-testing-123456"],
  ["a test-secret marker", "this-test-secret-should-never-reach-production-123"],
  ["an insert-secret marker", "insert-secret-value-into-this-field-before-boot-12"],
  ["a generate-with marker", "generate-with-a-real-random-value-before-deploying"],
  ["the generation tool's own name", "run-openssl-to-produce-a-real-secret-before-deploy"],
  [
    "a long string built from fewer than eight distinct characters",
    "ab".repeat(20),
  ],
];

describe("betterAuthSecretSchema", () => {
  it.each(rejectedCases)("rejects %s", (_label, value) => {
    const result = betterAuthSecretSchema.safeParse(value);
    expect(result.success).toBe(false);
  });

  it.each(rejectedCases)(
    "never echoes the candidate value when rejecting %s",
    (_label, value) => {
      const result = betterAuthSecretSchema.safeParse(value);
      expect(result.success).toBe(false);
      if (!result.success) {
        const serialized = JSON.stringify(result.error.issues);
        if (value.length > 0) {
          expect(serialized).not.toContain(value);
        }
      }
    },
  );

  it.each([generateRealisticSecret(), generateRealisticSecret(), generateRealisticSecret()])(
    "accepts a genuinely generated 32-byte base64 secret (sample %#)",
    (secret) => {
      expect(betterAuthSecretSchema.safeParse(secret).success).toBe(true);
    },
  );

  it("accepts a secret at exactly the minimum length made of diverse characters", () => {
    const minimumLengthSecret = generateRealisticSecret().slice(0, AUTH_SECRET_MIN_LENGTH);
    expect(minimumLengthSecret).toHaveLength(AUTH_SECRET_MIN_LENGTH);
    // Guard against the astronomically unlikely case the slice itself is low-entropy.
    expect(new Set(minimumLengthSecret).size).toBeGreaterThanOrEqual(8);
    expect(betterAuthSecretSchema.safeParse(minimumLengthSecret).success).toBe(true);
  });
});

describe("isPlaceholderSecret", () => {
  it("flags the exact shipped template value", () => {
    expect(isPlaceholderSecret(SHIPPED_TEMPLATE_VALUE)).toBe(true);
  });

  it.each(rejectedCases.filter(([label]) => !label.includes("31-character")))(
    "flags %s as a placeholder or low-entropy string",
    (_label, value) => {
      // Every rejected case above is either a placeholder marker or a
      // repeated-character run; this cross-checks the predicate directly
      // rather than only through the composed schema.
      const isDistinctFloorCase = new Set(value).size < 8 && value.length >= AUTH_SECRET_MIN_LENGTH;
      expect(isPlaceholderSecret(value) || isDistinctFloorCase || value.length < AUTH_SECRET_MIN_LENGTH).toBe(
        true,
      );
    },
  );

  it("does not flag a genuinely generated secret", () => {
    expect(isPlaceholderSecret(generateRealisticSecret())).toBe(false);
  });
});
