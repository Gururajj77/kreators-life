-- 0060: performance indexes, and the table that holds real-user web vitals.
--
-- Each index below answers a query the app runs often, found by reading every WHERE, JOIN and ORDER BY in apps/api/src against
-- the CREATE INDEX lines of migrations 0001 to 0059 (and checked with EXPLAIN QUERY PLAN on a database built from them).
-- Column order is equality columns first, then the range or sort column. Nothing here duplicates an existing index; the three
-- DROPs remove an index that the new one starts with, so every old lookup still has an index and writes pay for one less.
-- Everything is IF NOT EXISTS / IF EXISTS, so running it twice changes nothing.

-- ---------------------------------------------------------------------------------------------------------------------
-- Read on every request or every screen
-- ---------------------------------------------------------------------------------------------------------------------

-- orgIdsOf() runs on every gated request (resolveAccess) as: WHERE user_id = ? AND status = 'active'.
-- The primary key is (organization_id, user_id), which cannot answer a lookup by user, so each request scanned the table.
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members (user_id, status);

-- "How many follow this person" (the feed shows it on every post, the public page and Home count it): WHERE owner_id = ?.
-- The primary key is (follower_id, owner_id), so a count by owner scanned the whole table once per post in the feed.
-- Ending in follower_id also answers "does this viewer follow that owner" from the index alone.
CREATE INDEX IF NOT EXISTS idx_follows_owner ON follows (owner_id, follower_id);

-- The unread count on /me, Home and the inbox tabs: WHERE user_id = ? AND read_at IS NULL (GROUP BY kind).
-- Partial: only unread rows are in it, so it stays tiny however many notes a person has read.
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (user_id, kind) WHERE read_at IS NULL;

-- The next event on Home and the brief, "my events" in Party: WHERE user_id = ? AND status = 'registered'.
-- The unique key is (event_id, user_id), which cannot answer a lookup by user.
CREATE INDEX IF NOT EXISTS idx_event_reg_user ON event_registrations (user_id, status);

-- Circles a person signed up for (Home, the brief, reminders, reviews): WHERE user_id = ? [AND created_at in a period].
-- The primary key is (event_id, user_id).
CREATE INDEX IF NOT EXISTS idx_circle_signups_user ON circle_signups (user_id, created_at);

-- ---------------------------------------------------------------------------------------------------------------------
-- The ledgers (written on every tick and every reward, read for caps, streaks and the review numbers)
-- ---------------------------------------------------------------------------------------------------------------------

-- xp by day on Home and in reviews, the leaderboard's season sum, the daily cap counts: user_id = ? AND created_at >= ? [< ?].
CREATE INDEX IF NOT EXISTS idx_xp_user_created ON xp_events (user_id, created_at);
-- "Was this thing already paid" (rewardSocial, a task tick, a run): user_id = ? AND source = ? AND source_id = ?.
CREATE INDEX IF NOT EXISTS idx_xp_user_source ON xp_events (user_id, source, source_id);
-- idx_xp_user (user_id) is the front of both indexes above.
DROP INDEX IF EXISTS idx_xp_user;

-- Daily caps and sums by reason: user_id = ? AND reason = ? AND created_at >= ?.
CREATE INDEX IF NOT EXISTS idx_points_user_reason ON points_ledger (user_id, reason, created_at);
-- "Was this already paid": user_id = ? AND reason = ? AND ref = ?.
CREATE INDEX IF NOT EXISTS idx_points_user_ref ON points_ledger (user_id, reason, ref);
-- idx_points_user (user_id) is the front of both indexes above.
DROP INDEX IF EXISTS idx_points_user;

-- ---------------------------------------------------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------------------------------------------------

-- Done tasks in a window (Home's last 24 hours and 14 days, the brief's week counts, reviews):
-- user_id = ? AND kind = 'task' AND status = 'done' AND completed_at >= ?. Without completed_at in the index every done task
-- a person ever ticked was read to find the recent ones. It still answers (user_id, kind, status) alone, so the old index goes.
CREATE INDEX IF NOT EXISTS idx_nodes_user_done ON nodes (user_id, kind, status, completed_at);
DROP INDEX IF EXISTS idx_nodes_user_kind;

-- ---------------------------------------------------------------------------------------------------------------------
-- Community
-- ---------------------------------------------------------------------------------------------------------------------

