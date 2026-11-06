-- 0084: discussions under School cohorts.
--
-- Threads for everyone enrolled in a cohort (enrolled or completed), its manager, mentors and the team with the cohorts permission.
-- Replies nest three levels under a post (depth 0 to 3, COHORT_TALK_MAX_DEPTH in shared); a reply to a line at depth 3 is kept at
-- depth 3 beside it, under the same parent, and names the line it answers in `reply_to_id`. Each member picks how they appear in each
-- cohort (cohort_talk_prefs): private until they say otherwise, with the handle and friend code shown in stars, which the server does.
-- Both tables go with the cohort (the foreign key) and with the account (account.ts), and are in the export (me.ts). Lines are kept
-- RETENTION_DAYS.channelLines, like a channel's.

CREATE TABLE cohort_talk (
  id TEXT PRIMARY KEY,
  cohort_id TEXT NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  -- The post a line belongs to (a post's own id for a post), so one page of posts brings its replies in one read.
  thread_id TEXT NOT NULL,
  parent_id TEXT,
  reply_to_id TEXT,
  depth INTEGER NOT NULL DEFAULT 0,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  -- A taken-down line keeps its place (replies hang from it) but loses its words.
  deleted_at TEXT,
  deleted_by TEXT
);
-- The page of posts, newest first.
CREATE INDEX idx_cohort_talk_posts ON cohort_talk (cohort_id, depth, created_at);
-- The replies of the posts on a page.
CREATE INDEX idx_cohort_talk_thread ON cohort_talk (thread_id, created_at);
-- The export and the account delete.
CREATE INDEX idx_cohort_talk_user ON cohort_talk (user_id);
-- The retention sweep by age.
CREATE INDEX idx_cohort_talk_created ON cohort_talk (created_at);

-- How a member appears in one cohort's discussion. No row means private.
CREATE TABLE cohort_talk_prefs (
  cohort_id TEXT NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (cohort_id, user_id)
);
CREATE INDEX idx_cohort_talk_prefs_user ON cohort_talk_prefs (user_id);
