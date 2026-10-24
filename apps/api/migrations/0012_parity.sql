-- Playbook parity: zones and overrides for bookings, booking settings, membership periods, a payment provider,
-- KYC, an email outbox, an event timeline, product analytics and rate limits.
ALTER TABLE users ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';
ALTER TABLE users ADD COLUMN avatar_url TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN socials_json TEXT NOT NULL DEFAULT '{}';

CREATE TABLE availability_overrides (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  ranges_json TEXT NOT NULL DEFAULT '[]',
  UNIQUE (owner_id, date)
);

ALTER TABLE products ADD COLUMN buffer_min INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN notice_hours INTEGER NOT NULL DEFAULT 2;
ALTER TABLE products ADD COLUMN max_days_ahead INTEGER NOT NULL DEFAULT 30;
ALTER TABLE products ADD COLUMN period_months INTEGER;

ALTER TABLE orders ADD COLUMN expires_at TEXT;
ALTER TABLE orders ADD COLUMN provider TEXT NOT NULL DEFAULT 'points';
ALTER TABLE orders ADD COLUMN provider_order_id TEXT;
ALTER TABLE orders ADD COLUMN provider_payment_id TEXT;
ALTER TABLE orders ADD COLUMN paid_at TEXT;
CREATE INDEX idx_orders_provider ON orders(provider_order_id);

CREATE TABLE kyc_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'none',
  legal_name TEXT NOT NULL DEFAULT '',
  pan_last4 TEXT NOT NULL DEFAULT '',
  pan_hash TEXT NOT NULL DEFAULT '',
  bank_last4 TEXT NOT NULL DEFAULT '',
  ifsc TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  submitted_at TEXT,
  decided_at TEXT,
  decided_by TEXT
);

CREATE TABLE email_outbox (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  sent_at TEXT
);

CREATE TABLE timeline_events (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  type TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_timeline_entity ON timeline_events(entity, entity_id, created_at);

CREATE TABLE analytics_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,
  props_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_analytics_name ON analytics_events(name, created_at);
CREATE INDEX idx_analytics_user ON analytics_events(user_id, name);

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);
