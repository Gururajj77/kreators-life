-- Badges earned are written down the first time they are seen, so a badge once earned is never taken back (a deleted post or a ended club
-- does not undo it) and the gallery can say when it was earned. earned_at is empty for a badge held before dates were kept. Owner only.
CREATE TABLE IF NOT EXISTS badge_awards (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_key TEXT NOT NULL,
  earned_at TEXT,
  PRIMARY KEY (user_id, badge_key)
);
-- The referral badge counts the people who signed up with someone's code; without this it would scan every account.
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users (referred_by) WHERE referred_by IS NOT NULL;
