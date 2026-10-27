import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "НаРуки",
  description: "Расчёт и прогноз зарплаты «на руки» с учётом НДФЛ",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "НаРуки",
  },
};

// themeColor and viewport sizing fields do NOT belong inside `metadata` in
// this Next.js version — they moved to a dedicated `viewport` export in
// Next 14+ and are silently ignored inside `metadata` (confirmed via
// node_modules/next/dist/docs/.../generate-viewport.md).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f3f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0f11" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={`${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
