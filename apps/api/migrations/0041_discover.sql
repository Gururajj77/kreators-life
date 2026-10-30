-- Discover: a self-discovery quiz. Answers are saved as the person goes (one draft) and each finished quiz keeps its answers and
-- its result, so a changed algorithm never rewrites an old result. Owner only: never shown to brands, staff, the leaderboard or a coach.
CREATE TABLE discover_drafts (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  answers_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE discover_results (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_discover_results_user ON discover_results(user_id, created_at);
