# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-08-31
**Phases:** 4 | **Plans:** 23 | **Sessions:** ~1 (autonomous, 2026-08-28 → 2026-08-31)

### What Was Built
- Core payroll loop: registration, salary/schedule entry, cross-device sync, progressive НДФЛ engine, next-payment forecast
- One-off bonuses (premии/компенсации) taxed through the same cumulative НДФЛ engine
- Отпускные (vacation pay) via ст.139 ТК РФ average-daily-earnings, correctly taxed and folded into the forecast
- Annual gross/tax/net pie chart and iPhone home-screen PWA installability

### What Worked
- Vertical-slice phase sequencing (tracer commit → gap-closure waves) caught real defects each phase's own re-verification round, rather than deferring them
- Pure, zero-I/O domain engines (НДФЛ, vacation-pay, payment-date resolver) built RED-then-GREEN made the highest-risk money math independently testable before any UI touched it
- Re-verification loops (Phase 1 and Phase 2 both needed 2 rounds) reliably found real BLOCKER-severity gaps rather than churning on cosmetic ones

### What Was Inefficient
- Browser-based manual UAT (cross-device convergence, some Phase 3 flows) was repeatedly deferred to automated-test substitutes across multiple phases — this is exactly the gap that let the Phase 4 UAT G-04-2 auth-redirect bug ship undetected since Phase 1's tracer commit (db14032). A real browser check earlier would have caught it 3 phases sooner.
- Debug session file (`auth-no-redirect-standalone.md`) was left at `status: diagnosed` even after its own fix landed two commits later in the same phase — required manual correction at milestone close rather than being closed by the fixing plan itself.

### Patterns Established
- React Hook Form `values` (not `defaultValues`) + explicit `reset()` on Cancel/success for any form editing an already-mounted row (BonusRow Phase 2, VacationRow Phase 3) — `defaultValues` silently goes stale on prop changes
- Never render a computed ₽0 as a confirmed payment amount when source history is empty — use an explicit "not configured" state instead (recurred independently in 2 places in Phase 3)
- `router.refresh()` immediately before `router.push()` after any client-side Better Auth sign-in/sign-up, to avoid the App Router resolving the destination against a stale pre-auth client cache

### Key Lessons
1. When a bug-fix plan lands, update the corresponding debug-session file's `status` in the same commit or the next one — don't let it go stale for a later milestone-close audit to catch.
2. Real-browser UAT for auth/session flows should not be indefinitely substituted with automated tests across multiple phases — schedule it explicitly once a browser tool becomes available, rather than letting it silently persist as an open item.
3. Statute-verification gaps (2025 НДФЛ bracket thresholds, ст.139 divisor) that can't be resolved due to sandboxed environment (no live web access) should be flagged loudly and tracked as a standing pre-production blocker, not just a footnote — carried forward here from STATE.md.

### Cost Observations
- Sessions: 1 continuous autonomous session across all 4 phases
- Notable: 215 commits over 3 calendar days for a 23-plan, 4-phase MVP — heavy use of gap-closure re-verification waves (Phase 1: 5 gap waves, Phase 2: 2 gap waves) rather than large upfront plans

---

## Milestone: v1.1 — Полировка MVP

**Shipped:** 2026-09-03
**Phases:** 4 (5-8) | **Plans:** 17 | **Sessions:** ~1 (autonomous, 2026-08-28 → 2026-09-03, interrupted twice by rate limits and once by a rejected tool call — each time resumed cleanly with no rework)

### What Was Built
- Isolated per-PR preview environments (Vercel + Neon per-branch) and a GitHub Actions CI gate (lint/typecheck/build/unit-tests) blocking merges on `main`
- Auth flow hardened: generic login errors (no account enumeration), empirically verified session-cookie flags and no credential leaks
- Full Playwright e2e suite (golden path, bonuses, vacations, annual pie chart, PWA install) running in CI against a throwaway, isolated Neon branch per run, with Playwright MCP wired up
- Complete visual redesign onto a CSS-variable design-token system across every screen — dark/light theme, consistent money formatting, empty/loading/error states, confirmation dialogs, WCAG AA accessibility, iOS Dynamic Island safe-area handling — with zero change to any calculation logic

