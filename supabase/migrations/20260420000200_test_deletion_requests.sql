-- Add 'deletion_requested' to test_status_enum and create test_deletion_requests table.
-- Teachers can request deletion of a test; admins review and approve/reject.
-- Follows the same pattern as test_approvals (decision, reviewed_by, reviewed_at, deleted_at).

-- ──────────────────────────────────────────────
-- Extend test_status_enum
-- ──────────────────────────────────────────────

alter type public.test_status_enum
  add value 'deletion_requested';

-- ──────────────────────────────────────────────
-- test_deletion_requests
-- ──────────────────────────────────────────────
-- Deletion request lifecycle table.
-- Teacher requests deletion; admin reviews and approves/rejects.
-- On approval, the test (and its questions via CASCADE) is hard-deleted.

create table public.test_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null,
  requested_by_platform_user_id uuid not null,
  reason text,
  decision text not null default 'pending',
  reviewed_by_platform_user_id uuid,
  review_reason text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint test_deletion_requests_test_id_fkey
    foreign key (test_id)
    references public.tests (id)
    on delete cascade,
  constraint test_deletion_requests_requested_by_platform_user_id_fkey
    foreign key (requested_by_platform_user_id)
    references public.platform_users (id)
    on update cascade
    on delete restrict,
  constraint test_deletion_requests_reviewed_by_platform_user_id_fkey
    foreign key (reviewed_by_platform_user_id)
    references public.platform_users (id)
    on update cascade
    on delete restrict,
  constraint test_deletion_requests_decision_check
    check (decision in ('pending', 'approved', 'rejected')),
  constraint test_deletion_requests_reason_check
    check (reason is null or btrim(reason) <> ''),
  constraint test_deletion_requests_review_reason_check
    check (review_reason is null or btrim(review_reason) <> ''),
  constraint test_deletion_requests_review_state_check
    check (
      (decision = 'pending' and reviewed_by_platform_user_id is null and reviewed_at is null)
      or (
        decision in ('approved', 'rejected')
        and reviewed_by_platform_user_id is not null
        and reviewed_at is not null
      )
    )
);

create index test_deletion_requests_test_id_idx
  on public.test_deletion_requests (test_id);

create index test_deletion_requests_decision_idx
  on public.test_deletion_requests (decision);

create index test_deletion_requests_created_at_idx
  on public.test_deletion_requests (created_at);
