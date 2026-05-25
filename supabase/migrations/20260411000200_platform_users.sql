create table public.platform_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  role public.platform_user_role_enum not null default 'teacher',
  status public.platform_user_status_enum not null default 'active',
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint platform_users_auth_user_id_fkey
    foreign key (auth_user_id)
    references auth.users (id)
    on update cascade
    on delete restrict
);

create unique index platform_users_auth_user_id_active_idx
  on public.platform_users (auth_user_id)
  where deleted_at is null;
