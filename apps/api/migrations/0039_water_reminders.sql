-- Water intake and the person's own reminders, for Daily and Journal. Owner-only, never shown to anyone else.
CREATE TABLE reminder_prefs (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  water_on INTEGER NOT NULL DEFAULT 1,
  water_goal_ml INTEGER NOT NULL DEFAULT 2000,
  water_glass_ml INTEGER NOT NULL DEFAULT 250,
  water_every_min INTEGER NOT NULL DEFAULT 120,
  water_from TEXT NOT NULL DEFAULT '09:00',
  water_to TEXT NOT NULL DEFAULT '21:00',
  last_water_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE water_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  ml INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_water_logs_user_day ON water_logs(user_id, day);

CREATE TABLE custom_reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  time TEXT NOT NULL,
  -- ISO weekdays, 1 = Monday to 7 = Sunday, as JSON.
  days_json TEXT NOT NULL DEFAULT '[1,2,3,4,5,6,7]',
  enabled INTEGER NOT NULL DEFAULT 1,
  last_sent_day TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_custom_reminders_user ON custom_reminders(user_id);
