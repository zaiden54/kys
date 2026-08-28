import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// server-only guard equivalent: the `server-only` npm package isn't
// installed (new package installs require a human-verify checkpoint per
// executor deviation rules — the plan permits "an equivalent" here), so this
// throws immediately if the module is ever evaluated in a browser context,
// preventing it from reaching a client bundle.
if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/session.ts is server-only and must never be imported into a client component.",
  );
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

/**
 * Reads the session strictly from the request cookie via Better Auth's
 * server API — never trusts client-supplied identity. Returns null when
 * there is no active session.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, email, name } = session.user;
  return { id, email, name };
}

/**
 * The single ownership anchor for every user-scoped query in this app.
 * No Server Action or repository function may accept a client-supplied
 * userId — every one of them must call this instead.
 */
export async function requireUserId(): Promise<string> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  return user.id;
}
