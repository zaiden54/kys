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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 1 | 4 | First milestone — tracer-commit + re-verification gap-closure pattern established |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 315+ (Vitest, incl. render tests) | Not tracked | — |

### Top Lessons (Verified Across Milestones)

1. Real-browser UAT deferral is a recurring risk — track it explicitly, don't let it silently roll forward across phases.
