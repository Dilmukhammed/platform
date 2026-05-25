-- Replace image_url (single text) with images (jsonb array) to support
-- multiple images per question.  Backfills existing single-image data.

-- 1. Add new column
ALTER TABLE public.test_questions
  ADD COLUMN images jsonb;

-- 2. Backfill: wrap existing image_url into a single-element array
UPDATE public.test_questions
SET images = jsonb_build_array(image_url)
WHERE image_url IS NOT NULL;

-- 3. Set empty array as default for all remaining rows
UPDATE public.test_questions
SET images = '[]'::jsonb
WHERE images IS NULL;

-- 4. Add NOT NULL + default
ALTER TABLE public.test_questions
  ALTER COLUMN images SET NOT NULL,
  ALTER COLUMN images SET DEFAULT '[]'::jsonb;

-- 5. Drop old column
ALTER TABLE public.test_questions
  DROP COLUMN image_url;

COMMENT ON COLUMN public.test_questions.images IS
  'JSON array of Supabase Storage paths for question images. '
  'Served via signed URL because the bucket is private. '
  'Up to 5 images per question, 1 per MC option (stored in optionsJson.optionImages).';
