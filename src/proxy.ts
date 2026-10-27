import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic auth gate for the (app) route group.
 *
 * This checks cookie PRESENCE only, never validity. The authoritative check
 * remains requireUserId() in every (app) page and every Server Action
 * (proxy.md notes Server Functions arrive as POSTs to the page route and must
 * authenticate themselves), so a forged or stale cookie that passes here is
 * still rejected before any data is read.
 *
 * Why it exists: the (app) layout may no longer touch headers()/cookies(),
 * otherwise Next blocks navigation until the layout renders and never shows
 * loading.tsx (layout.md, "Interaction with loading.js").
 *
 * The matcher is an explicit allowlist of the (app) routes, so /login,
 * /register, /api/*, _next assets, sw.js, the manifest and icons are never
 * touched. A NEW (app) route must be added to the matcher below (pages stay
 * authoritative regardless).
 *
 * Redirects to a fixed /login (no ?next= parameter): e2e/auth.spec.ts asserts
 * the exact URL, and a fixed target has no open-redirect surface.
 */
export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/bonuses/:path*",
    "/vacations/:path*",
    "/settings/:path*",
    "/onboarding/:path*",
  ],
};
