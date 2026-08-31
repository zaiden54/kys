import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
  themeColor: "#18181b",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
