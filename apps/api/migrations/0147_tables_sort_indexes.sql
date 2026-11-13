-- 0147: All tables' default sorts, through an index each (the review of 2026-11-13). Each of these tables opens newest first by when a row
-- was added, and the owner index alone made every page sort all of a person's rows (water 3,000, focus rounds 2,000, subtasks 4,000 with a
-- title look-up each, followers 5,000 with a name each, on a heavy test person); with these the same pages read about thirty rows.
-- Indexes only.

-- Water taps, newest first (the Water table's default page).
CREATE INDEX IF NOT EXISTS idx_water_logs_user_created ON water_logs (user_id, created_at);

-- Focus rounds, newest first (the Focus sessions table's default page).
CREATE INDEX IF NOT EXISTS idx_focus_rounds_user_created ON focus_rounds (user_id, created_at);

-- Subtasks, newest first (the Subtasks table's default page); it also serves every read by user_id alone, so the old index goes.
CREATE INDEX IF NOT EXISTS idx_subtasks_user_created ON subtasks (user_id, created_at);
DROP INDEX IF EXISTS idx_subtasks_user;

-- Followers, newest first: a list that grows with other people's taps, so a popular person's page never sorts all of it.
CREATE INDEX IF NOT EXISTS idx_follows_owner_created ON follows (owner_id, created_at);

-- idx_orders_buyer (buyer_id) is the front of idx_orders_buyer_created (0144), which serves every read it did: one write less per order.
DROP INDEX IF EXISTS idx_orders_buyer;
