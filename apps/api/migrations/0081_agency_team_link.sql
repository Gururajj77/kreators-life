-- The team link (2026-11-04): a second link per client, for the client's own team (a junior). It is the client page without the paper:
-- no invoice, agreement, document, retainer, onboarding, billing, hours or money, whatever is switched on (TEAM_LINK_NEVER in shared).
-- It has its own token, switches, password and sessions, so renewing or closing the client link, or changing its password, leaves the
-- team link as it is, and the other way round. Owner-scoped like the client link: the settings are in the export (never the hash, the
-- salt or a session), and everything goes with the client and with the account.
ALTER TABLE agency_clients ADD COLUMN team_link_token TEXT;
ALTER TABLE agency_clients ADD COLUMN team_link_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE agency_clients ADD COLUMN team_link_pass_hash TEXT;
ALTER TABLE agency_clients ADD COLUMN team_link_pass_salt TEXT;
ALTER TABLE agency_clients ADD COLUMN team_link_pass_set_at TEXT;
ALTER TABLE agency_clients ADD COLUMN team_link_opened_day TEXT;
-- Every team link page and unlock looks the client up by this token; unique so two clients can never share one (a column added by
-- ALTER cannot carry UNIQUE, so the index does it). Partial, because a switched-off link has no token.
CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_clients_team_link_token ON agency_clients(team_link_token) WHERE team_link_token IS NOT NULL;

-- What the team link's password opens: a random token kept only as a SHA-256 hash, twelve hours, per client. Its own table, so a team
-- session is never a portal session: it can never open the client link, an agreement, an invoice or a document. Deleted when the owner
-- changes or clears the team link's password, makes a fresh team link or closes it; pruned by the cron; never in the export.
CREATE TABLE IF NOT EXISTS team_link_sessions (
  token_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES agency_clients(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
-- The unlock check and the owner's "end every session" look sessions up by client.
CREATE INDEX IF NOT EXISTS idx_team_link_sessions_client ON team_link_sessions(client_id);
-- The cron prunes sessions past their twelve hours by this.
CREATE INDEX IF NOT EXISTS idx_team_link_sessions_expiry ON team_link_sessions(expires_at);

-- An ask for a new password names its link: 'client' (the client link and its documents, as before) or 'team' (the team link). One open
-- ask per client and link, so an ask from their team never hides or closes an ask from the client, and the other way round.
ALTER TABLE agency_password_requests ADD COLUMN link TEXT NOT NULL DEFAULT 'client';
DROP INDEX IF EXISTS idx_agency_password_requests_open;
CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_password_requests_open ON agency_password_requests(client_id, link) WHERE closed_at IS NULL;

-- A note written at the team link is a client note (author 'client') marked as from the client's team, so the owner and the client see
-- who wrote it. Nothing reads by it, so no index.
ALTER TABLE agency_notes ADD COLUMN via_team_link INTEGER NOT NULL DEFAULT 0;
