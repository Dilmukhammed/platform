-- Add shuffle settings to tests table.
-- Teachers can independently toggle question order shuffling and MC option shuffling.

ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS shuffle_questions boolean NOT NULL DEFAULT false;

ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS shuffle_options boolean NOT NULL DEFAULT false;
