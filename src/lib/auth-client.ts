import { createAuthClient } from "better-auth/react";

// The only client-side auth surface. baseURL falls back to the current
// origin when NEXT_PUBLIC_BETTER_AUTH_URL is unset (better-auth/react's
// default behavior for an undefined baseURL).
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
});

export const { signUp, signIn, signOut, useSession } = authClient;
