-- Add missing database indexes for performance optimization
-- Indexes for frequently queried columns

-- ──────────────────────────────────────────────
-- notifications table indexes
-- ──────────────────────────────────────────────

-- Index for filtering notifications by type
CREATE INDEX IF NOT EXISTS notifications_type_idx
  ON public.notifications (type);

-- Index for finding unread notifications (read_at IS NULL)
CREATE INDEX IF NOT EXISTS notifications_read_at_idx
  ON public.notifications (read_at)
  WHERE read_at IS NULL;

-- ──────────────────────────────────────────────
-- upload_sessions table indexes
-- ──────────────────────────────────────────────

-- Index for filtering upload sessions by context type
CREATE INDEX IF NOT EXISTS upload_sessions_context_type_idx
  ON public.upload_sessions (context_type);

-- ──────────────────────────────────────────────
-- derived_assets table indexes
-- ──────────────────────────────────────────────

-- Index for filtering derived assets by derivation status
CREATE INDEX IF NOT EXISTS derived_assets_derivation_status_idx
  ON public.derived_assets (derivation_status);
