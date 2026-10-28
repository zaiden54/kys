import { describe, expect, it } from "vitest";
import {
  MAX_AVATAR_BYTES,
  emailInputSchema,
  nameInputSchema,
  passwordInputSchema,
  validateAvatarBytes,
} from "./profile";

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

describe("validateAvatarBytes", () => {
  it.each([
    ["image/jpeg", JPEG],
    ["image/png", PNG],
    ["image/webp", WEBP],
  ])("accepts a real %s", (type, bytes) => {
    expect(validateAvatarBytes(type, new Uint8Array(bytes))).toEqual({ ok: true, contentType: type });
  });

  it("rejects a type outside the allowlist", () => {
    expect(validateAvatarBytes("image/svg+xml", new Uint8Array(JPEG)).ok).toBe(false);
  });

  it("rejects bytes that do not match the declared type", () => {
    expect(validateAvatarBytes("image/png", new Uint8Array(JPEG)).ok).toBe(false);
    expect(validateAvatarBytes("image/jpeg", new TextEncoder().encode("<html>")).ok).toBe(false);
  });

  it("rejects empty and oversized files", () => {
    expect(validateAvatarBytes("image/jpeg", new Uint8Array()).ok).toBe(false);
    const big = new Uint8Array(MAX_AVATAR_BYTES + 1);
    big.set(JPEG);
    expect(validateAvatarBytes("image/jpeg", big).ok).toBe(false);
  });
});

describe("profile input schemas", () => {
  it("trims the name and rejects a blank one", () => {
    expect(nameInputSchema.parse({ name: "  Денис  " })).toEqual({ name: "Денис" });
    expect(nameInputSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("normalizes the email", () => {
    expect(emailInputSchema.parse({ email: " Me@Example.COM " })).toEqual({ email: "me@example.com" });
    expect(emailInputSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });

  it("requires a matching, different, long-enough new password", () => {
    const ok = { currentPassword: "old-secret", newPassword: "new-secret", confirmPassword: "new-secret" };
    expect(passwordInputSchema.safeParse(ok).success).toBe(true);
    expect(passwordInputSchema.safeParse({ ...ok, confirmPassword: "other" }).success).toBe(false);
    expect(passwordInputSchema.safeParse({ ...ok, newPassword: "short", confirmPassword: "short" }).success).toBe(false);
    expect(
      passwordInputSchema.safeParse({ ...ok, newPassword: "old-secret", confirmPassword: "old-secret" }).success,
    ).toBe(false);
  });
});
