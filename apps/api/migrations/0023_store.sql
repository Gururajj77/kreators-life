-- The Store: new gear that staff add and people buy through partner links, pre-owned gear other
-- creators sell with offers and a chat, kits by budget, and featured spots at the top.
CREATE TABLE store_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other',
  description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  url TEXT NOT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT 'any',
  featured_until TEXT,
  status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'hidden')),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE store_kits (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT 'any',
  budget_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  items_json TEXT NOT NULL DEFAULT '[]',
  featured_until TEXT,
  status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'hidden')),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE preowned_listings (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other',
  description TEXT NOT NULL DEFAULT '',
  condition TEXT NOT NULL CHECK (condition IN ('new', 'lightly_used', 'regularly_used', 'well_used')),
  price_cents INTEGER NOT NULL,
  original_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'INR',
  purchase_year INTEGER,
  includes TEXT NOT NULL DEFAULT '',
  images_json TEXT NOT NULL DEFAULT '[]',
  is_kit INTEGER NOT NULL DEFAULT 0,
  city TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'agreed', 'sold', 'withdrawn')),
  sold_cents INTEGER,
  buyer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  featured_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_preowned_status ON preowned_listings(status, created_at);
CREATE INDEX idx_preowned_seller ON preowned_listings(seller_id, created_at);
CREATE TABLE preowned_offers (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES preowned_listings(id) ON DELETE CASCADE,
  buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cents INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'declined', 'withdrawn')),
  created_at TEXT NOT NULL,
  decided_at TEXT
);
CREATE INDEX idx_offers_listing ON preowned_offers(listing_id, created_at);
CREATE INDEX idx_offers_buyer ON preowned_offers(buyer_id, created_at);
CREATE TABLE preowned_messages (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES preowned_listings(id) ON DELETE CASCADE,
  buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_pm_thread ON preowned_messages(listing_id, buyer_id, created_at);
-- Taps on partner links. Never a raw address: a salted hash, like /go.
CREATE TABLE outbound_clicks (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  target_id TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_outbound ON outbound_clicks(kind, target_id, created_at);
ALTER TABLE tools ADD COLUMN featured_until TEXT;
