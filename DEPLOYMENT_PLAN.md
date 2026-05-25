# Deployment Plan — LMS Platform

**Created:** 2026-05-24  
**Status:** In Progress

---

## Этап 0: Инфраструктура

- [ ] Создать Supabase проект (production)
- [ ] Обновить `site_url` и `additional_redirect_urls` в `supabase/config.toml`
- [ ] Накатить все 32 миграции по порядку
- [ ] Настроить Supabase Auth email templates
- [ ] Создать Upstash Redis инстанс
- [ ] Проверить Fireworks AI API key

---

## Этап 1: Критические фиксы кода (6 проблем) ✅ ВЫПОЛНЕНО

### 1.1 Bootstrap fallback в production
- [x] Добавить guard в `authenticateStaff()` — кидать ошибку в production если Supabase недоступен
- [x] Добавить guard в `authenticateStudent()` — аналогично
- [x] Добавить guard в `createStudentProfileAction` — проверка `NEXT_PUBLIC_APP_URL`

### 1.2 Замена in-memory stores на Supabase
- [x] `src/modules/grades/store.ts` → отключён с production guard
- [x] `src/modules/join-codes/store.ts` → отключён с production guard
- [x] `src/lib/auth/reset-tokens.ts` → переписан на Supabase таблицу + миграция

### 1.3 Удаление реальных данных
- [x] Заменён `turdimuratovdilmuxammed321@gmail.com` → `teacher2@platform.local` в `seed.public.sql` и `bootstrap-data.ts`

### 1.4 Preview stub в Reviews
- [x] Реализован `AssetPreview` компонент в `ReviewWorkspace.tsx` (изображения + PDF через Google Docs viewer)

### 1.5 Пагинация
- [x] `/teacher/tests` — `listTeacherTests` возвращает `{ tests, total }` + UI
- [x] `/teacher/publications` — `listTeacherPublications` возвращает `{ publications, total }` + UI
- [x] `/teacher/reviews` — уже была пагинация
- [x] `/teacher/library` — навигационный хаб, пагинация не нужна

### 1.6 Teacher Settings API
- [x] `PATCH /profile` и avatar-эндпоинты уже существовали
- [x] Исправлен `initialAvatarUrl` (был hardcoded `null`)

### Дополнительно исправлено:
- [x] Орфанная `}` в `translations.ts` (ломала парсер) + восстановлена структура `tests.detail`
- [x] 107 ссылок `t.teacher.assignments` → `t.teacher.tests`
- [x] ~300+ пропущенных translation keys (`tests.*`, `student.assignments.*`, `gradebook.*`, `publications.*`)
- [x] 15+ pre-existing type errors (MaterialCardProps, SearchParams, string|null mismatches)
- [x] `bun run build` — 0 ошибок

---

## Этап 2: High-priority фиксы

- [ ] Добавить `import "server-only"` во все модули `src/modules/*/actions.ts`
- [ ] Убрать double-hop в Server Actions (прямые вызовы Supabase)
- [ ] Настроить Supabase Realtime для нотификаций
- [ ] Добавить триггер нотификации при student submission
- [ ] Настроить Upstash Redis для production rate limiting

---

## Этап 3: Финальная верификация

- [ ] `bun run build` — без ошибок
- [ ] `bun run lint` — без ошибок
- [ ] `bun test` — все тесты проходят
- [ ] `bunx playwright test` — E2E проходят
- [ ] Проверить LSP diagnostics на всех изменённых файлах
- [ ] Проверить RLS политики в production Supabase через Supabase Dashboard

---

## Этап 4: Production окружение

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<production-key>
AUTH_COOKIE_SECRET=<random-256-bit-hex>
FIREWORKS_API_KEY=<key>
UPSTASH_REDIS_REST_URL=https://<url>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<token>
NEXT_PUBLIC_APP_URL=https://<deployment-domain>
```

---

## Ресурсы

- `UNFIXED_ISSUES.md` — полный список известных проблем (43 шт.)
- `MINOR_BUGS.md` — мелкие UI баги (3 шт.)
- `supabase/migrations/` — 32 миграции БД
- `plans/` — планы по оптимизации и AI интеграции
