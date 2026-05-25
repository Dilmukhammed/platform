-- Canonical runtime QA fixtures for the public schema.
-- These rows mirror the deterministic IDs used by repaired API routes.

insert into auth.users (
  id,
  email,
  aud,
  role,
  created_at,
  updated_at,
  email_confirmed_at,
  is_sso_user,
  is_anonymous
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'admin@platform.local',
    'authenticated',
    'authenticated',
    '2026-01-10T09:00:00Z',
    '2026-01-10T09:00:00Z',
    '2026-01-10T09:00:00Z',
    false,
    false
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'teacher@platform.local',
    'authenticated',
    'authenticated',
    '2026-01-10T09:05:00Z',
    '2026-01-10T09:05:00Z',
    '2026-01-10T09:05:00Z',
    false,
    false
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'teacher2@platform.local',
    'authenticated',
    'authenticated',
    '2026-01-10T09:10:00Z',
    '2026-01-10T09:10:00Z',
    '2026-01-10T09:10:00Z',
    false,
    false
  )
on conflict (id) do update
set
  email = excluded.email,
  aud = excluded.aud,
  role = excluded.role,
  updated_at = excluded.updated_at,
  email_confirmed_at = excluded.email_confirmed_at,
  is_sso_user = excluded.is_sso_user,
  is_anonymous = excluded.is_anonymous;

insert into public.platform_users (
  id,
  auth_user_id,
  role,
  status,
  display_name,
  created_at,
  updated_at,
  deleted_at
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'super_admin',
    'active',
    'Platform Admin',
    '2026-01-10T09:00:00Z',
    '2026-01-10T09:00:00Z',
    null
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    'teacher',
    'active',
    'Demo Teacher',
    '2026-01-10T09:05:00Z',
    '2026-01-10T09:05:00Z',
    null
  ),
  (
    '27a9365d-e4fc-4477-acc4-faeba45576ad',
    '10000000-0000-4000-8000-000000000003',
    'teacher',
    'active',
    'Second Teacher',
    '2026-01-10T09:10:00Z',
    '2026-01-10T09:10:00Z',
    null
  )
on conflict (id) do update
set
  auth_user_id = excluded.auth_user_id,
  role = excluded.role,
  status = excluded.status,
  display_name = excluded.display_name,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;

insert into public.organizations (
  id,
  name,
  slug,
  status,
  created_by_platform_user_id,
  approved_by_platform_user_id,
  approved_at,
  created_at,
  updated_at,
  deleted_at
)
values (
  '30000000-0000-4000-8000-000000000001',
  'Demo School of Technical Drawing',
  'demo-school',
  'active',
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '2026-01-10T09:00:00Z',
  '2026-01-10T09:00:00Z',
  '2026-01-10T09:00:00Z',
  null
)
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug,
  status = excluded.status,
  created_by_platform_user_id = excluded.created_by_platform_user_id,
  approved_by_platform_user_id = excluded.approved_by_platform_user_id,
  approved_at = excluded.approved_at,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;

insert into public.organizations (
  id,
  name,
  slug,
  status,
  created_by_platform_user_id,
  approved_by_platform_user_id,
  approved_at,
  created_at,
  updated_at,
  deleted_at
)
values (
  '30000000-0000-4000-8000-000000000002',
  'Dilmuxammed School',
  'dilmuxammed-school',
  'active',
  '27a9365d-e4fc-4477-acc4-faeba45576ad',
  '20000000-0000-4000-8000-000000000001',
  '2026-01-10T09:10:00Z',
  '2026-01-10T09:10:00Z',
  '2026-01-10T09:10:00Z',
  null
)
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug,
  status = excluded.status,
  created_by_platform_user_id = excluded.created_by_platform_user_id,
  approved_by_platform_user_id = excluded.approved_by_platform_user_id,
  approved_at = excluded.approved_at,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;

insert into public.organization_memberships (
  id,
  organization_id,
  platform_user_id,
  role,
  status,
  joined_at,
  created_at,
  updated_at,
  deleted_at
)
values
  (
    '40000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'owner',
    'active',
    '2026-01-10T09:00:00Z',
    '2026-01-10T09:00:00Z',
    '2026-01-10T09:00:00Z',
    null
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    'teacher',
    'active',
    '2026-01-10T09:05:00Z',
    '2026-01-10T09:05:00Z',
    '2026-01-10T09:05:00Z',
    null
  ),
  (
    '40000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000002',
    '27a9365d-e4fc-4477-acc4-faeba45576ad',
    'owner',
    'active',
    '2026-01-10T09:10:00Z',
    '2026-01-10T09:10:00Z',
    '2026-01-10T09:10:00Z',
    null
  )
