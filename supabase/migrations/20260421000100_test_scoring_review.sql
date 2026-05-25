-- Add show_results enum to tests table and question_results to test_attempts.
-- Controls when students can see their test results.

-- Create enum for test show results behavior
CREATE TYPE public.test_show_results_enum AS ENUM (
  'immediate',
  'after_review',
  'never'
);

-- Add show_results column to tests table
ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS show_results public.test_show_results_enum NOT NULL DEFAULT 'after_review';

-- Add question_results column to test_attempts table
ALTER TABLE public.test_attempts
  ADD COLUMN IF NOT EXISTS question_results jsonb DEFAULT '[]'::jsonb;

-- Add comment describing the JSON schema
COMMENT ON COLUMN public.test_attempts.question_results IS 'Per-question scoring results: [{ questionId, questionType, score, isCorrect, autoScored }]';