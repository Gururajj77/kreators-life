-- Client onboarding (2026-11-03): the owner adds a client with a name, an email and a password for their link; the client opens
-- it, unlocks it and fills in a short form once (company, who to talk to, the trial brief). The form is saved as they go in
-- onboarding_json (`parseOnboarding` in shared is the one reader) and sent once (onboarded_at, set by a guarded UPDATE ... WHERE
-- onboarded_at IS NULL, so two taps send it once). Only a client added from now on is asked (onboarding_needed = 1); a client
-- already being worked with stays 0, so nobody who is already working is locked out of their page.
ALTER TABLE agency_clients ADD COLUMN onboarding_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE agency_clients ADD COLUMN onboarded_at TEXT;
ALTER TABLE agency_clients ADD COLUMN onboarding_needed INTEGER NOT NULL DEFAULT 0;

-- A client asks for a new password from the lock screen ("I think it was shared"). The owner is told and sets a new one; the app
-- never sends a password. One open ask per client (the partial unique index below), closed when the owner sets a new password or
-- dismisses it. The reason is the client's own short words, kept only here and shown only on the owner's client page (never in
-- agency_log or the app log). Owner-scoped: in the export, deleted with the client and with the account; closed rows go after
-- RETENTION_DAYS.passwordRequests (the cron's tidyOld).
CREATE TABLE IF NOT EXISTS agency_password_requests (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  closed_at TEXT
);
-- One open ask per client: a second ask while one is open is an INSERT OR IGNORE that changes nothing, so it tells the owner once.
CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_password_requests_open ON agency_password_requests(client_id) WHERE closed_at IS NULL;
-- The export and the account delete look rows up by owner.
CREATE INDEX IF NOT EXISTS idx_agency_password_requests_user ON agency_password_requests(user_id);
