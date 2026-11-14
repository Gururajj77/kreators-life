-- 0159: All tables' School and Connection (2026-11-14, the founder: "ok, add them"), each page's default sort through an index.
-- These tables had no index that starts on the person and keeps the page's order, so a page read every row of theirs (or, for programs, cohorts,
-- reactions, introductions and mutes, every row of everyone's) and sorted them. Several also serve the app's own reads, which scanned the same
-- way. Three single-column indexes are replaced by one that starts on the same column, which serves everything they served. Nothing is rewritten.

-- Programs you made, newest first, and Program invites walks the maker's programs by this index first. programs had no index but its id.
CREATE INDEX IF NOT EXISTS idx_programs_created_by ON programs (created_by, created_at);

-- A program's cohorts, by when each starts: counted on each of Programs you made's rows, and read by School's own program list and access check
-- (WHERE program_id), which scanned every cohort before.
CREATE INDEX IF NOT EXISTS idx_cohorts_program ON cohorts (program_id, start_at);

-- Cohorts you run, latest start first. School's own Cohorts you run (WHERE manager_user_id) scanned every cohort before.
CREATE INDEX IF NOT EXISTS idx_cohorts_manager ON cohorts (manager_user_id, start_at);

-- Program invites: each program's invites newest first. The key (program_id, user_id) found them but kept them out of that order; School's own
-- list of who is invited reads them the same way (WHERE program_id ORDER BY created_at DESC).
CREATE INDEX IF NOT EXISTS idx_program_invites_program_created ON program_invites (program_id, created_at);

-- Programs you were invited to, newest first. It replaces idx_program_invites_user (user_id), which it serves.
CREATE INDEX IF NOT EXISTS idx_program_invites_user_created ON program_invites (user_id, created_at);
DROP INDEX IF EXISTS idx_program_invites_user;

-- Your lines in cohort talk, newest first. It replaces idx_cohort_talk_user (user_id), which it serves (the export and the account delete).
CREATE INDEX IF NOT EXISTS idx_cohort_talk_user_created ON cohort_talk (user_id, created_at);
DROP INDEX IF EXISTS idx_cohort_talk_user;

-- Community channels and Bond channels you are in, joined last first. idx_channel_members_user (user_id, status) found them but kept them out of
-- that order; it stays for the seat counts that ask by status.
CREATE INDEX IF NOT EXISTS idx_channel_members_user_joined ON channel_members (user_id, joined_at);

-- Reactions on posts you gave, newest first. The key starts on the post, so there was no index by who reacted; the export and the account delete
-- scanned for them too.
CREATE INDEX IF NOT EXISTS idx_community_likes_user ON community_likes (user_id, created_at);

-- Reactions on replies you gave, newest first. The key starts on the reply, as above.
CREATE INDEX IF NOT EXISTS idx_reply_reactions_user ON community_reply_reactions (user_id, created_at);

-- Posts you follow, newest first. It replaces community_post_follows_user (user_id), which it serves.
CREATE INDEX IF NOT EXISTS idx_post_follows_user_created ON community_post_follows (user_id, created_at);
DROP INDEX IF EXISTS community_post_follows_user;

-- People you muted as a guide, newest first. The key is the muted person, so there was no index by who muted.
CREATE INDEX IF NOT EXISTS idx_community_mutes_by ON community_mutes (muted_by, created_at);

-- People you blocked, newest first. The key (blocker_id, blocked_id) found them but kept them out of that order; Bond's own list reads them the
-- same way (WHERE blocker_id ORDER BY created_at DESC).
CREATE INDEX IF NOT EXISTS idx_blocks_blocker_created ON blocks (blocker_id, created_at);

-- Introductions you asked for and the ones asked of you, newest first. There was no index on either side; Bond's own list (requester or
-- recipient, newest first) scanned every introduction.
CREATE INDEX IF NOT EXISTS idx_introductions_requester ON introductions (requester_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_introductions_recipient ON introductions (recipient_user_id, created_at);
