-- The strategy session: onboarding as an assessment, a placement per relationship, a routine ramped from the
-- person's real day, a signed contract, and one row per day for the morning routine.
CREATE TABLE IF NOT EXISTS assessments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  fears_json TEXT NOT NULL DEFAULT '[]',
  insecurities_json TEXT NOT NULL DEFAULT '[]',
  scores_json TEXT NOT NULL DEFAULT '{}',
  real_day_json TEXT NOT NULL DEFAULT '{}',
  focus_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS assessments_user ON assessments (user_id, created_at);

CREATE TABLE IF NOT EXISTS placements (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  relationship TEXT NOT NULL,
  core_level INTEGER NOT NULL,
  floor_level INTEGER NOT NULL,
  core_band TEXT NOT NULL,
  floor_band TEXT NOT NULL,
  evidence TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE (assessment_id, relationship)
);

CREATE TABLE IF NOT EXISTS routines (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  ramp_step INTEGER NOT NULL DEFAULT 0,
  general_json TEXT NOT NULL,
  exceptional_json TEXT NOT NULL,
  practices_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS routines_user ON routines (user_id, created_at);

CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  min_days INTEGER NOT NULL DEFAULT 5,
  checkin_time TEXT NOT NULL DEFAULT '21:00',
  penalty TEXT NOT NULL DEFAULT 'streak',
  next_weekly TEXT NOT NULL,
  next_monthly TEXT NOT NULL,
  signed_name TEXT NOT NULL,
  signed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS contracts_user ON contracts (user_id, signed_at);

CREATE TABLE IF NOT EXISTS routine_days (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  day_type TEXT NOT NULL DEFAULT 'general',
  steps_json TEXT NOT NULL DEFAULT '[]',
  done INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, day)
);
