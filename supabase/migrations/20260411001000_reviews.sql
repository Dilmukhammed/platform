-- T8: Review, comments, and annotation schema
-- Tables: submission_reviews, review_comments, annotation_documents

-- ──────────────────────────────────────────────
-- submission_reviews
-- ──────────────────────────────────────────────
-- Core review lifecycle table.
-- Teacher draft/release state; central parent for comment threads and review lifecycle.

create table public.submission_reviews (
  id uuid primary key default gen_random_uuid(),
  assignment_result_id uuid not null,
  reviewed_by_teacher_id uuid not null,
  status public.review_status_enum not null default 'draft',
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint submission_reviews_assignment_result_id_fkey
    foreign key (assignment_result_id)
    references public.assignment_results (id)
    on update cascade
    on delete restrict,
  constraint submission_reviews_reviewed_by_teacher_id_fkey
    foreign key (reviewed_by_teacher_id)
    references public.platform_users (id)
    on update cascade
    on delete restrict,
  constraint submission_reviews_release_after_draft_check
    check (released_at is null or status in ('released', 'archived'))
);

create index submission_reviews_assignment_result_id_idx
  on public.submission_reviews (assignment_result_id);

create index submission_reviews_reviewed_by_teacher_id_idx
  on public.submission_reviews (reviewed_by_teacher_id);

-- One current review per result in MVP
create unique index submission_reviews_current_per_result_idx
  on public.submission_reviews (assignment_result_id)
  where deleted_at is null
    and status in ('draft', 'released');

-- ──────────────────────────────────────────────
-- review_comments
-- ──────────────────────────────────────────────
-- Threaded comments table.
-- Two-way teacher/student replies; parent entity is submission_reviews.

create table public.review_comments (
  id uuid primary key default gen_random_uuid(),
  submission_review_id uuid not null,
  author_type public.review_comment_author_type_enum not null,
  author_platform_user_id uuid,
  author_student_profile_id uuid,
  parent_comment_id uuid,
  body text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint review_comments_submission_review_id_fkey
    foreign key (submission_review_id)
    references public.submission_reviews (id)
    on update cascade
    on delete restrict,
  constraint review_comments_author_platform_user_id_fkey
    foreign key (author_platform_user_id)
    references public.platform_users (id)
    on update cascade
    on delete restrict,
  constraint review_comments_author_student_profile_id_fkey
    foreign key (author_student_profile_id)
    references public.student_profiles (id)
    on update cascade
    on delete restrict,
  constraint review_comments_parent_comment_id_fkey
    foreign key (parent_comment_id)
    references public.review_comments (id)
    on update cascade
    on delete restrict,
  constraint review_comments_body_check
    check (btrim(body) <> ''),
  constraint review_comments_exactly_one_author_check
    check (
      (author_platform_user_id is not null and author_student_profile_id is null)
      or
      (author_platform_user_id is null and author_student_profile_id is not null)
    ),
  constraint review_comments_author_type_consistency_check
    check (
      (author_type = 'teacher' and author_platform_user_id is not null and author_student_profile_id is null)
      or
      (author_type = 'student' and author_platform_user_id is null and author_student_profile_id is not null)
    )
);

create index review_comments_submission_review_id_idx
  on public.review_comments (submission_review_id);

create index review_comments_author_platform_user_id_idx
  on public.review_comments (author_platform_user_id);

create index review_comments_author_student_profile_id_idx
  on public.review_comments (author_student_profile_id);

create index review_comments_parent_comment_id_idx
  on public.review_comments (parent_comment_id);

-- ──────────────────────────────────────────────
-- annotation_documents
-- ──────────────────────────────────────────────
-- Versioned JSON documents per asset/page.
-- One JSON document per asset/page/version, not one row per primitive.
-- Annotation target: derived_asset_id, not ambiguous asset references.

create table public.annotation_documents (
  id uuid primary key default gen_random_uuid(),
  submission_review_id uuid not null,
  derived_asset_id uuid not null,
  page_index integer,
  version integer not null default 1,
  is_current boolean not null default true,
  base_width integer not null,
  base_height integer not null,
  payload_json jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint annotation_documents_submission_review_id_fkey
    foreign key (submission_review_id)
    references public.submission_reviews (id)
    on update cascade
    on delete restrict,
  constraint annotation_documents_derived_asset_id_fkey
    foreign key (derived_asset_id)
    references public.derived_assets (id)
    on update cascade
    on delete restrict,
  constraint annotation_documents_page_index_check
    check (page_index is null or page_index >= 0),
  constraint annotation_documents_version_check
    check (version > 0),
  constraint annotation_documents_base_width_check
    check (base_width > 0),
  constraint annotation_documents_base_height_check
    check (base_height > 0)
);

create index annotation_documents_submission_review_id_idx
  on public.annotation_documents (submission_review_id);

create index annotation_documents_derived_asset_id_idx
  on public.annotation_documents (derived_asset_id);

-- One current annotation document per (review, derived_asset, page)
create unique index annotation_documents_current_per_review_asset_page_idx
  on public.annotation_documents (submission_review_id, derived_asset_id, page_index)
  where deleted_at is null
    and is_current;
