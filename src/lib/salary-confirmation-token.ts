if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/salary-confirmation-token.ts is server-only and must never be imported into a client component.",
  );
}

import { createHmac, timingSafeEqual } from "node:crypto";

export const SALARY_CONFIRMATION_TTL_MS = 10 * 60 * 1000;

export interface SalaryReplacementClaim {
  userId: string;
  effectiveFrom: string;
  rowId: string;
  existingGrossAmountKopecks: number;
  issuedAtMs: number;
}

function signature(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

function isClaim(value: unknown): value is SalaryReplacementClaim {
  if (!value || typeof value !== "object") return false;
  const claim = value as Record<string, unknown>;
  return (
    typeof claim.userId === "string" &&
    typeof claim.effectiveFrom === "string" &&
    typeof claim.rowId === "string" &&
    typeof claim.existingGrossAmountKopecks === "number" &&
    Number.isSafeInteger(claim.existingGrossAmountKopecks) &&
    typeof claim.issuedAtMs === "number" &&
    Number.isSafeInteger(claim.issuedAtMs)
  );
}

export function signSalaryReplacementToken(
  claim: SalaryReplacementClaim,
  secret: string,
): string {
  const payload = Buffer.from(JSON.stringify(claim)).toString("base64url");
  return `${payload}.${signature(payload, secret).toString("base64url")}`;
}

export function verifySalaryReplacementToken(
  token: string,
  secret: string,
  nowMs: number,
): SalaryReplacementClaim | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    const [payload, encodedSignature] = parts;
    const suppliedSignature = Buffer.from(encodedSignature, "base64url");
    const expectedSignature = signature(payload, secret);
    if (suppliedSignature.length !== expectedSignature.length) return null;
    if (!timingSafeEqual(suppliedSignature, expectedSignature)) return null;

    const claim: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!isClaim(claim)) return null;
    const age = nowMs - claim.issuedAtMs;
    if (age < 0 || age > SALARY_CONFIRMATION_TTL_MS) return null;
    return claim;
  } catch {
    return null;
  }
}
