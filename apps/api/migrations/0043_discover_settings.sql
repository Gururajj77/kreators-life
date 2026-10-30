-- What the person lets Discover do with their result. Next steps (rules only, no model) are on by default; the assistant is off
-- until they say yes, and even then only a model that keeps nothing reads it.
CREATE TABLE discover_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  steps INTEGER NOT NULL DEFAULT 1,
  assistant INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
