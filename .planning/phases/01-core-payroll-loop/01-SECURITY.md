---
phase: 01
slug: core-payroll-loop
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-29
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| npm registry → developer machine | Third-party package code executes at install/build time | package code |
| application process → Neon Postgres | Financial personal data crosses the network and is persisted | salary, schedule, YTD, tax figures |
| environment/secret store → application | `DATABASE_URL` / `BETTER_AUTH_SECRET` enter the process | credentials |
| browser → `/api/auth/*` | Untrusted credentials and registration input | email, password |
| browser cookie → server session read | Session cookie is the only accepted identity claim | session token |
| Server Action / RSC → domain engine | Validated but user-originated amounts/dates enter pure tax functions | gross amounts, dates |
| domain engine → rendered output | Every money figure the user sees originates here | computed tax/net figures |
| browser form → Server Action | Untrusted salary amounts, dates, day numbers | FormData |
| Server Action → repository → Postgres | User id must originate from session, never payload | ownership-scoped writes |
| host runtime clock/timezone → application | Serverless host's `TZ`/system clock is external configuration | wall-clock reads |
| server → client bundle | `src/domain/time.ts` crosses into user-inspectable code | Moscow date defaults |
| two authenticated devices → one user's rows | Legitimate concurrent cross-device writes to the same rows | salary/schedule/YTD rows |
| Neon HTTP driver → Postgres | Each statement is an independent HTTP request with no interactive transaction | write statements |
| any future non-action writer → money columns | Migration/admin tooling could bypass Zod schemas | salary_history, ytd_baseline |
| `drizzle-kit push` → live database | Schema-apply operates directly on the live DB with no reviewable migration file | schema changes |
| Browser form → Server Action (confirmation flow) | Amount, effective date, and confirmation claim are attacker-controlled FormData | confirmation claims |
| Device A session ↔ Device B session (same account) | Two authenticated sessions writing the same dated row | conflicting writes |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-SC | Tampering | npm installs (Plan 01-01) | high | mitigate | Package-legitimacy blocking-human gate; deprecated-package build failure | closed |
| T-01-01 | Elevation of Privilege | `salary_history`, `payment_schedule`, `ytd_baseline`, actions, page (Plans 01-01/02/04/05) | high | mitigate | Not-null `user_id` FK + cascade delete; `requireUserId()` sole identity source; ownership-scoped queries verified by grep (`requireUserId` used in 7 files) | closed |
| T-01-03 | Spoofing | Better Auth session config (Plans 01-01/02) | medium | mitigate | Explicit session lifetime (30-day/7-day), default cookie flags preserved, 32-byte validated secret | closed |
| T-01-05 | Information Disclosure | `.env.local` (Plan 01-01) | high | mitigate | `.gitignore` contains `.env*` / `!.env.example`; `git check-ignore .env.local` confirms ignored | closed |
| T-01-06 | Denial of Service | Missing/malformed env vars at boot (Plan 01-01) | low | accept | `@t3-oss/env-nextjs` fails loudly at boot; acceptable for solo-operated app | closed |
| T-01-07 | Spoofing | `POST /api/auth/sign-up/email` duplicate + race (Plan 01-02) | high | mitigate | Unique-email constraint in Better Auth `user` table; race-path test proves single row | closed |
| T-01-08 | Information Disclosure | Auth error messages (Plan 01-02) | low | accept | Better Auth default messages; account-enumeration hardening routed to future secure-phase pass | closed |
| T-01-09 | Denial of Service | Unthrottled credential submission (Plan 01-02) | medium | transfer | Deployment-layer rate limiting deferred to Phase 4 (Vercel platform) | closed |
| T-01-02 | Tampering | `calculateNdfl` execution site (Plans 01-03/05) | high | mitigate | Pure, framework-free tax modules; server-only invocation; grep-asserted absence from client bundle | closed |
| T-01-10 | Tampering | Tax-year selection / unverified bracket scale (Plans 01-03/05) | high | mitigate | `bracketsForYear` throws `UnsupportedTaxYearError` outside verified range (confirmed present in `ndfl-brackets.ts`); `MAX_VERIFIED_TAX_YEAR` gate | closed |
| T-01-11 | Information Disclosure | Money values in thrown error messages (Plan 01-03) | low | accept | `UnsupportedTaxYearError` names only the year, never an amount | closed |
| T-01-12 | Denial of Service | Unbounded loop in weekend/holiday backward walk (Plan 01-03) | low | mitigate | Loop bounded by longest RU non-working run (~8 days); tested directly | closed |
| T-01-13 | Tampering | Server Action input (`grossRubles`, day numbers, dates) (Plan 01-04) | high | mitigate | Zod parsing at action boundary + Postgres check constraints confirmed in `schema.ts` (`salary_gross_amount_positive`, day-range checks) | closed |
| T-01-04 | Information Disclosure | Salary amounts in logs/errors (Plans 01-04/05) | medium | mitigate | No logging calls in repository/actions/forecast modules (grep confirms no `console.*` in `src/domain/`, `src/lib/db/`) | closed |
| T-01-14 | Repudiation | D-14 overwrite discards prior salary value (Plan 01-04) | medium | accept | Accepted per D-14; mitigated at interaction layer via confirm-before-overwrite prompt (superseded/hardened by T-01-11-01..04 in Plan 01-11) | closed |
| T-01-15 | Denial of Service | Unbounded amount input (Plan 01-04) | low | mitigate | 100,000,000 ruble ceiling keeps kopeck values in safe integer range | closed |
| T-01-16 | Information Disclosure | Response caching of per-user server render (Plan 01-05) | medium | mitigate | Session cookie read via `headers()` opts render out of static generation | closed |
| T-01-06-01 | Tampering | `src/domain/time.ts` / `nextPaymentOnOrAfter` (Plan 01-06) | high | mitigate | Moscow fields derived via UTC accessors on shifted epoch; test suite run under `TZ=UTC` and `TZ=Asia/Vladivostok` | closed |
| T-01-06-02 | Tampering | `updatedAt` writes (Plan 01-06) | medium | mitigate | Real-instant constructor gated; no Moscow helper adjacent to `updatedAt` | closed |
| T-01-06-03 | Information Disclosure | new code in forecast/salary modules (Plan 01-06) | low | mitigate | No-logging-of-money convention preserved (grep confirms no `console.*`) | closed |
| T-01-06-04 | Spoofing | client-side `todayIsoInMoscow()` form default (Plan 01-06) | low | accept | Client value is only a form default; server re-validates via schemas and `requireUserId()` | closed |
| T-01-06-SC | Tampering | npm supply chain (Plan 01-06) | high | mitigate | Zero new packages; hand-rolled UTC+3 offset; package-file diff gate | closed |
| T-01-07-01 | Tampering | `replaceSalaryAt` partial-failure window (Plan 01-07) | high | mitigate | `onConflictDoUpdate` confirmed in `salary-repository.ts` (4 call sites); no delete+insert pattern remains | closed |
| T-01-07-02 | Repudiation | D-14 confirm-before-overwrite race (Plan 01-07) | high | mitigate | Both concurrent calls succeed against unique index; exactly one row survives | closed |
| T-01-07-03 | Tampering | Conflict arbiter scope across writes (Plan 01-07) | high | mitigate | Arbiter includes `user_id` / is the `user_id` primary key; cross-user isolation asserted in race test | closed |
| T-01-07-04 | Denial of Service | `upsertSchedule`/`upsertYtdBaseline` double-submit (Plan 01-07) | medium | mitigate | Both calls resolve as upserts via `onConflictDoUpdate` | closed |
| T-01-07-05 | Tampering | `updated_at`/`created_at` timestamp columns (Plan 01-07) | medium | mitigate | True UTC instant rule carried forward; count gate on `updatedAt: new Date()` | closed |
| T-01-07-06 | Information Disclosure | new repository/action code (Plan 01-07) | low | mitigate | No-logging-of-money convention preserved | closed |
| T-01-07-SC | Tampering | npm supply chain (Plan 01-07) | high | mitigate | Zero new packages; `onConflictDoUpdate` ships with installed `drizzle-orm` | closed |
| T-01-08-01 | Tampering | `salary_history.gross_amount_kopecks`, `ytd_baseline.amount_kopecks` (Plan 01-08) | high | mitigate | Database `check()` constraints confirmed present in `schema.ts` | closed |
| T-01-08-02 | Tampering | `drizzle-kit push` against live database (Plan 01-08) | high | mitigate | Generated statement list inspected before acceptance; destructive ops halt the task | closed |
| T-01-08-03 | Tampering | `NDFL_SCALES` bracket ordering (Plan 01-08) | medium | mitigate | `assertStrictlyAscending` confirmed present and tested in `ndfl-brackets.ts` / `.test.ts` | closed |
| T-01-08-04 | Repudiation | header comment asserting unperformed statute verification (Plan 01-08) | medium | mitigate | Misleading comment removed; points at open human_verification item | closed |
| T-01-08-05 | Tampering | `halfSplitGross` reconciliation (Plan 01-08) | low | mitigate | Floor + remainder construction removes one-kopeck drift; asserted over parity table | closed |
| T-01-08-06 | Information Disclosure | new forecast/schema code (Plan 01-08) | low | mitigate | No-logging-of-money convention preserved | closed |
| T-01-08-07 | Spoofing | product identity in link previews / iOS home screen (Plan 01-08) | low | accept | Cosmetic misidentification only; PWA integrity controls are Phase 4 scope | closed |
| T-01-08-SC | Tampering | npm supply chain (Plan 01-08) | high | mitigate | Zero new packages; package-file diff gate in all tasks | closed |
| T-01-09-01 | Tampering | `salaryInputSchema.grossRubles` precision (Plan 01-09) | high | mitigate | Exact stored-precision predicate enforced; boundary-table tests | closed |
| T-01-09-02 | Information Disclosure | `saveSalaryAction` persistence catch (Plan 01-09) | high | mitigate | Fixed generic Russian field error only; no DB message/amount leaked (grep confirms no logging added) | closed |
| T-01-09-03 | Denial of Service | `SalaryForm.submit` rejected promise (Plan 01-09) | medium | mitigate | Async rejection caught in event-handler path; AST test pins try/catch wiring | closed |
| T-01-09-04 | Elevation of Privilege | `saveSalaryAction` ownership (Plan 01-09) | high | mitigate | `requireUserId()` preserved as first action operation | closed |
| T-01-09-05 | Repudiation | failed mutation + cache revalidation (Plan 01-09) | medium | mitigate | Explicit structured failure result; no success-only revalidation on failure | closed |
| T-01-09-SC | Tampering | npm supply chain (Plan 01-09) | high | mitigate | Zero package changes; package-file diff gate | closed |
| T-01-10-01 | Tampering | `getCumulativeIncomeBeforeDate` accrual window (Plan 01-10) | high | mitigate | Window bound derived server-side from persisted baseline + payment year; DB-backed calendar-year-reset test | closed |
| T-01-10-02 | Elevation of Privilege | schedule/salary-history reads in cumulative path (Plan 01-10) | high | mitigate | Uniform user-id equality filters via `getSchedule`/`listSalaryHistory`; cross-user isolation test | closed |
| T-01-10-03 | Information Disclosure | accrual errors/forecast failures (Plan 01-10) | high | mitigate | No amount-bearing errors; `UnsupportedTaxYearError` carries only a year | closed |
| T-01-10-04 | Tampering | `saveYtdBaselineAction` as-of date (Plan 01-10) | medium | mitigate | Schema-validated before persistence; tightened further in Plan 01-12 | closed |
| T-01-10-05 | Denial of Service | event enumeration span (Plan 01-10) | medium | mitigate | Window bounded by calendar-year reset (~13 months max) | closed |
| T-01-10-06 | Repudiation | materially wrong displayed take-home figure (Plan 01-10) | high | mitigate | Bracket-crossing test asserts strict inequality vs baseline-only answer; D-11 estimated-baseline banner wired | closed |
| T-01-10-SC | Tampering | npm supply chain (Plan 01-10) | high | mitigate | Zero package changes; package-file diff gate | closed |
| T-01-11-01 | Tampering | confirmation authority in `saveSalaryAction` (Plan 01-11) | high | mitigate | HMAC-verified claim only; `timingSafeEqual` confirmed present in `salary-confirmation-token.ts` | closed |
| T-01-11-02 | Spoofing | replayed/cross-account claim (Plan 01-11) | high | mitigate | Claim carries user id, effective date, issue time; session-id match + 10-min TTL confirmed (`issuedAtMs` field present) | closed |
| T-01-11-03 | Repudiation | undisclosed destruction of stored salary value (Plan 01-11) | high | mitigate | Compare-and-swap against disclosed amount; mismatch returns fresh prompt | closed |
| T-01-11-04 | Tampering | cross-device concurrent write (AUTH-02) (Plan 01-11) | high | mitigate | Single conflict-handling statements arbitrated by unique index; live promise-raced tests | closed |
| T-01-11-05 | Information Disclosure | claim contents/repository errors (Plan 01-11) | medium | mitigate | Claim signed but not secret; DB errors stay inside generic field error | closed |
| T-01-11-06 | Denial of Service | confirmation retry behaviour (Plan 01-11) | medium | mitigate | Conflicts return fresh prompt; vanished-row path retries insert once before generic error | closed |
| T-01-11-07 | Elevation of Privilege | ownership on conditional write (Plan 01-11) | high | mitigate | User-id equality predicate in same statement as conflict target; `requireUserId` sole identity source | closed |
| T-01-11-SC | Tampering | npm supply chain (Plan 01-11) | high | mitigate | Zero package changes; token module uses `node:crypto` only | closed |
| T-01-12-01 | Spoofing | Better Auth sessions under published secret (Plan 01-12) | critical | mitigate | `betterAuthSecretSchema` confirmed wired in `env.ts`; boot fails on placeholder/low-entropy values | closed |
| T-01-12-02 | Tampering | HMAC-signed salary confirmation claims depend on secret (Plan 01-12) | high | mitigate | Declared dependency of Plan 01-11; claim integrity never rests on public value | closed |
| T-01-12-03 | Tampering | impossible dates reaching Postgres date column (Plan 01-12) | high | mitigate | Shared validator round-trips parsed value against submitted string | closed |
| T-01-12-04 | Repudiation | dated row recording a day the user never entered (Plan 01-12) | high | mitigate | Submission fails visibly rather than persisting a normalised value | closed |
| T-01-12-05 | Information Disclosure | validation/boot error messages (Plan 01-12) | medium | mitigate | Messages name variable/rule/remedy only; candidate value never serialized | closed |
| T-01-12-06 | Denial of Service | false-positive placeholder match locking out valid deployment (Plan 01-12) | low | accept | Markers long/distinctive; failure mode is loud boot refusal with regeneration instruction | closed |
| T-01-12-SC | Tampering | npm supply chain (Plan 01-12) | high | mitigate | Zero package changes; zod + installed test runner only | closed |

