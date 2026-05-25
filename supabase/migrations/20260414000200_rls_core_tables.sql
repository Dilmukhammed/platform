-- RLS Policies for Core Tables
-- Enables tenant isolation: teachers see only their org's data, students see only enrolled data
-- super_admin bypasses RLS for platform administration

-- ──────────────────────────────────────────────
-- Helper function: Get current platform_user_id from auth session
-- ──────────────────────────────────────────────
create or replace function public.current_platform_user_id()
returns uuid
language sql
stable
security definer
as $$
  select id from public.platform_users
  where auth_user_id = auth.uid()
  limit 1;
$$;

-- ──────────────────────────────────────────────
-- Helper function: Check if current user is super_admin
-- ──────────────────────────────────────────────
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.platform_users
    where auth_user_id = auth.uid()
      and role = 'super_admin'
      and status = 'active'
      and deleted_at is null
  );
$$;

-- ──────────────────────────────────────────────
-- Helper function: Get current user's student_profile_id
-- ──────────────────────────────────────────────
create or replace function public.current_student_profile_id()
returns uuid
language sql
stable
security definer
as $$
  -- This assumes a mapping between auth.users and student_profiles
  -- Students log in via a different mechanism (login + PIN)
  -- For RLS purposes, we check if the current session has a student context
  -- This is handled via JWT claims or session variables set during student login
  select null::uuid; -- Placeholder - student access is handled differently
$$;

-- ──────────────────────────────────────────────
-- ORGANIZATIONS
-- ──────────────────────────────────────────────

alter table public.organizations enable row level security;

-- Super admin: full access (bypass via USING clause)
create policy organizations_super_admin_all
  on public.organizations
  for all
  to authenticated
  using (public.is_super_admin());

-- Teachers: see organizations they are members of
-- Note: CREATE requires separate policy since USING doesn't apply to INSERT
create policy organizations_teachers_select
  on public.organizations
  for select
  to authenticated
  using (
    exists (
      select 1 from public.organization_memberships om
      where om.organization_id = organizations.id
        and om.platform_user_id = public.current_platform_user_id()
        and om.status = 'active'
        and om.deleted_at is null
    )
    or public.is_super_admin()
  );

create policy organizations_teachers_insert
  on public.organizations
  for insert
  to authenticated
  with check (
    -- Allow creating organizations (creator will be added as owner via trigger)
    created_by_platform_user_id = public.current_platform_user_id()
    or public.is_super_admin()
  );

create policy organizations_teachers_update
  on public.organizations
  for update
  to authenticated
  using (
    exists (
      select 1 from public.organization_memberships om
      where om.organization_id = organizations.id
        and om.platform_user_id = public.current_platform_user_id()
        and om.role in ('owner', 'manager')
        and om.status = 'active'
        and om.deleted_at is null
    )
    or public.is_super_admin()
  );

create policy organizations_teachers_delete
  on public.organizations
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.organization_memberships om
      where om.organization_id = organizations.id
        and om.platform_user_id = public.current_platform_user_id()
        and om.role = 'owner'
        and om.status = 'active'
        and om.deleted_at is null
    )
    or public.is_super_admin()
  );

-- ──────────────────────────────────────────────
-- CLASSES
-- ──────────────────────────────────────────────

alter table public.classes enable row level security;

-- Super admin: full access
create policy classes_super_admin_all
  on public.classes
  for all
  to authenticated
  using (public.is_super_admin());

-- Teachers: see classes in their organizations or where they are class teachers
create policy classes_teachers_select
  on public.classes
  for select
  to authenticated
  using (
    exists (
      -- User is a member of the organization
      select 1 from public.organization_memberships om
      where om.organization_id = classes.organization_id
        and om.platform_user_id = public.current_platform_user_id()
        and om.status = 'active'
        and om.deleted_at is null
    )
    or public.is_super_admin()
  );

create policy classes_teachers_insert
  on public.classes
  for insert
  to authenticated
  with check (
    exists (
      -- User is owner or manager of the organization
      select 1 from public.organization_memberships om
      where om.organization_id = classes.organization_id
        and om.platform_user_id = public.current_platform_user_id()
        and om.role in ('owner', 'manager')
        and om.status = 'active'
        and om.deleted_at is null
    )
    or public.is_super_admin()
  );

