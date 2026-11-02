-- Agency lifecycle: the way a brand goes from a first enquiry to monthly delivery, the password on a client's link, the retainer
-- the client picks a length for, and the month that makes its own invoice and pieces. Owner only, in the export (never a password hash
-- or a session), gone with the client or the account.

-- Where the client is, from enquiry to monthly delivery (see AGENCY_STAGES in shared). A client made before this is already working with
-- the owner, so it starts at monthly delivery; a lead starts at the first stage.
ALTER TABLE agency_clients ADD COLUMN stage TEXT NOT NULL DEFAULT 'enquiry';
ALTER TABLE agency_clients ADD COLUMN stage_since TEXT;
UPDATE agency_clients SET stage = 'delivery' WHERE status != 'lead';
-- The days of the lifecycle the owner sets (strategy session, trial video due, pilot start and end) as JSON, and the checklist ticks.
ALTER TABLE agency_clients ADD COLUMN lifecycle_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE agency_clients ADD COLUMN ticks_json TEXT NOT NULL DEFAULT '{}';
-- Changes included for each piece, unless a retainer says otherwise. The Trial and pilot and Retainer agreements both say two rounds.
ALTER TABLE agency_clients ADD COLUMN revisions_per_piece INTEGER NOT NULL DEFAULT 2;
-- The password the owner set for this client's link. PBKDF2 like every password here; the hash and salt are never sent anywhere.
ALTER TABLE agency_clients ADD COLUMN portal_pass_hash TEXT;
ALTER TABLE agency_clients ADD COLUMN portal_pass_salt TEXT;
ALTER TABLE agency_clients ADD COLUMN portal_pass_set_at TEXT;
-- The last UTC day someone opened the link. A day, not a visit: nothing more is tracked.
ALTER TABLE agency_clients ADD COLUMN portal_last_opened_day TEXT;

-- What a client does at their link after unlocking it: a random token kept only as a hash, good for twelve hours, per client.
-- Deleted when the owner changes or clears the password, makes a fresh link or closes it; pruned by the cron.
CREATE TABLE portal_sessions (
  token_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES agency_clients(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_portal_sessions_client ON portal_sessions(client_id);
CREATE INDEX idx_portal_sessions_expiry ON portal_sessions(expires_at);

-- What happened on the way: stage moves, who made them, the password being set or cleared (never its value), retainer steps, cycles.
CREATE TABLE agency_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES agency_clients(id) ON DELETE CASCADE,
  actor TEXT NOT NULL,
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_agency_log_client ON agency_log(client_id, created_at);

-- A retainer: offered with some lengths, chosen by the client, confirmed by the owner (active), later ended. A renewal is a new row.
-- The month's fee is the client's retainer amount (or what the owner typed) less the discount of the length chosen, in whole cents.
CREATE TABLE agency_retainers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES agency_clients(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'offered',
  options_json TEXT NOT NULL DEFAULT '[]',
  months INTEGER,
  discount_bps INTEGER NOT NULL DEFAULT 0,
  fee_cents INTEGER NOT NULL DEFAULT 0,
  pieces_per_month INTEGER NOT NULL DEFAULT 0,
  revisions_per_piece INTEGER NOT NULL DEFAULT 2,
  start_day TEXT,
  auto_send INTEGER NOT NULL DEFAULT 1,
  chosen_at TEXT,
  confirmed_at TEXT,
  ended_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_agency_retainers_client ON agency_retainers(client_id, status);
CREATE INDEX idx_agency_retainers_active ON agency_retainers(status);

-- One row for each month a retainer made. UNIQUE (retainer_id, month) is what makes a month happen once, however often the cron runs.
CREATE TABLE agency_cycles (
  id TEXT PRIMARY KEY,
  retainer_id TEXT NOT NULL REFERENCES agency_retainers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES agency_clients(id) ON DELETE CASCADE,
  n INTEGER NOT NULL,
  month TEXT NOT NULL,
  day TEXT NOT NULL,
  pieces INTEGER NOT NULL DEFAULT 0,
  -- Null until the invoice is made; an empty string when there was nothing to invoice.
  invoice_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (retainer_id, month)
);
CREATE INDEX idx_agency_cycles_client ON agency_cycles(client_id, n);

-- A piece knows the month that made it, how many changes are included in it (empty: what its client says) and whether it is the trial video.
ALTER TABLE agency_items ADD COLUMN cycle_id TEXT;
ALTER TABLE agency_items ADD COLUMN cycle_n INTEGER;
ALTER TABLE agency_items ADD COLUMN revisions_allowed INTEGER;
ALTER TABLE agency_items ADD COLUMN trial INTEGER NOT NULL DEFAULT 0;
-- A line in a piece's thread says what it is: a note, a comment, a change asked for, or a paid change asked for.
ALTER TABLE agency_notes ADD COLUMN kind TEXT NOT NULL DEFAULT 'note';
-- An invoice made by a month remembers it, so a month is invoiced once.
ALTER TABLE invoices ADD COLUMN agency_cycle_id TEXT;
