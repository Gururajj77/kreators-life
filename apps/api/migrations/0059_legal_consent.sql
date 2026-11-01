-- Legal records: which version of the terms and privacy policy a person accepted, what they chose about cookies, embedded video and
-- marketing, a log of data requests (no names), and copyright notices people send in.

-- Append-only: a new row each time a person accepts a version. Nothing here is ever updated.
CREATE TABLE terms_acceptances (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc TEXT NOT NULL,
  version TEXT NOT NULL,
  -- sign-up (the box next to the button), notice (the one-time notice for people who had an account already)
  how TEXT NOT NULL,
  accepted_at TEXT NOT NULL
);
CREATE INDEX idx_terms_acceptances_user ON terms_acceptances(user_id, doc, accepted_at);

-- What a person chose, per purpose: one row each, changed from Profile whenever they like.
CREATE TABLE user_consents (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  granted INTEGER NOT NULL,
  banner_version INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, purpose)
);

-- Append-only log of every choice, with the wording version and the place it was made, so a choice can be shown later.
CREATE TABLE consent_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  granted INTEGER NOT NULL,
  -- popup, profile, unsubscribe
  source TEXT NOT NULL,
  banner_version INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_consent_records_user ON consent_records(user_id, created_at);

-- When someone asks for their data or for the account to go, and when it was done. No names: the account is gone by then.
CREATE TABLE data_requests (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  completed_at TEXT,
  outcome TEXT NOT NULL DEFAULT ''
);

-- Copyright notices sent through the public form. The person who sent it signs it; staff act on it and the row keeps what was done.
CREATE TABLE copyright_notices (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'notice',
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  work TEXT NOT NULL,
  urls TEXT NOT NULL,
  statement TEXT NOT NULL DEFAULT '',
  signature TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE INDEX idx_copyright_notices_status ON copyright_notices(status, created_at);
