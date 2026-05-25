-- T0.2 deterministic QA bootstrap fixtures.
-- This seed intentionally avoids direct inserts into Supabase auth.users.
-- Staff/admin credentials are tracked in app.bootstrap_auth_accounts as a local
-- scaffold until the real auth implementation lands in T1.

create schema if not exists app;

create type app.platform_user_role_enum as enum ('super_admin', 'teacher');
create type app.platform_user_status_enum as enum ('active', 'suspended', 'archived');
create type app.organization_status_enum as enum ('pending', 'active', 'suspended', 'archived');
create type app.organization_membership_role_enum as enum ('owner', 'manager', 'teacher');
create type app.organization_membership_status_enum as enum ('pending', 'active', 'revoked', 'archived');
create type app.student_status_enum as enum ('active', 'blocked', 'archived');
create type app.student_credential_status_enum as enum ('active', 'locked', 'reset_required', 'archived');
create type app.class_status_enum as enum ('draft', 'active', 'archived');
create type app.join_code_status_enum as enum ('active', 'inactive', 'expired', 'revoked');
create type app.enrollment_status_enum as enum ('active', 'inactive', 'left', 'archived');
create type app.enrollment_source_enum as enum ('manual', 'bulk_import', 'self_join');
create type app.assignment_template_status_enum as enum ('draft', 'active', 'archived');
create type app.assignment_publication_status_enum as enum ('draft', 'published', 'closed', 'archived');

