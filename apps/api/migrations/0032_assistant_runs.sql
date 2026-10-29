-- The Stop button. Each typed message is a run with an id the browser makes; Stop marks it stopped, and the
-- assistant looks before each model call and before running any tool, so nothing is changed after the mark is seen.
-- A row lives only while its message runs (and a day at most); it holds no words, only the id, the owner and times.
CREATE TABLE IF NOT EXISTS assistant_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  stopped_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS assistant_runs_created ON assistant_runs (created_at);
