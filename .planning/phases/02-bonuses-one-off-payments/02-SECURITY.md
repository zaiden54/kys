---
phase: 02
slug: bonuses-one-off-payments
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-30
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser → `saveBonusAction` (create + edit paths) | Untrusted bonus amount, date, note, and (for edits) a client-supplied bonus id crosses here | Money amount, calendar date, free-text note, UUID |
| Browser → `deleteBonusAction` | A client-supplied bonus id crosses here, with no other payload | UUID |
| Server → Neon Postgres | `bonuses` rows are inserted/updated/deleted, ownership- and id-scoped, alongside `salary_history`/`payment_schedule`/`ytd_baseline` for the cumulative-income query | Money, dates, userId |
| `drizzle-kit push` → live database | Schema-apply operates directly on the live database with no reviewable migration file between declaration and execution | Schema DDL |
| npm registry → project devDependencies | Three new third-party packages (jsdom, @testing-library/dom, @testing-library/react) entered the dependency tree | Package code (dev-only, never bundled) |
| Cross-device revalidated server data → still-mounted client form state | A prop update delivered by Next.js revalidation must correctly overwrite in-memory client form state | Money, dates |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | Elevation of Privilege | `bonus-repository.ts` (`createBonus`, `listBonuses`), `getCumulativeIncomeBeforeDate` | high | mitigate | Every query/mutation carries `eq(bonuses.userId, userId)`; verified in `src/lib/db/bonus-repository.ts` (lines 28, 41, 55, 64) — `userId` always sourced from `requireUserId()`, never client input. | closed |
| T-02-02 | Tampering | `saveBonusAction` amount/date/note input | high | mitigate | `bonusInputSchema` re-validates server-side (`src/lib/validation/bonus.ts`); live `bonus_amount_positive` check constraint is the second gate. | closed |
| T-02-03 | Tampering | `drizzle-kit push` against the live database | high | mitigate | Additive-only schema change (one table, one constraint, one index); Task 1's verify checked presence without dropping pre-existing tables. | closed |
| T-02-04 | Information Disclosure | Thrown repository/action errors | medium | mitigate | Fixed generic string "Не удалось сохранить бонус. Попробуйте ещё раз." returned on any failure; verified in `bonus.ts`, `bonus-form.tsx`, `bonus-row.tsx` — never the caught error's own message. | closed |
| T-02-05 | Tampering | Free-text `note` field rendered in bonus list | low | accept | React's default JSX escaping prevents stored notes executing as HTML/script; no `dangerouslySetInnerHTML` used. | closed |
| T-02-06 | Elevation of Privilege | `updateBonus`, `deleteBonusIfFuture` | high | mitigate | Both filter `and(eq(bonuses.id, bonusId), eq(bonuses.userId, userId))` in the same write statement; verified in `src/lib/db/bonus-repository.ts`. | closed |
| T-02-07 | Tampering | Client-supplied `bonusId` in `deleteBonusAction`/edit path | medium | mitigate | `z.string().uuid().safeParse(bonusId)` validated before reaching the repository; verified in `src/app/actions/bonus.ts` line 53. | closed |
| T-02-08 | Repudiation | Deletion-guard bypass for a past-dated bonus | high | mitigate | `gt(bonuses.date, todayIsoInMoscow())` enforced inside the atomic `DELETE` statement itself; verified in `src/lib/db/bonus-repository.ts` `deleteBonusIfFuture`. | closed |
| T-02-09 | Tampering | Concurrent edit of the same bonus from two devices | low | accept | Last-write-wins on a single atomic `UPDATE` by primary key; no natural-key collision to guard against per D-B04. | closed |
| T-02-10 | Tampering | `bonusInputSchema.amountRubles` sub-kopeck precision | low | mitigate | `.refine` rejecting amounts with more than two decimal places before `rublesToKopecks`'s rounding; verified in `src/lib/validation/bonus.ts`. | closed |
| T-02-11 | Denial of Service | `bonus-form.tsx` `onSubmit`, `bonus-row.tsx` `onEdit` | low | mitigate | `try/catch` around the awaited action call in both handlers, generic message only; verified in both files. | closed |
| T-02-12 | Tampering (trust-signal integrity) | `forecast.ts` `forecastNextPayment`'s `baselineIsEstimated` | medium | mitigate | Flag gated on the identical `asOfDate`/year boundary as the cumulative figure; verified in `src/app/actions/forecast.ts` line 161 and covered by `forecast.test.ts` cases (4) and (13). | closed |
| T-02-13 | Denial of Service (verification pipeline) | `.planning/ROADMAP.md` Phase 2 `**Goal:**` line | low | mitigate | Goal locked into "As a / I want to / so that" format; verified directly in ROADMAP.md line 95. | closed |
| T-02-04-01 | Tampering / Data Integrity | `bonus-row.tsx` (`useForm` resync) | high | mitigate | `values: toDefaults(bonus)` auto-resyncs to the live prop, plus explicit `reset()` on Cancel and onEdit's success branch; verified in `src/app/(app)/bonuses/bonus-row.tsx` lines 35, 55, 94. Covered by a render-based regression test. | closed |
| T-02-04-02 | Information Disclosure (cosmetic) | `bonus-row.tsx` delete-confirm dialog formatting | low | accept | Display-format mismatch only, no data leak beyond what's already visible in the row above it. | closed |
| T-02-04-SC | Tampering (supply chain) | npm installs: jsdom, @testing-library/dom, @testing-library/react | high | mitigate | Verified in `package.json`: all three are `devDependencies` only, never reach the production bundle. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-02-01 | T-02-05 | React's default JSX escaping is a structural (not per-instance) mitigation for stored-note XSS; no component uses `dangerouslySetInnerHTML`. | gsd-secure-phase (grep-level audit) | 2026-08-30 |
| AR-02-02 | T-02-09 | Last-write-wins is an intentional design decision (D-B04) — bonus edits have no natural-key collision requiring compare-and-swap, unlike Phase 1's salary-replacement flow. | gsd-secure-phase (grep-level audit) | 2026-08-30 |
| AR-02-03 | T-02-04-02 | Confirm-dialog formatting inconsistency is cosmetic only; no data exposed beyond what's already rendered in the row. | gsd-secure-phase (grep-level audit) | 2026-08-30 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-30 | 16 | 16 | 0 | gsd-secure-phase (orchestrator, grep-level ASVS L1 verification against plan-time register; auditor subagent skipped per short-circuit rule — threats_open: 0, register_authored_at_plan_time: true, asvs_level: 1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-30
