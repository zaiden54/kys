---
phase: 05-deploy-pipeline-environment-config
verified: 2026-09-01T17:15:00Z
human_confirmed: 2026-09-01
status: passed
score: 6/6 truths verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "Every PR runs lint + typecheck + unit tests via GitHub Actions, and a failing check blocks merge (DEPLOY-03) — with the codebase in a lint-clean state"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Confirm BETTER_AUTH_SECRET differs between Production and Preview in the Vercel dashboard (on-hands project → Settings → Environment Variables)"
    expected: "BETTER_AUTH_SECRET has a distinct value for Preview vs. Production — no shared production secret leaking into Preview"
    why_human: "No available tool (Neon MCP, Vercel MCP, or an authenticated vercel CLI session) can read or write Vercel project environment variables in this environment. This is a disclosed, ledgered gap (WINDOWS.md entry #4, open) with DATABASE_URL already confirmed auto-scoped per-branch — only BETTER_AUTH_SECRET is unverified."
    result: "confirmed 2026-09-01 — user set separate BETTER_AUTH_SECRET values for Preview and Production in the Vercel dashboard (screenshot: two distinct entries, added/updated minutes apart). WINDOWS.md #4 marked fixed; DEPLOY-02 marked Complete."
  - test: "Open PR #2's preview URL while logged into the project's Vercel account and exercise register/login now that CI is green"
    expected: "App loads, register/login succeed, no cross-environment redirect or cookie failures — confirming SEC-04's dynamic allowedHosts resolution end-to-end on a live deployment, not just via the unit test"
    why_human: "Vercel Authentication (SSO) is enabled project-wide and blocks unauthenticated/scripted access to every non-custom-domain deployment URL, including PR-previews. This is why DEPLOYMENT.md's release procedure explicitly documents this step as manual. The unit test (auth-allowed-hosts.test.ts) proves the resolution logic is correct against the installed better-auth package, but does not exercise a live HTTP request/response/cookie cycle."
    result: "confirmed 2026-09-01 — user completed a real registration on the PR-preview deployment (https://on-hands-git-gsd-phase-05-depl-ae5802-careeremit-9861s-projects.vercel.app/), proving SEC-04's dynamic allowedHosts resolution end-to-end on a live deployment."
---

# Phase 5: Deploy Pipeline & Environment Config Verification Report

**Phase Goal:** Changes move from feature branch to production through one safe, unambiguous pipeline — isolated per-PR preview environments separate from production, environment-scoped configuration, and no double-deploy races — with `BETTER_AUTH_URL`/allowed-hosts resolving correctly everywhere.

**Verified:** 2026-09-01T17:15:00Z
**Human-confirmed:** 2026-09-01
**Status:** passed
**Re-verification:** Yes — after gap closure, then human confirmation of both deferred items

## Human Confirmation (2026-09-01)

Both deferred human-verification items are now confirmed by the user directly:

1. **BETTER_AUTH_SECRET Preview/Production scoping** — user set separate values via the Vercel dashboard (screenshot confirms two distinct `BETTER_AUTH_SECRET` entries, one scoped to Preview, one to Production). `WINDOWS.md` #4 marked fixed; `REQUIREMENTS.md` DEPLOY-02 marked Complete.
2. **Live register/login on PR #2's preview URL** — user completed a real registration at `https://on-hands-git-gsd-phase-05-depl-ae5802-careeremit-9861s-projects.vercel.app/`, confirming SEC-04's dynamic `allowedHosts` resolution works end-to-end on a live deployment, not just in the unit test.

All 6 truths (DEPLOY-01 through DEPLOY-05, SEC-04) are now fully verified. Phase 5 is complete.

