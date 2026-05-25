-- Add re-approval tracking columns to test_approvals.
-- When a teacher edits an already-approved test and resubmits,
-- is_reapproval=true and previous_questions_json stores a snapshot
-- of the questions from the last approved version so the admin
-- can see what changed.

alter table public.test_approvals
  add column is_reapproval boolean not null default false,
  add column previous_questions_json jsonb;

comment on column public.test_approvals.is_reapproval is
  'True when this approval request follows an edit to a previously approved test';
comment on column public.test_approvals.previous_questions_json is
  'Snapshot of test_questions from the previously approved version, used to highlight diffs for the admin';
