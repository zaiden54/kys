# Requirements: НаРуки

**Defined:** 2026-09-01
**Core Value:** Пользователь может заранее и точно спланировать бюджет, зная сумму и дату ближайшей выплаты зарплаты на руки.

## v1.1 Requirements

Requirements for the "Полировка MVP" milestone. Each maps to roadmap phases.

### UI/UX (визуальный редизайн)

- [ ] **UI-01**: Пользователь видит понятные empty/loading/error-состояния вместо пустых экранов и технических ошибок (логин, главная, бонусы, отпуска, сводка)
- [ ] **UI-02**: Все денежные суммы форматируются единообразно (locale-aware, табличные цифры) по всему приложению
- [ ] **UI-03**: Разрушающие действия (перезапись оклада, удаление бонуса/отпуска) показывают диалог подтверждения с значением до/после
- [ ] **UI-04**: Пользователь может вернуться на главный экран с любого экрана приложения
- [ ] **UI-05**: Визуальный дизайн приложения (типографика, цвета, компоненты) полностью переработан через `frontend-design` skill
- [ ] **UI-06**: Приложение поддерживает тёмную тему по системной настройке
- [ ] **UI-07**: Интерактивные элементы соответствуют базовым требованиям доступности (контраст, focus-индикаторы, подписанные поля форм)

### PWA

- [ ] **PWA-01**: Хедер/навигация уважают `env(safe-area-inset-top/bottom)` — контент не пересекается с dynamic island/home indicator на iPhone
- [ ] **PWA-02**: Viewport настроен с `viewport-fit=cover`, safe-area отступы проверены на реальном/симулированном iPhone с Dynamic Island

### Безопасность

- [ ] **SEC-01**: Флоу логина и регистрации проверены (браузерным DevTools/Playwright), что пароль никогда не попадает в URL, query-строку или логи
- [ ] **SEC-02**: Ошибки аутентификации — обобщённые (без user enumeration) при неверном логине/пароле
- [ ] **SEC-03**: Сессионные cookie подтверждены как httpOnly + secure + с корректным scope
- [x] **SEC-04**: `BETTER_AUTH_URL`/allowed-hosts корректно и динамически резолвятся на PR-preview, staging и production

### E2E-тестирование

- [ ] **E2E-01**: Playwright настроен в репозитории, golden-path smoke-тест покрывает регистрация → вход → ввод оклада → прогноз следующей выплаты
- [ ] **E2E-02**: E2E-тесты покрывают добавление/редактирование/удаление бонуса и его влияние на прогноз
- [ ] **E2E-03**: E2E-тесты покрывают добавление/редактирование/удаление отпуска и расчёт отпускных
- [ ] **E2E-04**: E2E-тесты покрывают годовую pie-сводку и установку PWA
- [ ] **E2E-05**: Playwright MCP интегрирован для AI-ассистированного написания тестов
- [ ] **E2E-06**: E2E-сьют в CI использует изолированную Neon-ветку БД, а не общее/прод состояние

### Деплой и релизный процесс

- [ ] **DEPLOY-01**: Постоянное staging-окружение (свой Vercel-домен + своя Neon-ветка) отделено от прода
- [ ] **DEPLOY-02**: Переменные окружения (`BETTER_AUTH_URL`, `DATABASE_URL` и др.) корректно скоуплены по окружениям (Preview/Staging/Prod)
- [x] **DEPLOY-03**: GitHub Actions запускает lint + typecheck + unit-тесты на каждый PR и блокирует мердж при ошибке
- [ ] **DEPLOY-04**: Релизный цикл — feature-branch → staging (ручная проверка) → production — задокументирован и соблюдается
- [ ] **DEPLOY-05**: Vercel auto-deploy и GitHub Actions не конфликтуют (double-deploy race устранён, чёткий владелец на каждое окружение)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### UI/UX Differentiators

- **UI-08**: Экспорт истории (оклад/бонусы/отпуска) в PDF/CSV
- **UI-09**: In-app или push-уведомления о приближающейся выплате

### Auth

- **SEC-05**: Биометрическая аутентификация (Face ID / Touch ID) через WebAuthn

### Core Model

- **MODEL-01**: Мультивалютная поддержка (для сотрудников за рубежом)
- **MODEL-02**: Undo/история изменений оклада (журнал аудита)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| i18n (кроме русского) | Приложение специфично для РФ-налогового законодательства |
| SMS 2FA / MFA | Overkill для проекта с <1000 пользователей; риск — кража сессии, а не подбор пароля |
| Audit log по каждому полю | Overkill, усложняет схему БД без явного запроса пользователей |
| Offline-first sync | Вне scope v1 по решению в PROJECT.md; PWA-манифест нужен только для установки на экран |
| Рефакторинг налогового движка НДФЛ | Заморожен на время polish-milestone — вносятся только подтверждённые баг-фиксы, не рефакторинг |
| Real-time collaboration (несколько юзеров редактируют одну запись) | Ломает текущую compare-and-swap + HMAC-модель конкурентной записи |
| Enterprise-grade CI/CD (ArgoCD, Terraform, multi-stage approvals) | Overkill для solo/small-team проекта; GitHub Actions гейт + Vercel + ручной staging→prod промоушен достаточны |
| Аналитика/телеметрия (Mixpanel, Amplitude и т.п.) | Приватность важна для финансового приложения; нет конкретных вопросов, на которые нужны данные |
| A/B тестирование / feature flags | Преждевременно для polish-milestone без новых экспериментальных фич |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| UI-01 | Phase 8 | Pending |
| UI-02 | Phase 8 | Pending |
| UI-03 | Phase 8 | Pending |
| UI-04 | Phase 8 | Pending |
| UI-05 | Phase 8 | Pending |
| UI-06 | Phase 8 | Pending |
| UI-07 | Phase 8 | Pending |
| PWA-01 | Phase 8 | Pending |
| PWA-02 | Phase 8 | Pending |
| SEC-01 | Phase 6 | Pending |
| SEC-02 | Phase 6 | Pending |
| SEC-03 | Phase 6 | Pending |
| SEC-04 | Phase 5 | Complete |
| E2E-01 | Phase 7 | Pending |
| E2E-02 | Phase 7 | Pending |
| E2E-03 | Phase 7 | Pending |
| E2E-04 | Phase 7 | Pending |
| E2E-05 | Phase 7 | Pending |
| E2E-06 | Phase 7 | Pending |
| DEPLOY-01 | Phase 5 | Pending |
| DEPLOY-02 | Phase 5 | Pending |
| DEPLOY-03 | Phase 5 | Complete |
| DEPLOY-04 | Phase 5 | Pending |
| DEPLOY-05 | Phase 5 | Pending |

**Coverage:**

- v1.1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-01*
*Last updated: 2026-09-01 after v1.1 ROADMAP.md creation (Phases 5-8)*
