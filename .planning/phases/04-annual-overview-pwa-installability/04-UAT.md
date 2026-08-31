---
status: testing
phase: 04-annual-overview-pwa-installability
source: [04-VERIFICATION.md]
started: 2026-08-31T17:30:00Z
updated: 2026-08-31T17:30:00Z
---

## Current Test

number: 1
name: iPhone Home Screen Installation
expected: |
  App installs to home screen, icon appears (monochrome "H" on dark background), installation completes without error.
awaiting: user response

## Tests

### 1. iPhone Home Screen Installation
expected: On a physical iPhone (iOS 15+), open the app in Safari, tap Share → Add to Home Screen, confirm the "НаРуки" app appears on the home screen with the correct icon. App installs to home screen, icon appears (monochrome "H" on dark background), installation completes without error.
result: [pending]

### 2. Standalone App Launch and Re-Login
expected: |
  Tap the installed app icon to launch it in standalone mode. Verify: (1) app launches without Safari UI chrome, (2) user is not logged in (storage-jar separation), (3) login screen displays with re-login hint ("Похоже, это первый запуск с домашнего экрана…"), (4) log in with test credentials, (5) home screen displays (next payment card, pie chart, install banner hidden).
  Expected: app launches fullscreen standalone, login screen with re-login hint, after login home screen renders with correct data.
result: [pending]

### 3. AnnualPieChart Visual Verification
expected: |
  On the home screen (Safari tab and standalone app), visually inspect the pie chart: donut proportions match displayed percentages, "Налог" (red #dc2626) and "На руки" (green #16a34a) slices clearly distinct, title "Доход и налоги в {YYYY} году" readable, 3-row summary correct, estimated-baseline note appears when applicable.
  Expected: proportions accurate, colors legible in light/dark mode, text readable, layout matches other cards.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
