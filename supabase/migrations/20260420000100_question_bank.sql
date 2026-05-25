create table public.question_bank (
  id uuid primary key default gen_random_uuid(),
  question_type text not null,
  prompt text not null,
  options_json jsonb,
  answer_json jsonb not null,
  explanation text,
  images jsonb not null default '[]'::jsonb,
  scope_type public.library_scope_enum not null,
  owner_teacher_id uuid,
  owner_organization_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint question_bank_owner_teacher_id_fkey
    foreign key (owner_teacher_id)
    references public.platform_users (id)
    on update cascade
    on delete restrict,
  constraint question_bank_owner_organization_id_fkey
    foreign key (owner_organization_id)
    references public.organizations (id)
    on update cascade
    on delete restrict,
  constraint question_bank_question_type_check
    check (btrim(question_type) <> ''),
  constraint question_bank_prompt_check
    check (btrim(prompt) <> ''),
  constraint question_bank_explanation_check
    check (explanation is null or btrim(explanation) <> ''),
  constraint question_bank_scope_owner_check
    check (
      (scope_type = 'personal' and owner_teacher_id is not null and owner_organization_id is null)
      or (scope_type = 'organization' and owner_organization_id is not null)
    )
);

create index question_bank_owner_teacher_id_idx
  on public.question_bank (owner_teacher_id);

create index question_bank_owner_organization_id_idx
  on public.question_bank (owner_organization_id);

create index question_bank_scope_type_idx
  on public.question_bank (scope_type);

comment on column public.question_bank.id is 'Primary key - UUID';
comment on column public.question_bank.question_type is 'Type of question (e.g., multiple_choice, true_false, short_answer)';
comment on column public.question_bank.prompt is 'The question text/prompt';
comment on column public.question_bank.options_json is 'JSON object containing question options (for MC: {options: [...], correctIndex: n})';
comment on column public.question_bank.answer_json is 'JSON object containing the correct answer(s)';
comment on column public.question_bank.explanation is 'Explanation for the correct answer';
comment on column public.question_bank.images is 'JSON array of Supabase Storage paths for question images';
comment on column public.question_bank.scope_type is 'Scope: personal or organization';
comment on column public.question_bank.owner_teacher_id is 'FK to platform_users - owner for personal scope';
comment on column public.question_bank.owner_organization_id is 'FK to organizations - owner for organization scope';
comment on column public.question_bank.created_at is 'Creation timestamp';
comment on column public.question_bank.updated_at is 'Last update timestamp';
comment on column public.question_bank.deleted_at is 'Soft delete timestamp';