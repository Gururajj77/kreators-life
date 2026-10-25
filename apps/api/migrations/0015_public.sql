-- What each person chooses to show on their public page. Empty means the defaults in shared.
ALTER TABLE users ADD COLUMN public_json TEXT NOT NULL DEFAULT '{}';
