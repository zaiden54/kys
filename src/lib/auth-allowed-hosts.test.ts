/**
 * DB-independent proof of SEC-04's dynamic Better Auth baseURL resolution.
 *
 * Imports ALLOWED_AUTH_HOSTS from ./auth-allowed-hosts (NOT from ./auth) —
 * importing ./auth transitively constructs the Better Auth instance via
 * drizzleAdapter(db, ...), which requires a live, valid DATABASE_URL through
 * src/env.ts's createEnv() call and would defeat this test's purpose as a
 * DB-independent check.
 *
 * matchesHostPattern and resolveDynamicBaseURL are imported directly from
 * the installed better-auth package (both confirmed exported from
 * better-auth@1.7.2's index.d.mts / index.mjs).
 */
import { describe, expect, it } from "vitest";
import { matchesHostPattern, resolveDynamicBaseURL } from "better-auth";
import { ALLOWED_AUTH_HOSTS } from "./auth-allowed-hosts";

describe("ALLOWED_AUTH_HOSTS + matchesHostPattern", () => {
  it("matches an exact host", () => {
    expect(matchesHostPattern("localhost:3000", "localhost:3000")).toBe(true);
  });

  it("matches the real predicted persistent-staging git-branch alias against *.vercel.app", () => {
    expect(
      matchesHostPattern(
        "on-hands-git-staging-careeremit-9861s-projects.vercel.app",
        "*.vercel.app",
      ),
    ).toBe(true);
  });

  it("matches a real observed per-deployment hash hostname against *.vercel.app", () => {
    expect(
      matchesHostPattern(
        "on-hands-6zdzwlrld-careeremit-9861s-projects.vercel.app",
        "*.vercel.app",
      ),
    ).toBe(true);
  });

  it("never matches an untrusted host against any configured pattern", () => {
    for (const pattern of ALLOWED_AUTH_HOSTS) {
      expect(matchesHostPattern("evil.com", pattern)).toBe(false);
    }
  });
});

describe("resolveDynamicBaseURL with ALLOWED_AUTH_HOSTS", () => {
  it("resolves the correct https origin for a trusted Vercel staging host", () => {
    const url = resolveDynamicBaseURL(
      { allowedHosts: ALLOWED_AUTH_HOSTS },
      new Headers({ host: "on-hands-git-staging-careeremit-9861s-projects.vercel.app" }),
      "/api/auth",
    );
    expect(url).toBe(
      "https://on-hands-git-staging-careeremit-9861s-projects.vercel.app/api/auth",
    );
  });

  it("resolves http for localhost (auto protocol defaults to the request's own scheme)", () => {
    const url = resolveDynamicBaseURL(
      { allowedHosts: ALLOWED_AUTH_HOSTS },
      new Headers({ host: "localhost:3000" }),
      "/api/auth",
    );
    expect(url).toBe("http://localhost:3000/api/auth");
  });

  it("throws (fails closed) for an unrecognized host with no fallback configured", () => {
    expect(() =>
      resolveDynamicBaseURL(
        { allowedHosts: ALLOWED_AUTH_HOSTS },
        new Headers({ host: "evil.com" }),
        "/api/auth",
      ),
    ).toThrow();
  });
});
