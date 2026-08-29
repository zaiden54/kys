import { describe, expect, it } from "vitest";
import {
  SALARY_CONFIRMATION_TTL_MS,
  signSalaryReplacementToken,
  verifySalaryReplacementToken,
  type SalaryReplacementClaim,
} from "@/lib/salary-confirmation-token";

const secret = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGH";
const now = 1_800_000_000_000;
const claim: SalaryReplacementClaim = {
  userId: "user-01",
  effectiveFrom: "2026-08-29",
  rowId: "row-01",
  existingGrossAmountKopecks: 20_000_000,
  issuedAtMs: now,
};

describe("salary replacement confirmation token", () => {
  it("round-trips a signed claim", () => {
    expect(verifySalaryReplacementToken(signSalaryReplacementToken(claim, secret), secret, now))
      .toEqual(claim);
  });

  it.each(["payload", "signature"])("rejects a tampered %s", (segment) => {
    const parts = signSalaryReplacementToken(claim, secret).split(".");
    const index = segment === "payload" ? 0 : 1;
    parts[index] = `${parts[index]?.slice(0, -1)}${parts[index]?.endsWith("A") ? "B" : "A"}`;
    expect(verifySalaryReplacementToken(parts.join("."), secret, now)).toBeNull();
  });

  it("rejects a different secret and an expired or future-issued claim", () => {
    const token = signSalaryReplacementToken(claim, secret);
    expect(verifySalaryReplacementToken(token, `${secret}x`, now)).toBeNull();
    expect(verifySalaryReplacementToken(token, secret, now + SALARY_CONFIRMATION_TTL_MS + 1)).toBeNull();
    expect(verifySalaryReplacementToken(token, secret, now - 1)).toBeNull();
    expect(verifySalaryReplacementToken(token, secret, now + SALARY_CONFIRMATION_TTL_MS)).toEqual(claim);
  });

  it.each(["", "abc", "%%%.%%%", "e30.AA", "W10.AA"])(
    "returns null without throwing for malformed token %j",
    (token) => expect(verifySalaryReplacementToken(token, secret, now)).toBeNull(),
  );
});
