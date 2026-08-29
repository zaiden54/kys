import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  insertSalaryIfAbsent: vi.fn(),
  replaceSalaryIfUnchanged: vi.fn(),
  upsertSchedule: vi.fn(),
  upsertYtdBaseline: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ requireUserId: mocks.requireUserId }));
vi.mock("@/lib/db/salary-repository", () => ({
  insertSalaryIfAbsent: mocks.insertSalaryIfAbsent,
  replaceSalaryIfUnchanged: mocks.replaceSalaryIfUnchanged,
  upsertSchedule: mocks.upsertSchedule,
  upsertYtdBaseline: mocks.upsertYtdBaseline,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/env", () => ({ env: { BETTER_AUTH_SECRET: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGH" } }));

import { saveSalaryAction } from "@/app/actions/salary";
import { signSalaryReplacementToken } from "@/lib/salary-confirmation-token";

const testSecret = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGH";

function salaryFormData(grossRubles: string, confirmationClaim?: string): FormData {
  const formData = new FormData();
  formData.set("grossRubles", grossRubles);
  formData.set("effectiveFrom", "2026-08-29");
  if (confirmationClaim) formData.set("confirmationClaim", confirmationClaim);
  return formData;
}

describe("saveSalaryAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUserId.mockResolvedValue("user-01");
    mocks.insertSalaryIfAbsent.mockResolvedValue({ status: "written", row: {} });
    mocks.replaceSalaryIfUnchanged.mockResolvedValue({ status: "written", row: {} });
  });

  it("rejects a sub-half-kopeck salary before any repository access or revalidation", async () => {
    const result = await saveSalaryAction(salaryFormData("0.001"));

    expect(result.success).toBe(false);
    expect(result).toMatchObject({
      fieldErrors: { grossRubles: ["Оклад должен быть не меньше одной копейки"] },
    });
    expect(mocks.insertSalaryIfAbsent).not.toHaveBeenCalled();
    expect(mocks.replaceSalaryIfUnchanged).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("converts a repository rejection to a generic non-sensitive field error", async () => {
    const fakeDatabaseError = "constraint salary_gross_amount_positive leaked-secret";
    mocks.insertSalaryIfAbsent.mockRejectedValue(new Error(fakeDatabaseError));

    const result = await saveSalaryAction(salaryFormData("123456.78"));
    const serialized = JSON.stringify(result);

    expect(result).toEqual({
      success: false,
      fieldErrors: { grossRubles: ["Не удалось сохранить оклад. Попробуйте ещё раз."] },
    });
    expect(serialized).not.toContain(fakeDatabaseError);
    expect(serialized).not.toContain("123456.78");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("keeps a successful confirmed write and all three revalidations", async () => {
    const result = await saveSalaryAction(salaryFormData("250000"));

    expect(result).toEqual({ success: true });
    expect(mocks.insertSalaryIfAbsent).toHaveBeenCalledWith("user-01", 25_000_000, "2026-08-29");
    expect(mocks.revalidatePath.mock.calls).toEqual([
      ["/"],
      ["/onboarding"],
      ["/settings/salary"],
    ]);
  });

  it("keeps D-14 confirmation behavior without writing or revalidating", async () => {
    mocks.insertSalaryIfAbsent.mockResolvedValue({
      status: "conflict",
      current: { id: "row-01", grossAmountKopecks: 20_000_000 },
    });

    const result = await saveSalaryAction(salaryFormData("250000"));

    expect(result).toMatchObject({
      success: false,
      needsConfirmation: true,
      existingAmountRubles: 200_000,
      submittedAmountRubles: 250_000,
      effectiveFrom: "2026-08-29",
    });
    expect(result).toHaveProperty("confirmationClaim");
    expect(mocks.replaceSalaryIfUnchanged).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("conditionally replaces when a valid claim still matches", async () => {
    const confirmationClaim = signSalaryReplacementToken(
      {
        userId: "user-01",
        effectiveFrom: "2026-08-29",
        rowId: "row-01",
        existingGrossAmountKopecks: 20_000_000,
        issuedAtMs: Date.now(),
      },
      testSecret,
    );

    expect(await saveSalaryAction(salaryFormData("250000", confirmationClaim))).toEqual({
      success: true,
    });
    expect(mocks.replaceSalaryIfUnchanged).toHaveBeenCalledWith(
      "user-01",
      25_000_000,
      "2026-08-29",
      "row-01",
      20_000_000,
    );
    expect(mocks.insertSalaryIfAbsent).not.toHaveBeenCalled();
  });

  it("re-prompts without an insert when a valid claim is stale", async () => {
    const confirmationClaim = signSalaryReplacementToken(
      {
        userId: "user-01",
        effectiveFrom: "2026-08-29",
        rowId: "row-01",
        existingGrossAmountKopecks: 20_000_000,
        issuedAtMs: Date.now(),
      },
      testSecret,
    );
    mocks.replaceSalaryIfUnchanged.mockResolvedValue({
      status: "conflict",
      current: { id: "row-01", grossAmountKopecks: 21_000_000 },
    });

    const result = await saveSalaryAction(salaryFormData("250000", confirmationClaim));
    expect(result).toMatchObject({ needsConfirmation: true, existingAmountRubles: 210_000 });
    expect(mocks.insertSalaryIfAbsent).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("treats a foreign-user claim as unconfirmed and never conditionally replaces", async () => {
    const confirmationClaim = signSalaryReplacementToken(
      {
        userId: "other-user",
        effectiveFrom: "2026-08-29",
        rowId: "row-01",
        existingGrossAmountKopecks: 20_000_000,
        issuedAtMs: Date.now(),
      },
      testSecret,
    );
    mocks.insertSalaryIfAbsent.mockResolvedValue({
      status: "conflict",
      current: { id: "row-01", grossAmountKopecks: 20_000_000 },
    });

    expect(await saveSalaryAction(salaryFormData("250000", confirmationClaim))).toMatchObject({
      needsConfirmation: true,
    });
    expect(mocks.replaceSalaryIfUnchanged).not.toHaveBeenCalled();
  });
});
