-- 0062: chat channels in Community (public, made by guides) and Bond (private, made by a member for friends).
--
-- Polled, not live: a screen asks for the lines after the last `seq` it holds. Nothing here is a transport.
-- No foreign keys on people: a deleted account keeps its row anonymised, and account.ts removes the person's lines and seats by hand.

CREATE TABLE channels (
  id TEXT PRIMARY KEY,
  -- 'community' (public, guides make them) or 'bond' (private, friends only).
  scope TEXT NOT NULL CHECK (scope IN ('community', 'bond')),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'public' CHECK (kind IN ('public', 'private')),
  created_by TEXT NOT NULL,
  archived_at TEXT,
  created_at TEXT NOT NULL
);
-- One slug per scope. Also answers "is this name taken" on create and the list of a scope.
CREATE UNIQUE INDEX idx_channels_scope_slug ON channels (scope, slug);
-- "The private channels this person owns" (the owned-channels cap) and the guide's own list.
CREATE INDEX idx_channels_owner ON channels (created_by, scope) WHERE archived_at IS NULL;

CREATE TABLE channel_members (
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'mod')),
  -- 'member' is in; 'invited' is a private channel's invitation waiting for a yes.
  status TEXT NOT NULL DEFAULT 'member' CHECK (status IN ('member', 'invited')),
  -- Lines after this are unread. Set to the last line seen when the channel is open and showing.
  last_read_at TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (channel_id, user_id)
);
-- "Which channels am I in, and which have I been asked to join": the list screen and the joined-channels cap.
CREATE INDEX idx_channel_members_user ON channel_members (user_id, status);

CREATE TABLE channel_messages (
  -- `seq` is the cursor: it only goes up, so "lines after 120" never misses two written in the same millisecond.
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  anonymous INTEGER NOT NULL DEFAULT 0,
  reply_to TEXT,
  created_at TEXT NOT NULL,
  -- A taken-down line keeps its place but loses its words.
  deleted_at TEXT,
  deleted_by TEXT
);
-- The poll and "load earlier": WHERE channel_id = ? AND seq > ? (or < ?) ORDER BY seq.
CREATE INDEX idx_channel_messages_channel ON channel_messages (channel_id, seq);
-- The unread count on the list: WHERE channel_id = ? AND created_at > last_read_at.
CREATE INDEX idx_channel_messages_time ON channel_messages (channel_id, created_at);
-- The daily tidy-up of old lines, and the export and erase of one person's lines.
CREATE INDEX idx_channel_messages_created ON channel_messages (created_at);
CREATE INDEX idx_channel_messages_user ON channel_messages (user_id);
