-- Magic links: a one-time token per email, stored hashed, good for fifteen minutes.
CREATE TABLE login_tokens (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  -- the anonymous account on the device that asked, so progress comes along
  device_user_id TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE INDEX idx_login_tokens_email ON login_tokens(email, created_at);
-- Set the first time an email proves itself through a link.
ALTER TABLE users ADD COLUMN email_verified_at TEXT;
