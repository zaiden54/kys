import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUserId: vi.fn(), createBonus: vi.fn(), updateBonus: vi.fn(),
  deleteBonusIfFuture: vi.fn(), revalidatePath: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ requireUserId: mocks.requireUserId }));
vi.mock("@/lib/db/bonus-repository", () => ({
  createBonus: mocks.createBonus, updateBonus: mocks.updateBonus,
  deleteBonusIfFuture: mocks.deleteBonusIfFuture,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { deleteBonusAction, saveBonusAction } from "@/app/actions/bonus";

const bonusId = "11111111-1111-4111-8111-111111111111";
function formData(id?: string): FormData {
  const data = new FormData();
  if (id) data.set("id", id);
  data.set("amountRubles", "25000"); data.set("date", "2026-09-02"); data.set("note", "Проект");
  return data;
}

describe("bonus actions", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.requireUserId.mockResolvedValue("user-01");
    mocks.createBonus.mockResolvedValue({}); mocks.updateBonus.mockResolvedValue({ id: bonusId });
    mocks.deleteBonusIfFuture.mockResolvedValue({ status: "deleted" });
  });

  it("creates when id is absent", async () => {
    expect(await saveBonusAction(formData())).toEqual({ success: true });
    expect(mocks.createBonus).toHaveBeenCalledWith("user-01", 2_500_000, "2026-09-02", "Проект");
    expect(mocks.updateBonus).not.toHaveBeenCalled();
  });

  it("updates when id is present", async () => {
    expect(await saveBonusAction(formData(bonusId))).toEqual({ success: true });
    expect(mocks.updateBonus).toHaveBeenCalledWith("user-01", bonusId, 2_500_000, "2026-09-02", "Проект");
    expect(mocks.createBonus).not.toHaveBeenCalled();
  });

  it("returns not found without revalidation", async () => {
    mocks.updateBonus.mockResolvedValue(null);
    expect(await saveBonusAction(formData(bonusId))).toEqual({ success: false, fieldErrors: { amountRubles: ["Бонус не найден"] } });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("hides repository errors", async () => {
    mocks.createBonus.mockRejectedValue(new Error("leaked-secret"));
    const result = await saveBonusAction(formData());
    expect(result).toEqual({ success: false, fieldErrors: { amountRubles: ["Не удалось сохранить бонус. Попробуйте ещё раз."] } });
    expect(JSON.stringify(result)).not.toContain("leaked-secret");
  });

  it("returns the exact blocked-delete message without revalidation", async () => {
    mocks.deleteBonusIfFuture.mockResolvedValue({ status: "blocked" });
    expect(await deleteBonusAction(bonusId)).toEqual({ success: false, fieldErrors: { date: ["Нельзя удалять бонусы из прошлого. Вы можете изменить сумму."] } });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects malformed ids before repository access", async () => {
    expect((await deleteBonusAction("not-a-uuid")).success).toBe(false);
    expect(mocks.deleteBonusIfFuture).not.toHaveBeenCalled();
  });
});
