import { ImageResponse } from "next/og";
import { renderPwaIconMarkup } from "@/lib/pwa-icon";

// No request-time API is read here (no searchParams/headers/cookies), so
// Next.js statically executes and caches this route at `npm run build`
// time — a broken renderer fails the build loudly rather than 404ing at
// runtime. Next.js auto-injects
// <link rel="apple-touch-icon" href="/apple-icon?<hash>" sizes="180x180" type="image/png">
// into <head> from this file alone; no manual <link> tag is added anywhere.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(renderPwaIconMarkup({ size: 180, maskable: false }), {
    ...size,
  });
}
