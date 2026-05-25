-- Junction table linking classes to materials
-- Allows teachers to add materials to their classes for student access

create table public.class_materials (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null,
  material_id uuid not null,
  added_by uuid not null,
  added_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint class_materials_class_id_fkey
    foreign key (class_id)
    references public.classes (id)
    on update cascade
    on delete cascade,
  constraint class_materials_material_id_fkey
    foreign key (material_id)
    references public.materials (id)
    on update cascade
    on delete restrict,
  constraint class_materials_added_by_fkey
    foreign key (added_by)
    references public.platform_users (id)
    on update cascade
    on delete restrict
);

create index class_materials_class_id_idx
  on public.class_materials (class_id);

create index class_materials_material_id_idx
  on public.class_materials (material_id);

create index class_materials_added_by_idx
  on public.class_materials (added_by);

-- One active link per (class_id, material_id)
create unique index class_materials_active_link_idx
  on public.class_materials (class_id, material_id)
  where deleted_at is null;

-- ──────────────────────────────────────────────
-- RLS Policies
-- ──────────────────────────────────────────────

alter table public.class_materials enable row level security;

-- Super admin: full access
create policy class_materials_super_admin_all
  on public.class_materials
  for all
  to authenticated
  using (public.is_super_admin());

-- Teachers: SELECT materials in classes they teach
create policy class_materials_teachers_select
  on public.class_materials
  for select
  to authenticated
  using (
    exists (
      select 1 from public.class_teachers ct
      where ct.class_id = class_materials.class_id
        and ct.platform_user_id = public.current_platform_user_id()
        and ct.status = 'active'
        and ct.deleted_at is null
    )
    or exists (
      -- User is org owner/manager
      select 1 from public.classes c
      join public.organization_memberships om on om.organization_id = c.organization_id
      where c.id = class_materials.class_id
        and om.platform_user_id = public.current_platform_user_id()
        and om.role in ('owner', 'manager')
        and om.status = 'active'
        and om.deleted_at is null
    )
    or public.is_super_admin()
  );

-- Teachers: INSERT materials into classes they teach
create policy class_materials_teachers_insert
  on public.class_materials
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.class_teachers ct
      where ct.class_id = class_materials.class_id
        and ct.platform_user_id = public.current_platform_user_id()
        and ct.status = 'active'
        and ct.deleted_at is null
    )
    or exists (
      -- User is org owner/manager
      select 1 from public.classes c
      join public.organization_memberships om on om.organization_id = c.organization_id
      where c.id = class_materials.class_id
        and om.platform_user_id = public.current_platform_user_id()
        and om.role in ('owner', 'manager')
        and om.status = 'active'
        and om.deleted_at is null
    )
    or public.is_super_admin()
  );

-- Teachers: DELETE materials from classes they teach
create policy class_materials_teachers_delete
  on public.class_materials
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.class_teachers ct
      where ct.class_id = class_materials.class_id
        and ct.platform_user_id = public.current_platform_user_id()
        and ct.status = 'active'
        and ct.deleted_at is null
    )
    or exists (
      -- User is org owner/manager
      select 1 from public.classes c
      join public.organization_memberships om on om.organization_id = c.organization_id
      where c.id = class_materials.class_id
        and om.platform_user_id = public.current_platform_user_id()
        and om.role in ('owner', 'manager')
        and om.status = 'active'
        and om.deleted_at is null
    )
    or public.is_super_admin()
  );

-- Students: SELECT materials in classes they are enrolled in
create policy class_materials_students_select
  on public.class_materials
  for select
  to authenticated
  using (
    exists (
      select 1 from public.class_enrollments ce
      where ce.class_id = class_materials.class_id
        and ce.student_profile_id = public.current_student_profile_id()
        and ce.status = 'active'
        and ce.deleted_at is null
    )
    or public.is_super_admin()
  );
