-- Life coaches. The team makes someone a life coach with the 'coach' permission (users.permissions, no column), and
-- a coach works only with students who said yes. A link starts three ways: the coach or an admin asks and the
-- student says yes, the student asks and the coach says yes, or an admin links the two. Either side can end it.
-- One open link (asked or active) per coach and student; a no or an end stays as history.
CREATE TABLE IF NOT EXISTS coach_links (
  id TEXT PRIMARY KEY,
  coach_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  status TEXT NOT NULL,
  asked_by TEXT NOT NULL,
  created_by TEXT,
  -- What the student shares with this coach: daily, pillars, routine, lifeMap, reflection. All on to start with.
  share_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  answered_at TEXT,
  ended_at TEXT,
  ended_by TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS coach_links_open ON coach_links (coach_id, student_id) WHERE status IN ('pending', 'active');
CREATE INDEX IF NOT EXISTS coach_links_student ON coach_links (student_id, status);
CREATE INDEX IF NOT EXISTS coach_links_coach ON coach_links (coach_id, status);

-- Notes a coach leaves for a student. The student reads every one; nothing a coach writes is hidden from them.
CREATE TABLE IF NOT EXISTS coach_notes (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL,
  coach_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS coach_notes_student ON coach_notes (student_id, created_at);
CREATE INDEX IF NOT EXISTS coach_notes_pair ON coach_notes (coach_id, student_id, created_at);

-- The change log both sides see at the end of their page: every ask, answer, end, share change, note and task change.
-- Labels are plain words about the change (a task's title, a part's name), never journal text.
CREATE TABLE IF NOT EXISTS coach_log (
  id TEXT PRIMARY KEY,
  link_id TEXT,
  coach_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  label TEXT NOT NULL,
  target_id TEXT,
  before_json TEXT NOT NULL DEFAULT '',
  after_json TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS coach_log_pair ON coach_log (coach_id, student_id, created_at);
CREATE INDEX IF NOT EXISTS coach_log_student ON coach_log (student_id, created_at);

-- A coach's own line for the directory and whether they take new students; also an ask to be made a life coach,
-- waiting for an admin, from someone who is not one yet.
CREATE TABLE IF NOT EXISTS coach_profiles (
  user_id TEXT PRIMARY KEY,
  about TEXT NOT NULL DEFAULT '',
  open INTEGER NOT NULL DEFAULT 1,
  asked_at TEXT,
  updated_at TEXT NOT NULL
);

-- A task a coach added carries the coach's id, so the student sees it came from their coach.
ALTER TABLE nodes ADD COLUMN added_by TEXT;
