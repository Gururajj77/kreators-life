-- Engagement, learned from Circle and Wylo: reactions, following a post, mentions, pinned and held posts, inbox
-- tabs with an archive, reminders before events, monthly leaderboard seasons, and the first-week checklist.

-- Six reactions instead of one like. Any reaction is the like that pays, once per post, as before.
ALTER TABLE community_likes ADD COLUMN kind TEXT NOT NULL DEFAULT 'like';
CREATE TABLE IF NOT EXISTS community_reply_reactions (
  reply_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (reply_id, user_id)
);

-- Following a post: its author and everyone who replies follow it, and anyone can follow or stop following it.
CREATE TABLE IF NOT EXISTS community_post_follows (
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS community_post_follows_user ON community_post_follows (user_id);

-- Guides pin up to three posts to the top of a category, and can hold a new member's first post until they say okay.
ALTER TABLE community_posts ADD COLUMN pinned_at TEXT;
ALTER TABLE community_posts ADD COLUMN pinned_by TEXT;
ALTER TABLE community_posts ADD COLUMN held_at TEXT;
CREATE TABLE IF NOT EXISTS community_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL
);

-- The inbox keeps an archive, so a note can be put away without being lost.
ALTER TABLE notifications ADD COLUMN archived_at TEXT;
CREATE INDEX IF NOT EXISTS notifications_user_kind ON notifications (user_id, kind, created_at);

-- Reminders before an event someone signed up for: a day before and an hour before, each once.
CREATE TABLE IF NOT EXISTS event_reminders (
  app TEXT NOT NULL,
  thing_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (app, thing_id, user_id, kind)
);

-- Monthly leaderboard seasons: a season is closed once, and its top three are kept.
CREATE TABLE IF NOT EXISTS seasons (
  season TEXT PRIMARY KEY,
  closed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS season_results (
  season TEXT NOT NULL,
  place INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  xp INTEGER NOT NULL,
  PRIMARY KEY (season, place)
);

-- The first-week checklist on Home can be folded away for good.
ALTER TABLE users ADD COLUMN getting_started_hidden_at TEXT;
