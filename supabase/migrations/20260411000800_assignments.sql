create table public.assignment_templates (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  title text not null,
  description text,
  has_practice boolean not null default false,
  has_test boolean not null default false,
  linked_test_id uuid,
  grading_scheme_override_id uuid,
  status public.assignment_template_status_enum not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint assignment_templates_teacher_id_fkey
    foreign key (teacher_id)
    references public.platform_users (id)
    on update cascade
    on delete restrict,
  constraint assignment_templates_linked_test_id_fkey
    foreign key (linked_test_id)
    references public.tests (id)
    on update cascade
    on delete restrict,
  constraint assignment_templates_grading_scheme_override_id_fkey
    foreign key (grading_scheme_override_id)
    references public.grading_schemes (id)
    on update cascade
    on delete restrict,
  constraint assignment_templates_title_check
    check (btrim(title) <> ''),
  constraint assignment_templates_description_check
    check (description is null or btrim(description) <> '')
);

create index assignment_templates_teacher_id_idx
  on public.assignment_templates (teacher_id);

create index assignment_templates_linked_test_id_idx
  on public.assignment_templates (linked_test_id);

create index assignment_templates_grading_scheme_override_id_idx
  on public.assignment_templates (grading_scheme_override_id);

-- One linked test max per active template in MVP
create unique index assignment_templates_active_linked_test_idx
  on public.assignment_templates (linked_test_id)
  where deleted_at is null
    and linked_test_id is not null
    and status in ('draft', 'active');

create table public.assignment_template_materials (
  id uuid primary key default gen_random_uuid(),
  assignment_template_id uuid not null,
  material_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint assignment_template_materials_assignment_template_id_fkey
    foreign key (assignment_template_id)
    references public.assignment_templates (id)
    on update cascade
    on delete restrict,
  constraint assignment_template_materials_material_id_fkey
    foreign key (material_id)
    references public.materials (id)
    on update cascade
    on delete restrict
);

create index assignment_template_materials_assignment_template_id_idx
  on public.assignment_template_materials (assignment_template_id);

create index assignment_template_materials_material_id_idx
  on public.assignment_template_materials (material_id);

-- One active link per (assignment_template_id, material_id)
create unique index assignment_template_materials_active_link_idx
  on public.assignment_template_materials (assignment_template_id, material_id)
  where deleted_at is null;

create table public.assignment_publications (
  id uuid primary key default gen_random_uuid(),
  assignment_template_id uuid not null,
  published_by_teacher_id uuid not null,
  default_deadline timestamptz,
  status public.assignment_publication_status_enum not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint assignment_publications_assignment_template_id_fkey
    foreign key (assignment_template_id)
    references public.assignment_templates (id)
    on update cascade
    on delete restrict,
  constraint assignment_publications_published_by_teacher_id_fkey
    foreign key (published_by_teacher_id)
    references public.platform_users (id)
    on update cascade
    on delete restrict
);

create index assignment_publications_assignment_template_id_idx
  on public.assignment_publications (assignment_template_id);

create index assignment_publications_published_by_teacher_id_idx
  on public.assignment_publications (published_by_teacher_id);

create table public.assignment_publication_classes (
  id uuid primary key default gen_random_uuid(),
  assignment_publication_id uuid not null,
  class_id uuid not null,
  deadline_override timestamptz,
  status public.assignment_publication_status_enum not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint assignment_publication_classes_assignment_publication_id_fkey
    foreign key (assignment_publication_id)
    references public.assignment_publications (id)
    on update cascade
    on delete restrict,
  constraint assignment_publication_classes_class_id_fkey
    foreign key (class_id)
    references public.classes (id)
    on update cascade
    on delete restrict
);

create index assignment_publication_classes_assignment_publication_id_idx
  on public.assignment_publication_classes (assignment_publication_id);

create index assignment_publication_classes_class_id_idx
  on public.assignment_publication_classes (class_id);

-- One active link per (assignment_publication_id, class_id)
create unique index assignment_publication_classes_active_link_idx
  on public.assignment_publication_classes (assignment_publication_id, class_id)
  where deleted_at is null;
