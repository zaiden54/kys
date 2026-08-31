---
phase: 02-bonuses-one-off-payments
reviewed: 2026-08-30T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - package.json
  - src/app/(app)/bonuses/bonus-form.test.ts
  - src/app/(app)/bonuses/bonus-form.tsx
  - src/app/(app)/bonuses/bonus-row.render.test.tsx
  - src/app/(app)/bonuses/bonus-row.test.ts
  - src/app/(app)/bonuses/bonus-row.tsx
  - src/app/(app)/bonuses/page.tsx
  - src/app/(app)/layout.tsx
  - src/app/actions/bonus.test.ts
  - src/app/actions/bonus.ts
  - src/app/actions/forecast.test.ts
  - src/app/actions/forecast.ts
  - src/components/next-payment-card.tsx
  - src/lib/db/bonus-repository.test.ts
  - src/lib/db/bonus-repository.ts
  - src/lib/db/salary-repository.test.ts
  - src/lib/db/salary-repository.ts
  - src/lib/db/schema.ts
  - src/lib/validation/bonus.test.ts
  - src/lib/validation/bonus.ts
  - vitest.config.ts
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 02: Code Review Report (re-review after gap-closure plan 02-04)

**Reviewed:** 2026-08-30T00:00:00Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

This is a full independent re-review of Phase 02 (Bonuses & One-off Payments) after gap-closure plan 02-04, which claimed to close CR-01 (`BonusRow`'s edit form silently resubmitting stale data) by switching `useForm` to `values: toDefaults(bonus)` plus explicit `reset(toDefaults(bonus))` calls wired into Cancel and the `onEdit` success branch, backed by two new render-based tests.

**CR-01's originally-reported two paths are genuinely closed.** I traced `bonus-row.tsx` directly (not just the plan's claim):
- Cancel-then-reopen: `reset(toDefaults(bonus))` on the Cancel button correctly discards unsaved input and restores the current prop-bound bonus. Confirmed correct and covered by `bonus-row.render.test.tsx`'s first test.
- Cross-device revalidation while mounted in display mode: `values: toDefaults(bonus)` auto-resyncs whenever the incoming `bonus` prop changes, confirmed against `react-hook-form`'s actual implementation (`useEffect` guarded by `!deepEqual(props.values, cached)` → `_reset(...)`). Confirmed correct and covered by the second render test.

**However, the same fix reintroduces a narrower variant of the exact same bug class in the `onEdit` success path** (CR-01-adjacent, see Critical finding below), and the unconditional `values` resync creates a new, untested data-loss edge case for edits made while a row is actively in edit mode (see Warning below). Neither is covered by the two new render tests — both of those tests only exercise resync while the row is in *display* mode, never while a form is dirty *inside* an active edit session.

## Critical Issues

### CR-01: `onEdit`'s success-path `reset()` uses the stale pre-save `bonus`, not the just-saved `values` — reintroduces silent stale overwrite in a race window

**File:** `src/app/(app)/bonuses/bonus-row.tsx:45`

**Issue:** On a successful save, the code does:

```tsx
if (result.success) { setMode("display"); reset(toDefaults(bonus)); return; }
```

`bonus` here is the closure-captured prop from the render that is currently executing — i.e. the **pre-edit** value, since the parent page's Server Component props only get refreshed after Next.js's router revalidation lands (asynchronously, after `revalidatePath` runs inside `saveBonusAction`). At the instant this line executes, `bonus` is guaranteed to still hold the old, superseded amount/date/note; the revalidated (fresh) prop cannot have arrived yet inside this synchronous continuation.

Concrete sequence:
1. Bonus X has amount 5000₽. User opens edit, changes amount to 8000₽, clicks "Сохранить". `saveBonusAction` succeeds — the server now has 8000₽.
2. `onEdit`'s success branch runs `reset(toDefaults(bonus))` using the **old** closure (`bonus.amountKopecks` = 5000₽), then flips to display mode.
3. Before the revalidated props propagate down to this row (a real, non-zero window — React must receive and reconcile a new RSC payload), the user reopens "Изменить бонус". The edit form now shows the stale 5000₽, not the just-saved 8000₽.
4. If the user clicks "Сохранить" again without changing anything (e.g. just double-checking, or editing only the unrelated note field), the form resubmits amount = 5000₽, **silently reverting the just-saved 8000₽ back to the old value.**

