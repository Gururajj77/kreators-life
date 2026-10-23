ALTER TABLE users ADD COLUMN points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN is_pro INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN leaderboard_opt_in INTEGER NOT NULL DEFAULT 1;

CREATE TABLE honors (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  honor_key TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  awarded_at TEXT NOT NULL,
  PRIMARY KEY (user_id, honor_key)
);

CREATE TABLE points_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_points_user ON points_ledger(user_id);

CREATE TABLE redemptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_key TEXT NOT NULL,
  points INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'reserved',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_redemptions_user ON redemptions(user_id);
CREATE INDEX idx_redemptions_status ON redemptions(status);

CREATE INDEX idx_users_xp ON users(xp DESC);
