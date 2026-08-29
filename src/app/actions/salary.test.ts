import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  findSalaryAt: vi.fn(),
  replaceSalaryAt: vi.fn(),
  upsertSchedule: vi.fn(),
  upsertYtdBaseline: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ requireUserId: mocks.requireUserId }));
vi.mock("@/lib/db/salary-repository", () => ({
  findSalaryAt: mocks.findSalaryAt,
  replaceSalaryAt: mocks.replaceSalaryAt,
  upsertSchedule: mocks.upsertSchedule,
  upsertYtdBaseline: mocks.upsertYtdBaseline,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { saveSalaryAction } from "@/app/actions/salary";

function salaryFormData(grossRubles: string, confirm = true): FormData {
  const formData = new FormData();
  formData.set("grossRubles", grossRubles);
  formData.set("effectiveFrom", "2026-08-29");
  formData.set("confirm", String(confirm));
  return formData;
}

describe("saveSalaryAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUserId.mockResolvedValue("user-01");
    mocks.findSalaryAt.mockResolvedValue(null);
    mocks.replaceSalaryAt.mockResolvedValue(undefined);
  });

  it("rejects a sub-half-kopeck salary before any repository access or revalidation", async () => {
    const result = await saveSalaryAction(salaryFormData("0.001"));

    expect(result.success).toBe(false);
    expect(result).toMatchObject({
      fieldErrors: { grossRubles: ["Оклад должен быть не меньше одной копейки"] },
    });
    expect(mocks.findSalaryAt).not.toHaveBeenCalled();
    expect(mocks.replaceSalaryAt).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("converts a repository rejection to a generic non-sensitive field error", async () => {
    const fakeDatabaseError = "constraint salary_gross_amount_positive leaked-secret";
    mocks.replaceSalaryAt.mockRejectedValue(new Error(fakeDatabaseError));

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
    expect(mocks.replaceSalaryAt).toHaveBeenCalledWith("user-01", 25_000_000, "2026-08-29");
    expect(mocks.revalidatePath.mock.calls).toEqual([
      ["/"],
      ["/onboarding"],
      ["/settings/salary"],
    ]);
  });

  it("keeps D-14 confirmation behavior without writing or revalidating", async () => {
    mocks.findSalaryAt.mockResolvedValue({ grossAmountKopecks: 20_000_000 });

    const result = await saveSalaryAction(salaryFormData("250000", false));

    expect(result).toEqual({
      success: false,
      needsConfirmation: true,
      existingAmountRubles: 200_000,
      effectiveFrom: "2026-08-29",
    });
    expect(mocks.replaceSalaryAt).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
