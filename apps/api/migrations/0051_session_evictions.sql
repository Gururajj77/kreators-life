-- An account can be signed in on three devices at once. A fourth sign-in signs the oldest one out; its token is kept here for a while so that
-- device can be told why it was signed out, instead of just landing on the sign-in page.
CREATE TABLE session_evictions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_session_evictions_at ON session_evictions(created_at);
