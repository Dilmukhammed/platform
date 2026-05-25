create table public.classes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  title text not null,
  description text,
  status public.class_status_enum not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint classes_organization_id_fkey
    foreign key (organization_id)
    references public.organizations (id)
    on update cascade
    on delete restrict,
  constraint classes_organization_id_id_key
    unique (organization_id, id),
  constraint classes_title_check
    check (btrim(title) <> ''),
  constraint classes_description_check
    check (description is null or btrim(description) <> '')
);

create index classes_organization_id_idx
  on public.classes (organization_id);

create table public.class_teachers (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null,
  platform_user_id uuid not null,
  role public.class_teacher_role_enum not null,
  is_primary boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint class_teachers_class_id_fkey
    foreign key (class_id)
    references public.classes (id)
    on update cascade
    on delete restrict,
  constraint class_teachers_platform_user_id_fkey
    foreign key (platform_user_id)
    references public.platform_users (id)
    on update cascade
    on delete restrict,
  constraint class_teachers_status_check
    check (status in ('active', 'inactive', 'archived')),
  constraint class_teachers_primary_owner_check
    check (not is_primary or role = 'owner')
);

create index class_teachers_class_id_idx
  on public.class_teachers (class_id);

create index class_teachers_platform_user_id_idx
  on public.class_teachers (platform_user_id);

create unique index class_teachers_active_class_user_idx
  on public.class_teachers (class_id, platform_user_id)
  where deleted_at is null
    and status = 'active';

create unique index class_teachers_active_primary_owner_idx
  on public.class_teachers (class_id)
  where deleted_at is null
    and status = 'active'
    and is_primary
    and role = 'owner';

create table public.class_join_codes (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null,
  code text not null,
  status public.join_code_status_enum not null default 'active',
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  replaced_by_join_code_id uuid,
  rotated_by_platform_user_id uuid,
  rotated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint class_join_codes_class_id_fkey
    foreign key (class_id)
    references public.classes (id)
    on update cascade
    on delete restrict,
  constraint class_join_codes_class_id_id_key
    unique (class_id, id),
  constraint class_join_codes_rotated_by_platform_user_id_fkey
    foreign key (rotated_by_platform_user_id)
    references public.platform_users (id)
    on update cascade
    on delete restrict,
  constraint class_join_codes_replaced_by_join_code_id_fkey
    foreign key (class_id, replaced_by_join_code_id)
    references public.class_join_codes (class_id, id)
    on update cascade
    on delete restrict,
  constraint class_join_codes_code_format_check
    check (code ~ '^[0-9]{6}$'),
  constraint class_join_codes_valid_window_check
    check (valid_until is null or valid_until >= valid_from),
  constraint class_join_codes_rotation_pair_check
    check (
      (rotated_by_platform_user_id is null and rotated_at is null)
      or (rotated_by_platform_user_id is not null and rotated_at is not null)
    ),
  constraint class_join_codes_replacement_state_check
    check (
      replaced_by_join_code_id is null
      or (
        status <> 'active'
        and rotated_at is not null
      )
    ),
  constraint class_join_codes_active_state_check
    check (
      status <> 'active'
      or (
        valid_until is null
        and replaced_by_join_code_id is null
        and rotated_by_platform_user_id is null
        and rotated_at is null
      )
    ),
  constraint class_join_codes_not_self_replacement_check
    check (replaced_by_join_code_id is null or replaced_by_join_code_id <> id)
);

create index class_join_codes_class_id_idx
  on public.class_join_codes (class_id);

create index class_join_codes_rotated_by_platform_user_id_idx
  on public.class_join_codes (rotated_by_platform_user_id);

create unique index class_join_codes_active_class_idx
  on public.class_join_codes (class_id)
  where deleted_at is null
    and status = 'active';

create unique index class_join_codes_active_code_idx
  on public.class_join_codes (code)
  where deleted_at is null
    and status = 'active';

alter table public.organization_students
  add constraint organization_students_organization_id_id_student_profile_id_key
  unique (organization_id, id, student_profile_id);

create table public.class_enrollments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  class_id uuid not null,
  student_profile_id uuid not null,
  organization_student_id uuid,
  status public.enrollment_status_enum not null default 'active',
  source public.enrollment_source_enum not null,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint class_enrollments_organization_id_fkey
    foreign key (organization_id)
    references public.organizations (id)
    on update cascade
    on delete restrict,
  constraint class_enrollments_class_id_fkey
    foreign key (organization_id, class_id)
    references public.classes (organization_id, id)
    on update cascade
    on delete restrict,
  constraint class_enrollments_student_profile_id_fkey
    foreign key (student_profile_id)
    references public.student_profiles (id)
    on update cascade
    on delete restrict,
  constraint class_enrollments_organization_student_id_fkey
    foreign key (organization_id, organization_student_id, student_profile_id)
    references public.organization_students (organization_id, id, student_profile_id)
    on update cascade
    on delete restrict,
  constraint class_enrollments_active_left_at_check
    check (status <> 'active' or left_at is null),
  constraint class_enrollments_left_status_check
    check (status <> 'left' or left_at is not null),
  constraint class_enrollments_left_at_window_check
    check (left_at is null or left_at >= joined_at)
);

create index class_enrollments_organization_id_idx
  on public.class_enrollments (organization_id);

create index class_enrollments_class_id_idx
  on public.class_enrollments (class_id);

create index class_enrollments_student_profile_id_idx
  on public.class_enrollments (student_profile_id);

create index class_enrollments_organization_student_id_idx
  on public.class_enrollments (organization_student_id);

create unique index class_enrollments_active_class_student_idx
  on public.class_enrollments (class_id, student_profile_id)
  where deleted_at is null
    and status = 'active';

create table public.class_enrollment_status_history (
  id uuid primary key default gen_random_uuid(),
  class_enrollment_id uuid not null,
  previous_status public.enrollment_status_enum,
  status public.enrollment_status_enum not null,
  changed_by_platform_user_id uuid,
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint class_enrollment_status_history_class_enrollment_id_fkey
    foreign key (class_enrollment_id)
    references public.class_enrollments (id)
    on update cascade
    on delete restrict,
  constraint class_enrollment_status_history_changed_by_platform_user_id_fkey
    foreign key (changed_by_platform_user_id)
    references public.platform_users (id)
    on update cascade
    on delete restrict,
  constraint class_enrollment_status_history_transition_check
    check (previous_status is null or previous_status <> status)
);

create index class_enrollment_status_history_class_enrollment_id_idx
  on public.class_enrollment_status_history (class_enrollment_id);

create index class_enrollment_status_history_changed_by_platform_user_id_idx
  on public.class_enrollment_status_history (changed_by_platform_user_id);

create or replace function public.prevent_class_enrollment_status_history_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'class_enrollment_status_history is append-only';
end;
$$;

create trigger class_enrollment_status_history_prevent_update
  before update on public.class_enrollment_status_history
  for each row
  execute function public.prevent_class_enrollment_status_history_mutation();

create trigger class_enrollment_status_history_prevent_delete
  before delete on public.class_enrollment_status_history
  for each row
  execute function public.prevent_class_enrollment_status_history_mutation();
