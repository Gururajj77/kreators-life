-- Supplements in Fitness (2026-11-07): the person's own list, off until they switch on Track supplements, and their daily ticks.
-- Owner only, like the trackers. The app never suggests one, gives an amount or checks a mix: a name, a kind, an amount as typed,
-- when, the days, its place and whether it is paused. In the export, gone with the account, kept through an erase of progress.

-- The Fitness switches: Track supplements (the consent), Show on Daily, and a reminder time for each part of the day that has one.
CREATE TABLE IF NOT EXISTS fitness_prefs (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  supplements_on INTEGER NOT NULL DEFAULT 0,
  supplements_daily INTEGER NOT NULL DEFAULT 0,
  -- {"morning": "08:00", ...}: HH:MM in the person's zone; a part with no time sends nothing.
  remind_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS supplements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount TEXT NOT NULL DEFAULT '',
  time_of_day TEXT NOT NULL,
  -- Weekdays, 1 for Monday to 7 for Sunday.
  days_json TEXT NOT NULL DEFAULT '[1,2,3,4,5,6,7]',
  position INTEGER NOT NULL DEFAULT 0,
  paused_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
-- The list is always read by its owner in order (Fitness, Daily, the reminder cron).
CREATE INDEX IF NOT EXISTS idx_supplements_user ON supplements(user_id, position);

-- One row a day a supplement was taken; no row means not marked (there is no skipped). Two taps make one row.
CREATE TABLE IF NOT EXISTS supplement_days (
  supplement_id TEXT NOT NULL REFERENCES supplements(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  taken_at TEXT NOT NULL,
  UNIQUE (supplement_id, day)
);
-- Daily, Fitness's last seven days and the cron read one person's ticks by day.
CREATE INDEX IF NOT EXISTS idx_supplement_days_user_day ON supplement_days(user_id, day);
