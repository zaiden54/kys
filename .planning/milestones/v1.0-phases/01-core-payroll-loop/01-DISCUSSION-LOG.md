# Phase 1: Core Payroll Loop - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-28
**Phase:** 1-core-payroll-loop
**Areas discussed:** Payment schedule input, Registration / login method, Mid-year YTD onboarding, Salary change effective date

---

## Payment Schedule Input

| Question | Options | Selected |
|---|---|---|
| How should the user specify avans/salary payment dates? | Day-of-month numbers / Exact recurring calendar dates | Day-of-month numbers ✓ |
| Weekend/holiday handling? | Shift earlier (RU standard) / Leave date as-is / Configurable per user | Shift earlier (RU standard) ✓ |
| Day-of-month values that don't exist in a given month? | Clamp to last day of month / Reject day >28 at input | Clamp to last day of month ✓ |
| Validate avans/salary gap? | No validation / Warn if gap exceeds 15 days | Warn if gap exceeds 15 days ✓ |

**Notes:** RU standard behavior confirmed by user — employers legally must pay early if payday lands on a weekend/holiday.

---

## Registration / Login Method

| Question | Options | Selected |
|---|---|---|
| How should users register/log in? | Email + password / Email magic link / Email+password, OAuth later | Email+password, OAuth later ✓ |
| Email verification required? | No verification required / Require verified email | No verification required ✓ |
| Session duration? | Long-lived (30+ days) / Short session (7 days) | Long-lived (30+ days) ✓ |
| Password reset flow in v1? | Yes, email-based reset link / Defer to v1.x | Defer to v1.x ✓ |

**Notes:** Google OAuth flagged as awkward for RU users; Yandex ID/VK ID considered but deferred rather than decided now.

---

## Mid-year YTD Onboarding (SAL-03)

| Question | Options | Selected |
|---|---|---|
| When to ask for YTD income? | Always ask at signup / Only ask if signing up after Jan 1 | Always ask at signup ✓ |
| Can YTD be edited later, and what happens to forecasts? | Editable anytime, recomputes forward / Locked after signup | Editable anytime, recomputes forward ✓ |
| Warning visibility if skipped? | Persistent banner until filled in / One-time dismissible notice | Persistent banner until filled in ✓ |

**Notes:** This was the explicitly flagged unresolved product decision from research (SUMMARY.md "Gaps to Address"). Now resolved. Also clarified during discussion (Claude's implementation note, not a user question): the engine derives "tax already withheld YTD" from the single YTD-income figure via `taxOnCumulative()`, no separate tax-withheld input needed.

---

## Salary Change Effective Date (SAL-02)

| Question | Options | Selected |
|---|---|---|
| When does a salary change take effect? | Immediately, applies to next payment / User picks an effective date | User picks an effective date ✓ |
| Can the effective date be backdated? | Future or today only / Backdating allowed | Backdating allowed ✓ |
| Backdating collision behavior? | Overwrite the record / Keep audit trail of corrections | Overwrite the record ✓ |
| Surface future-dated changes on home screen? | Show automatically, no extra UI / Explicitly surface the pending change | Show automatically, no extra UI ✓ |

**Notes:** Keeping HOME-01 minimal per the literal requirement text (amount + date only) — explicit "upcoming raise" UI was considered and deferred, not rejected outright.

---

## Claude's Discretion

None — every gray area discussed resolved to a concrete user choice.

## Deferred Ideas

- OAuth login (Yandex ID / VK ID) — v1.x candidate
- Password reset flow — v1.x candidate
- Audit trail for salary-history corrections — potential v1.x/v2 item if needed
- "Upcoming salary change" home-screen indicator — considered, deferred past Phase 1
