-- Creator commerce: more product types, attribution, Auto-DM, funnels, sequences, refunds, certificates.
ALTER TABLE users ADD COLUMN fee_bps INTEGER NOT NULL DEFAULT 500;

ALTER TABLE products ADD COLUMN pwyw INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN intake_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE products ADD COLUMN replay_url TEXT;
ALTER TABLE products ADD COLUMN replay_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN bundle_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE products ADD COLUMN locked_body TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN response_days INTEGER;
ALTER TABLE products ADD COLUMN lead_magnet INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN certificate INTEGER NOT NULL DEFAULT 0;

ALTER TABLE lessons ADD COLUMN quiz_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE lessons ADD COLUMN pass_score INTEGER NOT NULL DEFAULT 0;

CREATE TABLE quiz_attempts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  passed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE certificates (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  issued_at TEXT NOT NULL,
  UNIQUE (user_id, product_id)
);

ALTER TABLE orders ADD COLUMN source_link_id TEXT;
ALTER TABLE orders ADD COLUMN click_id TEXT;
ALTER TABLE orders ADD COLUMN platform_fee_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN intake_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE orders ADD COLUMN variant TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN refunded_at TEXT;
ALTER TABLE orders ADD COLUMN refund_reason TEXT NOT NULL DEFAULT '';
CREATE INDEX idx_orders_source ON orders(source_link_id);

ALTER TABLE bookings ADD COLUMN intake_json TEXT NOT NULL DEFAULT '[]';
-- Two people can never hold the same slot with the same creator.
CREATE UNIQUE INDEX uniq_active_booking ON bookings(owner_id, starts_at) WHERE status IN ('requested', 'confirmed');

CREATE TABLE dm_requests (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  due_at TEXT NOT NULL,
  answered_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_dm_requests_owner ON dm_requests(owner_id, status);

CREATE TABLE content_items (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'other',
  external_id TEXT,
  kind TEXT NOT NULL DEFAULT 'post',
  url TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT,
  posted_at TEXT,
  views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  synced_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (owner_id, url)
);

CREATE TABLE tracked_links (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL DEFAULT 'other',
  content_item_id TEXT REFERENCES content_items(id) ON DELETE SET NULL,
  automation_id TEXT,
  label TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_links_owner ON tracked_links(owner_id, created_at);

CREATE TABLE link_clicks (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL REFERENCES tracked_links(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT,
  referrer TEXT,
  country TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_clicks_link ON link_clicks(link_id, created_at);

CREATE TABLE dm_automations (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_item_id TEXT REFERENCES content_items(id) ON DELETE SET NULL,
  keywords_json TEXT NOT NULL DEFAULT '[]',
  dm_message TEXT NOT NULL,
  public_replies_json TEXT NOT NULL DEFAULT '[]',
  link_id TEXT NOT NULL REFERENCES tracked_links(id) ON DELETE CASCADE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE dm_sends (
  id TEXT PRIMARY KEY,
  automation_id TEXT NOT NULL REFERENCES dm_automations(id) ON DELETE CASCADE,
  external_comment_id TEXT NOT NULL UNIQUE,
  recipient_external_id TEXT NOT NULL,
  recipient_handle TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued',
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE (automation_id, recipient_external_id)
);

CREATE TABLE funnels (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  steps_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE sequences (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  delay_days INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE sequence_sends (
  sequence_id TEXT NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (sequence_id, order_id)
);

CREATE TABLE webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  processed_at TEXT,
  error TEXT,
  received_at TEXT NOT NULL
);
