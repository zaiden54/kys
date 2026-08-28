# Feature Research

**Domain:** Russian personal salary/take-home-pay forecasting PWA (НаРуки)
**Researched:** 2026-08-28
**Confidence:** MEDIUM-HIGH (domain/tax mechanics HIGH; competitive/feature-landscape framing MEDIUM — cross-verified across 3+ independent Russian tax-content sources, no single authoritative primary source fetched directly from ФНС/ГАРАНТ full text)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or, worse, produces a wrong number the user will not trust.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Gross salary + payment schedule input (аванс + основная часть, 2x/month) | This is the actual Russian payroll rhythm — a tool that assumes one monthly payment is unusable for real budgeting | LOW | Already in v1 scope. Dates should be editable per user (employer-specific, not fixed to a calendar default) |
| Correct progressive NDFL calculation, cumulative YTD | This is the core value prop. A calculator that gets NDFL wrong is worse than no calculator — user cannot trust any other number in the app | HIGH | See Correctness section below. Marginal-bracket, cumulative-from-Jan-1, recalculated on **every** payment event (avans and salary are separate income-receipt dates since 2023) |
| Next-payment amount + date on home screen | Users open the app to answer one question: "how much, when." This is the single most-repeated user action | LOW | Already in v1 scope |
| Salary history over time | Salaries change (raises, promotions); отпускные calculation and past-payment display both need historical values, not just current | MEDIUM | Already in v1 scope. Also a correctness dependency for отпускные (see below) |
| Gross vs. tax vs. net breakdown, per payment and annually | Users think in "grязными/на руки" — showing only net is not enough; they want to see the tax bite | LOW-MEDIUM | Annual pie chart already in v1 scope; per-payment breakdown (this payment's gross/NDFL/net) is a natural companion and should not be treated as separate scope — it's the same computation surfaced twice |
| One-off bonus/compensation entry tied to a pay date | Real Russian salaries are not just oklad — premii are routine (quarterly, annual, KPI) | MEDIUM | Already in v1 scope. Tax-base interaction is correctness-critical (see below) |
| Automatic vacation pay (отпускные) calculation | Manually computing 12-month average earnings per ст.139 ТК РФ is exactly the kind of tedious, error-prone math this app exists to remove | HIGH | Already in v1 scope. See Correctness section — this is the most complex single feature in v1 |
| Account + cloud sync across devices | Explicitly in scope; also table stakes for any tool a user checks from both phone and desktop | MEDIUM-HIGH | Requires backend, DB, auth — already acknowledged in PROJECT.md constraints |
| Install-to-home-screen PWA (iOS Safari) | Explicit constraint; users expect an app-like experience without an App Store | LOW-MEDIUM | Manifest + icons + standalone display mode; iOS PWA support has known quirks (no push notifications pre-iOS 16.4, add-to-home-screen must be manually triggered by user — cannot be prompted programmatically like on Android/Chrome) |
| Editable/correctable inputs | If the user's employer changes the pay schedule or the user mistyped a salary, they need to fix it without starting over | LOW-MEDIUM | Not explicitly named in PROJECT.md scope but implied by "история окладов" — treat as part of salary-history feature, not a separate one |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required for v1, but valuable and align with the "point solution for Russian payroll forecasting" niche this app occupies (see Competitive Landscape below — no direct competitor was found that combines these).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Annual gross/tax/net pie chart | Most calculators show one month at a time; showing the shape of the whole year (and how much of it went to tax) is a genuinely different framing that supports the "budget planning" use case, not just "what's my paycheck" | LOW-MEDIUM | Already in v1 scope — call this out explicitly as the differentiator it is, not just a nice visualization |
| Bracket-crossing awareness ("you're about to enter the 15% bracket") | Progressive NDFL is new (2025) and non-obvious to most employees; showing *when in the year* a user's cumulative income crosses a threshold is a feature no generic calculator offers, because generic calculators are single-month, not YTD-stateful | MEDIUM | Natural extension of the core NDFL engine once cumulative state exists — near-zero marginal cost once table-stakes calc is built. Strong v1.x candidate |
| Vacation-pay "what-if" planner (pick dates, see payout before booking) | Employees plan vacations around cash flow; letting them try dates and see the resulting отпускные before committing is a real behavior this app's data model already supports | LOW-MEDIUM | Depends on salary-history + отпускные engine already existing; mostly a UI/UX feature on top of existing computation |
| Multi-user comparison / household view | Two-earner households want combined forecasting | MEDIUM-HIGH | Explicitly out of v1 (implied by "один оклад на пользователя") — flag as v2 candidate, not v1 |
| Year-end tax reconciliation reminder (напоминание про декларацию/вычеты) | Since deductions are out of scope, the app could still remind users that they may be leaving money on the table via вычеты, driving future engagement/upsell into v2 deduction features | LOW | Pure notification/copy feature — no calculation risk, safe differentiator | 
| Historical "what I actually earned this year so far" running total | Complements the forward-looking pie chart with a backward-looking receipt; cheap given the same cumulative-income engine | LOW | Shares data model with core NDFL engine |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create correctness, scope, or trust problems for this specific domain.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Full payslip reconciliation / import from employer 1С or bank statement | "Just show me it matches" feels like the obvious trust-builder | Requires parsing arbitrary payslip formats, employer-specific accounting quirks (районные коэффициенты, matиз выгода, other allowances), and turns a forecasting tool into an accounting-reconciliation tool — explicitly out of scope in PROJECT.md and correctly so; this is a multi-month feature on its own | Keep the tool a forward-looking forecaster; if trust is a concern, show the calculation formula/breakdown transparently instead of trying to match real payslips |
| Multiple employers / income sources | Some users genuinely have side income or job changes mid-year | Correctly excluded for v1 — NDFL cumulative base and bracket crossing become materially harder to reason about (and to display clearly) with multiple concurrent income streams, and the UI for "which income contributed how much to this bracket" gets complex fast | v2: model as an explicit multi-source income list once single-source engine is proven; do not bolt on early |
| Tax deductions (вычеты) | Users will ask "why doesn't it match my actual payslip" once they have deductions | Correctly excluded for v1 per PROJECT.md — deduction eligibility rules (child count, ages, property deduction caps, application timing) are a large independent rules engine that does not change the core forecasting model, just refines the net number | v2, additive: deductions reduce the taxable base before the existing bracket engine runs — architect the tax calculation so this slot-in is possible later (see ARCHITECTURE.md/PITFALLS.md) |
| Offline-first / full offline mode | Feels like standard "PWA best practice" | Explicitly out of scope; given cloud sync + multi-device is core to the value prop, offline-first adds meaningful complexity (conflict resolution, local calculation engine duplication) for a use case (occasional budget checking) that tolerates needing connectivity | PWA manifest only for install-to-home-screen; simple "you're offline" state is enough for v1 |
| Regional coefficient / northern allowance (районный коэффициент / северная надбавка) support | Real for a meaningful minority of Russian employees (Far North / equivalent regions) and someone will ask for it | As of 2025 these form a **separate NDFL tax base** with different rules than the main 5-step scale, and the rules changed again for 2026 (see Correctness section) — supporting this correctly means a second parallel tax engine, not a parameter tweak | Out of v1 scope by implication (not explicitly named in PROJECT.md, but should be — flag explicitly as excluded so users on district-coefficient salaries know the app is not calculating for them). Add to Out of Scope list formally |
| Push notifications for payment reminders | Obvious “engagement” feature | iOS PWA push notification support is limited/fragile (historically unavailable pre-iOS 16.4, and even after requires the user to have already added to home screen and granted permission) — building this in v1 risks a half-working feature on the primary target platform (iPhone, per PROJECT.md constraint) | Defer; home-screen "next payment" display already answers the core need without needing OS-level push |
| Generic budgeting/expense-tracking (categorized spending, envelope budgeting) | "Personal finance app" pattern-matches to Mint/YNAB-style tools | Out of the stated Core Value ("know the number and date of the next payment") — building a spending tracker on top turns this into a different, much bigger product competing with an entirely different, crowded category (YNAB, CoinKeeper, Дзен-мани) | Stay a forecasting tool for *income*, not a full budget tracker; if users want that, they can pair this app's output with a dedicated budgeting app |

## Feature Dependencies

```
Salary history (with dated changes)
    └──requires for──> Progressive NDFL cumulative calculation
                            └──requires for──> Next-payment amount+date display
                            └──requires for──> Annual pie chart (gross/tax/net)
                            └──requires for──> Bracket-crossing awareness (differentiator)

Salary history (12 months of values) + Payment history
    └──requires for──> Otpusknye (vacation pay) auto-calculation
                            └──requires for──> Vacation "what-if" planner (differentiator)

One-off bonus/premiya entry
    └──feeds into──> Progressive NDFL cumulative calculation (same base, same engine)

Account + cloud sync
    └──requires for──> Multi-device access to all of the above (no feature works meaningfully without persisted, synced state)

Regional coefficient / northern allowance support (anti-feature, deferred)
    └──conflicts with──> Single unified NDFL engine (would require a second parallel tax base and UI to disambiguate which payments qualify)

Tax deductions (вычеты, deferred to v2)
    └──enhances──> Progressive NDFL cumulative calculation (reduces taxable base before bracket math runs; additive, not conflicting — architect for this even though not built now)

Multiple employers/income sources (deferred to v2)
    └──enhances/complicates──> Progressive NDFL cumulative calculation (cumulative base must merge across sources; UI must attribute tax split back to income sources)
```

### Dependency Notes

- **Progressive NDFL calculation requires salary history:** the tax owed on any given payment depends on the *cumulative* income for the year to that point, which in turn depends on every prior payment (salary + bonuses) at their historical amounts — not just the current salary value. This is why "история окладов" is not a nice-to-have but a hard prerequisite for correct tax math from day one.
- **Otpusknye requires salary history + payment history for the trailing 12 months:** the average-daily-earnings formula sums *actual earnings paid* in the 12 calendar months before the vacation month, excluding certain periods/payments. If salary changed mid-period, the app must use the actual historical amounts, not the current salary — this is the same underlying data as the NDFL engine, so both features should share one "earnings ledger" data model rather than being built as separate subsystems.
- **Bonus/premiya entry feeds the same NDFL engine as salary** — no separate tax logic needed; premii use the identical cumulative-base, marginal-bracket calculation. Building a separate "bonus tax" path would be a design mistake (see PITFALLS.md).
- **Deductions (v2) enhance, not conflict with, the NDFL engine** — they only need to reduce the taxable base fed into the existing bracket calculation. Worth architecting the tax function to accept a "taxable base" parameter (post-deduction) rather than hard-wiring gross income directly into the bracket logic, so v2 deductions slot in without a rewrite.
- **Regional coefficient/northern allowance conflicts with a single unified engine** — this is why it should stay explicitly out of scope rather than "supported vaguely." A half-correct implementation (e.g., just adding the coefficient as a multiplier without recognizing it needs its own separate tax base) would produce wrong numbers for exactly the users who need it most.

## MVP Definition

### Launch With (v1)

Minimum viable product — matches PROJECT.md Active requirements exactly, framed by priority.

- [ ] Account creation + cloud sync — nothing else works without persisted, cross-device state
- [ ] Gross salary + payment schedule (avans/salary dates) input — the base data every other feature reads
- [ ] Progressive NDFL cumulative calculation engine (5-step scale, YTD, per-payment-event) — the core value; must be correct on day one, not "good enough"
- [ ] Salary change history — required for NDFL correctness on any salary change, not just a display feature
- [ ] One-off bonus/compensation entry tied to a pay date — routine part of Russian salary, uses the same engine
- [ ] Automatic otpusknye calculation from 12-month average — explicit differentiator and stated core requirement
- [ ] Home screen: next payment amount + date
- [ ] Home screen: annual pie chart (gross/tax/net)
- [ ] Installable PWA (manifest, icons, standalone mode) for iPhone home screen

### Add After Validation (v1.x)

Features to add once core is working and trusted.

- [ ] Bracket-crossing awareness / "approaching next NDFL threshold" indicator — trigger: users ask "why did my take-home suddenly drop" after crossing a bracket, or user testing shows people don't understand the progressive mechanic
- [ ] Vacation "what-if" date planner — trigger: users manually re-enter vacation dates repeatedly to compare payout scenarios
- [ ] Per-payment gross/tax/net breakdown (not just annual) — trigger: users want to understand *why* a specific payment's net differs from expectation
- [ ] Explicit "regional coefficient / northern allowance not supported" messaging — trigger: any user reports numbers not matching for a Far North / district-coefficient job; needed even before actual support is built, as an honesty/trust feature

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Tax deductions (вычеты — children, property, etc.) — deferred per PROJECT.md; requires an independent rules engine, additive to existing tax base
- [ ] Multiple employers/income sources — deferred per PROJECT.md; requires merging cumulative bases across sources
- [ ] Regional coefficient / northern allowance support — deferred; requires a second, separate tax-base engine per 2025/2026 rules
- [ ] Offline mode — deferred per PROJECT.md; adds sync-conflict complexity for a use case that tolerates connectivity requirements
- [ ] Payslip reconciliation/import — deferred per PROJECT.md; different product shape (accounting vs. forecasting)
- [ ] Push notifications for upcoming payments — deferred; iOS PWA push support is fragile and not worth the risk pre-validation
- [ ] Multi-user/household combined view — deferred; v1 is explicitly single-oklad-per-user

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Cloud sync + account | HIGH | HIGH | P1 |
| Progressive NDFL cumulative engine | HIGH | HIGH | P1 |
| Salary + payment schedule input | HIGH | LOW | P1 |
| Salary change history | HIGH | MEDIUM | P1 |
| Bonus/premiya entry | MEDIUM | LOW (shares engine) | P1 |
| Otpusknye auto-calculation | HIGH | HIGH | P1 |
| Home screen next-payment | HIGH | LOW | P1 |
| Annual pie chart | MEDIUM-HIGH | LOW-MEDIUM | P1 |
| PWA installability | MEDIUM | LOW-MEDIUM | P1 |
| Bracket-crossing awareness | MEDIUM | LOW (once P1 engine exists) | P2 |
| Vacation what-if planner | MEDIUM | LOW-MEDIUM | P2 |
| Per-payment breakdown detail | MEDIUM | LOW | P2 |
| Tax deductions | HIGH (long-term) | HIGH | P3 |
| Multiple income sources | MEDIUM | HIGH | P3 |
| Regional coefficient support | LOW (niche user base) | HIGH | P3 |
| Offline mode | LOW (given always-connected use case) | HIGH | P3 |
| Payslip reconciliation | LOW-MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Correctness-Critical Domain Mechanics

This section is the actual load-bearing content for the tax/payroll engine — feature framing alone is not sufficient for this domain; getting the numbers right *is* the product.

### NDFL progressive scale (2025, 5-step, ст. 224 НК РФ as amended by 176-ФЗ)

Confirmed consistently across multiple independent Russian tax-content sources (nalog-nalog.ru, garant.ru, astral.ru, moedelo.org):

| Annual cumulative income (RUB) | Rate |
|---|---|
| 0 – 2,400,000 | 13% |
| 2,400,001 – 5,000,000 | 15% |
| 5,000,001 – 10,000,000 | 18% |
| 10,000,001 – 23,711,600 | 20% |
| above 23,711,600 | 22% |

**Mechanics — this is a true marginal-bracket system**, not a "whole income taxed at the top rate you reach" system. Only the slice of income *within* each bracket is taxed at that bracket's rate. Worked example (5.81M annual): first 2.4M × 13% = 312,000; next 2.6M × 15% = 390,000; remaining 0.81M × 18% = 145,800; total tax 847,800 — i.e., the effective rate is well below the top marginal rate reached.

**Calculated нарастающим итогом (cumulatively) from January 1 of the calendar year.** Each payment's tax is determined by: `tax_due_after_this_payment = bracket_tax(cumulative_income_including_this_payment) - tax_already_withheld_YTD`. This means the engine must track running YTD gross income and running YTD tax withheld as state, not compute each payment in isolation.

**Since 2023, both avans (advance, mid-month) and the final salary payment (end-month) are separate "date of income receipt" events, each with NDFL withheld at time of payment.** Before 2023 only one NDFL calculation happened per month; the app's twice-monthly payment model must treat avans and final salary as two distinct cumulative-base update events, in date order, not net them into a single monthly calculation. This directly matches the app's stated aванс+основная схема, which is good — but the tax engine internally needs per-payment-event granularity, not per-month granularity.

### Onboarding mid-year without full income history (identified gap — no authoritative source found, requires a product decision)

None of the sources researched directly address "user starts using the app in, say, June, with no recorded income for Jan–May." This is a genuine correctness edge case the roadmap/spec phase should resolve explicitly, not leave implicit. Two reasonable approaches, to be decided in requirements/architecture (not resolved by this research):
1. **Ask the user to enter their actual YTD cumulative gross income** at first use (a single number) so the bracket engine's running total starts correct — most accurate, minimal data entry.
2. **Assume zero prior YTD income** if the user declines/skips — understates the correct bracket for users onboarding later in the year (their true marginal rate on subsequent payments would be higher than the app calculates), which is a silent-but-material correctness bug if not called out to the user.
Recommend flagging this explicitly as a required decision for requirements/spec, and — whichever is chosen — surfacing it to the user as an assumption ("расчёт предполагает, что до этого момента доход в этом году не начислялся — если это не так, укажите фактический доход с начала года") rather than a silent default.

### Premii / bonus interaction with the progressive base

Premii (bonuses) are added into the **same** cumulative annual income base as salary — there is no separate bonus tax scale. A bonus can push cumulative YTD income across a bracket threshold; only the portion of *that specific payment* which falls above the threshold is taxed at the higher rate, using the same running-total mechanism as any other payment. The most common real-world payroll error (noted in sourced content) is adding a bonus to the current month's gross without recomputing the YTD cumulative base — i.e., mixing up "tax this payment as if isolated" vs. "tax this payment as the next slice of the YTD total." The app's engine must always route bonus amounts through the identical cumulative-base function as salary, never a parallel/simplified path.

### Otpusknye (vacation pay) — ст. 139 ТК РФ

**Formula:** `average_daily_earnings = earnings_in_trailing_12_calendar_months / 12 / 29.3`, then `otpusknye = average_daily_earnings × vacation_calendar_days`.

- **Period:** the 12 calendar months preceding the month the vacation starts (not the 12 months preceding the request date).
- **29.3** is a fixed statutory average-days-per-month constant — not derived from the actual calendar.
- **If the trailing 12 months are not fully worked** (e.g., recently hired, or had excluded periods), only the actually-worked months/days are used, both in the numerator (earnings) and denominator (day count) — the ratio is preserved, not just the numerator adjusted.
- **Excluded from both earnings AND day count** (periods where average earnings, not actual work, was paid): sick leave (больничный), other paid leave, business trips (командировка), maternity/parental leave, unpaid leave, employer-caused downtime (простой).
- **Excluded from earnings only** (payments that don't count toward the average even though the days aren't excluded): social assistance, non-performance/occasion bonuses (e.g., birthday), meal/transport reimbursements.
- **Included in earnings:** base salary, performance bonuses actually earned within the 12-month period, shift/night-work premiums.
- This means отпускные calculation needs, at minimum: the salary-history ledger, the payment-history ledger (to know which premii were "performance" vs. "social/occasional" — a distinction the app must capture at bonus-entry time via a type field, not infer), and a way to record excluded periods (sick leave, prior vacation, etc.) if the app is to be fully correct. **Given v1 does not track sick leave/leave-of-absence history, the отпускные calculation should be documented as an approximation that assumes no excluded periods in the trailing 12 months** — this is a scope/accuracy tradeoff worth stating explicitly in requirements rather than silently computing an approximate number as if it were exact.

### Regional coefficient / northern allowance — explicit non-goal, not silently ignorable

As of 2025, районный коэффициент and северная надбавка form a **separate NDFL tax base** from ordinary salary (different thresholds/structure than the main 5-step scale), and the rules changed again for 2026 (Федеральный закон №425-ФЗ, Nov 2025) — this area is legislatively unstable. FNS also clarified (June 2025) that average-earnings-based payments (i.e., отпускные itself, and travel per-diems) do **not** use this special northern scale and fall under the main 5-step scale regardless of the employee's region. Since PROJECT.md's v1 scope implies a single standard salary without regional multipliers, this is consistent — but it should be added explicitly to the Out of Scope list (it currently is not named) so that Far North / equivalent-region employees are not silently given wrong numbers by an app that doesn't flag the gap.

## Competitor Feature Analysis

| Feature | Generic Russian gross/net calculators (kontur-extern, nalog-nalog, calcman, zarplata.ru) | Existing Russian salary mobile apps (Gig, Мой расчёт ЗАРПЛАТЫ) | Western paycheck-forecast apps (PayCheck Budget, Koody, EveryTwo) | Our Approach |
|---------|---|---|---|---|
| NDFL calculation | Single-month gross↔net conversion, some now support the 2025 progressive scale for one point in time | Basic, hourly/shift-focused, not progressive-scale aware | N/A (US/generic tax context, not applicable) | Full cumulative YTD progressive engine, stateful across the whole year — no competitor found doing this for RU |
| Payment schedule | Not modeled — one-off calculation per visit | Modeled for hourly/shift schedules, not salaried avans+основная | Modeled (biweekly/semimonthly/custom) but not RU-tax-aware | Avans + основная salary rhythm modeled with cumulative tax state, matching actual RU payroll practice |
| Vacation pay | Occasionally offered as a separate, disconnected calculator (not linked to salary history) | Not offered | N/A | Fully integrated, reads from the same salary/payment history ledger — no re-entry of data |
| History / trends | Not offered (stateless single calculations) | Not offered | Offered (recurring transaction history, balance trends) | Salary history + annual pie chart, itself a differentiator vs. RU competitors |
| Cloud sync / multi-device | Not offered (stateless web tools) | Occasionally (cloud save), not a focus | Standard feature | Core requirement per PROJECT.md — matches Western budget-app baseline, absent from RU salary-calculator competitors |
| Target user | Accountants/HR verifying numbers, or one-off curious employees | Hourly/freelance/shift workers | US/Western budgeters with irregular pay | Salaried RU employees wanting ongoing personal forecasting — an underserved niche between "accountant calculator" and "generic budget app" |

## Sources

- [Прогрессивная шкала НДФЛ с 2025 года — nalog-nalog.ru](https://nalog-nalog.ru/ndfl/progressivnaya-shkala-ndfl-s-2025-goda/) — HIGH confidence (cross-verified bracket thresholds/example)
- [Прогрессивная шкала НДФЛ с 2025 года — garant.ru](https://www.garant.ru/1c-wiseadvice/guide/progressivnaya-shkala-ndfl-s-2025-goda/) — HIGH confidence (corroborating)
- [Расчет НДФЛ 2026 — astral.ru](https://astral.ru/aj/elem/kak-rasschityvat-ndfl-v-2025-godu-novye-stavki-i-lgoty/) — MEDIUM confidence (corroborating, secondary)
- [Расчет отпускных — Контур.Экстерн](https://kontur.ru/extern/spravka/50486-raschet_otpusknyh) — HIGH confidence (ст.139 ТК РФ formula)
- [Расчет отпускных — secrets.tbank.ru](https://secrets.tbank.ru/buhgalteriya/raschet-otpusknyh/) — HIGH confidence (corroborating, worked example)
- [НДФЛ с премий — buhsoft.ru](https://www.buhsoft.ru/article/2948-ndfl-s-premiy) — MEDIUM confidence (premii/cumulative-base interaction)
- [Как удерживать НДФЛ с аванса — garant.ru](https://www.garant.ru/news/1560509/) — HIGH confidence (2023 avans withholding rule)
- [Районный коэффициент и северная надбавка НДФЛ — saby.ru / 1c-wiseadvice.ru / gazeta-unp.ru](https://saby.ru/articles/accounting/rayonnyy_koefficient_i_severnaya_nadbavka_kak_nachislyat_oblagat_ndfl_i_vznosami) — MEDIUM confidence (separate tax base rule, 2025/2026 changes)
- Web search survey of existing RU salary calculator tools (kontur-extern.ru, calcman.ru, zarplata.ru, web-calculator.ru) and RU mobile salary apps (App Store/RuStore listings for Gig, Мой расчёт ЗАРПЛАТЫ) — MEDIUM confidence (competitive landscape, listing-level detail only, not deep product testing)
- Web search survey of Western paycheck-forecast/budgeting apps (PayCheck Budget, Koody, EveryTwo, CashFlowCalendar, CalendarBudget) — MEDIUM confidence (feature-pattern generalization, not RU-specific)
- PROJECT.md (project context, already-decided v1 scope) — provided directly, not independently verified

---
*Feature research for: Russian salary/take-home-pay tracking PWA*
*Researched: 2026-08-28*
