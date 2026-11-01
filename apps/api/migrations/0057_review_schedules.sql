-- Reviews on a calendar: a person picks a day and a time for a review, may repeat it the way a task repeats, and gets a reminder in the
-- inbox. `next_on` is the next day the reminder falls on, so the cron only looks at the few that are due. Owner only, in the export,
-- gone with the account.
CREATE TABLE review_schedules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  anchor TEXT NOT NULL,
  time TEXT NOT NULL DEFAULT '09:00',
  repeat_json TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  next_on TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_review_schedules_user ON review_schedules(user_id);
CREATE INDEX idx_review_schedules_due ON review_schedules(enabled, next_on);

-- A task can be brought to the review for its period: the review lists it, and a tap puts it into an answer. A flag, like Remember.
ALTER TABLE nodes ADD COLUMN for_review INTEGER NOT NULL DEFAULT 0;
