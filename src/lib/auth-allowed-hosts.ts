/**
 * Single source of truth for every trusted Better Auth request origin in
 * this project (SEC-04). `*.vercel.app` covers every Vercel-hosted
 * deployment for this project — PR-preview hash URLs, the persistent
 * `staging` git-branch alias, and the production alias — because the
 * project uses no custom domain in this phase. A future custom production
 * domain gets appended here, not substituted in.
 *
 * Deliberately free of any other imports (no env-schema module, no db
 * module) so it can be imported without pulling in a live-DB dependency —
 * that is exactly why it lives as its own module rather than inline in
 * auth.ts.
 */
export const ALLOWED_AUTH_HOSTS: string[] = ["localhost:3000", "*.vercel.app"];