create table if not exists app.bootstrap_auth_accounts (
  id uuid primary key,
  role app.platform_user_role_enum not null,
  email text not null unique,
  password_plaintext text not null,
  auth_provider text not null default 'supabase-email-planned',
  notes text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.platform_users (
  id uuid primary key,
  bootstrap_auth_account_id uuid references app.bootstrap_auth_accounts(id),
  role app.platform_user_role_enum not null,
  status app.platform_user_status_enum not null default 'active',
  display_name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.organizations (
  id uuid primary key,
  name text not null,
  slug text not null unique,
  status app.organization_status_enum not null,
  created_by_platform_user_id uuid references app.platform_users(id),
  approved_by_platform_user_id uuid references app.platform_users(id),
  approved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.organization_memberships (
  id uuid primary key,
  organization_id uuid not null references app.organizations(id),
  platform_user_id uuid not null references app.platform_users(id),
  role app.organization_membership_role_enum not null,
  status app.organization_membership_status_enum not null,
  joined_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, platform_user_id)
);

create table if not exists app.student_profiles (
  id uuid primary key,
  student_login text not null unique,
  first_name text not null,
  last_name text not null,
  display_name text not null,
  status app.student_status_enum not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.student_credentials (
  id uuid primary key,
  student_profile_id uuid not null unique references app.student_profiles(id),
  pin_hash text not null,
  pin_plaintext_dev_only text not null,
  status app.student_credential_status_enum not null default 'active',
  last_pin_changed_at timestamptz not null,
  failed_attempts_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.organization_students (
  id uuid primary key,
  organization_id uuid not null references app.organizations(id),
  student_profile_id uuid not null references app.student_profiles(id),
  status app.student_status_enum not null default 'active',
  joined_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, student_profile_id)
);

create table if not exists app.classes (
  id uuid primary key,
  organization_id uuid not null references app.organizations(id),
  title text not null,
  description text,
  status app.class_status_enum not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.class_join_codes (
  id uuid primary key,
  class_id uuid not null references app.classes(id),
  code char(6) not null unique,
  status app.join_code_status_enum not null,
  valid_from timestamptz not null,
  valid_until timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.class_enrollments (
  id uuid primary key,
  class_id uuid not null references app.classes(id),
  student_profile_id uuid not null references app.student_profiles(id),
  organization_student_id uuid references app.organization_students(id),
  status app.enrollment_status_enum not null,
  source app.enrollment_source_enum not null,
  joined_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (class_id, student_profile_id)
);

create table if not exists app.assignment_templates (
  id uuid primary key,
  teacher_id uuid not null references app.platform_users(id),
  title text not null,
  description text not null,
  has_practice boolean not null,
  has_test boolean not null,
  status app.assignment_template_status_enum not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.assignment_publications (
  id uuid primary key,
  assignment_template_id uuid not null references app.assignment_templates(id),
  published_by_teacher_id uuid not null references app.platform_users(id),
  default_deadline timestamptz,
  status app.assignment_publication_status_enum not null,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists app.assignment_publication_classes (
  id uuid primary key,
  assignment_publication_id uuid not null references app.assignment_publications(id),
  class_id uuid not null references app.classes(id),
  deadline_override timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (assignment_publication_id, class_id)
);

truncate table
  app.assignment_publication_classes,
  app.assignment_publications,
  app.assignment_templates,
  app.class_enrollments,
  app.class_join_codes,
  app.classes,
  app.organization_students,
  app.student_credentials,
  app.student_profiles,
  app.organization_memberships,
  app.organizations,
  app.platform_users,
  app.bootstrap_auth_accounts
restart identity cascade;

insert into app.bootstrap_auth_accounts (id, role, email, password_plaintext, notes)
values
  ('10000000-0000-4000-8000-000000000001', 'super_admin', 'admin@platform.local', 'Admin123!', 'Deterministic local bootstrap credential placeholder until Supabase auth wiring lands.'),
  ('10000000-0000-4000-8000-000000000002', 'teacher', 'teacher@platform.local', 'Teacher123!', 'Deterministic local bootstrap credential placeholder until Supabase auth wiring lands.');

insert into app.platform_users (id, bootstrap_auth_account_id, role, status, display_name)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'super_admin', 'active', 'Platform Admin'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'teacher', 'active', 'Demo Teacher');

insert into app.organizations (id, name, slug, status, created_by_platform_user_id, approved_by_platform_user_id, approved_at)
values
  ('30000000-0000-4000-8000-000000000001', 'Demo School of Technical Drawing', 'demo-school', 'active', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '2026-01-10T09:00:00Z'),
  ('30000000-0000-4000-8000-000000000002', 'Pending School Request', 'pending-school-request', 'pending', '20000000-0000-4000-8000-000000000002', null, null);

insert into app.organization_memberships (id, organization_id, platform_user_id, role, status, joined_at)
values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'owner', 'active', '2026-01-10T09:00:00Z'),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'teacher', 'active', '2026-01-10T09:05:00Z'),
  ('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'owner', 'pending', '2026-01-12T08:00:00Z');

insert into app.student_profiles (id, student_login, first_name, last_name, display_name, status)
values
  ('50000000-0000-4000-8000-000000000001', 'ST-100001', 'Alex', 'Morozov', 'Alex Morozov', 'active');

insert into app.student_credentials (id, student_profile_id, pin_hash, pin_plaintext_dev_only, status, last_pin_changed_at, failed_attempts_count)
values
  ('60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', md5('1111'), '1111', 'active', '2026-01-10T09:10:00Z', 0);

insert into app.organization_students (id, organization_id, student_profile_id, status, joined_at)
values
  ('70000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'active', '2026-01-10T09:15:00Z');

insert into app.classes (id, organization_id, title, description, status)
values
  ('80000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Engineering Graphics 8A', 'Primary seeded class for fixture QA.', 'active'),
  ('80000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'Engineering Graphics 8B', 'Secondary seeded class for multi-class student dashboard QA.', 'active');

insert into app.class_join_codes (id, class_id, code, status, valid_from, valid_until)
values
  ('81000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001', '120801', 'active', '2026-01-10T09:20:00Z', null),
  ('81000000-0000-4000-8000-000000000002', '80000000-0000-4000-8000-000000000002', '120802', 'active', '2026-01-10T09:20:00Z', null);

insert into app.class_enrollments (id, class_id, student_profile_id, organization_student_id, status, source, joined_at)
values
  ('82000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'active', 'bulk_import', '2026-01-10T09:25:00Z'),
  ('82000000-0000-4000-8000-000000000002', '80000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'active', 'self_join', '2026-01-10T09:30:00Z');

insert into app.assignment_templates (id, teacher_id, title, description, has_practice, has_test, status)
values
  ('90000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'Orthographic Projection Basics', 'Deterministic fixture assignment published to both seeded classes.', true, true, 'active');

insert into app.assignment_publications (id, assignment_template_id, published_by_teacher_id, default_deadline, status, published_at)
values
  ('91000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '2026-02-01T18:00:00Z', 'published', '2026-01-15T10:00:00Z');

insert into app.assignment_publication_classes (id, assignment_publication_id, class_id, deadline_override, status)
values
  ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001', null, 'active'),
  ('92000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000002', null, 'active');

comment on schema app is 'Application scaffold tables for deterministic local QA fixtures before full domain migrations exist.';
comment on table app.bootstrap_auth_accounts is 'Local-only credential placeholders for seeded staff accounts until real Supabase auth seeding is introduced.';
comment on column app.student_credentials.pin_plaintext_dev_only is 'Bootstrap-only deterministic PIN reference for QA; remove when real auth flow hashes/rotates secrets.';
