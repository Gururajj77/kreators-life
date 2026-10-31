-- Badges a super admin gives by hand, on top of the ones the app counts. They show on the person's profile, count toward unlocks and the
-- leaderboard, and every grant is audited.
CREATE TABLE badge_grants (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_key TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  awarded_at TEXT NOT NULL,
  PRIMARY KEY (user_id, badge_key)
);
