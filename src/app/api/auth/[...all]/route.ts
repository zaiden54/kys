import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Node.js runtime — the Neon HTTP driver and Better Auth's Drizzle adapter
// are configured for Node here, not the Edge runtime.
export const { GET, POST } = toNextJsHandler(auth);
