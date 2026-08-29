/**
 * Pure authentication-secret schema (AUTH-01). No environment access of its
 * own — `src/env.ts` imports and composes this schema into the boot-time
 * environment parser. Keeping it in its own module lets its rules be
 * exercised directly by a test without a fully populated environment (see
 * `vitest.config.ts`'s note on why DB-backed tests load `.env.local` but
 * pure-domain tests do not need to).
 *
 * Every message names the variable and states the remedy; the candidate
 * value itself is never echoed into a message (T-01-12-05: no secret value,
 * or prefix of one, may reach a validation error, a log line, or a test
 * failure output).
 */

import { z } from "zod";

/** Better Auth's own floor. Named rather than a bare literal so the intent reads at call sites. */
export const AUTH_SECRET_MIN_LENGTH = 32;

/**
 * Below this many distinct characters, a string this long cannot carry real
 * entropy even if it clears the length rule (e.g. a long run of one or two
 * repeated characters).
 */
const MIN_DISTINCT_CHARACTERS = 8;

/**
 * Case-insensitive markers that identify a value as a placeholder rather
 * than a generated secret. Each family covers hyphenated, underscored, and
 * joined forms of the same phrase, plus the name of the documented
 * generation tool itself (`openssl`, from `openssl rand -base64 32`).
 *
 * Markers are deliberately long, multi-character phrases rather than single
 * short words — a genuinely random base64 secret matching one of these by
 * chance is vanishingly unlikely (T-01-12-06). The failure mode of a false
 * positive is a loud boot refusal with a regeneration instruction, which is
 * the safe direction; the failure mode of a false negative would be a
 * silently accepted public secret, which is not.
 */
const PLACEHOLDER_MARKERS = [
  "change-me",
  "change_me",
  "changeme",
  "your-secret",
  "your_secret",
  "yoursecret",
  "placeholder",
  "replace-me",
  "replace_me",
  "replaceme",
  "example-secret",
  "example_secret",
  "examplesecret",
  "secret-here",
  "secret_here",
  "secrethere",
  "dummy-secret",
  "dummy_secret",
  "dummysecret",
  "test-secret",
  "test_secret",
  "testsecret",
  "insert-secret",
  "insert_secret",
  "insertsecret",
  "generate-with",
  "generate_with",
  "generatewith",
  "openssl",
];

/** Eight or more consecutive repeats of the same character. */
const REPEATED_CHARACTER_RUN = /(.)\1{7,}/;

/**
 * Reports whether `candidate` looks like a placeholder rather than a
 * generated secret. Case-insensitive marker search, plus a check for a long
 * run of one repeated character.
 */
export function isPlaceholderSecret(candidate: string): boolean {
  const lower = candidate.toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => lower.includes(marker)) || REPEATED_CHARACTER_RUN.test(candidate);
}

const REMEDY = "generate a real secret with: openssl rand -base64 32";

/**
 * BETTER_AUTH_SECRET schema. Composes the length floor with the placeholder
 * check and the distinct-character floor, so a value long enough to satisfy
 * the bare length rule but still predictable — published in a template, or
 * built from a handful of repeated characters — is rejected before Better
 * Auth is constructed. A genuinely random 32-byte base64 secret passes all
 * three rules unchanged.
 */
export const betterAuthSecretSchema = z
  .string()
  .min(AUTH_SECRET_MIN_LENGTH, `BETTER_AUTH_SECRET is too short — ${REMEDY}`)
  .refine((value) => !isPlaceholderSecret(value), {
    message: `BETTER_AUTH_SECRET looks like a placeholder, not a generated secret — ${REMEDY}`,
  })
  .refine((value) => new Set(value).size >= MIN_DISTINCT_CHARACTERS, {
    message: `BETTER_AUTH_SECRET does not have enough distinct characters to be a real secret — ${REMEDY}`,
  });
