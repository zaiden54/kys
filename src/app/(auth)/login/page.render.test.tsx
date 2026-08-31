// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      email: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

import LoginPage from "./page";

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
});

afterEach(cleanup);

const RE_LOGIN_HINT = "Похоже, это первый запуск с домашнего экрана — войдите ещё раз.";

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
