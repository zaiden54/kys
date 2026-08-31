// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { pushMock, refreshMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signUp: {
      email: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

import RegisterPage from "./page";
import { authClient } from "@/lib/auth-client";

beforeEach(() => {
  pushMock.mockClear();
  refreshMock.mockClear();
  vi.mocked(authClient.signUp.email).mockClear();
  vi.mocked(authClient.signUp.email).mockResolvedValue({ error: null });
});

afterEach(cleanup);

async function submitRegisterForm() {
  render(<RegisterPage />);
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "user@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Пароль"), {
    target: { value: "password123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Зарегистрироваться" }));
}

describe("RegisterPage submit redirect (G-04-2)", () => {
  it("calls router.refresh() before router.push() on successful sign-up", async () => {
    await submitRegisterForm();

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalled();
    });

    expect(refreshMock.mock.invocationCallOrder[0]).toBeLessThan(
      pushMock.mock.invocationCallOrder[0],
    );
  });

  it("calls router.push with exactly '/onboarding'", async () => {
    await submitRegisterForm();

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/onboarding");
    });
    expect(pushMock).toHaveBeenCalledTimes(1);
  });

  it("does not call router.refresh() or router.push() when sign-up errors", async () => {
    vi.mocked(authClient.signUp.email).mockResolvedValueOnce({
      error: { message: "Такой email уже зарегистрирован" },
    });

    await submitRegisterForm();

    await waitFor(() => {
      expect(screen.getByText("Такой email уже зарегистрирован")).not.toBeNull();
    });

    expect(refreshMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
