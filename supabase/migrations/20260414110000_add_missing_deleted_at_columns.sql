-- Add missing deleted_at columns for soft-delete support
-- Migration: Add deleted_at to tables missing soft-delete capability

-- upload_sessions table - missing deleted_at column
alter table public.upload_sessions
  add column if not exists deleted_at timestamptz default null;

-- Add index on deleted_at for query performance (active record filtering)
create index if not exists upload_sessions_deleted_at_idx
  on public.upload_sessions (deleted_at)
  where deleted_at is null;

-- Add comment explaining the column
comment on column public.upload_sessions.deleted_at is 'Soft-delete timestamp; null means active record';

-- notifications table - missing deleted_at column
alter table public.notifications
  add column if not exists deleted_at timestamptz default null;

-- Add index on deleted_at for query performance (active record filtering)
create index if not exists notifications_deleted_at_idx
  on public.notifications (deleted_at)
  where deleted_at is null;

-- Add comment explaining the column
comment on column public.notifications.deleted_at is 'Soft-delete timestamp; null means active record';
