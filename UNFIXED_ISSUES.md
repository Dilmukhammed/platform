# Unfixed Issues — Full Audit Summary

**Generated**: 2026-05-17
**Scope**: Teacher-facing pages — Students, Tests, Publications, Reviews, Library, Settings

---

## Students Page (`/teacher/students`)

| # | Issue | Severity | Why Not Fixed |
|---|-------|----------|---------------|
| — | *(all critical bugs fixed)* | — | CSV `class_code`, pagination, `imported=true` — all fixed |

---

## Tests Page (`/teacher/tests`)

| # | Issue | Severity | Why Not Fixed |
|---|-------|----------|---------------|
| 6 | **AI Draft Generation API** (`/api/v1/teacher/test-drafts/generate`) — полностью stub (in-memory `jobStore`, placeholder вопросы) | 🟡 Low | Мёртвый код. UI НЕ вызывает этот эндпоинт — `CreateAiDraftForm` шлёт запросы напрямую в `POST /api/v1/teacher/tests`. Удаление безопасно, но требует отдельного PR. |
| 7 | **CreateAiDraftForm** — генерирует placeholder-вопросы (`"Question 1 about: ...", "Sample answer for question 1"`) | 🟡 Low | Документированный стаб. Описание на странице: *"This workspace uses a deterministic local stub instead of an external AI API"*. Нужна интеграция с реальным AI API — отдельная задача. |
| 8 | **Legacy types** (`src/modules/tests/types.ts`) — `TestStatus = "personal_draft" | "pending_school"` не совпадает с реальными `"draft" | "active" | "archived" | "deletion_requested"` | 🟡 Low | Нигде не импортируется в production-коде. Безвреден, но запутывает разработчиков. Удаление безопасно. |
| 10 | **DraftEditor** — нет кнопок Add/Delete вопросов | 🟠 Minor | UX improvement, не баг. В `CreateTestForm` и `EditTestForm` кнопки есть. Требует дизайна UI. |
| 11 | **DraftEditor** — нет валидации перед сохранением (`handleSave` отправляет без проверки) | 🟠 Minor | В отличие от `CreateTestForm.validateForm()`. Риск: пустые промпты, невалидные опции уходят на сервер. Серверная валидация частично спасает. |
| 13 | **Нет пагинации** — `listTeacherTests(userId, { pageSize: 100 })` хардкод | 🟠 Minor | Нужен `page` параметр в `server-data.ts` + UI-компонент пагинации. Аналогично уже сделанному для Students. Трудоёмко (~30 мин). |

---

## Publications Page (`/teacher/publications`)

| # | Issue | Severity | Why Not Fixed |
|---|-------|----------|---------------|
| 10 | **Нет пагинации** — `listTeacherPublications()` использует `.range(0, PAGE_SIZE - 1)` без параметра `page` | 🟠 Minor | Аналогично Tests #13. Нужен `page` параметр + UI. Нет кнопок Next/Prev. |
| 11 | **Мёртвый модуль** (`src/modules/publications/` — `store.ts`, `service.ts`, `bootstrap-data.ts`) | 🟡 Low | In-memory состояние через `globalThis`. Страницы используют Supabase напрямую через `server-data.ts` или `apiGet()`. Модуль можно удалить как сделано для organizations/students/classes. |
| 12 | **`formulaSnapshot` может быть строкой** вместо объекта | 🟡 Low | Зависит от типа колонки `formula_snapshot_json` в БД (JSON vs TEXT). Если TEXT — Supabase вернёт строку, `.practiceWeight` упадёт. Нужна проверка `typeof` перед обращением. |
| 13 | **Partial failure** при создании публикации — `assignment_results` insert может упасть после создания publication | 🟡 Low | Supabase JS client не поддерживает транзакции. Частично созданная публикация остаётся. Нужен cleanup в catch-блоке. |
| 14 | **Двойной путь данных**: список → `server-data.ts` (прямой Supabase), детали → `apiGet()` (HTTP → API route) | 🟡 Low | Архитектурный долг. Может приводить к расхождению данных. Унификация требует рефакторинга. |

---

## Reviews Page (`/teacher/reviews`)

