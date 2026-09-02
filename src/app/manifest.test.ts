import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("manifest()", () => {
  it("returns standalone display, theme/background colors, short_name, and three icon entries", () => {
    const result = manifest();

    expect(result.display).toBe("standalone");
    expect(result.theme_color).toBe("#1a1a1a");
    expect(result.background_color).toBe("#1a1a1a");
    expect(result.short_name).toBe("НаРуки");

    const icons = result.icons ?? [];
    expect(icons).toHaveLength(3);

    const anyIcons = icons.filter((icon) => icon.purpose === "any");
    expect(anyIcons).toHaveLength(2);
    expect(anyIcons.some((icon) => icon.sizes === "192x192")).toBe(true);
    expect(anyIcons.some((icon) => icon.sizes === "512x512")).toBe(true);

    const maskableIcons = icons.filter((icon) => icon.purpose === "maskable");
    expect(maskableIcons).toHaveLength(1);
    expect(maskableIcons[0].sizes).toBe("512x512");

    for (const icon of icons) {
      expect(icon.type).toBe("image/png");
    }
  });
});
