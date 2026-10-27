## Project

**НаРуки** — PWA для расчёта зарплаты «на руки» в РФ. Пользователь вводит оклад «грязными» и график выплат (аванс + зарплата); приложение считает НДФЛ по прогрессивной шкале (с 2025 года) и показывает сумму и дату ближайшей выплаты. Мультипользовательское, данные синхронизируются через облако.

Constraints:
- PWA для iPhone (Safari «Добавить на экран Домой»): манифест, apple-touch-icon, standalone.
- Расчёты НДФЛ и отпускных — самая рискованная логика; покрыта unit-тестами в `src/domain/`.
- Данные только на сервере (Postgres), без offline-режима.

## Stack

Next.js 16.3 (App Router, Server Actions), React 19.2, TypeScript **6.0.x** (не 7.x — ломает typescript-eslint), Drizzle ORM + drizzle-kit, Neon Postgres (`@neondatabase/serverless`, neon-http — без интерактивных транзакций), Better Auth (email+пароль), Tailwind 4, Recharts, Serwist (не `next-pwa`), date-fns, Zod, React Hook Form, Vitest, Playwright.

## Conventions

- Деньги — целые копейки (`bigint`), даты — строки `YYYY-MM-DD`. «Сегодня» — всегда по Москве (`todayIsoInMoscow()` из `src/domain/time.ts`), в том числе в тестах.
- Каждый запрос к БД фильтрует по `userId`, полученному из `requireUserId()` (`src/lib/session.ts`); репозитории в `src/lib/db/*-repository.ts` — server-only.
- Схема БД: `src/lib/db/schema.ts` + `auth-schema.ts`, применяется `drizzle-kit push` (файлов миграций нет).

## Environments

- `main` → Vercel Production → Neon-ветка `production`. Схему в прод применять вручную: `npm run db:push`.
- Любая другая git-ветка → Vercel Preview → автоматическая Neon-ветка `preview/<branch>`; схема пушится в сборке (`scripts/apply-preview-schema.mjs`).
- Локально → Neon-ветка `vercel-dev` через `.env.local` (не читать и не выводить его содержимое).
- CI (GitHub Actions): lint, typecheck, unit-тесты, e2e на одноразовой Neon-ветке.

## Commands

`npm run dev` · `npm run lint` · `npm run typecheck` · `npm test` · `npm run test:e2e` · `npm run db:push`

`.planning/` — архив исследований и решений прошлых этапов (НДФЛ, отпускные, деплой); читать по необходимости, не обновлять.
