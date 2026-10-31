-- Discover add-ons: a 16-type self-check, love languages (given and received) and how your mind works. Each kind keeps the latest answers
-- (or a draft saved as the person goes) and its result. Owner only, like the journal: never shown to brands, staff, the leaderboard or a coach.
CREATE TABLE discover_extras (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  draft_json TEXT,
  answers_json TEXT,
  result_json TEXT,
  taken_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, kind)
);
-- "How your mind works" is the most personal of them, so it has its own switch for the assistant and next steps, off until the person says.
ALTER TABLE discover_settings ADD COLUMN mind INTEGER NOT NULL DEFAULT 0;
