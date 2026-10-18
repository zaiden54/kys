import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import { betterAuthSecretSchema } from "@/lib/validation/auth-secret";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: betterAuthSecretSchema,
    // No longer consumed by src/lib/auth.ts — SEC-04's dynamic
    // ALLOWED_AUTH_HOSTS baseURL config replaced it. Kept optional (no
    // .default(...), since a default would misleadingly imply it's still
    // read) only for backward compatibility with any existing .env.local.
    BETTER_AUTH_URL: z.string().url().optional(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  },
});
