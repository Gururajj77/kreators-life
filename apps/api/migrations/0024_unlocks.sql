-- Who can buy or open a thing: a points balance to reach, a badge to hold, or both. Zero and empty mean anyone.
ALTER TABLE products ADD COLUMN min_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN badge TEXT NOT NULL DEFAULT '';
ALTER TABLE store_items ADD COLUMN min_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE store_items ADD COLUMN badge TEXT NOT NULL DEFAULT '';
ALTER TABLE tools ADD COLUMN min_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tools ADD COLUMN badge TEXT NOT NULL DEFAULT '';
