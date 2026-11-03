-- A client link that was renewed or closed. The old link then answers 410 "this link was closed, contact <agency>" instead of
-- a bare 404, so a client who opens an old email knows to ask for the new one. Only a SHA-256 hash of the old token is kept (never
-- the token), with the client and the owner it belonged to, so the closed page can name the business and its email
-- (agencyFace) and nothing else. Owner-scoped: deleted with the client and with the account; the cron drops rows after a year.
CREATE TABLE IF NOT EXISTS retired_portal_links (
  token_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  retired_at TEXT NOT NULL
);
-- The account erase and the client delete look rows up by owner and by client; the cron by age.
CREATE INDEX IF NOT EXISTS idx_retired_portal_links_user ON retired_portal_links(user_id);
CREATE INDEX IF NOT EXISTS idx_retired_portal_links_client ON retired_portal_links(client_id);
CREATE INDEX IF NOT EXISTS idx_retired_portal_links_at ON retired_portal_links(retired_at);