**Note on scope revision:** Phase 5's goal and DEPLOY-01/DEPLOY-04 wording were deliberately, user-approved revised mid-execution — a standalone persistent `staging` environment was dropped in favor of the already-live Vercel↔Neon per-PR preview isolation (see `05-04-SUMMARY.md` key-decisions, `ROADMAP.md` Phase 5 section, `DEPLOYMENT.md`). This verification checks the revised scope as the operative contract, not the original "persistent staging" wording. This revision itself is well-documented, cross-referenced consistently across `ROADMAP.md`, `REQUIREMENTS.md`, `DEPLOYMENT.md`, and `05-04-SUMMARY.md`, and is treated as legitimate — it is not counted as a gap.

## Re-Verification Summary

The prior verification pass (2026-09-01, initial) found exactly one gap: `npm run lint` exited 1 on this branch due to `react-hooks/set-state-in-effect` in `src/lib/use-standalone.ts:35`, a regression introduced by review-fix commit `4b14b2a` (which legitimately fixed an SSR-hydration-mismatch bug but reintroduced a synchronous `setState` inside a mount effect) and never caught by the 3 prior review iterations.

This gap has been independently re-verified as closed, not just accepted on the executor's word:

- Commit `2b3bed0` ("fix(05): rewrite useIsStandalone with useSyncExternalStore, fixing CI lint regression") rewrites `src/lib/use-standalone.ts` to use `useSyncExternalStore` — the same hydration-safe pattern already used by `src/components/install-banner.tsx` for its own boolean state (`getDismissedSnapshot`/`getDismissedServerSnapshot`/`subscribeToDismissed`). Read directly: the file no longer contains `useState` or `useEffect` at all; the server snapshot (`getStandaloneServerSnapshot`) always returns `false`, matching the original hydration fix's intent without a post-mount `setState`.
- `npm run lint` run directly in this session: **exit 0** — 0 errors, 2 pre-existing warnings (`error.tsx` unused var, `vacation-form.tsx` React Compiler skip notice), neither in a phase-modified file.
- `npx tsc --noEmit` run directly: **exit 0**, no output.
- `npx vitest run src/components/install-banner.render.test.tsx` run directly: **4/4 passing** (this is the test that exercises `useIsStandalone` indirectly through the banner; no dedicated `use-standalone.test.ts` exists, matching what was claimed).
- `npx vitest run src/lib/auth-allowed-hosts.test.ts` run directly: **10/10 passing** — SEC-04 resolution logic unaffected, unchanged from prior verification.
- Full CI-scoped unit-test command (the exact `--exclude` list from `.github/workflows/ci.yml`) run directly: **29 test files, 291/291 tests passing** — identical count to the prior verification pass, confirming no regression was introduced by the other commits (`098089d`, `7bb51d7`, `fd67642`, `caf3656`, `c5ffd07`, `a04eacf`, `a4d7605`) that landed between the prior verification and now.
- Live CI on the real PR, checked directly via `gh pr checks 2` and `gh pr view 2 --json headRefOid,mergeable,mergeStateStatus,statusCheckRollup`: `ci  pass  1m35s` (run `33516897414`, job `99886065166`, conclusion `SUCCESS`), at `headRefOid = 2b3bed0f57a0af93a3eec308cac63ac4d609e442` — exactly the fix commit, not a stale prior run. `mergeStateStatus: CLEAN`, `mergeable: MERGEABLE`. `Vercel` and `Vercel Preview Comments` checks also both `pass`.
- Branch protection re-confirmed live and unchanged: `gh api repos/zaiden54/kys/branches/main/protection` → `required_status_checks.contexts: ["ci"]`, `enforce_admins.enabled: true`.
- DEPLOY-05 (no double-deploy) re-confirmed: `grep -c 'vercel deploy\|vercel --prod' .github/workflows/ci.yml` → 0; `gh api repos/zaiden54/kys/deployments` → all 14 deployments created by `vercel[bot]`, no GitHub-Actions-triggered deployment.
- `src/lib/auth-allowed-hosts.ts` and `src/lib/auth.ts` re-read directly: unchanged from prior verification, still wired identically (4 allowlist entries including the two CR-01 bare production hostnames; `auth.ts` still imports and wires `ALLOWED_AUTH_HOSTS` into `baseURL.allowedHosts`, no `env.BETTER_AUTH_URL` reference).
- `src/env.ts` / `.env.example` re-checked: `BETTER_AUTH_URL` still `.optional()`, still commented out in the example file.
- No debt markers (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`) found in `src/lib/use-standalone.ts` or `src/components/install-banner.tsx`.

**Gap closed. No regressions found in any of the previously-passing must-haves.**

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every PR gets its own isolated preview URL (own Vercel branch-alias domain + own Neon branch), reachable independent of production, shows its own data (DEPLOY-01) | ✓ VERIFIED | Unchanged from prior verification. `DEPLOYMENT.md` documents the mechanism; re-confirmed live via `gh api repos/zaiden54/kys/deployments` (all 14 deployments created by `vercel[bot]`). |
| 2 | Login/register succeed on PR-preview and production alike, with `BETTER_AUTH_URL`/allowed-hosts resolving to the right origin on each — no cross-environment redirect/cookie failures (SEC-04) | ✓ VERIFIED (code-level) | `src/lib/auth.ts:27` wires `baseURL: { allowedHosts: ALLOWED_AUTH_HOSTS }`. `src/lib/auth-allowed-hosts.test.ts` re-run directly: **10/10 passing**. Live end-to-end login remains routed to human verification below (Vercel SSO blocks scripting it) — now that CI is green, this check is actionable. |
| 3 | Opening a PR triggers exactly one deploy path per environment; GitHub Actions and Vercel auto-deploy never both deploy the same environment (DEPLOY-05) | ✓ VERIFIED | Re-confirmed: `.github/workflows/ci.yml` has no deploy step (0 matches for `vercel deploy`/`vercel --prod`); all 14 deployments in `gh api .../deployments` created by `vercel[bot]`. |
| 4 | Every PR runs lint + typecheck + unit tests via GitHub Actions, and a failing check blocks merge (DEPLOY-03) — with the codebase in a lint-clean state | ✓ VERIFIED (gap closed) | `npm run lint` exits 0 (0 errors, 2 pre-existing unrelated warnings), `npx tsc --noEmit` exits 0, CI-scoped unit tests 291/291 passing — all confirmed by direct execution in this session. Live PR #2 `ci` check now shows `pass` (run `33516897414`) at `headRefOid 2b3bed0`, matching the current branch HEAD exactly. Branch protection (`required_status_checks.contexts: ["ci"]`, `enforce_admins: true`) confirmed still live. |
| 5 | A documented feature-branch → PR-preview (manual check) → production release procedure exists, has been followed for a real deploy, env vars confirmed correctly scoped per environment (DEPLOY-04, DEPLOY-02) | ⚠️ PARTIAL (disclosed) | Unchanged from prior verification. `DATABASE_URL` scoping confirmed (Vercel↔Neon Marketplace integration). `BETTER_AUTH_SECRET` Preview-environment scoping remains unverified — no tool access to read/write Vercel env vars. Disclosed in `DEPLOYMENT.md`, `REQUIREMENTS.md` (DEPLOY-02 marked "Partial"), and `WINDOWS.md` ledger entry #4 (open). Per task instruction, not treated as a phase failure — routed to human verification. |

**Score:** 5/5 truths now fully verified (truth #4's regression closed and re-confirmed live); 1 additional truth (#5) partially verified with an honestly disclosed, ledgered, non-blocking gap (DEPLOY-02/BETTER_AUTH_SECRET), routed to human verification per the task's explicit guidance.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/use-standalone.ts` | Hydration-safe standalone-mode detection, lint-clean | ✓ VERIFIED | Rewritten (commit `2b3bed0`) to use `useSyncExternalStore` instead of `useState`+`useEffect`; no `react-hooks/set-state-in-effect` violation; matches `install-banner.tsx`'s existing pattern for the same class of problem. |
| `src/lib/auth-allowed-hosts.ts` | Single source of truth for trusted Better Auth hosts | ✓ VERIFIED | Unchanged; 4 entries, CR-01 fix intact. |
| `src/lib/auth-allowed-hosts.test.ts` | DB-independent proof of dynamic baseURL resolution | ✓ VERIFIED | 10/10 passing, re-run directly. |
| `src/lib/auth.ts` | Consumes `ALLOWED_AUTH_HOSTS`, no static `BETTER_AUTH_URL` read for baseURL | ✓ VERIFIED | Unchanged. |
| `.github/workflows/ci.yml` | Lint + typecheck + unit tests + build, gates merge, no deploy step | ✓ VERIFIED | Now green on PR #2 at current HEAD (`2b3bed0`), not just structurally present. |
| `.planning/phases/05-deploy-pipeline-environment-config/DEPLOYMENT.md` | Documented release procedure | ✓ VERIFIED | Its "CI went green" claim, previously stale, is now true again at the current branch HEAD. |
| `src/env.ts` / `.env.example` / `README.md` | Reflect `BETTER_AUTH_URL` no longer required for server baseURL | ✓ VERIFIED | Unchanged. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/lib/auth.ts` | `src/lib/auth-allowed-hosts.ts` | `import { ALLOWED_AUTH_HOSTS }` consumed by `baseURL.allowedHosts` | ✓ WIRED | Unchanged. |
| `.github/workflows/ci.yml` | GitHub branch protection on `main` | `required_status_checks.contexts: ["ci"]` | ✓ WIRED | Confirmed live; PR #2 is now `MERGEABLE`/`CLEAN` with the gate passing on real green checks — demonstrates the gate works in both the fail and pass direction. |
| Vercel git integration | Neon Marketplace integration | Per-branch Neon database auto-provisioning | ✓ WIRED | Unchanged. |
| `src/components/install-banner.tsx` | `src/lib/use-standalone.ts` | `useIsStandalone()` call, now both using `useSyncExternalStore` consistently | ✓ WIRED | Confirmed by direct read of both files — same hydration-safe pattern used in both, no drift. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| SEC-04 dynamic host resolution (single named test file) | `npx vitest run src/lib/auth-allowed-hosts.test.ts` | 10/10 passing | ✓ PASS |
| `npm run lint` exits 0 | `npm run lint` | Exit 0 — 0 errors, 2 pre-existing unrelated warnings | ✓ PASS |
| `npx tsc --noEmit` exits 0 | `npx tsc --noEmit` | Exit 0, no output | ✓ PASS |
| Install-banner hydration/mount test (exercises rewritten `useIsStandalone`) | `npx vitest run src/components/install-banner.render.test.tsx` | 4/4 passing | ✓ PASS |
| CI-scoped unit tests (matching `.github/workflows/ci.yml`'s exact `--exclude` list) | `npm test -- --exclude ... (6 files)` | 29 test files, 291/291 tests passing (identical to prior pass) | ✓ PASS |
| DEPLOY-05: no deploy step in CI, single deployer | `grep 'vercel deploy\|vercel --prod' .github/workflows/ci.yml` + `gh api repos/zaiden54/kys/deployments` | 0 matches; all 14 deployments created by `vercel[bot]` | ✓ PASS |
| PR #2's live CI status | `gh pr checks 2` | `ci  pass  1m35s` (run 33516897414), `Vercel  pass`, `Vercel Preview Comments  pass` | ✓ PASS |
| PR #2's HEAD matches the fix commit | `gh pr view 2 --json headRefOid,mergeable,mergeStateStatus` | `headRefOid: 2b3bed0f...`, `mergeable: MERGEABLE`, `mergeStateStatus: CLEAN` | ✓ PASS |
| Branch protection live and enforced | `gh api repos/zaiden54/kys/branches/main/protection` | 200, `required_status_checks.contexts: ["ci"]`, `enforce_admins.enabled: true` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SEC-04 | 05-01 | Dynamic `BETTER_AUTH_URL`/allowed-hosts resolution | ✓ SATISFIED | Unchanged, re-confirmed passing. |
| DEPLOY-01 | 05-04 | Isolated per-PR preview env (Vercel domain + Neon branch), separate from prod | ✓ SATISFIED | Unchanged, re-confirmed live. |
| DEPLOY-02 | 05-04 | Env vars correctly scoped per environment | ⚠️ PARTIAL (disclosed) | Unchanged — DATABASE_URL confirmed; BETTER_AUTH_SECRET Preview scoping unverified — WINDOWS.md #4, human verification item above. |
| DEPLOY-03 | 05-02, 05-03 | GitHub Actions runs lint+typecheck+tests, blocks merge on failure | ✓ SATISFIED (gap closed) | Gate proven functioning in both directions: blocked a red PR previously, now passes a genuinely green PR at the current HEAD. |
| DEPLOY-04 | 05-04 | Documented release procedure, exercised for a real deploy | ✓ SATISFIED (disclosed, revised scope) | Unchanged. |
| DEPLOY-05 | 05-03 | No double-deploy race; single owner per environment | ✓ SATISFIED | Unchanged, re-confirmed. |

No orphaned requirements — all 6 IDs declared in this phase's PLAN frontmatter (SEC-04, DEPLOY-01 through DEPLOY-05) match REQUIREMENTS.md's Phase 5 mapping exactly.

### Anti-Patterns Found

None. The previously-found blocker (`react-hooks/set-state-in-effect` in `src/lib/use-standalone.ts:35`) is resolved — the file no longer contains a mount-effect `setState` at all (rewritten with `useSyncExternalStore`). No debt-marker comments (`TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, `PLACEHOLDER`) found in `src/lib/use-standalone.ts`, `src/components/install-banner.tsx`, or any other file modified across `05-01` through this re-verification's fix commit.

