-- 0169: the review of All tables' Edit and Delete (2026-11-14). Hand-ins can now be taken back from Tables while nobody has given feedback on
-- them, so the owner's page works out `NOT EXISTS (SELECT 1 FROM submission_feedback f WHERE f.submission_id = t.id)` for every row it shows,
-- and DELETE /school/submissions/:id asks the same once. submission_feedback had no index on submission_id, so each of those read every
-- feedback line anyone was ever given, up to 101 times a page. This serves them by the hand-in, and also School's own feedback read for a
-- cohort (`f.submission_id IN (SELECT id FROM submissions WHERE cohort_id = ?)`), the cohort delete and the account delete, which find the
-- lines by their hand-in, and the cascade from submissions. Nothing is rewritten.
CREATE INDEX IF NOT EXISTS idx_submission_feedback_submission ON submission_feedback (submission_id);
