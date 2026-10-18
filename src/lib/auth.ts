import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "@/lib/db";
import { env } from "@/env";
import * as authSchema from "@/lib/db/auth-schema";
import { ALLOWED_AUTH_HOSTS } from "./auth-allowed-hosts";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // D-06
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days, D-07
    updateAge: 60 * 60 * 24 * 7, // refresh weekly on use
  },
  secret: env.BETTER_AUTH_SECRET,
  // SEC-04: resolved dynamically per-request host against an explicit
  // allowlist instead of a static env var, so the same deployed build works
  // on localhost, every Vercel PR-preview, staging, and production without a
  // rebuild or per-environment env-var swap. `protocol` is deliberately
  // omitted (defaults to "auto", resolving from the request's own URL
  // scheme without needing advanced.trustedProxyHeaders). `fallback` is
  // deliberately omitted so an unrecognized Host header throws instead of
  // silently resolving to a default trusted origin (fail-closed).
  baseURL: { allowedHosts: ALLOWED_AUTH_HOSTS },
});
