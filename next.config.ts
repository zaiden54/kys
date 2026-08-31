import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  /* config options here */
};

// T-04-04 mitigation: keeps the injected precache manifest empty — the
// service worker can never cache (and later serve stale/tampered copies of)
// any authenticated page or API response, matching CONTEXT.md's
// "minimal/empty precache, no offline caching" decision.
// - `exclude: [/.*/]` excludes every webpack-compiled build asset (JS/CSS
//   chunks) from the precache manifest.
// - `globPublicPatterns: []` additionally skips @serwist/next's separate
//   public/ directory scan (defaults to ["**/*"]) — without this, static
//   files under public/ (e.g. the default file.svg/globe.svg/etc.) are
//   still added to self.__SW_MANIFEST even though `exclude` never sees them.
export default withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  register: true,
  reloadOnOnline: true,
  exclude: [/.*/],
  globPublicPatterns: [],
})(nextConfig);
