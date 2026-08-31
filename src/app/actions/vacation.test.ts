import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUserId: vi.fn(), createVacation: vi.fn(), updateVacation: vi.fn(),
  checkOverlapVacations: vi.fn(), deleteVacationIfFuture: vi.fn(), revalidatePath: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ requireUserId: mocks.requireUserId }));
vi.mock("@/lib/db/vacation-repository", () => ({
  createVacation: mocks.createVacation, updateVacation: mocks.updateVacation,
  checkOverlapVacations: mocks.checkOverlapVacations, deleteVacationIfFuture: mocks.deleteVacationIfFuture,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { deleteVacationAction, saveVacationAction } from "@/app/actions/vacation";

const vacationId = "22222222-2222-4222-8222-222222222222";
function formData(id?: string, startDate = "2026-09-10", endDate = "2026-09-15"): FormData {
  const data = new FormData();
  if (id) data.set("id", id);
  data.set("startDate", startDate);
  data.set("endDate", endDate);
  return data;
}

describe("vacation actions", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.requireUserId.mockResolvedValue("user-01");
    mocks.createVacation.mockResolvedValue({}); mocks.updateVacation.mockResolvedValue({ id: vacationId });
    mocks.checkOverlapVacations.mockResolvedValue(false);
    mocks.deleteVacationIfFuture.mockResolvedValue({ status: "deleted" });
  });

  it("creates when id is absent", async () => {
    expect(await saveVacationAction(formData())).toEqual({ success: true });
    expect(mocks.checkOverlapVacations).toHaveBeenCalledWith("user-01", "2026-09-10", "2026-09-15");
    expect(mocks.createVacation).toHaveBeenCalledWith("user-01", "2026-09-10", "2026-09-15");
    expect(mocks.updateVacation).not.toHaveBeenCalled();
  });

  it("updates when id is present", async () => {
    expect(await saveVacationAction(formData(vacationId))).toEqual({ success: true });
    expect(mocks.checkOverlapVacations).toHaveBeenCalledWith("user-01", "2026-09-10", "2026-09-15", vacationId);
    expect(mocks.updateVacation).toHaveBeenCalledWith("user-01", vacationId, "2026-09-10", "2026-09-15");
    expect(mocks.createVacation).not.toHaveBeenCalled();
  });

  it("returns the exact overlap message and never calls createVacation/updateVacation", async () => {
    mocks.checkOverlapVacations.mockResolvedValue(true);
    expect(await saveVacationAction(formData())).toEqual({
      success: false,
      fieldErrors: { endDate: ["Даты пересекаются с существующим отпуском"] },
    });
    expect(mocks.createVacation).not.toHaveBeenCalled();
    expect(mocks.updateVacation).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns the exact overlap message on edit too, excluding the vacation's own id", async () => {
    mocks.checkOverlapVacations.mockResolvedValue(true);
    expect(await saveVacationAction(formData(vacationId))).toEqual({
      success: false,
      fieldErrors: { endDate: ["Даты пересекаются с существующим отпуском"] },
    });
    expect(mocks.updateVacation).not.toHaveBeenCalled();
  });

  it("updateVacation resolving null produces 'Отпуск не найден' and no revalidatePath call", async () => {
    mocks.updateVacation.mockResolvedValue(null);
    expect(await saveVacationAction(formData(vacationId))).toEqual({
      success: false,
      fieldErrors: { endDate: ["Отпуск не найден"] },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("hides repository errors on create", async () => {
    mocks.createVacation.mockRejectedValue(new Error("leaked-secret"));
    const result = await saveVacationAction(formData());
    expect(result).toEqual({
      success: false,
      fieldErrors: { startDate: ["Не удалось сохранить отпуск. Попробуйте ещё раз."] },
    });
    expect(JSON.stringify(result)).not.toContain("leaked-secret");
  });

  it("returns the exact blocked-delete message without revalidation", async () => {
    mocks.deleteVacationIfFuture.mockResolvedValue({ status: "blocked" });
    expect(await deleteVacationAction(vacationId)).toEqual({
      success: false,
      fieldErrors: { startDate: ["Нельзя удалять отпуска из прошлого. Вы можете изменить даты."] },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns 'Отпуск не найден' when deleteVacationIfFuture reports not-found", async () => {
    mocks.deleteVacationIfFuture.mockResolvedValue({ status: "not-found" });
    expect(await deleteVacationAction(vacationId)).toEqual({
      success: false,
      fieldErrors: { startDate: ["Отпуск не найден"] },
    });
  });

  it("rejects malformed ids before repository access, never calling deleteVacationIfFuture", async () => {
    expect((await deleteVacationAction("not-a-uuid")).success).toBe(false);
    expect(mocks.deleteVacationIfFuture).not.toHaveBeenCalled();
  });
});
