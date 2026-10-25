-- The not-to-do list on Daily: things to stay away from, each with its own streak.
-- One row per item per day: kept or slipped. A day with no row was missed.
CREATE TABLE not_to_do (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  relationship TEXT,
  streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_not_to_do_user ON not_to_do(user_id, created_at);
CREATE TABLE not_to_do_days (
  item_id TEXT NOT NULL REFERENCES not_to_do(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('kept', 'slipped')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (item_id, day)
);
CREATE INDEX idx_not_to_do_days_user_day ON not_to_do_days(user_id, day);