| # | Issue | Severity | Why Not Fixed |
|---|-------|----------|---------------|
| 1 | **Preview stub** вместо реального рендера файла студента (`[Preview of filename]`) | 🔴 Critical | Требует интеграции PDF.js / image viewer. Это архитектурная задача, не быстрый фикс. Нужен отдельный план. |
| 3 | **Нет пагинации в UI** — `listTeacherPendingReviews()` возвращает ≤20, остальные не видны | 🔴 Functional | Аналогично Tests #13, Publications #10. Нужен `page` параметр + UI компонент. |
| 4 | **Мёртвый API** `/api/v1/teacher/reviews/pending` — делает то же что `server-data.ts`, но не используется | 🟡 Low | Кандидат на удаление. Ни одна страница не вызывает этот эндпоинт. |
| 5 | **Потеря фильтров при поиске** — форма поиска и фильтры разделены, сброс при submit | 🟡 UX | Нужно объединить в одну `<form>` или дублировать hidden-поля в обеих формах. |
| 6 | **Дублирование API аннотаций** — `/reviews/[reviewId]/annotations` (не исп.) vs `/assignment-results/[id]/annotations` (исп.) | 🟡 Low | Два роута делают одно и то же. Мёртвый можно удалить. |
| 7 | **Семантическая путаница** — `submissionId` = `assignmentResultId` в `[submissionId]/page.tsx` | 🟡 Low | Не баг рендеринга, но источник будущих ошибок. Нужен рефакторинг имён. |
| 10 | **Двойная рамка** в `ExpandableQuestionCard` — `rounded-card` + `Card elevation="sm"` | 🟡 UI | Визуальный глюк. Нужен CSS-фикс: убрать вложенный Card или `rounded-card`. |
| 11 | **Нет переключения** между Practice Review и Test Review — обе секции видны одновременно | 🟡 UX | Добавить табы с `useState` (нужен client component). |
| 12 | **Clear кнопка без подтверждения** — мгновенно удаляет все аннотации | 🟡 UX | Добавить `confirm()` диалог перед удалением. |
| 13 | **Хардкод цвета/толщины пера** — `color: "red", width: 2` | 🟡 Functional | Нужен UI для выбора цвета и толщины. Фича, не баг. |
| 14 | **`getRelativeTime` не локализован** — "Just now", "h ago" на английском | 🟢 i18n | Нужна локализация (i18n). Отдельная задача. |
| 15 | **Потенциальный 404** — `<Link href="/teacher/assignments">` может вести на несуществующий роут | 🟢 Navigation | Проверить существует ли `/teacher/assignments`. Если нет — убрать или создать. |
| 16 | **Нет кнопки "Clear Filters"** — сброс только ручной | 🟢 UX | Добавить кнопку сброса в `ReviewsFilters`. |

---

## Library Page (`/teacher/library`)

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | **Wrong org** — school materials берёт `organizations[0]` вместо выбранной | 🔴 Critical | ✅ **FIXED** — заменено на `/api/v1/teacher/organizations/selected` |
| 2 | **Null crash** — `ownerTeacherName: string` в UI, API возвращает `null` | 🔴 Critical | ✅ **FIXED** — тип → `string \| null`, добавлен `?? "Unknown"` |
| 3 | **Поиск не реализован** — `Search` и `Input` импортированы но не используются | 🟡 Stub | Убрать неиспользуемые импорты или реализовать поиск |
| 4 | **Замена файла не реализована** — `EditMaterialForm` явно говорит "File replacement stays outside this v1" | 🟡 Stub | Запланированная фича, не баг |
| 5 | **Нет пагинации** — все материалы загружаются одним запросом | 🟠 Minor | Нужен `page` параметр + UI |
| 6 | **Дубликат: карточки + таблица** — оба view рендерятся одновременно | 🟠 Minor | Аналогично Publications #8 — нужен переключатель `?view=` |
| 7 | **Мёртвый in-memory сервис** — `modules/materials/service.ts` (не используется UI) | 🟡 Low | Удалить или пометить deprecated |
| 8 | **Type hack** — `"default" as "info"` в StatusChip | 🟠 Quality | Заменить на `"info"` напрямую или добавить в union |
| 9 | **Дублирование типов** — `OrganizationItem`, `SchoolMaterial` внутри компонента | 🟡 Low | Вынести в общий файл типов |
| 10 | **Material ID в UI** — UUID показывается учителю | 🟢 Cosmetic | Убрать `<dd>{material.materialId}</dd>` |
| 11 | **Неиспользуемые импорты** — `Search`, `Input` | 🟢 Cleanup | Удалить |

---

