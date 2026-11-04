-- 0080: a discussion for each run in Kreators Run, drawn like a channel.
--
-- Its people are the run's own: the club's host, the members who were in the club by the time the run ended, and anyone who
-- logged the run with its start code. It is open for writing until a month after the run (RUN_TALK_DAYS_AFTER in shared,
-- the same month as an event conversation) and closed when the run is cancelled. Polled, not live: a screen asks for the
-- lines after the last `seq` it holds. No foreign keys on people: account.ts removes the person's lines and reads by hand,
-- and the cron keeps lines RETENTION_DAYS.channelLines, like a channel's.

CREATE TABLE run_messages (
  -- `seq` is the cursor: it only goes up, so "lines after 120" never misses two written in the same millisecond.
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  run_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  anonymous INTEGER NOT NULL DEFAULT 0,
  reply_to TEXT,
  created_at TEXT NOT NULL,
  -- A taken-down line keeps its place but loses its words.
  deleted_at TEXT,
  deleted_by TEXT
);
-- The poll ("lines after seq N in this run") and "load earlier".
CREATE INDEX idx_run_messages_run ON run_messages (run_id, seq);
-- The export and the account delete, and the retention sweep by age.
CREATE INDEX idx_run_messages_user ON run_messages (user_id);
CREATE INDEX idx_run_messages_created ON run_messages (created_at);

-- Lines after `last_read_at` are unread for that person. No row yet means nothing read.
CREATE TABLE run_discussion_reads (
  run_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  last_read_at TEXT NOT NULL,
  PRIMARY KEY (run_id, user_id)
);
CREATE INDEX idx_run_discussion_reads_user ON run_discussion_reads (user_id);

-- A run's conversation used to live with Party's event lines (event_messages, app 'run'). It moves here, in its order, so a run
-- has one conversation; a line that was taken down keeps its place and loses its words.
INSERT INTO run_messages (id, run_id, user_id, body, anonymous, reply_to, created_at, deleted_at, deleted_by)
  SELECT id, event_id, user_id, CASE WHEN removed_by IS NULL THEN body ELSE '' END, anonymous, parent_id, created_at,
         CASE WHEN removed_by IS NULL THEN NULL ELSE created_at END, removed_by
  FROM event_messages WHERE app = 'run' ORDER BY created_at, id;
DELETE FROM event_messages WHERE app = 'run';