### Human Verification Required

See `human_verification` in frontmatter — 2 items, both unchanged from the prior verification pass (neither depended on the lint gap; the second is now more actionable since CI is green):
1. Confirm `BETTER_AUTH_SECRET` is distinctly scoped between Production and Preview in the Vercel dashboard (WINDOWS.md #4, disclosed, non-blocking per task instruction).
2. Click through PR #2's live preview URL to confirm register/login actually succeed end-to-end (Vercel SSO blocks scripting this) — now unblocked since CI is green and the preview deployment reflects the fix commit.

### Gaps Summary

No gaps remain. The single gap from the prior verification pass — `npm run lint` failing on `src/lib/use-standalone.ts` due to a `react-hooks/set-state-in-effect` regression reintroduced by commit `4b14b2a` — has been independently re-verified as closed via commit `2b3bed0`, which rewrites the hook using `useSyncExternalStore` (mirroring the existing `install-banner.tsx` pattern), eliminating the effect-driven `setState` entirely rather than merely suppressing the lint rule. `npm run lint`, `npx tsc --noEmit`, the affected component's test, `auth-allowed-hosts.test.ts`, and the full CI-scoped unit-test suite (291/291) were all re-run directly in this session and pass. The real PR's live CI check (`gh pr checks 2`, run `33516897414`) confirms `ci pass` at the exact current HEAD (`2b3bed0`), not a stale prior run, and the PR is now `MERGEABLE`/`CLEAN`.

Status is `human_needed` rather than `passed` because two disclosed human-verification items remain outstanding (BETTER_AUTH_SECRET Preview-scoping confirmation and live end-to-end login on the preview URL) — both pre-existing, non-blocking, and explicitly ledgered per the task's instructions, not new findings from this re-verification.

---

_Verified: 2026-09-01T17:15:00Z_
_Verifier: Claude (gsd-verifier)_
