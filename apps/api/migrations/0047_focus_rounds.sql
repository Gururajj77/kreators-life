-- Finished focus rounds from Mindful minutes: when, how long, and which task (kept as its title, so the history survives the task being
-- deleted). Owner only, in the export, gone with the account. Used for the productivity dashboard.
CREATE TABLE focus_rounds (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  node_id TEXT,
  title TEXT NOT NULL DEFAULT '',
  minutes INTEGER NOT NULL,
  day TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_focus_rounds_user_day ON focus_rounds(user_id, day);
