create table public.materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  scope_type public.library_scope_enum not null,
  owner_teacher_id uuid,
  owner_organization_id uuid,
  status public.material_status_enum not null default 'draft',
  source_file_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint materials_owner_teacher_id_fkey
    foreign key (owner_teacher_id)
    references public.platform_users (id)
    on update cascade
    on delete restrict,
  constraint materials_owner_organization_id_fkey
    foreign key (owner_organization_id)
    references public.organizations (id)
    on update cascade
    on delete restrict,
  constraint materials_title_check
    check (btrim(title) <> ''),
  constraint materials_description_check
    check (description is null or btrim(description) <> ''),
  constraint materials_source_file_path_check
    check (btrim(source_file_path) <> ''),
  constraint materials_scope_owner_check
    check (
      (scope_type = 'personal' and owner_teacher_id is not null and owner_organization_id is null)
      or (scope_type = 'organization' and owner_organization_id is not null)
    )
);

create index materials_owner_teacher_id_idx
  on public.materials (owner_teacher_id);

create index materials_owner_organization_id_idx
  on public.materials (owner_organization_id);

create table public.material_approvals (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null,
  requested_by_platform_user_id uuid not null,
  reviewed_by_platform_user_id uuid,
  decision public.approval_decision_enum not null default 'pending',
  decision_reason text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint material_approvals_material_id_fkey
    foreign key (material_id)
    references public.materials (id)
    on update cascade
    on delete restrict,
  constraint material_approvals_requested_by_platform_user_id_fkey
    foreign key (requested_by_platform_user_id)
    references public.platform_users (id)
    on update cascade
    on delete restrict,
  constraint material_approvals_reviewed_by_platform_user_id_fkey
    foreign key (reviewed_by_platform_user_id)
    references public.platform_users (id)
    on update cascade
    on delete restrict,
  constraint material_approvals_decision_reason_check
    check (decision_reason is null or btrim(decision_reason) <> ''),
  constraint material_approvals_review_state_check
    check (
      (decision = 'pending' and reviewed_by_platform_user_id is null and reviewed_at is null)
      or (
        decision in ('approved', 'rejected')
        and reviewed_by_platform_user_id is not null
        and reviewed_at is not null
      )
    )
);

create index material_approvals_material_id_idx
  on public.material_approvals (material_id);

create index material_approvals_requested_by_platform_user_id_idx
  on public.material_approvals (requested_by_platform_user_id);

create index material_approvals_reviewed_by_platform_user_id_idx
  on public.material_approvals (reviewed_by_platform_user_id);

create unique index material_approvals_pending_material_idx
  on public.material_approvals (material_id)
  where deleted_at is null
    and decision = 'pending';

create table public.tests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  scope_type public.library_scope_enum not null,
  owner_teacher_id uuid,
  owner_organization_id uuid,
  status public.test_status_enum not null default 'draft',
  origin text not null default 'manual',
  source_file_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint tests_owner_teacher_id_fkey
    foreign key (owner_teacher_id)
    references public.platform_users (id)
    on update cascade
    on delete restrict,
  constraint tests_owner_organization_id_fkey
    foreign key (owner_organization_id)
    references public.organizations (id)
    on update cascade
    on delete restrict,
  constraint tests_title_check
    check (btrim(title) <> ''),
  constraint tests_description_check
    check (description is null or btrim(description) <> ''),
  constraint tests_origin_check
    check (origin in ('manual', 'ai_draft', 'imported')),
  constraint tests_source_file_path_check
    check (source_file_path is null or btrim(source_file_path) <> ''),
  constraint tests_scope_owner_check
    check (
      (scope_type = 'personal' and owner_teacher_id is not null and owner_organization_id is null)
      or (scope_type = 'organization' and owner_organization_id is not null)
    )
);

create index tests_owner_teacher_id_idx
  on public.tests (owner_teacher_id);

create index tests_owner_organization_id_idx
  on public.tests (owner_organization_id);

create table public.test_questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null,
  order_index integer not null,
  question_type text not null,
  prompt text not null,
  options_json jsonb,
  answer_json jsonb not null,
  explanation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint test_questions_test_id_fkey
    foreign key (test_id)
    references public.tests (id)
    on update cascade
    on delete restrict,
  constraint test_questions_order_index_check
    check (order_index >= 0),
  constraint test_questions_question_type_check
    check (btrim(question_type) <> ''),
  constraint test_questions_prompt_check
    check (btrim(prompt) <> ''),
  constraint test_questions_explanation_check
    check (explanation is null or btrim(explanation) <> '')
);

create index test_questions_test_id_idx
  on public.test_questions (test_id);

create unique index test_questions_active_test_order_idx
  on public.test_questions (test_id, order_index)
  where deleted_at is null;

create table public.test_approvals (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null,
  requested_by_platform_user_id uuid not null,
  reviewed_by_platform_user_id uuid,
  decision public.approval_decision_enum not null default 'pending',
  decision_reason text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint test_approvals_test_id_fkey
    foreign key (test_id)
    references public.tests (id)
    on update cascade
    on delete restrict,
  constraint test_approvals_requested_by_platform_user_id_fkey
    foreign key (requested_by_platform_user_id)
    references public.platform_users (id)
    on update cascade
    on delete restrict,
  constraint test_approvals_reviewed_by_platform_user_id_fkey
    foreign key (reviewed_by_platform_user_id)
    references public.platform_users (id)
    on update cascade
    on delete restrict,
  constraint test_approvals_decision_reason_check
    check (decision_reason is null or btrim(decision_reason) <> ''),
  constraint test_approvals_review_state_check
    check (
      (decision = 'pending' and reviewed_by_platform_user_id is null and reviewed_at is null)
      or (
        decision in ('approved', 'rejected')
        and reviewed_by_platform_user_id is not null
        and reviewed_at is not null
      )
    )
);

create index test_approvals_test_id_idx
  on public.test_approvals (test_id);

create index test_approvals_requested_by_platform_user_id_idx
  on public.test_approvals (requested_by_platform_user_id);

create index test_approvals_reviewed_by_platform_user_id_idx
  on public.test_approvals (reviewed_by_platform_user_id);

create unique index test_approvals_pending_test_idx
  on public.test_approvals (test_id)
  where deleted_at is null
    and decision = 'pending';
