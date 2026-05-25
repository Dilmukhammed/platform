-- T9: Grading history and notification schema
-- Tables: grade_records, grade_record_revisions, notifications

-- ──────────────────────────────────────────────
-- grade_records
-- ──────────────────────────────────────────────
-- Current resolved grading view for a result.
-- Holds the single source of truth quickly accessible by UI and reports.

create table public.grade_records (
  id uuid primary key default gen_random_uuid(),
  assignment_result_id uuid not null,
  grading_scheme_id uuid,
  formula_snapshot_json jsonb not null default '{}'::jsonb,
  practice_score_raw numeric,
  test_score_raw numeric,
  final_score_raw numeric,
  mapped_grade text not null,
  is_overridden boolean not null default false,
  override_reason text,
  overridden_by_teacher_id uuid,
  status public.grade_record_status_enum not null default 'current',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint grade_records_assignment_result_id_fkey
    foreign key (assignment_result_id)
    references public.assignment_results (id)
    on update cascade
    on delete restrict,
  constraint grade_records_grading_scheme_id_fkey
    foreign key (grading_scheme_id)
    references public.grading_schemes (id)
    on update cascade
    on delete restrict,
  constraint grade_records_overridden_by_teacher_id_fkey
    foreign key (overridden_by_teacher_id)
    references public.platform_users (id)
    on update cascade
    on delete restrict,
  constraint grade_records_mapped_grade_check
    check (btrim(mapped_grade) <> ''),
  constraint grade_records_override_reason_check
    check (btrim(override_reason) <> ''),
  constraint grade_records_override_reason_required_check
    check (not is_overridden or override_reason is not null),
  constraint grade_records_score_raw_check
    check (practice_score_raw is null or practice_score_raw >= 0),
  constraint grade_records_test_score_raw_check
    check (test_score_raw is null or test_score_raw >= 0),
  constraint grade_records_final_score_raw_check
    check (final_score_raw is null or final_score_raw >= 0)
);

create index grade_records_assignment_result_id_idx
  on public.grade_records (assignment_result_id);

create index grade_records_grading_scheme_id_idx
  on public.grade_records (grading_scheme_id);

create index grade_records_overridden_by_teacher_id_idx
  on public.grade_records (overridden_by_teacher_id);

-- One current grade record per result
create unique index grade_records_current_per_result_idx
  on public.grade_records (assignment_result_id)
  where deleted_at is null
    and status = 'current';

-- ──────────────────────────────────────────────
-- grade_record_revisions
-- ──────────────────────────────────────────────
-- Append-only grading history.
-- Preserves audit trail and manual override history.

create table public.grade_record_revisions (
  id uuid primary key default gen_random_uuid(),
  grade_record_id uuid not null,
  revision_number integer not null,
  grading_scheme_id uuid,
  formula_snapshot_json jsonb not null default '{}'::jsonb,
  practice_score_raw numeric,
  test_score_raw numeric,
  final_score_raw numeric,
  mapped_grade text not null,
  is_overridden boolean not null default false,
  override_reason text,
  changed_by_teacher_id uuid not null,
  change_reason text,
  created_at timestamptz not null default now(),
  constraint grade_record_revisions_grade_record_id_fkey
    foreign key (grade_record_id)
    references public.grade_records (id)
    on update cascade
    on delete restrict,
  constraint grade_record_revisions_grading_scheme_id_fkey
    foreign key (grading_scheme_id)
    references public.grading_schemes (id)
    on update cascade
    on delete restrict,
  constraint grade_record_revisions_changed_by_teacher_id_fkey
    foreign key (changed_by_teacher_id)
    references public.platform_users (id)
    on update cascade
    on delete restrict,
  constraint grade_record_revisions_revision_number_check
    check (revision_number > 0),
  constraint grade_record_revisions_mapped_grade_check
    check (btrim(mapped_grade) <> ''),
  constraint grade_record_revisions_override_reason_check
    check (override_reason is null or btrim(override_reason) <> ''),
  constraint grade_record_revisions_change_reason_check
    check (change_reason is null or btrim(change_reason) <> ''),
  constraint grade_record_revisions_practice_score_raw_check
    check (practice_score_raw is null or practice_score_raw >= 0),
  constraint grade_record_revisions_test_score_raw_check
    check (test_score_raw is null or test_score_raw >= 0),
  constraint grade_record_revisions_final_score_raw_check
    check (final_score_raw is null or final_score_raw >= 0)
);

create index grade_record_revisions_grade_record_id_idx
  on public.grade_record_revisions (grade_record_id);

create index grade_record_revisions_grading_scheme_id_idx
  on public.grade_record_revisions (grading_scheme_id);

create index grade_record_revisions_changed_by_teacher_id_idx
  on public.grade_record_revisions (changed_by_teacher_id);

-- One revision per (grade_record, revision_number)
create unique index grade_record_revisions_unique_revision_idx
  on public.grade_record_revisions (grade_record_id, revision_number);

-- ──────────────────────────────────────────────
-- notifications
-- ──────────────────────────────────────────────
-- Single main notification table for MVP in-app notifications.
-- Recipient polymorphism: exactly one of platform_user or student_profile must be set.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_type public.notification_recipient_type_enum not null,
  recipient_platform_user_id uuid,
  recipient_student_profile_id uuid,
  type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_recipient_platform_user_id_fkey
    foreign key (recipient_platform_user_id)
    references public.platform_users (id)
    on update cascade
    on delete restrict,
  constraint notifications_recipient_student_profile_id_fkey
    foreign key (recipient_student_profile_id)
    references public.student_profiles (id)
    on update cascade
    on delete restrict,
  constraint notifications_type_check
    check (btrim(type) <> ''),
  constraint notifications_exactly_one_recipient_check
    check (
      (recipient_platform_user_id is not null and recipient_student_profile_id is null)
      or
      (recipient_platform_user_id is null and recipient_student_profile_id is not null)
    ),
  constraint notifications_recipient_type_consistency_check
    check (
      (recipient_type = 'platform_user' and recipient_platform_user_id is not null and recipient_student_profile_id is null)
      or
      (recipient_type = 'student_profile' and recipient_platform_user_id is null and recipient_student_profile_id is not null)
    )
);

create index notifications_recipient_platform_user_id_idx
  on public.notifications (recipient_platform_user_id);

create index notifications_recipient_student_profile_id_idx
  on public.notifications (recipient_student_profile_id);
