/**
 * Single source of truth for every trusted Better Auth request origin in
 * this project (SEC-04). The `on-hands-*-careeremit-9861s-projects.vercel.app`
 * pattern is scoped to this project's actual Vercel deployment naming
 * convention — it covers PR-preview hash URLs (e.g.
 * `on-hands-6zdzwlrld-careeremit-9861s-projects.vercel.app`) and the
 * persistent `staging` git-branch alias (e.g.
 * `on-hands-git-staging-careeremit-9861s-projects.vercel.app`) — without
 * trusting the entire shared `*.vercel.app` apex domain, which anyone can
 * claim a subdomain of regardless of project. A future custom production
 * domain gets appended here, not substituted in.
 *
 * Deliberately free of any other imports (no env-schema module, no db
 * module) so it can be imported without pulling in a live-DB dependency —
 * that is exactly why it lives as its own module rather than inline in
 * auth.ts.
 */
export const ALLOWED_AUTH_HOSTS: string[] = [
  "localhost:3000",
  "on-hands-*-careeremit-9861s-projects.vercel.app", // PR previews + staging alias
  // add the production custom domain here once one exists
];