create policy classes_teachers_update
  on public.classes
  for update
  to authenticated
  using (
    exists (
      -- User is owner/manager of the org OR owner of the class
      select 1 from public.organization_memberships om
      where om.organization_id = classes.organization_id
        and om.platform_user_id = public.current_platform_user_id()
        and om.role in ('owner', 'manager')
        and om.status = 'active'
        and om.deleted_at is null
    )
    or exists (
      -- User is primary owner of this specific class
      select 1 from public.class_teachers ct
      where ct.class_id = classes.id
        and ct.platform_user_id = public.current_platform_user_id()
        and ct.role = 'owner'
        and ct.is_primary = true
        and ct.status = 'active'
        and ct.deleted_at is null
    )
    or public.is_super_admin()
  );

create policy classes_teachers_delete
  on public.classes
  for delete
  to authenticated
  using (
    exists (
      -- User is owner of the organization
      select 1 from public.organization_memberships om
      where om.organization_id = classes.organization_id
        and om.platform_user_id = public.current_platform_user_id()
        and om.role = 'owner'
        and om.status = 'active'
        and om.deleted_at is null
    )
    or exists (
      -- User is primary owner of this specific class
      select 1 from public.class_teachers ct
      where ct.class_id = classes.id
        and ct.platform_user_id = public.current_platform_user_id()
        and ct.role = 'owner'
        and ct.is_primary = true
        and ct.status = 'active'
        and ct.deleted_at is null
    )
    or public.is_super_admin()
  );

-- ──────────────────────────────────────────────
-- STUDENT_PROFILES
-- ──────────────────────────────────────────────

alter table public.student_profiles enable row level security;

-- Super admin: full access
create policy student_profiles_super_admin_all
  on public.student_profiles
  for all
  to authenticated
  using (public.is_super_admin());

-- Teachers: see student profiles in their organizations
create policy student_profiles_teachers_select
  on public.student_profiles
  for select
  to authenticated
  using (
    exists (
      select 1 from public.organization_students os
      where os.student_profile_id = student_profiles.id
        and os.status in ('active', 'blocked')
        and os.deleted_at is null
        and exists (
          select 1 from public.organization_memberships om
          where om.organization_id = os.organization_id
            and om.platform_user_id = public.current_platform_user_id()
            and om.status = 'active'
            and om.deleted_at is null
        )
    )
    or public.is_super_admin()
  );

-- Students can only see their own profile (handled via student login, not JWT)
-- For now, no direct student access via authenticated role

-- ──────────────────────────────────────────────
-- ASSIGNMENT_RESULTS
-- ──────────────────────────────────────────────

alter table public.assignment_results enable row level security;

-- Super admin: full access
create policy assignment_results_super_admin_all
  on public.assignment_results
  for all
  to authenticated
  using (public.is_super_admin());

-- Teachers: see results for students in their classes
create policy assignment_results_teachers_select
  on public.assignment_results
  for select
  to authenticated
  using (
    exists (
      -- Teacher has access to the class via class_teachers
      select 1 from public.class_enrollments ce
      where ce.id = assignment_results.class_enrollment_id
        and ce.deleted_at is null
        and exists (
          select 1 from public.class_teachers ct
          where ct.class_id = ce.class_id
            and ct.platform_user_id = public.current_platform_user_id()
            and ct.status = 'active'
            and ct.deleted_at is null
        )
    )
    or exists (
      -- Teacher is org owner/manager (can see all org results)
      select 1 from public.class_enrollments ce
      join public.classes c on c.id = ce.class_id
      where ce.id = assignment_results.class_enrollment_id
        and ce.deleted_at is null
        and exists (
          select 1 from public.organization_memberships om
          where om.organization_id = c.organization_id
            and om.platform_user_id = public.current_platform_user_id()
            and om.role in ('owner', 'manager')
            and om.status = 'active'
            and om.deleted_at is null
        )
    )
    or public.is_super_admin()
  );

create policy assignment_results_teachers_update
  on public.assignment_results
  for update
  to authenticated
  using (
    exists (
      -- Teacher has access to the class via class_teachers
      select 1 from public.class_enrollments ce
      where ce.id = assignment_results.class_enrollment_id
        and ce.deleted_at is null
        and exists (
          select 1 from public.class_teachers ct
          where ct.class_id = ce.class_id
            and ct.platform_user_id = public.current_platform_user_id()
            and ct.status = 'active'
            and ct.deleted_at is null
        )
    )
    or public.is_super_admin()
  );

