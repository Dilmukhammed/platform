create table public.student_profiles (
  id uuid primary key default gen_random_uuid(),
  student_login text not null,
  first_name text not null,
  last_name text not null,
  middle_name text,
  display_name text,
  status public.student_status_enum not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index student_profiles_student_login_active_idx
  on public.student_profiles (student_login)
  where deleted_at is null
    and status in ('active', 'blocked');

create table public.student_credentials (
  id uuid primary key default gen_random_uuid(),
  student_profile_id uuid not null,
  pin_hash text not null,
  status public.student_credential_status_enum not null default 'active',
  last_pin_changed_at timestamptz not null default now(),
  reset_required_at timestamptz,
  locked_at timestamptz,
  failed_attempts_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint student_credentials_student_profile_id_fkey
    foreign key (student_profile_id)
    references public.student_profiles (id)
    on update cascade
    on delete restrict,
  constraint student_credentials_failed_attempts_count_check
    check (failed_attempts_count >= 0)
);

create index student_credentials_student_profile_id_idx
  on public.student_credentials (student_profile_id);

create unique index student_credentials_student_profile_id_current_idx
  on public.student_credentials (student_profile_id)
  where deleted_at is null
    and status in ('active', 'locked', 'reset_required');

create table public.organization_students (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  student_profile_id uuid not null,
  status public.student_status_enum not null default 'active',
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint organization_students_organization_id_fkey
    foreign key (organization_id)
    references public.organizations (id)
    on update cascade
    on delete restrict,
  constraint organization_students_student_profile_id_fkey
    foreign key (student_profile_id)
    references public.student_profiles (id)
    on update cascade
    on delete restrict,
  constraint organization_students_organization_id_id_key
    unique (organization_id, id)
);

create index organization_students_organization_id_idx
  on public.organization_students (organization_id);

create index organization_students_student_profile_id_idx
  on public.organization_students (student_profile_id);

create unique index organization_students_active_org_student_idx
  on public.organization_students (organization_id, student_profile_id)
  where deleted_at is null
    and status in ('active', 'blocked');

create table public.organization_student_identifiers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  organization_student_id uuid not null,
  identifier_type text not null,
  identifier_value text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint organization_student_identifiers_org_student_fkey
    foreign key (organization_id, organization_student_id)
    references public.organization_students (organization_id, id)
    on update cascade
    on delete restrict,
  constraint organization_student_identifiers_identifier_type_check
    check (btrim(identifier_type) <> ''),
  constraint organization_student_identifiers_identifier_value_check
    check (btrim(identifier_value) <> '')
);

create index organization_student_identifiers_organization_id_idx
  on public.organization_student_identifiers (organization_id);

create index organization_student_identifiers_organization_student_id_idx
  on public.organization_student_identifiers (organization_student_id);

create unique index organization_student_identifiers_active_org_identifier_idx
  on public.organization_student_identifiers (organization_id, identifier_type, identifier_value)
  where deleted_at is null;
