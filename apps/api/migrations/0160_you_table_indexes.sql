-- 0160: All tables' seventh batch, You (2026-11-14, the founder: "ok, add them"), each page's default sort through an index.
-- These tables had no index that starts on the person and keeps the page's order, so a page read every row of theirs (season places: every row of
-- everyone's) and sorted them. Two single-column indexes are replaced by one that starts on the same column, which serves everything they served.
-- Nothing is rewritten.

-- Your life coaches, newest ask first. coach_links_student (student_id, status) found them but kept them out of that order; it stays for the
-- reads by status (an open link, the roster).
CREATE INDEX IF NOT EXISTS idx_coach_links_student_created ON coach_links (student_id, created_at);

-- Your students, newest ask first, as above from the coach's side (coach_links_coach keeps serving the reads by status).
CREATE INDEX IF NOT EXISTS idx_coach_links_coach_created ON coach_links (coach_id, created_at);

-- Season places, newest season first. The key (season, place) starts on the season, so there was no index by who finished there.
CREATE INDEX IF NOT EXISTS idx_season_results_user ON season_results (user_id, season);

-- Live call asks, newest first. idx_call_requests_open is a partial index on the open asks alone, so it never serves a page of all of them.
CREATE INDEX IF NOT EXISTS idx_call_requests_user_created ON call_requests (user_id, created_at);

-- Discount codes you used, newest first. It replaces idx_discount_redemptions_user (user_id), which it serves (the export and the account delete).
CREATE INDEX IF NOT EXISTS idx_discount_redemptions_user_created ON discount_redemptions (user_id, created_at);
DROP INDEX IF EXISTS idx_discount_redemptions_user;

-- Vibe check answers, newest first. It replaces idx_answers_user (user_id), which it serves (the vibe check's own read of what was kept, the
-- export and the account delete).
CREATE INDEX IF NOT EXISTS idx_answers_user_created ON onboarding_answers (user_id, created_at);
DROP INDEX IF EXISTS idx_answers_user;

-- Terms you accepted, newest first. idx_terms_acceptances_user (user_id, doc, accepted_at) keeps them by document first; it stays for the
-- notice's own read of the latest acceptance of each document.
CREATE INDEX IF NOT EXISTS idx_terms_acceptances_user_time ON terms_acceptances (user_id, accepted_at);
