-- Joining by invite (2026-11-10, the founder: "dont allow people to join the website without waitlist approval by admins or a secret invite
-- code that can only be used 1 per account ... and gets linked to the referrer affiliate"). See packages/shared/src/invites.ts and
-- apps/api/src/routes/invites.ts.

-- A code: made by an admin, a staff member or someone holding Inviter (or by an admin's yes on the waitlist), used once by one account.
CREATE TABLE invite_codes (
  id TEXT PRIMARY KEY,
  -- Ten characters with no look-alikes (INVITE_ALPHABET). A live key: never in the export, only that one exists.
  code TEXT NOT NULL UNIQUE,
  -- The maker; NULL when the admin key made it.
  created_by TEXT,
  -- A private label, for example who it is for. Only the maker and the admins see it; cleared when the maker's account goes.
  label TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  -- NULL never runs out.
  expires_at TEXT,
  revoked_at TEXT,
  revoked_by TEXT,
  -- The account that used it. Claimed by one guarded UPDATE before the account is made.
  used_by TEXT,
  used_at TEXT,
  -- The waitlist row an admin's yes made it for.
  waitlist_id TEXT,
  -- When the account that used it finished setup: the referral pays its maker then, once (claimed by a guarded UPDATE).
  setup_done_at TEXT
);
-- One code per account, in the database too: an account can never hold two.
CREATE UNIQUE INDEX idx_invite_codes_used_by ON invite_codes (used_by) WHERE used_by IS NOT NULL;
-- A maker's own codes by date (Profile's list, the open cap, the badge count), and every code by date (Admin's list).
CREATE INDEX idx_invite_codes_maker ON invite_codes (created_by, created_at);
CREATE INDEX idx_invite_codes_created ON invite_codes (created_at);

-- The waitlist: a name and an email; an admin says yes (which makes a code tied to the row and mails its link) or no.
CREATE TABLE waitlist (
  id TEXT PRIMARY KEY,
  -- Lower case. One row per address: asking again answers the same and changes nothing.
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'invited', 'joined', 'declined')),
  created_at TEXT NOT NULL,
  decided_at TEXT,
  -- The admin who decided; NULL once their account goes.
  decided_by TEXT,
  invite_id TEXT
);
-- Admin's list, waiting first by date, and the tidy-up of old rows by status (cron.ts tidyOld): each reads a range of one of these.
CREATE INDEX idx_waitlist_status ON waitlist (status, created_at);
CREATE INDEX idx_waitlist_decided ON waitlist (status, decided_at);

-- How joining works, read on every sign-up. One row: Invite only, on from the start.
CREATE TABLE signup_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO signup_settings (key, value, updated_at) VALUES ('invite_only', '1', '2026-11-10T00:00:00.000Z');

-- A connection the team made comes true once (the yes, or a direct link): that pays each side who is not an admin, once, and counts for the
-- Connected badges. Guarded `WHERE came_true_at IS NULL`, so two yeses at once pay once, and an erase of progress never pays it again.
ALTER TABLE team_connections ADD COLUMN came_true_at TEXT;