on conflict (id) do update
set
  organization_id = excluded.organization_id,
  platform_user_id = excluded.platform_user_id,
  role = excluded.role,
  status = excluded.status,
  joined_at = excluded.joined_at,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;

insert into public.student_profiles (
  id,
  student_login,
  first_name,
  last_name,
  middle_name,
  display_name,
  status,
  created_at,
  updated_at,
  deleted_at
)
values
  (
    '50000000-0000-4000-8000-000000000001',
    'ST-100001',
    'Alex',
    'Morozov',
    null,
    'Alex Morozov',
    'active',
    '2026-01-10T09:10:00Z',
    '2026-01-10T09:10:00Z',
    null
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    'ST-100002',
    'Mira',
    'Volkova',
    null,
    'Mira Volkova',
    'active',
    '2026-01-10T09:11:00Z',
    '2026-01-10T09:11:00Z',
    null
  )
on conflict (id) do update
set
  student_login = excluded.student_login,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  middle_name = excluded.middle_name,
  display_name = excluded.display_name,
  status = excluded.status,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;

insert into public.student_credentials (
  id,
  student_profile_id,
  pin_hash,
  status,
  last_pin_changed_at,
  reset_required_at,
  locked_at,
  failed_attempts_count,
  created_at,
  updated_at,
  deleted_at
)
values
  (
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    md5('1111'),
    'active',
    '2026-01-10T09:10:00Z',
    null,
    null,
    0,
    '2026-01-10T09:10:00Z',
    '2026-01-10T09:10:00Z',
    null
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000002',
    md5('2222'),
    'active',
    '2026-01-10T09:11:00Z',
    null,
    null,
    0,
    '2026-01-10T09:11:00Z',
    '2026-01-10T09:11:00Z',
    null
  )
on conflict (id) do update
set
  student_profile_id = excluded.student_profile_id,
  pin_hash = excluded.pin_hash,
  status = excluded.status,
  last_pin_changed_at = excluded.last_pin_changed_at,
  reset_required_at = excluded.reset_required_at,
  locked_at = excluded.locked_at,
  failed_attempts_count = excluded.failed_attempts_count,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;

insert into public.organization_students (
  id,
  organization_id,
  student_profile_id,
  status,
  joined_at,
  created_at,
  updated_at,
  deleted_at
)
values
  (
    '70000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    'active',
    '2026-01-10T09:15:00Z',
    '2026-01-10T09:15:00Z',
    '2026-01-10T09:15:00Z',
    null
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000002',
    'active',
    '2026-01-10T09:16:00Z',
    '2026-01-10T09:16:00Z',
    '2026-01-10T09:16:00Z',
    null
  )
on conflict (id) do update
set
  organization_id = excluded.organization_id,
  student_profile_id = excluded.student_profile_id,
  status = excluded.status,
  joined_at = excluded.joined_at,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;

insert into public.classes (
  id,
  organization_id,
  title,
  description,
  status,
  created_at,
  updated_at,
  deleted_at
)
values
  (
    '80000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'Engineering Graphics 8A',
    'Primary seeded class for fixture QA.',
    'active',
    '2026-01-10T09:20:00Z',
    '2026-01-10T09:20:00Z',
    null
  ),
  (
    '80000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000001',
    'Engineering Graphics 8B',
    'Secondary seeded class for multi-class student dashboard QA.',
    'active',
    '2026-01-10T09:20:00Z',
    '2026-01-10T09:20:00Z',
    null
  )
on conflict (id) do update
set
  organization_id = excluded.organization_id,
  title = excluded.title,
  description = excluded.description,
  status = excluded.status,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;

insert into public.class_teachers (
  id,
  class_id,
  platform_user_id,
  role,
  is_primary,
  status,
  created_at,
  updated_at,
  deleted_at
)
values
  (
    '80500000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    'owner',
    true,
    'active',
    '2026-01-10T09:20:00Z',
    '2026-01-10T09:20:00Z',
    null
  ),
  (
    '80500000-0000-4000-8000-000000000002',
    '80000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'owner',
    true,
    'active',
    '2026-01-10T09:20:00Z',
    '2026-01-10T09:20:00Z',
    null
  )