## Settings Page (`/teacher/settings`)

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | **PasswordChangeModal без accessibility** — нет focus trap, Escape, portal, ARIA | 🔴 Critical | ✅ **FIXED** — переписан на проектный `<Modal>` |
| 2 | **Нет API для обновления профиля** — нет `/api/v1/teacher/profile` | 🔴 Critical | Нужен новый API route. Display Name/Login навсегда disabled. |
| 3 | **Нет endpoint для аватара** — нет связи uploads → `platform_users.avatar_url` | 🔴 Critical | Нужен новый API route |
| 4 | **"Coming Soon" заглушки** ×3 — Email Notifications, 2FA, Appearance Theme | 🟡 Stub | Запланированные фичи |
| 5 | **Хардкод данных** — In-app Notifications "Enabled", Theme "Light" | 🟡 Stub | Нет бэкенда для хранения/чтения настроек |
| 6 | **Organization ID — сырой UUID** в UI | 🟢 Cosmetic | Заменить на имя организации |
| 7 | **Нет Suspense/Skeleton** — в отличие от admin settings | 🟠 Minor | Добавить `loading.tsx` |
| 8 | **Нет подсказки о disabled полях** — пользователь не понимает почему нельзя edit | 🟠 UX | Добавить текст "Contact administrator to change" |
| 9 | **Мёртвый `userId` prop** — PasswordChangeModal получает но не использует | 🟢 Cleanup | Убрать |
| 10 | **Session expiration всегда fresh** — `Date.now() + 8h`, предупреждение никогда не сработает | 🟡 Potential bug | Сохранять `iat` в cookie |

---

## Summary by Priority (Updated)

| Priority | Count | Action |
|----------|-------|--------|
| 🔴 Critical (not fixed) | 4 | Reviews #1 (preview stub), #3 (pagination), Settings #2 (no profile API), #3 (no avatar API) |
| 🔴 Critical (fixed) | 5 | Library #1 (wrong org), #2 (null crash); Settings #1 (modal a11y); Tests/Publications various |
| 🟠 Functional/UX debt | 12 | Pagination ×4, validation, filters, tabs, duplicate views, no skeleton |
| 🟡 Dead code / low risk | 12 | Unused APIs, legacy types, dual paths, stubs |
| 🟢 Cosmetic / i18n | 6 | Localization, 404 check, clear filters, UUID in UI, unused imports |

**Total unfixed**: 43 issues across 9 pages
**Total fixed**: 65+ issues across all audits

**Biggest gaps**:
1. **Reviews #1** — PDF/image preview stub (core review functionality broken)
2. **Settings #2** — No teacher profile update API (all profile fields read-only forever)
3. **Pagination ×7** — Materials ✅, Assignments ✅, Notifications ✅; Tests, Publications, Reviews, Library still missing
4. **Duplicate views ×2** — Publications, Library both render cards+table simultaneously

---

## Assignments Page (`/teacher/assignments`) — Recent Audit

| # | Issue | Severity | Why Not Fixed |
|---|-------|----------|---------------|
| 8 | **No Edit button** for templates | 🟠 Medium | Needs full edit page: new route `[templateId]/edit`, pre-filled form, PATCH handler |
| 14 | **Filter tabs trigger full server render** | 🟢 Low | Uses `<Link href="?filter=">` — works correctly, just not optimal. Needs client component refactor |

---

## Gradebook Page (`/teacher/gradebook`) — Recent Audit

| # | Issue | Severity | Why Not Fixed |
|---|-------|----------|---------------|
| 13 | **No pagination** in grades table | 🟠 Medium | Table grows indefinitely. Needs API page param + UI |
| 4 | **`mappedGrade` type mismatch** in main gradebook API | 🟢 Low | API returns nullable, frontend already handles null via recent fixes |
| 12 | **`studentId` field** contains login or enrollment ID | 🟢 Cosmetic | Naming issue in API response |

---

## Notifications Page (`/teacher/notifications`) — Recent Audit

| # | Issue | Severity | Why Not Fixed |
|---|-------|----------|---------------|
| 4 | **No unread badge in sidebar** | 🔴 High | Requires `layout.tsx` + `NotificationsBadge` integration — feature work |
| 8 | **No notification when student submits** | 🔴 High | Missing trigger code — no `INSERT` into `notifications` table on student submission |
| 9 | **No Supabase Realtime** subscriptions | 🟠 Medium | Architectural feature — needs Realtime channel setup + client subscription |
| 5 | **Email notifications "Coming Soon"** stub | 🟢 Low | Planned feature stub in Settings page |

---

## Summary by Priority (Updated)

| Priority | Count | Action |
|----------|-------|--------|
| 🔴 Critical (not fixed) | 6 | Reviews #1 (preview stub), #3 (pagination); Settings #2 (no profile API), #3 (no avatar API); Notifications #4 (sidebar badge), #8 (missing triggers) |
| 🔴 Critical (fixed) | 10 | Materials, Assignments, Gradebook, Notifications — all critical bugs fixed |
| 🟠 Functional/UX debt | 14 | Pagination ×4 unfixed (Tests, Publications, Reviews, Library), Edit button, validation, filters, tabs |
| 🟡 Dead code / low risk | 12 | Unused APIs, legacy types, dual paths, stubs |
| 🟢 Cosmetic / i18n | 7 | Localization, 404 check, naming, UUID in UI, unused imports |
