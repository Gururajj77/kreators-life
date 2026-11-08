-- 0118: the Leaderboard's overview, its filter counts and its two heavy sorts, kept for a few hours (routes/leaderboard.ts). Worked out on each open, they visited about eight rows for every
-- opted-in person on every open, or about 47,000 at a thousand people, against the free plan's 5 million rows a day. Holds ids and numbers, never a name, and is emptied when an account is deleted.
CREATE TABLE IF NOT EXISTS board_cache (
  key TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  at TEXT NOT NULL
);
