-- Reddit-style choices: post under a made-up name, and answer a reply directly so a conversation threads.
ALTER TABLE community_posts ADD COLUMN anonymous INTEGER NOT NULL DEFAULT 0;
ALTER TABLE community_replies ADD COLUMN anonymous INTEGER NOT NULL DEFAULT 0;
ALTER TABLE community_replies ADD COLUMN parent_id TEXT;
ALTER TABLE community_replies ADD COLUMN depth INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_replies_parent ON community_replies(parent_id);
ALTER TABLE event_messages ADD COLUMN anonymous INTEGER NOT NULL DEFAULT 0;
ALTER TABLE event_messages ADD COLUMN parent_id TEXT;
ALTER TABLE event_messages ADD COLUMN depth INTEGER NOT NULL DEFAULT 0;
