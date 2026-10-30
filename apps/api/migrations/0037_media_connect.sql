-- Pictures, GIFs and videos on listings and lessons; photo links, conversations and
-- connecting inside events; and a rank-based mute for Community.
CREATE TABLE media_files (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  -- Base64, because D1 hands a BLOB back as a list of numbers.
  data TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_media_files_owner ON media_files(owner_id);

CREATE TABLE media_items (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  url TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  added_by TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_media_items_owner ON media_items(owner_id, owner_type, position);

-- One shared photo folder per event, set by the host after it.
CREATE TABLE event_photos (
  app TEXT NOT NULL,
  event_id TEXT NOT NULL,
  url TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  set_by TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (app, event_id)
);

-- The conversation inside an event: guests, the host and events staff.
CREATE TABLE event_messages (
  id TEXT PRIMARY KEY,
  app TEXT NOT NULL,
  event_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  removed_by TEXT
);
CREATE INDEX idx_event_messages_event ON event_messages(app, event_id, created_at);

-- A guest says yes to being listed for other guests to connect with.
CREATE TABLE event_networking (
  app TEXT NOT NULL,
  event_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (app, event_id, user_id)
);

-- A muted member cannot post or reply in Community until someone of a higher rank lifts it.
CREATE TABLE community_mutes (
  user_id TEXT PRIMARY KEY,
  muted_by TEXT NOT NULL,
  muter_rank TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