on conflict (id) do update
set
  class_id = excluded.class_id,
  platform_user_id = excluded.platform_user_id,
  role = excluded.role,
  is_primary = excluded.is_primary,
  status = excluded.status,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;

insert into public.class_join_codes (
  id,
  class_id,
  code,
  status,
  valid_from,
  valid_until,
  replaced_by_join_code_id,
  rotated_by_platform_user_id,
  rotated_at,
  created_at,
  updated_at,
  deleted_at
)
values
  (
    '81000000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000001',
    '120801',
    'active',
    '2026-01-10T09:20:00Z',
    null,
    null,
    null,
    null,
    '2026-01-10T09:20:00Z',
    '2026-01-10T09:20:00Z',
    null
  ),
  (
    '81000000-0000-4000-8000-000000000002',
    '80000000-0000-4000-8000-000000000002',
    '120802',
    'active',
    '2026-01-10T09:20:00Z',
    null,
    null,
    null,
    null,
    '2026-01-10T09:20:00Z',
    '2026-01-10T09:20:00Z',
    null
  )
on conflict (id) do update
set
  class_id = excluded.class_id,
  code = excluded.code,
  status = excluded.status,
  valid_from = excluded.valid_from,
  valid_until = excluded.valid_until,
  replaced_by_join_code_id = excluded.replaced_by_join_code_id,
  rotated_by_platform_user_id = excluded.rotated_by_platform_user_id,
  rotated_at = excluded.rotated_at,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;

insert into public.class_enrollments (
  id,
  organization_id,
  class_id,
  student_profile_id,
  organization_student_id,
  status,
  source,
  joined_at,
  left_at,
  created_at,
  updated_at,
  deleted_at
)
values
  (
    '82000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    'active',
    'bulk_import',
    '2026-01-10T09:25:00Z',
    null,
    '2026-01-10T09:25:00Z',
    '2026-01-10T09:25:00Z',
    null
  ),
  (
    '82000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    'active',
    'self_join',
    '2026-01-10T09:30:00Z',
    null,
    '2026-01-10T09:30:00Z',
    '2026-01-10T09:30:00Z',
    null
  ),
  (
    '82000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000002',
    '70000000-0000-4000-8000-000000000002',
    'active',
    'bulk_import',
    '2026-01-10T09:31:00Z',
    null,
    '2026-01-10T09:31:00Z',
    '2026-01-10T09:31:00Z',
    null
  )
on conflict (id) do update
set
  organization_id = excluded.organization_id,
  class_id = excluded.class_id,
  student_profile_id = excluded.student_profile_id,
  organization_student_id = excluded.organization_student_id,
  status = excluded.status,
  source = excluded.source,
  joined_at = excluded.joined_at,
  left_at = excluded.left_at,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;

insert into public.assignment_templates (
  id,
  teacher_id,
  title,
  description,
  has_practice,
  has_test,
  linked_test_id,
  grading_scheme_override_id,
  status,
  created_at,
  updated_at,
  deleted_at
)
values (
  '90000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  'Orthographic Projection Basics',
  'Deterministic fixture assignment published to both seeded classes.',
  true,
  true,
  null,
  null,
  'active',
  '2026-01-15T09:55:00Z',
  '2026-01-15T09:55:00Z',
  null
)
on conflict (id) do update
set
  teacher_id = excluded.teacher_id,
  title = excluded.title,
  description = excluded.description,
  has_practice = excluded.has_practice,
  has_test = excluded.has_test,
  linked_test_id = excluded.linked_test_id,
  grading_scheme_override_id = excluded.grading_scheme_override_id,
  status = excluded.status,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;

insert into public.assignment_publications (
  id,
  assignment_template_id,
  published_by_teacher_id,
  default_deadline,
  status,
  published_at,
  created_at,
  updated_at,
  deleted_at
)
values (
  '91000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '2026-02-01T18:00:00Z',
  'published',
  '2026-01-15T10:00:00Z',
  '2026-01-15T10:00:00Z',
  '2026-01-15T10:00:00Z',
  null
)
on conflict (id) do update
set
  assignment_template_id = excluded.assignment_template_id,
  published_by_teacher_id = excluded.published_by_teacher_id,
  default_deadline = excluded.default_deadline,
  status = excluded.status,
  published_at = excluded.published_at,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;

