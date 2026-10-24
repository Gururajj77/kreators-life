-- Content rewards with view-based payouts, social metrics, and featured listings for the public site.
ALTER TABLE bounties ADD COLUMN brand_name TEXT NOT NULL DEFAULT '';
ALTER TABLE bounties ADD COLUMN deliverable TEXT NOT NULL DEFAULT 'Short video';
ALTER TABLE bounties ADD COLUMN rate_per_thousand INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bounties ADD COLUMN max_payout_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bounties ADD COLUMN min_views INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE bounties ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;

ALTER TABLE bounty_submissions ADD COLUMN platform TEXT NOT NULL DEFAULT 'other';
ALTER TABLE bounty_submissions ADD COLUMN latest_views INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bounty_submissions ADD COLUMN latest_engagement INTEGER NOT NULL DEFAULT 0;

CREATE TABLE social_metrics (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES bounty_submissions(id) ON DELETE CASCADE,
  views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  note TEXT NOT NULL DEFAULT '',
  recorded_by TEXT,
  fetched_at TEXT NOT NULL
);
CREATE INDEX idx_social_metrics_submission ON social_metrics(submission_id, fetched_at);

ALTER TABLE opportunities ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;
ALTER TABLE programs ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN public INTEGER NOT NULL DEFAULT 0;
