// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { InstallBanner } from "./install-banner";

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

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("InstallBanner", () => {
  it("renders the install instructions when not standalone and not dismissed", () => {
    render(<InstallBanner />);

    expect(screen.getByText("Установить приложение")).not.toBeNull();
    expect(screen.getByText("Поделиться → На экран «Домой»")).not.toBeNull();
  });

  it("renders nothing when standalone is detected (matchMedia)", () => {
    mockMatchMedia(true);
    const { container } = render(<InstallBanner />);

    expect(container.querySelector("div")).toBeNull();
  });

  it("renders nothing when standalone is detected (navigator.standalone)", () => {
    mockNavigatorStandalone(true);
    const { container } = render(<InstallBanner />);

    expect(container.querySelector("div")).toBeNull();
  });

  it("dismiss control hides the banner and persists across a fresh mount", () => {
    const { unmount } = render(<InstallBanner />);

    fireEvent.click(screen.getByRole("button", { name: "Скрыть" }));
    expect(screen.queryByText("Установить приложение")).toBeNull();
    expect(window.localStorage.getItem("__pwa_install_banner_dismissed")).toBe("1");

    unmount();

    // Simulate a fresh mount — dismissal should still be respected.
    render(<InstallBanner />);
    expect(screen.queryByText("Установить приложение")).toBeNull();
  });
});
