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
    signIn: {
      email: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

import LoginPage from "./page";
import { authClient } from "@/lib/auth-client";

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
}

function mockNavigatorStandalone(value: boolean | undefined) {
  Object.defineProperty(window.navigator, "standalone", {
    value,
    configurable: true,
  });
}

beforeEach(() => {
  mockMatchMedia(false);
  mockNavigatorStandalone(undefined);
  pushMock.mockClear();
  refreshMock.mockClear();
  vi.mocked(authClient.signIn.email).mockClear();
  vi.mocked(authClient.signIn.email).mockResolvedValue({ error: null });
});

afterEach(cleanup);

const RE_LOGIN_HINT = "Похоже, это первый запуск с домашнего экрана — войдите ещё раз.";

async function submitLoginForm() {
  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "user@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Пароль"), {
    target: { value: "any-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Войти" }));
}

describe("LoginPage re-login hint", () => {
  it("renders the re-login hint above the form when standalone", () => {
    mockNavigatorStandalone(true);
    render(<LoginPage />);

    expect(screen.getByText(RE_LOGIN_HINT)).not.toBeNull();
  });

  it("renders no hint when not standalone", () => {
    render(<LoginPage />);

    expect(screen.queryByText(RE_LOGIN_HINT)).toBeNull();
  });

  it("still renders the email/password form regardless of standalone state", () => {
    mockNavigatorStandalone(true);
    render(<LoginPage />);

    expect(screen.getByLabelText("Email")).not.toBeNull();
    expect(screen.getByLabelText("Пароль")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Войти" })).not.toBeNull();
  });
});

describe("LoginPage submit redirect (G-04-2)", () => {
  it("calls router.refresh() before router.push() on successful sign-in", async () => {
    await submitLoginForm();

    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalled();
    });

    expect(refreshMock.mock.invocationCallOrder[0]).toBeLessThan(
      pushMock.mock.invocationCallOrder[0],
    );
  });

  it("calls router.push with exactly '/'", async () => {
    await submitLoginForm();

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/");
    });
    expect(pushMock).toHaveBeenCalledTimes(1);
  });

  it("does not call router.refresh() or router.push() when sign-in errors", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValueOnce({
      error: { message: "Неверный email или пароль" },
    });

    await submitLoginForm();

    await waitFor(() => {
      expect(screen.getByText("Неверный email или пароль")).not.toBeNull();
    });

    expect(refreshMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
