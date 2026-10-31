-- How a finished focus session felt, one to five. A private note to yourself: it pays nothing and reaches no one.
ALTER TABLE focus_rounds ADD COLUMN quality INTEGER;

-- A private calendar link: one secret address a person can subscribe to from Google, Apple or Outlook Calendar to see their tasks
-- with a day (and a time, when it has one). Off until the person switches it on; a fresh link closes the old one. Owner only,
-- in the export, gone with the account. Journal, wellbeing and notes are never in it.
CREATE TABLE calendar_feeds (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
