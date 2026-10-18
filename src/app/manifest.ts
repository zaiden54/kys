import type { MetadataRoute } from "next";

// Auto-discovered by Next.js's build-time metadata loader and served at
// /manifest.webmanifest, with <link rel="manifest"> auto-injected into
// <head> — do NOT manually set metadata.manifest anywhere else.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "НаРуки — расчёт зарплаты на руки",
    short_name: "НаРуки",
    description:
      "Приложение для точного прогнозирования суммы выплаты на руки с учётом прогрессивного НДФЛ.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    theme_color: "#1a1a1a",
    background_color: "#1a1a1a",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/api/pwa-icon?size=192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/api/pwa-icon?size=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/api/pwa-icon?size=512&maskable=1",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
