# Roadmap: НаРуки

## Overview

НаРуки delivers take-home-pay forecasting for Russian salaried employees, one end-to-end vertical
slice at a time. Phase 1 stands up the whole core loop — account, salary/schedule input, the
correctness-critical progressive НДФЛ engine, and a next-payment display — so the highest-risk
domain logic (cumulative, marginal tax math) is proven against a real user-observable outcome
from day one, not built in isolation behind a wall of CRUD. Phases 2 and 3 extend that same proven
engine to two additional income events (one-off premii/compensation, and ст.139 ТК РФ отпускные),
each shipped as a complete, usable capability. Phase 4 closes the MVP with the annual gross/tax/net
overview and iPhone home-screen installability, both of which depend on the full income picture
built by phases 1-3.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Core Payroll Loop** - User registers, enters salary and payment schedule, and sees a correctly-taxed next-payment amount on the home screen
- [ ] **Phase 2: Bonuses & One-off Payments** - User adds a one-off premium/compensation that is taxed through the same cumulative НДФЛ engine
- [ ] **Phase 3: Vacation Pay** - User enters vacation dates and sees auto-calculated отпускные per ст.139 ТК РФ
- [ ] **Phase 4: Annual Overview & PWA Installability** - User sees the full-year gross/tax/net pie chart and can install the app to their iPhone home screen

## Phase Details

### Phase 1: Core Payroll Loop

**Goal**: A registered user can enter their gross salary and avans/salary payment schedule and see an accurate amount and date for their next take-home payment, computed via the progressive 2025 НДФЛ scale applied cumulatively from the start of the calendar year — with data synced across their devices.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, SAL-01, SAL-02, SAL-03, TAX-01, TAX-02, HOME-01
**Success Criteria** (what must be TRUE):

  1. User can register and log in; logging in from a second device shows the same salary/schedule data (AUTH-01, AUTH-02)
  2. User can enter a gross ("грязными") salary and configure avans + salary payment dates occurring twice a month (SAL-01)
  3. User can change their salary amount, and the system retains a dated history of prior salary values (SAL-02)
  4. On first use, user can optionally enter their accumulated year-to-date income, or sees an explicit warning that the calculation assumes zero income since January 1 if they skip it (SAL-03)
  5. The home screen shows the amount and date of the next upcoming payment, taxed via the progressive НДФЛ scale (13/15/18/20/22%) applied to cumulative year-to-date income, with avans and salary treated as independent taxable payment events (TAX-01, TAX-02, HOME-01)

**Plans**: 8 plans (5/5 original executed; 3 gap-closure plans pending)

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Scaffold Next.js 16 + Neon/Drizzle schema + Better Auth config (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Apply schema to Neon, then the register → login → protected home tracer (wave 2)
- [x] 01-03-PLAN.md — Pure НДФЛ engine and payment-date resolver, exhaustively unit-tested (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-04-PLAN.md — Salary, schedule, and YTD entry: validated Server Actions + onboarding/settings UI (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-05-PLAN.md — Next-payment forecast and home screen with the persistent estimated-baseline banner (wave 4)

**Gap closure** *(added after 01-VERIFICATION.md returned `gaps_found`: 2/5 truths verified, SAL-02 and HOME-01 blocked)*

**Gap wave 1**

- [ ] 01-06-PLAN.md — Moscow-time anchor: one pure `nowInMoscow()`/`todayIsoInMoscow()` module routed through every "what is today" call site (CR-01 — TAX-01, TAX-02, HOME-01, SAL-03)

**Gap wave 2** *(blocked on Gap wave 1; these two share no files and run in parallel)*

- [ ] 01-07-PLAN.md — Atomic single-statement upserts for salary, schedule, and YTD baseline, pinned by live concurrency race tests (CR-02 + WR-01 — SAL-02)
- [ ] 01-08-PLAN.md — Residual review warnings: reconciling gross split, НДФЛ bracket-order assertion, statute-comment correction, DB money constraints, product metadata (WR-02..WR-05 — TAX-01, HOME-01)

**UI hint**: yes

### Phase 2: Bonuses & One-off Payments

**Goal**: A user can attach a one-off premium or compensation to a specific payment date and see it flow through the same cumulative НДФЛ engine as regular salary, correctly affecting that and subsequent payments.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: BON-01, BON-02
**Success Criteria** (what must be TRUE):

  1. User can add a one-off premium/compensation tied to a specific payment date (BON-01)
  2. The bonus amount is added to cumulative year-to-date income and taxed through the same progressive НДФЛ mechanism as regular salary, correctly changing the take-home amount for that payment (BON-02)
  3. If the bonus lands on the next upcoming payment date, the home screen's next-payment amount reflects it

**Plans**: TBD
**UI hint**: yes

### Phase 3: Vacation Pay

**Goal**: A user can record vacation dates and see the system automatically calculate отпускные using the average-daily-earnings formula over the trailing 12 months, correctly taxed and clearly labeled as a simplified calculation.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: VAC-01, VAC-02, VAC-03
**Success Criteria** (what must be TRUE):

  1. User can enter vacation dates (VAC-01)
  2. The system automatically calculates отпускные from average daily earnings over the preceding 12 months (÷29.3 per ст.139 ТК РФ), accounting for salary changes across that window (VAC-02)
  3. The interface explicitly discloses that the v1 vacation-pay calculation does not account for excludable periods (sick leave, prior vacation, etc.) and is a simplified estimate (VAC-03)
  4. Calculated отпускные is taxed through the same cumulative НДФЛ mechanism and appears as a distinct payment event in the user's forecast

**Plans**: TBD
**UI hint**: yes

### Phase 4: Annual Overview & PWA Installability

**Goal**: A user can see a full calendar-year breakdown of gross pay, tax withheld, and take-home pay across all income types, and can install НаРуки to their iPhone home screen as a standalone app that stays logged in.
**Mode:** mvp
**Depends on**: Phase 1, Phase 2, Phase 3
**Requirements**: HOME-02, PWA-01
**Success Criteria** (what must be TRUE):

  1. The home screen shows a pie chart for the current calendar year breaking down gross / tax / net, combining salary, bonuses, and vacation pay (HOME-02)
  2. The chart's totals reconcile exactly (to the ruble) with the sum of all individual payment breakdowns for the year
  3. User can install the app to their iPhone home screen via Safari's "Add to Home Screen," and it launches in standalone display mode with its own icon (PWA-01)
  4. After installing as a standalone PWA, the user remains logged in and sees their data (handling the separate storage-jar behavior between the Safari tab and the installed app)

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Payroll Loop | 5/5 | In Progress|  |
| 2. Bonuses & One-off Payments | 0/TBD | Not started | - |
| 3. Vacation Pay | 0/TBD | Not started | - |
| 4. Annual Overview & PWA Installability | 0/TBD | Not started | - |
