-- A daily review (2026-11-07, the founder's daily report): a review can be for one day, the shortest period, walking the day's tasks.
-- SQLite cannot change a CHECK in place, so both review tables are made again with 'day' allowed, exactly as 0101 did for the year:
-- every row copied over as it was, and their indexes and the one-review-per-period rule rebuilt. Nothing refers to either table, so
-- dropping the old one is safe; defer_foreign_keys keeps D1 from checking the users reference half-way through. review_schedules has no
-- CHECK on its kind, so a daily review reminder needs nothing here.
PRAGMA defer_foreign_keys = true;

CREATE TABLE review_templates_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('day', 'week', 'month', 'quarter', 'half', 'year')),
  name TEXT NOT NULL,
  prompts_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO review_templates_new (id, user_id, kind, name, prompts_json, created_at, updated_at)
  SELECT id, user_id, kind, name, prompts_json, created_at, updated_at FROM review_templates;
DROP TABLE review_templates;
ALTER TABLE review_templates_new RENAME TO review_templates;
-- A person's templates for a kind: WHERE user_id = ? AND kind = ? (Reviews, the template count).
CREATE INDEX idx_review_templates_user ON review_templates(user_id, kind);

CREATE TABLE reviews_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('day', 'week', 'month', 'quarter', 'half', 'year')),
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
INSERT INTO reviews_new (id, user_id, kind, period_start, period_end, template_id, template_name, prompts_json, answers_json, rating, highlight, snapshot_json, created_at, updated_at)
  SELECT id, user_id, kind, period_start, period_end, template_id, template_name, prompts_json, answers_json, rating, highlight, snapshot_json, created_at, updated_at FROM reviews;
DROP TABLE reviews;
ALTER TABLE reviews_new RENAME TO reviews;
-- Past reviews newest first, and the calendar's written reviews: WHERE user_id = ? [ORDER BY period_start]. The daily reviews' own list
-- (WHERE user_id = ? AND kind = 'day' ORDER BY period_start DESC) reads the UNIQUE (user_id, kind, period_start) index.
CREATE INDEX idx_reviews_user ON reviews(user_id, period_start);

PRAGMA defer_foreign_keys = false;
