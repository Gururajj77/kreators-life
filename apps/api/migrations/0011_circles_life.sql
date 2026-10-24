-- Interests and place for matching; Circles: anonymous small groups with a chat that opens a day before.
ALTER TABLE users ADD COLUMN interests TEXT NOT NULL DEFAULT '[]';
ALTER TABLE users ADD COLUMN city TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN area TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN lat REAL;
ALTER TABLE users ADD COLUMN lng REAL;

CREATE TABLE circle_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  city TEXT NOT NULL,
  area TEXT NOT NULL DEFAULT '',
  starts_at TEXT NOT NULL,
  venue_hint TEXT NOT NULL DEFAULT '',
  group_size INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'open',
  created_by TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_circle_events_city ON circle_events(city, starts_at);

CREATE TABLE circle_signups (
  event_id TEXT NOT NULL REFERENCES circle_events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE circle_groups (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES circle_events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  venue TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT '',
  chat_opens_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE circle_members (
  group_id TEXT NOT NULL REFERENCES circle_groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  character TEXT NOT NULL,
  revealed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX idx_circle_members_user ON circle_members(user_id);

CREATE TABLE circle_messages (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES circle_groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_circle_messages_group ON circle_messages(group_id, created_at);
