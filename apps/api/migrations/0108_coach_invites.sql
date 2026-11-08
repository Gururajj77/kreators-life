-- A life coach's invite link (2026-11-07, the founder: "adding a student should be effortless"). One live link per coach, shown only to
-- that coach; a renewed or closed one is kept only as a SHA-256 hash, so opening it later says it was closed instead of "no page"
-- (the same way as retired_portal_links; the cron drops those rows after a year). Both go with the account.
CREATE TABLE IF NOT EXISTS coach_invites (
  coach_id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS retired_coach_invites (
  token_hash TEXT PRIMARY KEY,
  coach_id TEXT NOT NULL,
  retired_at TEXT NOT NULL
);
-- The account delete looks rows up by coach, the cron by age.
CREATE INDEX IF NOT EXISTS idx_retired_coach_invites_coach ON retired_coach_invites(coach_id);
CREATE INDEX IF NOT EXISTS idx_retired_coach_invites_at ON retired_coach_invites(retired_at);

-- What a person keeps on their own Coaching pages: each section shown open, shown closed or hidden (`sections_json`, read through
-- parseCoachSections, the same for every student), and when a new coach read how sharing works (the first-steps list). Owner only,
-- in the export, gone with the account.
CREATE TABLE IF NOT EXISTS coach_prefs (
  user_id TEXT PRIMARY KEY,
  sections_json TEXT NOT NULL DEFAULT '{}',
  read_sharing_at TEXT,
  updated_at TEXT NOT NULL
);

-- When the coach last asked this student to turn Patterns on: at most once a week per link (guarded on this column).
ALTER TABLE coach_links ADD COLUMN patterns_asked_at TEXT;