This is the identical failure mode CR-01 was written to close (silently resubmitting a stale, previously-typed value over the bonus's real current data) — just triggered by the component's own success handler instead of cancel-then-reopen or a foreign revalidation. It is not covered by either new render test: both only assert resync while the row is *not* mid-edit.

**Fix:** Reset to the just-submitted (now-authoritative) `values` parameter, not the stale `bonus` prop:

```tsx
if (result.success) { setMode("display"); reset(values); return; }
```

`values` is exactly `BonusInput`-shaped (same shape `toDefaults` produces) and reflects what was actually persisted, so this removes the race window entirely — the form always reflects the last-known-good state, whether or not the prop refresh has landed yet.

## Warnings

### WR-01: Unconditional `values` resync can silently discard an in-progress edit with no user warning

**File:** `src/app/(app)/bonuses/bonus-row.tsx:32-36`

**Issue:** `useForm` is configured with `values: toDefaults(bonus)` and no `resetOptions`. Per `react-hook-form`'s actual implementation (verified in `node_modules/react-hook-form/dist/index.cjs.js`), whenever the incoming `values` object is deep-unequal to the previously cached one, the library calls `_reset(values, { keepFieldsRef: true, ...resetOptions })` — and since no `resetOptions.keepDirtyValues` is passed here, dirty (user-typed, unsaved) field values are overwritten unconditionally, regardless of whether the row is currently in `"editing"` mode with unsaved input.

Concrete scenario: the user opens edit mode on bonus X and starts typing a new amount (not yet saved). Meanwhile, on another device/tab, the *same* bonus X is edited and saved. The next revalidated payload updates `bonus` on this row; because the content genuinely differs, the resync effect fires and silently wipes whatever the user was mid-typing here, replacing it with the other device's value — with no dialog, no dirty-state warning, nothing. The user loses their in-progress input without knowing why.

(Unrelated bonuses being edited elsewhere on the same page do *not* trigger this — `revalidatePath("/bonuses")` refreshes every row's props, but the deep-equal check means a row whose *own* bonus content is unchanged is a no-op reset.)

Neither new render test exercises this path: both rerender with a changed bonus *before* entering edit mode, never *while* the form is dirty inside edit mode.

**Fix:** Either accept this as an intentional trade-off (server truth wins) but surface it to the user — e.g. detect `isDirty && mode === "editing"` in the resync effect and show an inline "Эта запись была изменена, ваши правки сброшены" notice instead of silently swapping values — or pass `resetOptions: { keepDirtyValues: true }` to `useForm` if preserving the user's local edits is preferred, accepting that this reopens (in a narrower form) the possibility of eventually submitting values based on stale premises. Either way, the current behavior (silent, unannounced overwrite of active user input) should be a deliberate, tested choice rather than an untested side effect of adopting `values`.

### WR-02: A superseded (cancelled) in-flight submission can retroactively clobber a newer edit session when it resolves

**File:** `src/app/(app)/bonuses/bonus-row.tsx:38-54`

**Issue:** Clicking "Отмена" is not disabled while `isSubmitting` is true, and clicking it does not cancel/ignore the in-flight `saveBonusAction` call. Sequence: user edits, clicks "Сохранить" (save in flight), then clicks "Отмена" before it resolves (mode flips to display immediately), then reopens "Изменить бонус" and starts a second, different edit. When the first (uncancelled) save eventually resolves, its `onEdit` continuation still runs unconditionally — `setMode("display")` and `reset(toDefaults(bonus))` (or, post-fix, `reset(values)` from the *first* attempt) — discarding whatever the user has typed in the second, currently-open edit session, and forcing the row back to display mode out from under them.

**Fix:** Guard the success/error continuations against being stale, e.g. capture a request token (or the `mode`/edit-session identity) at submission start and no-op the continuation if the row has since moved on to a different edit session:

```tsx
async function onEdit(values: BonusInput) {
  const requestToken = Symbol();
  editRequestRef.current = requestToken;
  ...
  const result = await saveBonusAction(data);
  if (editRequestRef.current !== requestToken) return; // superseded — do nothing
  ...
}
```

## Info

### IN-01: `formatPaymentDate` is duplicated verbatim across two files

**File:** `src/app/(app)/bonuses/bonus-row.tsx:18-26` and `src/components/next-payment-card.tsx:21-29`

**Issue:** The exact same function (split ISO date string, construct a local `Date`, format via `Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" })`) is copy-pasted in both files. This is the kind of duplication that lets one copy drift from the other (e.g. the IN-01 fix from the prior review round fixed the date-formatting inconsistency in `bonus-row.tsx`'s confirm dialog by introducing this local copy, rather than reusing the existing one in `next-payment-card.tsx`).

**Fix:** Extract to a shared module (e.g. `src/domain/time.ts`, which already hosts `todayIsoInMoscow`/`nowInMoscow`) and import it from both call sites.

---

_Reviewed: 2026-08-30T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
