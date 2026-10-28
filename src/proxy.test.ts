import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "./proxy";

function req(path: string, cookie?: string) {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : {},
  });
}

describe("proxy (optimistic auth gate)", () => {
  it("redirects /bonuses without any cookie to exactly /login", () => {
    const res = proxy(req("/bonuses"));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.search).toBe("");
  });

  it("redirects / carrying only an unrelated cookie", () => {
    const res = proxy(req("/", "foo=bar"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("passes through with the plain session cookie", () => {
    const res = proxy(req("/", "better-auth.session_token=abc.def"));
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through with the __Secure- prefixed session cookie", () => {
    const res = proxy(req("/", "__Secure-better-auth.session_token=abc.def"));
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.headers.get("location")).toBeNull();
  });

  it("exposes an exact static allowlist matcher", () => {
    expect(config.matcher).toEqual([
      "/",
      "/bonuses/:path*",
      "/vacations/:path*",
      "/settings/:path*",
      "/profile/:path*",
      "/onboarding/:path*",
    ]);
  });
});
