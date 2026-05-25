create table public.grading_schemes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  is_default boolean not null default false,
  formula_type text not null,
  formula_config_json jsonb not null default '{}'::jsonb,
  display_scale_type text not null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint grading_schemes_organization_id_fkey
    foreign key (organization_id)
    references public.organizations (id)
    on update cascade
    on delete restrict,
  constraint grading_schemes_name_check
    check (btrim(name) <> ''),
  constraint grading_schemes_formula_type_check
    check (btrim(formula_type) <> ''),
  constraint grading_schemes_display_scale_type_check
    check (btrim(display_scale_type) <> ''),
  constraint grading_schemes_status_check
    check (status in ('draft', 'active', 'archived'))
);

create index grading_schemes_organization_id_idx
  on public.grading_schemes (organization_id);

create unique index grading_schemes_active_org_name_idx
  on public.grading_schemes (organization_id, name)
  where deleted_at is null
    and status in ('draft', 'active');

create unique index grading_schemes_active_default_idx
  on public.grading_schemes (organization_id)
  where deleted_at is null
    and is_default
    and status in ('draft', 'active');