-- Feed "mine", a person's posts on their public page, reviews, export and erase: WHERE user_id = ? [ORDER BY created_at DESC].
CREATE INDEX IF NOT EXISTS idx_posts_user ON community_posts (user_id, created_at);
-- A category's feed, newest first: WHERE category = ? ... ORDER BY created_at DESC.
CREATE INDEX IF NOT EXISTS idx_posts_category ON community_posts (category, created_at);
-- Replies by person: reviews (user_id and a period), export and erase.
CREATE INDEX IF NOT EXISTS idx_replies_user ON community_replies (user_id, created_at);

-- ---------------------------------------------------------------------------------------------------------------------
-- Boards and lists
-- ---------------------------------------------------------------------------------------------------------------------

-- The leaderboard's pool: opted in and set up, ranked by xp then by age (ORDER BY u.xp DESC, u.created_at ASC LIMIT pool).
-- Partial, so people who never opted in are not in it and the board reads its pool straight off the index.
CREATE INDEX IF NOT EXISTS idx_users_board ON users (xp DESC, created_at) WHERE leaderboard_opt_in = 1 AND onboarded_at IS NOT NULL;

-- A person's submissions to rewards (Win): WHERE s.user_id = ?. The unique key is (bounty_id, user_id).
CREATE INDEX IF NOT EXISTS idx_bounty_subs_user ON bounty_submissions (user_id, created_at);
-- A person's help requests: WHERE user_id = ? ORDER BY created_at DESC.
CREATE INDEX IF NOT EXISTS idx_support_user ON support_tickets (user_id, created_at);
-- Portfolio on Profile and on the public page: WHERE user_id = ? [AND visibility = 'public'] ORDER BY created_at DESC.
CREATE INDEX IF NOT EXISTS idx_portfolio_user ON portfolio_items (user_id, created_at);
-- Finance: recurring entries and goals by person (the existing index is (active, next_date) for the cron, not for a person).
CREATE INDEX IF NOT EXISTS idx_fin_recurring_user ON finance_recurring (user_id, active, next_date);
CREATE INDEX IF NOT EXISTS idx_fin_goals_user ON finance_goals (user_id);
-- Approved testimonials on a creator's public page: WHERE t.owner_id = ? AND t.approved = 1 ORDER BY t.created_at DESC.
CREATE INDEX IF NOT EXISTS idx_testimonials_owner ON testimonials (owner_id, approved, created_at);

-- ---------------------------------------------------------------------------------------------------------------------
-- Retention sweeps and the admin outbox list (the cron deletes by age; the list sorts by age)
-- ---------------------------------------------------------------------------------------------------------------------

-- DELETE FROM link_clicks WHERE created_at < ? runs on every cron sweep, and link_clicks is the fastest-growing table.
CREATE INDEX IF NOT EXISTS idx_link_clicks_created ON link_clicks (created_at);
-- DELETE FROM email_outbox WHERE created_at < ?, and Admin's outbox: ORDER BY created_at DESC.
CREATE INDEX IF NOT EXISTS idx_email_outbox_created ON email_outbox (created_at);

-- ---------------------------------------------------------------------------------------------------------------------
-- Real-user web vitals (POST /api/public/vitals, summarised for Observability; rows older than 90 days are pruned)
-- ---------------------------------------------------------------------------------------------------------------------
-- No person, no address and no user agent: a route pattern with ids removed, the kind of device, a short connection label and
-- the numbers the browser measured. LCP, INP and TTFB are whole milliseconds; CLS is stored in thousandths (0.1 is 100).
-- A metric the browser did not report is NULL, never zero.
CREATE TABLE IF NOT EXISTS web_vitals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route TEXT NOT NULL,
  device TEXT NOT NULL,
  conn TEXT NOT NULL DEFAULT '',
  lcp_ms INTEGER,
  inp_ms INTEGER,
  cls_milli INTEGER,
  ttfb_ms INTEGER,
  created_at TEXT NOT NULL
);
-- One route over time.
CREATE INDEX IF NOT EXISTS idx_web_vitals_route ON web_vitals (route, created_at);
-- The summary window (created_at >= ?) and the 90-day sweep (created_at < ?).
CREATE INDEX IF NOT EXISTS idx_web_vitals_created ON web_vitals (created_at);
