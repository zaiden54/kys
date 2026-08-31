---
status: partial
phase: 04-annual-overview-pwa-installability
source: [04-VERIFICATION.md]
started: 2026-08-31T17:30:00Z
updated: 2026-08-31T17:42:00Z
---

## Current Test

[testing paused — 1 item outstanding]

## Tests

### 1. iPhone Home Screen Installation
expected: On a physical iPhone (iOS 15+), open the app in Safari, tap Share → Add to Home Screen, confirm the "НаРуки" app appears on the home screen with the correct icon. App installs to home screen, icon appears (monochrome "H" on dark background), installation completes without error.
result: pass

### 2. Standalone App Launch and Re-Login
expected: |
  Tap the installed app icon to launch it in standalone mode. Verify: (1) app launches without Safari UI chrome, (2) user is not logged in (storage-jar separation), (3) login screen displays with re-login hint ("Похоже, это первый запуск с домашнего экрана…"), (4) log in with test credentials, (5) home screen displays (next payment card, pie chart, install banner hidden).
  Expected: app launches fullscreen standalone, login screen with re-login hint, after login home screen renders with correct data.
result: issue
reported: "При попытке войти или зарегистрироваться ничего не происходит, данные отправляются на сервер, однако редиректа на главный экран не происходит"
severity: major

### 3. AnnualPieChart Visual Verification
expected: |
  On the home screen (Safari tab and standalone app), visually inspect the pie chart: donut proportions match displayed percentages, "Налог" (red #dc2626) and "На руки" (green #16a34a) slices clearly distinct, title "Доход и налоги в {YYYY} году" readable, 3-row summary correct, estimated-baseline note appears when applicable.
  Expected: proportions accurate, colors legible in light/dark mode, text readable, layout matches other cards.
result: blocked
blocked_by: other
reason: "Невозможно проверить, т.к. не происходит редиректа на главный экран"

## Summary

total: 3
passed: 1
issues: 1
pending: 0
skipped: 0
blocked: 1

## Gaps

- gap_id: G-04-2
  truth: "After installing as a standalone PWA, the user remains able to log back in and sees their data"
  status: failed
  reason: "User reported: При попытке войти или зарегистрироваться ничего не происходит, данные отправляются на сервер, однако редиректа на главный экран не происходит"
  severity: major
  test: 2
  artifacts: []
  missing: []
