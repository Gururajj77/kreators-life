CREATE TABLE users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '',
  creator_type TEXT NOT NULL DEFAULT '',
  xp INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  last_checkin TEXT,
  onboarded_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE relationship_scores (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, relationship)
);

CREATE TABLE onboarding_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  relationship TEXT NOT NULL,
  value INTEGER NOT NULL,
  points INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_answers_user ON onboarding_answers(user_id);

CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  parent_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL,
  title TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  xp INTEGER NOT NULL DEFAULT 0,
  due_date TEXT,
  completed_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_nodes_user_rel ON nodes(user_id, relationship);
CREATE INDEX idx_nodes_user_kind ON nodes(user_id, kind, status);
CREATE INDEX idx_nodes_parent ON nodes(parent_id);

CREATE TABLE xp_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relationship TEXT,
  source TEXT NOT NULL,
  source_id TEXT,
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_xp_user ON xp_events(user_id);

CREATE TABLE spark_completions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  relationship TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, date)
);