### What Worked
- Tracer-first plan ordering (every phase led with one production-quality end-to-end slice before expanding) kept scope honest and surfaced integration problems immediately rather than at phase end
- Independent, hand-computed verification beat trusting agent self-reports twice in the same phase: re-deriving WCAG relative-luminance math by hand caught 2 real contrast failures the UI-SPEC itself had claimed (unverified) were fine, and live-browser DevTools checks confirmed safe-area/focus-ring/dark-mode wiring no automated test covers
- The "zero change to calculation logic" constraint, stated explicitly up front and checked via `git diff --stat` against `src/domain/`, `src/lib/db/`, `src/app/actions/` at every consequential step, held across all 7 Phase 8 plans plus its gap-closure plan — never once violated
- Phase 8's own structural code review caught a real functional gap (annual pie-chart zero-income empty state) and correctly filed it rather than silently passing — closed cleanly via the standard one-retry gap-closure cycle

### What Was Inefficient
- Stale git worktree fork-base recurred twice (Phase 7 Wave 2, Phase 8 Wave 2) with the identical root cause — worktrees created from a very old `origin/main` instead of the live phase-branch HEAD — costing a full re-diagnosis each time before the orchestrator applied the actual fix (`gsd worktree set-baseref`)
- Wave 2's parallel worktree executors in Phase 8 lacked live Neon/Better-Auth credentials, forcing 3 of them to substitute typecheck/lint/render-tests for a real `build`/`test:e2e` run — deferring that verification to Wave 3's full-suite re-run instead of catching problems in-wave
- Two of the three open WINDOWS.md tech-debt items surfaced only during Wave 3's full-suite re-run at the very end of the phase, echoing v1.0's retrospective lesson ("real-browser/full-suite checks deferred repeatedly let bugs ship undetected until the end") — the lesson was recorded but not structurally prevented this milestone either

### Patterns Established
- CSS custom-property design tokens declared dark-mode-first (`:root` = dark values, light theme as a `@media (prefers-color-scheme: light)` override) — matches this product's actual usage pattern (balance-checking in the evening) and keeps one token set as the source of truth
- A color token that serves double duty as both text color and button-background color must have its contrast verified independently in each role — one token can legitimately pass in one role and fail in the other (`--color-accent` did exactly this)
- Playwright CI branch isolation needs the Neon branch provisioned in a standalone CI step *before* `npm run test:e2e` runs — Playwright's own `globalSetup` hook fires too late, after `webServer` has already started

### Key Lessons
1. Stale worktree fork-base is now a repeat defect across two consecutive milestones' multi-wave phases — apply `gsd worktree set-baseref` proactively at the start of any milestone using worktree-isolated parallel waves, rather than rediscovering and re-fixing it per phase.
2. When a design token is reused for both text and background/button roles, treat each role as a separate WCAG contrast check — do not assume one passing ratio covers both.
3. Full-suite verification (build + e2e) inside a parallel worktree requires the same live credentials as the orchestrator's own environment, or executors will silently narrow their acceptance criteria — provision worktree credentials before dispatching Wave 2+ in future milestones, rather than accepting the substitution and re-verifying only at phase close.

### Cost Observations
- Sessions: 1, spanning all 4 phases, resumed cleanly after 2 rate-limit interruptions and 1 rejected-tool-call interruption
- Notable: skipped the formal `--research` step for both Phase 7 and Phase 8 (CONTEXT.md/UI-SPEC.md judged sufficiently detailed already) — no rework resulted from the skip

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 1 | 4 | First milestone — tracer-commit + re-verification gap-closure pattern established |
| v1.1 | 1 | 4 | Added worktree-isolated parallel wave execution and independent hand-verification (WCAG math, live browser) of agent-reported claims rather than trusting self-reports |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 315+ (Vitest, incl. render tests) | Not tracked | — |
| v1.1 | 370 unit (Vitest) + 13 Playwright e2e specs | Not tracked | Playwright 1.62.1, Playwright MCP |

### Top Lessons (Verified Across Milestones)

1. Real-browser UAT deferral is a recurring risk — track it explicitly, don't let it silently roll forward across phases.
2. Stale worktree fork-base is a recurring defect across multi-wave phases in both milestones so far — fix it proactively at milestone start, not reactively per phase.
3. Never trust a design/UI claim (contrast ratio, visual correctness) without independent verification — self-reported "looks fine" from a UI-SPEC or an agent has twice now been wrong on inspection.
