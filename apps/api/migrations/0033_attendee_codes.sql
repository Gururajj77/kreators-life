-- Attendee codes: the host of an event sets, before it starts, how much xp it gives (up to a cap in shared), and a
-- code they show on the day. Only the event's own guests can claim it, once each, around the event's time, and never
-- the host. Party events and circles keep their code here; a run already has its start code, so it only gains the xp.
CREATE TABLE IF NOT EXISTS attendee_codes (
  app TEXT NOT NULL,
  thing_id TEXT NOT NULL,
  code TEXT NOT NULL,
  xp INTEGER NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (app, thing_id)
);

-- One claim per person per event. Kept through an erase (a reset of progress), so a code cannot be claimed twice by
-- starting over; it goes when the account is deleted.
CREATE TABLE IF NOT EXISTS attendee_claims (
  app TEXT NOT NULL,
  thing_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  xp INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (app, thing_id, user_id)
);
CREATE INDEX IF NOT EXISTS attendee_claims_user ON attendee_claims (user_id, created_at);

-- A run's xp is the host's call now, before it starts, up to the same cap. Today's runs keep the old fixed 20.
ALTER TABLE runs ADD COLUMN xp INTEGER NOT NULL DEFAULT 20;
