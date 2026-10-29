-- The setup chat, the first thing a new account sees: who you are (identity tags, known keys and labels in
-- your own words) and what you came for (goals, and what gets in the way). The apps that fit are switched on
-- from the whole of it; the strategy session moved inside Pillars.
ALTER TABLE users ADD COLUMN identities TEXT NOT NULL DEFAULT '[]';
ALTER TABLE users ADD COLUMN intake_json TEXT NOT NULL DEFAULT '{}';
