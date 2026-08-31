import { ImageResponse } from "next/og";
import { renderPwaIconMarkup } from "@/lib/pwa-icon";

// Public/unauthenticated by design: the manifest and its referenced icons
// must be fetchable before install, i.e. before login (see 04-02-PLAN.md's
// threat model trust boundaries).
//
// This route reads a request-time API (searchParams), so unlike
// apple-icon.tsx it is NOT statically pre-rendered at build time —
// route.test.ts is what proves it renders correctly.
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);

  // T-04-03 (DoS mitigation): whitelist `size` to exactly {192, 512} —
  // never pass a raw/unbounded value into ImageResponse's dimensions.
  const size = searchParams.get("size") === "512" ? 512 : 192;
  const maskable = searchParams.get("maskable") === "1";

  return new ImageResponse(renderPwaIconMarkup({ size, maskable }), {
    width: size,
    height: size,
  });
}
