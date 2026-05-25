create type public.platform_user_role_enum as enum (
  'super_admin',
  'teacher'
);

create type public.platform_user_status_enum as enum (
  'active',
  'suspended',
  'archived'
);

create type public.organization_status_enum as enum (
  'pending',
  'active',
  'suspended',
  'archived'
);

create type public.organization_membership_role_enum as enum (
  'owner',
  'manager',
  'teacher'
);

create type public.organization_membership_status_enum as enum (
  'pending',
  'active',
  'revoked',
  'archived'
);

create type public.student_status_enum as enum (
  'active',
  'blocked',
  'archived'
);

create type public.student_credential_status_enum as enum (
  'active',
  'locked',
  'reset_required',
  'archived'
);

create type public.class_status_enum as enum (
  'draft',
  'active',
  'archived'
);

create type public.class_teacher_role_enum as enum (
  'owner',
  'assistant'
);

create type public.join_code_status_enum as enum (
  'active',
  'inactive',
  'expired',
  'revoked'
);

create type public.enrollment_status_enum as enum (
  'active',
  'inactive',
  'left',
  'archived'
);

create type public.enrollment_source_enum as enum (
  'manual',
  'bulk_import',
  'self_join'
);

create type public.library_scope_enum as enum (
  'personal',
  'organization'
);

create type public.material_status_enum as enum (
  'draft',
  'active',
  'archived'
);

create type public.test_status_enum as enum (
  'draft',
  'active',
  'archived'
);

create type public.approval_decision_enum as enum (
  'pending',
  'approved',
  'rejected'
);

create type public.assignment_template_status_enum as enum (
  'draft',
  'active',
  'archived'
);

create type public.assignment_publication_status_enum as enum (
  'draft',
  'published',
  'closed',
  'archived'
);

create type public.assignment_result_status_enum as enum (
  'not_started',
  'in_progress',
  'submitted',
  'reviewed',
  'released',
  'archived'
);

create type public.submission_file_role_enum as enum (
  'main',
  'attachment',
  'reference',
  'source'
);

create type public.submission_file_kind_enum as enum (
  'image',
  'pdf',
  'dwg',
  'other'
);

create type public.derived_asset_kind_enum as enum (
  'compressed_preview',
  'thumbnail',
  'pdf_page_preview'
);

create type public.review_status_enum as enum (
  'draft',
  'released',
  'archived'
);

create type public.review_comment_author_type_enum as enum (
  'teacher',
  'student'
);

create type public.grade_record_status_enum as enum (
  'current',
  'superseded',
  'archived'
);

create type public.notification_recipient_type_enum as enum (
  'platform_user',
  'student_profile'
);
