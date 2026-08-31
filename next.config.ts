import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  /* config options here */
};

// T-04-04 mitigation: exclude:[/.*/] keeps the injected precache manifest
// empty — the service worker can never cache (and later serve stale/
// tampered copies of) any authenticated page or API response, matching
// CONTEXT.md's "minimal/empty precache, no offline caching" decision.
export default withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  register: true,
  reloadOnOnline: true,
  exclude: [/.*/],
})(nextConfig);
