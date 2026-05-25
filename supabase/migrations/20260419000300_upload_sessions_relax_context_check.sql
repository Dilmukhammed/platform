-- Relax the context_pair check constraint on upload_sessions.
-- test_asset uploads may be initialized before a test record exists (e.g. during creation),
-- so context_type = 'test' without context_id must be allowed.

ALTER TABLE upload_sessions
  DROP CONSTRAINT upload_sessions_context_pair_check;

ALTER TABLE upload_sessions
  ADD CONSTRAINT upload_sessions_context_pair_check
  CHECK (
    (context_type IS NULL AND context_id IS NULL)
    OR (context_type IS NOT NULL AND context_id IS NOT NULL)
    -- Allow test_asset without context_id (test not created yet)
    OR (context_type = 'test' AND context_id IS NULL)
  );
