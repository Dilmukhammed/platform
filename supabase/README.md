# Local Supabase bootstrap notes

- Primary seed entrypoint: `supabase/seed.sql`
- Local config entrypoint: `supabase/config.toml`
- Preferred reset command when Supabase CLI is installed locally: `npx supabase db reset --debug`

## Why not direct `auth.users` seeding yet?

T0.2 stays intentionally narrow: it provides deterministic domain fixtures and local credential placeholders without implementing T1 auth flows.

- staff/admin placeholders live in `app.bootstrap_auth_accounts`
- student login fixture lives in `app.student_profiles`
- student PIN fixture lives in `app.student_credentials`

This keeps QA fixtures reproducible now while leaving the real Supabase Auth wiring for the dedicated auth slice.
