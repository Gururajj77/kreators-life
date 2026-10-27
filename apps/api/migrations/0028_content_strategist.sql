-- Content becomes a strategist: one folder per brand, with its sources, research runs and the pieces written from them.
CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  niche TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  voice TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS brands_owner ON brands (owner_id, updated_at);

CREATE TABLE IF NOT EXISTS brand_sources (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  url TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  meta_json TEXT NOT NULL DEFAULT '{}',
  last_read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS brand_sources_brand ON brand_sources (brand_id, created_at);

CREATE TABLE IF NOT EXISTS research_runs (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  query TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  backend TEXT NOT NULL DEFAULT '',
  items_json TEXT NOT NULL DEFAULT '[]',
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE INDEX IF NOT EXISTS research_runs_brand ON research_runs (brand_id, created_at);

CREATE TABLE IF NOT EXISTS brand_pieces (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  brief TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  sources_json TEXT NOT NULL DEFAULT '[]',
  writer TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS brand_pieces_brand ON brand_pieces (brand_id, created_at);
