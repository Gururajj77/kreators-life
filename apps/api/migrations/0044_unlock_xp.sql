-- An xp floor beside the points floor and the badge, for products, store items and tools (see unlockFor in shared).
ALTER TABLE products ADD COLUMN min_xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE store_items ADD COLUMN min_xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tools ADD COLUMN min_xp INTEGER NOT NULL DEFAULT 0;
