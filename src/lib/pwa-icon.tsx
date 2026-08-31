/**
 * Shared PWA icon markup, rendered by next/og's satori engine at build
 * (apple-icon.tsx) or request (api/pwa-icon/route.ts) time — never by
 * React/the browser, so this file intentionally has no "use client".
 *
 * The glyph is the ASCII letter "H" (U+0048), NOT the Cyrillic capital "Н"
 * (U+041D) — the two are visually indistinguishable in any sans-serif font,
 * but next/og's default bundled font is Latin-subset only; rendering the
 * literal Cyrillic character would require shipping a new font file for
 * zero visible difference (see 04-02-PLAN.md's flagged assumption).
 */

export const PWA_ICON_BACKGROUND_HEX = "#18181b";

export function renderPwaIconMarkup({
  size,
  maskable,
}: {
  size: number;
  maskable: boolean;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: PWA_ICON_BACKGROUND_HEX,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          fontFamily: "sans-serif",
          fontWeight: 700,
          color: "#ffffff",
          fontSize: Math.round(size * (maskable ? 0.4 : 0.55)),
        }}
      >
        H
      </span>
    </div>
  );
}