-- Students: see only their own results (via enrollment)
-- Note: This requires the student to be authenticated via a special mechanism
-- For now, we create a policy that can be extended when student auth is implemented
create policy assignment_results_students_select
  on public.assignment_results
  for select
  to authenticated
  using (
    exists (
      -- Result belongs to the student's enrollment
      select 1 from public.class_enrollments ce
      join public.organization_students os on os.id = ce.organization_student_id
      where ce.id = assignment_results.class_enrollment_id
        and os.student_profile_id = public.current_student_profile_id()
        and ce.status = 'active'
        and ce.deleted_at is null
    )
    or public.is_super_admin()
  );

-- ──────────────────────────────────────────────
-- Related tables (for completeness)
-- ──────────────────────────────────────────────

-- ORGANIZATION_MEMBERSHIPS: Teachers see memberships in their orgs
alter table public.organization_memberships enable row level security;

create policy organization_memberships_super_admin_all
  on public.organization_memberships
  for all
  to authenticated
  using (public.is_super_admin());

create policy organization_memberships_teachers_select
  on public.organization_memberships
  for select
  to authenticated
  using (
    exists (
      select 1 from public.organization_memberships om
      where om.organization_id = organization_memberships.organization_id
        and om.platform_user_id = public.current_platform_user_id()
        and om.status = 'active'
        and om.deleted_at is null
    )
    or public.is_super_admin()
  );

-- CLASS_TEACHERS: Teachers see teacher assignments in their classes
alter table public.class_teachers enable row level security;

create policy class_teachers_super_admin_all
  on public.class_teachers
  for all
  to authenticated
  using (public.is_super_admin());

create policy class_teachers_teachers_select
  on public.class_teachers
  for select
  to authenticated
  using (
    exists (
      -- User is a teacher in the same class
      select 1 from public.class_teachers ct
      where ct.class_id = class_teachers.class_id
        and ct.platform_user_id = public.current_platform_user_id()
        and ct.status = 'active'
        and ct.deleted_at is null
    )
    or exists (
      -- User is org owner/manager
      select 1 from public.classes c
      join public.organization_memberships om on om.organization_id = c.organization_id
      where c.id = class_teachers.class_id
        and om.platform_user_id = public.current_platform_user_id()
        and om.role in ('owner', 'manager')
        and om.status = 'active'
        and om.deleted_at is null
    )
    or public.is_super_admin()
  );

-- CLASS_ENROLLMENTS: Teachers see enrollments in their classes
alter table public.class_enrollments enable row level security;

create policy class_enrollments_super_admin_all
  on public.class_enrollments
  for all
  to authenticated
  using (public.is_super_admin());

create policy class_enrollments_teachers_select
  on public.class_enrollments
  for select
  to authenticated
  using (
    exists (
      -- User is a teacher in the class
      select 1 from public.class_teachers ct
      where ct.class_id = class_enrollments.class_id
        and ct.platform_user_id = public.current_platform_user_id()
        and ct.status = 'active'
        and ct.deleted_at is null
    )
    or exists (
      -- User is org owner/manager
      select 1 from public.organization_memberships om
      where om.organization_id = class_enrollments.organization_id
        and om.platform_user_id = public.current_platform_user_id()
        and om.role in ('owner', 'manager')
        and om.status = 'active'
        and om.deleted_at is null
    )
    or public.is_super_admin()
  );

-- ORGANIZATION_STUDENTS: Teachers see students in their orgs
alter table public.organization_students enable row level security;

create policy organization_students_super_admin_all
  on public.organization_students
  for all
  to authenticated
  using (public.is_super_admin());

create policy organization_students_teachers_select
  on public.organization_students
  for select
  to authenticated
  using (
    exists (
      select 1 from public.organization_memberships om
      where om.organization_id = organization_students.organization_id
        and om.platform_user_id = public.current_platform_user_id()
        and om.status = 'active'
        and om.deleted_at is null
    )
    or public.is_super_admin()
  );

-- ──────────────────────────────────────────────
-- Comments for documentation
-- ──────────────────────────────────────────────
comment on function public.current_platform_user_id() is 
  'Returns the platform_user_id for the currently authenticated user';

comment on function public.is_super_admin() is 
  'Returns true if the current user has super_admin role';

comment on function public.current_student_profile_id() is 
  'Returns the student_profile_id for the current student session (placeholder)';