*Status: open · closed · open — below `high` threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (high) count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|--------------|------|
| AR-01 | T-01-06 | Loud boot failure on missing/malformed env vars is intended for a solo-operated app; no runtime degradation path warranted | Plan 01-01 threat register | 2026-08-29 |
| AR-02 | T-01-08 | Account-existence disclosure inherent to a usable sign-up form for single-tenant app; enumeration hardening is a future canon item | Plan 01-02 threat register | 2026-08-29 |
| AR-03 | T-01-11 (01-03) | `UnsupportedTaxYearError` names only the year — accepted as non-sensitive | Plan 01-03 threat register | 2026-08-29 |
| AR-04 | T-01-14 | D-14 explicitly chose overwrite over audit trail; residual risk mitigated at interaction layer, later hardened by signed confirmation claims (Plan 01-11) | Plan 01-04 threat register | 2026-08-29 |
| AR-05 | T-01-06-04 | Client-computed date is only a form default; server re-validates and re-scopes every write | Plan 01-06 threat register | 2026-08-29 |
| AR-06 | T-01-08-07 | Cosmetic product-identity misidentification only; PWA integrity controls are Phase 4 scope | Plan 01-08 threat register | 2026-08-29 |
| AR-07 | T-01-12-06 | Placeholder markers are long/distinctive; false-positive lockout fails safe (loud boot refusal) | Plan 01-12 threat register | 2026-08-29 |
| TR-01 | T-01-09 (01-02) | Unthrottled credential submission — deployment-layer rate limiting transferred to Vercel platform in Phase 4 | Plan 01-02 threat register | 2026-08-29 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-29 | 62 | 62 | 0 | /gsd-secure-phase (orchestrator, grep-level L1 verification; ASVS level 1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-29
