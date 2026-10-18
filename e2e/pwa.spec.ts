import { test, expect } from "@playwright/test";

// E2E-04 (PWA half): the manifest.webmanifest route and InstallBanner's
// visible/dismiss-persists UI behavior are this app's only non-calculation
// requirement — installability on iOS (per CLAUDE.md's core PWA constraint).
// Scoped to the manifest's served JSON and InstallBanner's own UI logic; it
// does NOT attempt to simulate an actual OS-level "Add to Home Screen"
// action (no browser automation API exists for that on iOS Safari, and this
// app never calls the Chrome-style beforeinstallprompt API — InstallBanner
// is static instructional text, not a native install-prompt capture).

test.describe("PWA installability (E2E-04)", () => {
  test("manifest.webmanifest is served with the correct installability metadata", async ({
    page,
  }) => {
    const res = await page.request.get("/manifest.webmanifest");
    expect(res.ok()).toBe(true);

    const manifest = await res.json();

    expect(typeof manifest.name).toBe("string");
    expect(manifest.name.length).toBeGreaterThan(0);
    expect(typeof manifest.short_name).toBe("string");
    expect(manifest.short_name.length).toBeGreaterThan(0);
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");

    const icons: Array<{ sizes: string }> = manifest.icons ?? [];
    expect(icons.some((icon) => icon.sizes === "192x192")).toBe(true);
    expect(icons.some((icon) => icon.sizes === "512x512")).toBe(true);
  });

  test("install banner is visible and dismissal persists across reload", async ({ page }) => {
    // A fresh Playwright browser context is never in standalone display
    // mode (navigator.standalone is undefined, matchMedia
    // "(display-mode: standalone)" never matches), so the banner is visible
    // on first load without any special viewport/emulation setup.
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Установить приложение" })).toBeVisible();

    await page.getByRole("button", { name: "Скрыть" }).click();
    await expect(page.getByRole("heading", { name: "Установить приложение" })).not.toBeVisible();

    // Reload proves the dismissal survives via localStorage, not just
    // in-memory React state.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Установить приложение" })).not.toBeVisible();

    // Cleanup: this file shares the `authenticated` session with
    // pie-chart.spec.ts/bonus.spec.ts/vacation.spec.ts — clear the
    // dismissed flag so a later local re-run of this same session doesn't
    // start with the banner already dismissed.
    await page.evaluate(() => localStorage.removeItem("__pwa_install_banner_dismissed"));
  });
});