insert into public.assignment_publication_classes (
  id,
  assignment_publication_id,
  class_id,
  deadline_override,
  status,
  created_at,
  updated_at,
  deleted_at
)
values
  (
    '92000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000001',
    '2027-02-01T18:00:00Z',
    'published',
    '2026-01-15T10:00:00Z',
    '2026-01-15T10:00:00Z',
    null
  ),
  (
    '92000000-0000-4000-8000-000000000002',
    '91000000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000002',
    '2027-02-15T18:00:00Z',
    'published',
    '2026-01-15T10:00:00Z',
    '2026-01-15T10:00:00Z',
    null
  )
on conflict (id) do update
set
  assignment_publication_id = excluded.assignment_publication_id,
  class_id = excluded.class_id,
  deadline_override = excluded.deadline_override,
  status = excluded.status,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;

insert into public.assignment_results (
  id,
  assignment_publication_class_id,
  class_enrollment_id,
  status,
  practice_started_at,
  practice_submitted_at,
  test_started_at,
  test_submitted_at,
  released_at,
  created_at,
  updated_at,
  deleted_at
)
values
  (
    '95000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001',
    'released',
    '2026-01-16T08:00:00Z',
    '2026-01-16T08:12:00Z',
    '2026-01-16T08:14:00Z',
    '2026-01-16T08:20:00Z',
    '2026-01-16T09:00:00Z',
    '2026-01-15T10:05:00Z',
    '2026-01-16T09:00:00Z',
    null
  ),
  (
    '95000000-0000-4000-8000-000000000002',
    '92000000-0000-4000-8000-000000000002',
    '82000000-0000-4000-8000-000000000002',
    'in_progress',
    '2026-01-16T08:30:00Z',
    null,
    null,
    null,
    null,
    '2026-01-15T10:06:00Z',
    '2026-01-16T08:30:00Z',
    null
  ),
  (
    '95000000-0000-4000-8000-000000000003',
    '92000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000003',
    'submitted',
    '2026-01-16T08:25:00Z',
    '2026-01-16T08:40:00Z',
    null,
    null,
    null,
    '2026-01-15T10:07:00Z',
    '2026-01-16T08:40:00Z',
    null
  )
on conflict (id) do update
set
  assignment_publication_class_id = excluded.assignment_publication_class_id,
  class_enrollment_id = excluded.class_enrollment_id,
  status = excluded.status,
  practice_started_at = excluded.practice_started_at,
  practice_submitted_at = excluded.practice_submitted_at,
  test_started_at = excluded.test_started_at,
  test_submitted_at = excluded.test_submitted_at,
  released_at = excluded.released_at,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;

insert into public.submission_files (
  id,
  assignment_result_id,
  file_role,
  file_kind,
  original_storage_path,
  original_filename,
  mime_type,
  file_size_bytes,
  sort_order,
  is_current,
  created_at,
  updated_at,
  deleted_at
)
values
  (
    '96000000-0000-4000-8000-000000000001',
    '95000000-0000-4000-8000-000000000001',
    'main',
    'pdf',
    'submissions/50000000-0000-4000-8000-000000000001/95000000-0000-4000-8000-000000000001/seeded-orthographic-projection.pdf',
    'orthographic-projection.pdf',
    'application/pdf',
    245760,
    0,
    true,
    '2026-01-16T08:05:00Z',
    '2026-01-16T09:00:00Z',
    null
  ),
  (
    '96000000-0000-4000-8000-000000000002',
    '95000000-0000-4000-8000-000000000003',
    'main',
    'pdf',
    'submissions/50000000-0000-4000-8000-000000000002/95000000-0000-4000-8000-000000000003/seeded-review-queue.pdf',
    'review-queue.pdf',
    'application/pdf',
    198640,
    0,
    true,
    '2026-01-16T08:38:00Z',
    '2026-01-16T08:40:00Z',
    null
  )
