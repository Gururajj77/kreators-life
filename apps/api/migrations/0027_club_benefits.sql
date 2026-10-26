-- The two Club benefits that were words only: club-only Work listings and a named manager.
ALTER TABLE opportunities ADD COLUMN club_only INTEGER NOT NULL DEFAULT 0;
ALTER TABLE memberships ADD COLUMN manager_user_id TEXT;
