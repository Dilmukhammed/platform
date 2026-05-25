-- Add image support to test questions.
-- Stores the Supabase storage path (not a full URL) so we can generate
-- signed URLs on demand.  The path corresponds to upload_sessions.storage_path.

alter table public.test_questions
  add column image_url text;

comment on column public.test_questions.image_url is
  'Supabase Storage path for a question image (e.g. test-assets/uuid.jpg). '
  'Served via signed URL because the bucket is private.';
