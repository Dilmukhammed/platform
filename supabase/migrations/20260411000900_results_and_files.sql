-- T7: Canonical result and submission asset schema
-- Tables: assignment_results, submission_files, derived_assets, test_attempts

-- ──────────────────────────────────────────────
-- assignment_results
-- ──────────────────────────────────────────────
-- Canonical result grain = publication_class + class_enrollment.
-- One active result per (assignment_publication_class_id, class_enrollment_id).

create table public.assignment_results (
  id uuid primary key default gen_random_uuid(),
  assignment_publication_class_id uuid not null,
  class_enrollment_id uuid not null,
  status public.assignment_result_status_enum not null default 'not_started',
  practice_started_at timestamptz,
  practice_submitted_at timestamptz,
  test_started_at timestamptz,
  test_submitted_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint assignment_results_assignment_publication_class_id_fkey
    foreign key (assignment_publication_class_id)
    references public.assignment_publication_classes (id)
    on update cascade
    on delete restrict,
  constraint assignment_results_class_enrollment_id_fkey
    foreign key (class_enrollment_id)
    references public.class_enrollments (id)
    on update cascade
    on delete restrict,
  constraint assignment_results_practice_window_check
    check (practice_submitted_at is null or practice_started_at is null or practice_submitted_at >= practice_started_at),
  constraint assignment_results_test_window_check
    check (test_submitted_at is null or test_started_at is null or test_submitted_at >= test_started_at),
  constraint assignment_results_release_after_test_check
    check (released_at is null or test_submitted_at is null or released_at >= test_submitted_at)
);

create index assignment_results_assignment_publication_class_id_idx
  on public.assignment_results (assignment_publication_class_id);

create index assignment_results_class_enrollment_id_idx
  on public.assignment_results (class_enrollment_id);

-- One active result per (assignment_publication_class_id, class_enrollment_id)
create unique index assignment_results_active_publication_enrollment_idx
  on public.assignment_results (assignment_publication_class_id, class_enrollment_id)
  where deleted_at is null;

-- ──────────────────────────────────────────────
-- submission_files
-- ──────────────────────────────────────────────
-- Source/original file records attached to a result.
-- Schema tolerates future resubmission/versioning via is_current flag.

create table public.submission_files (
  id uuid primary key default gen_random_uuid(),
  assignment_result_id uuid not null,
  file_role public.submission_file_role_enum not null,
  file_kind public.submission_file_kind_enum not null,
  original_storage_path text not null,
  original_filename text not null,
  mime_type text,
  file_size_bytes bigint not null,
  sort_order integer not null default 0,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint submission_files_assignment_result_id_fkey
    foreign key (assignment_result_id)
    references public.assignment_results (id)
    on update cascade
    on delete restrict,
  constraint submission_files_original_storage_path_check
    check (btrim(original_storage_path) <> ''),
  constraint submission_files_original_filename_check
    check (btrim(original_filename) <> ''),
  constraint submission_files_mime_type_check
    check (mime_type is null or btrim(mime_type) <> ''),
  constraint submission_files_file_size_bytes_check
    check (file_size_bytes >= 0),
  constraint submission_files_sort_order_check
    check (sort_order >= 0)
);

create index submission_files_assignment_result_id_idx
  on public.submission_files (assignment_result_id);

-- ──────────────────────────────────────────────
-- derived_assets
-- ──────────────────────────────────────────────
-- Separate table for previews and transforms of submission files.

create table public.derived_assets (
  id uuid primary key default gen_random_uuid(),
  submission_file_id uuid not null,
  kind public.derived_asset_kind_enum not null,
  storage_path text not null,
  page_index integer,
  width integer,
  height integer,
  metadata_json jsonb,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint derived_assets_submission_file_id_fkey
    foreign key (submission_file_id)
    references public.submission_files (id)
    on update cascade
    on delete restrict,
  constraint derived_assets_storage_path_check
    check (btrim(storage_path) <> ''),
  constraint derived_assets_page_index_check
    check (page_index is null or page_index >= 0),
  constraint derived_assets_width_check
    check (width is null or width > 0),
  constraint derived_assets_height_check
    check (height is null or height > 0)
);

create index derived_assets_submission_file_id_idx
  on public.derived_assets (submission_file_id);

-- ──────────────────────────────────────────────
-- test_attempts
-- ──────────────────────────────────────────────
-- Stores attempt state for the linked test.
-- MVP: one current attempt per result; schema leaves room for future multiple attempts.

create table public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  assignment_result_id uuid not null,
  test_id uuid not null,
  attempt_number integer not null,
  is_current boolean not null default true,
  score_raw numeric,
  responses_json jsonb,
  started_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint test_attempts_assignment_result_id_fkey
    foreign key (assignment_result_id)
    references public.assignment_results (id)
    on update cascade
    on delete restrict,
  constraint test_attempts_test_id_fkey
    foreign key (test_id)
    references public.tests (id)
    on update cascade
    on delete restrict,
  constraint test_attempts_attempt_number_check
    check (attempt_number > 0),
  constraint test_attempts_score_raw_check
    check (score_raw is null or score_raw >= 0),
  constraint test_attempts_submission_window_check
    check (submitted_at is null or started_at is null or submitted_at >= started_at)
);

create index test_attempts_assignment_result_id_idx
  on public.test_attempts (assignment_result_id);

create index test_attempts_test_id_idx
  on public.test_attempts (test_id);

-- One current attempt per result in MVP
create unique index test_attempts_current_per_result_idx
  on public.test_attempts (assignment_result_id)
  where deleted_at is null
    and is_current;
