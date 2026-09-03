// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppNavigation } from "./app-navigation";

let pathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut: vi.fn() },
}));

describe("AppNavigation", () => {
  beforeEach(() => {
    pathname = "/";
  });

  afterEach(cleanup);

  it("exposes only real application routes in both responsive navigation variants", () => {
    render(<AppNavigation />);

    const routes = [
      ["Главная", "/"],
      ["Бонусы", "/bonuses"],
      ["Отпуска", "/vacations"],
      ["Выплаты", "/settings/salary"],
    ] as const;

    for (const [name, href] of routes) {
      const links = screen.getAllByRole("link", { name: new RegExp(name) });
      expect(links.some((link) => link.getAttribute("href") === href)).toBe(true);
    }
  });

  it("marks the matching route active in desktop and mobile navigation", () => {
    pathname = "/settings/salary";
    render(<AppNavigation />);

    const activeLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");

    expect(activeLinks).toHaveLength(2);
    expect(activeLinks.every((link) => link.getAttribute("href") === "/settings/salary")).toBe(true);
  });

  it("keeps sign out as an action rather than a navigation link", () => {
    render(<AppNavigation />);

    expect(screen.getAllByRole("button", { name: "Выйти" })).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "Выйти" })).toBeNull();
  });
});
