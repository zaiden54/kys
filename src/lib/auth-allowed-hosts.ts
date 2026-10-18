/**
 * Single source of truth for every trusted Better Auth request origin in
 * this project (SEC-04). The `on-hands-*-careeremit-9861s-projects.vercel.app`
 * pattern is scoped to this project's actual Vercel deployment naming
 * convention — it covers PR-preview hash URLs (e.g.
 * `on-hands-6zdzwlrld-careeremit-9861s-projects.vercel.app`) and git-branch
 * aliases (e.g. `on-hands-git-main-careeremit-9861s-projects.vercel.app`) —
 * without trusting the entire shared `*.vercel.app` apex domain, which
 * anyone can claim a subdomain of regardless of project.
 *
 * better-auth's `wildcardMatch` requires the literal characters immediately
 * surrounding a `*` to be present in the input, so the wildcard pattern
 * above does NOT match the two "bare" production hostnames documented as
 * live in `.planning/phases/05-deploy-pipeline-environment-config/DEPLOYMENT.md`
 * (`on-hands-three.vercel.app` has no `careeremit` segment at all, and
 * `on-hands-careeremit-9861s-projects.vercel.app` has only one hyphen
 * between `on-hands` and `careeremit`, not the two the wildcard requires).
 * They are listed below as explicit exact entries instead — verified
 * empirically against the installed `better-auth` package's
 * `matchesHostPattern` (see `auth-allowed-hosts.test.ts`).
 *
 * Deliberately free of any other imports (no env-schema module, no db
 * module) so it can be imported without pulling in a live-DB dependency —
 * that is exactly why it lives as its own module rather than inline in
 * auth.ts.
 */
export const ALLOWED_AUTH_HOSTS: string[] = [
  "localhost:3000",
  "on-hands-*-careeremit-9861s-projects.vercel.app", // PR previews + branch aliases
  "on-hands-careeremit-9861s-projects.vercel.app", // production: team-scoped default domain (no branch segment)
  "on-hands-three.vercel.app", // production: project's short default domain
];
