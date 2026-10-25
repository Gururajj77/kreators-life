-- Reviews: one per person per period (a week, a month, a quarter or half a year), with the
-- prompts and numbers copied in at save time, plus the templates a person adds on top of the built-in ones.
CREATE TABLE review_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('week', 'month', 'quarter', 'half')),
  name TEXT NOT NULL,
  prompts_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_review_templates_user ON review_templates(user_id, kind);
CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('week', 'month', 'quarter', 'half')),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  template_id TEXT,
  template_name TEXT NOT NULL DEFAULT '',
  prompts_json TEXT NOT NULL DEFAULT '[]',
  answers_json TEXT NOT NULL DEFAULT '[]',
  rating INTEGER,
  highlight TEXT NOT NULL DEFAULT '',
  snapshot_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, kind, period_start)
);
CREATE INDEX idx_reviews_user ON reviews(user_id, period_start);
