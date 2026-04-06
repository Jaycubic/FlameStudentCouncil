-- Migration: add rank and is_top_pick columns to app.nominated_students
-- Run this once on the server before deploying the updated nomination logic.
-- Safe to run multiple times (uses IF NOT EXISTS / ALTER TABLE ... IF NOT EXISTS).

ALTER TABLE app.nominated_students
    ADD COLUMN IF NOT EXISTS rank         INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS is_top_pick  BOOLEAN DEFAULT FALSE;

-- Back-fill existing rows: rank 1 / is_top_pick true for all existing rows
-- (they were the only pick per gender before the new multi-nominee logic)
UPDATE app.nominated_students
SET rank = 1, is_top_pick = TRUE
WHERE rank IS NULL OR is_top_pick IS NULL;

-- Confirm
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'app'
  AND table_name   = 'nominated_students'
  AND column_name  IN ('rank', 'is_top_pick')
ORDER BY column_name;
