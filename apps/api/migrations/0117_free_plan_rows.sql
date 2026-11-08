-- 0117: Workers Free again: what an active person reads through the day (docs/performance.md, the Free plan section).

-- The counts behind the badges, kept on the person's row for an hour (`keptStats` in db.ts): reading them visits every row counted, and /me is read after every write.
ALTER TABLE users ADD COLUMN stats_json TEXT;
ALTER TABLE users ADD COLUMN stats_at TEXT;

-- Ranges by day over a person's logs (Home, Wellbeing, reviews, Emerging) walked every log the person has, since the one index starts with the kind. A few rows written a day; about a thousand read on each open of Home.
CREATE INDEX IF NOT EXISTS idx_wb_user_date ON wellbeing_logs (user_id, date);
-- Only tasks brought to a review, and only tasks with an area of life: every other task of the person's is never read for these.
CREATE INDEX IF NOT EXISTS idx_nodes_for_review ON nodes (user_id) WHERE for_review = 1;
CREATE INDEX IF NOT EXISTS idx_nodes_life_area ON nodes (user_id) WHERE life_area IS NOT NULL;