on conflict (id) do update
set
  assignment_result_id = excluded.assignment_result_id,
  file_role = excluded.file_role,
  file_kind = excluded.file_kind,
  original_storage_path = excluded.original_storage_path,
  original_filename = excluded.original_filename,
  mime_type = excluded.mime_type,
  file_size_bytes = excluded.file_size_bytes,
  sort_order = excluded.sort_order,
  is_current = excluded.is_current,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;

insert into public.derived_assets (
  id,
  submission_file_id,
  kind,
  storage_path,
  page_index,
  width,
  height,
  metadata_json,
  is_current,
  created_at,
  updated_at,
  deleted_at
)
values
  (
    '97000000-0000-4000-8000-000000000001',
    '96000000-0000-4000-8000-000000000001',
    'pdf_page_preview',
    'derived/95000000-0000-4000-8000-000000000001/96000000-0000-4000-8000-000000000001/page-1-preview.png',
    0,
    1600,
    1200,
    '{"source":"seed.public.sql","page":1}'::jsonb,
    true,
    '2026-01-16T08:06:00Z',
    '2026-01-16T09:00:00Z',
    null
  ),
  (
    '97000000-0000-4000-8000-000000000002',
    '96000000-0000-4000-8000-000000000002',
    'pdf_page_preview',
    'derived/95000000-0000-4000-8000-000000000003/96000000-0000-4000-8000-000000000002/page-1-preview.png',
    0,
    1600,
    1200,
    '{"source":"seed.public.sql","page":1,"qaState":"submitted-review-queue"}'::jsonb,
    true,
    '2026-01-16T08:39:00Z',
    '2026-01-16T08:40:00Z',
    null
  )
on conflict (id) do update
set
  submission_file_id = excluded.submission_file_id,
  kind = excluded.kind,
  storage_path = excluded.storage_path,
  page_index = excluded.page_index,
  width = excluded.width,
  height = excluded.height,
  metadata_json = excluded.metadata_json,
  is_current = excluded.is_current,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;

insert into public.submission_reviews (
  id,
  assignment_result_id,
  reviewed_by_teacher_id,
  status,
  released_at,
  created_at,
  updated_at,
  deleted_at
)
values (
  '98000000-0000-4000-8000-000000000001',
  '95000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  'released',
  '2026-01-16T09:00:00Z',
  '2026-01-16T08:07:00Z',
  '2026-01-16T09:00:00Z',
  null
)
on conflict (id) do update
set
  assignment_result_id = excluded.assignment_result_id,
  reviewed_by_teacher_id = excluded.reviewed_by_teacher_id,
  status = excluded.status,
  released_at = excluded.released_at,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;

insert into public.notifications (
  id,
  recipient_type,
  recipient_platform_user_id,
  recipient_student_profile_id,
  type,
  payload_json,
  read_at,
  created_at
)
values (
  '99000000-0000-4000-8000-000000000001',
  'platform_user',
  '20000000-0000-4000-8000-000000000002',
  null,
  'assignment_review_ready',
  '{"assignmentResultId":"95000000-0000-4000-8000-000000000001","message":"Seeded teacher notification for QA read coverage."}'::jsonb,
  null,
  '2026-01-16T08:10:00Z'
)
on conflict (id) do update
set
  recipient_type = excluded.recipient_type,
  recipient_platform_user_id = excluded.recipient_platform_user_id,
  recipient_student_profile_id = excluded.recipient_student_profile_id,
  type = excluded.type,
  payload_json = excluded.payload_json,
  read_at = excluded.read_at,
  created_at = excluded.created_at;

insert into public.organization_invites (
  id,
  organization_id,
  token,
  email,
  role,
  status,
  invited_by_platform_user_id,
  expires_at,
  created_at,
  updated_at,
  deleted_at
)
values (
  '99500000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  'seed-invite-demo-school-teacher-001',
  'pending.teacher.invite@platform.local',
  'teacher',
  'pending',
  '20000000-0000-4000-8000-000000000001',
  '2027-02-15T12:00:00Z',
  '2026-01-16T08:15:00Z',
  '2026-01-16T08:15:00Z',
  null
)
on conflict (id) do update
set
  organization_id = excluded.organization_id,
  token = excluded.token,
  email = excluded.email,
  role = excluded.role,
  status = excluded.status,
  invited_by_platform_user_id = excluded.invited_by_platform_user_id,
  expires_at = excluded.expires_at,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;
