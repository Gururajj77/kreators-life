-- 2026-11-06 (founder): time blocks, day templates, the weekly pattern. docs/time-blocks.md is the design.

-- A person's kinds of block (Deep work, Sleep, ...). `color` is a swatch KEY from TIME_BLOCK_SWATCHES in shared
-- (timeBlocks.ts), never a hex: CSS maps the key to a theme token. `seed` is the starting block's key when the app
-- made it (null for the person's own), so the starting set is added once and can be restored.
CREATE TABLE IF NOT EXISTS time_blocks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seed TEXT,
  name TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL,
  life_area TEXT,              -- a LIFE_AREA_ORDER key or NULL
  relationship TEXT,           -- a pillar key or NULL
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
-- Listing a person's blocks in their order (every read of the feature).
CREATE INDEX IF NOT EXISTS idx_time_blocks_user ON time_blocks(user_id, sort);
-- Seeding twice adds nothing: one starting block per key per person.
CREATE UNIQUE INDEX IF NOT EXISTS idx_time_blocks_seed ON time_blocks(user_id, seed) WHERE seed IS NOT NULL;

-- Day templates: a set of slots plus the lead and second pillar the By context sort uses. `source_kind` is the old
-- DAY_TYPES key a starting template was made from (deep_work, family, ...), so an old day_types row still finds its
-- template; `why` and `source` keep that kind's line and book pages.
CREATE TABLE IF NOT EXISTS day_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seed TEXT,
  source_kind TEXT,
  name TEXT NOT NULL,
  lead TEXT NOT NULL,          -- a pillar key
  second TEXT,                 -- a pillar key or NULL
  why TEXT,
  source TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
-- Listing a person's templates in their order.
CREATE INDEX IF NOT EXISTS idx_day_templates_user ON day_templates(user_id, sort);
-- Seeding twice adds nothing.
CREATE UNIQUE INDEX IF NOT EXISTS idx_day_templates_seed ON day_templates(user_id, seed) WHERE seed IS NOT NULL;
-- Exactly one default per person can exist; making another the default clears this one first, in the same batch.
CREATE UNIQUE INDEX IF NOT EXISTS idx_day_templates_default ON day_templates(user_id) WHERE is_default = 1;

-- A template's slots: a block from start_min to end_min (minutes after midnight, 0..1439). end_min < start_min
-- wraps past midnight (Sleep 23:00 to 07:00 is 1380 -> 420); end_min = 0 means "to midnight". Never equal.
CREATE TABLE IF NOT EXISTS day_template_slots (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES day_templates(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  block_id TEXT NOT NULL REFERENCES time_blocks(id) ON DELETE CASCADE,
  start_min INTEGER NOT NULL CHECK (start_min BETWEEN 0 AND 1439),
  end_min INTEGER NOT NULL CHECK (end_min BETWEEN 0 AND 1439 AND end_min <> start_min)
);
-- A template's slots in clock order (every resolved day).
CREATE INDEX IF NOT EXISTS idx_day_template_slots_tpl ON day_template_slots(template_id, start_min);
-- Deleting a block removes its slots, and the delete sheet counts the templates it leaves.
CREATE INDEX IF NOT EXISTS idx_day_template_slots_block ON day_template_slots(block_id);
-- The account delete and the export read by person.
CREATE INDEX IF NOT EXISTS idx_day_template_slots_user ON day_template_slots(user_id);

-- The weekly pattern: weekday 1 (Monday) .. 7 (Sunday) -> a template. No row means the default template.
CREATE TABLE IF NOT EXISTS week_patterns (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  template_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, weekday)
);

-- Single-date changes reuse day_types (0077). A new row carries template_id; `kind` stays NOT NULL and is written as the
-- template's source_kind, or 'template' for one with none. An old row (template_id NULL) finds its template by
-- source_kind = kind. A date row never changes the pattern.
ALTER TABLE day_types ADD COLUMN template_id TEXT;

-- The block a person picked for a task (NULL: by its time, or none).
ALTER TABLE nodes ADD COLUMN time_block_id TEXT;
-- Clearing a deleted block from tasks, and the `?block=` cut on GET /today.
CREATE INDEX IF NOT EXISTS idx_nodes_user_block ON nodes(user_id, time_block_id) WHERE time_block_id IS NOT NULL;

-- When the starting blocks and templates were added for this person (once; NULL until the first read).
ALTER TABLE users ADD COLUMN time_blocks_seeded_at TEXT;
