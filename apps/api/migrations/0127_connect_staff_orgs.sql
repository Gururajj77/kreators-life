-- 0127: Connect people for staff, brand teams by invite, and a cohort's manager (2026-11-10, the founder answering wave 24's three
-- questions: "yes to all").
--
-- 1. team_connections takes two more kinds: `cohort` (the team names who runs a cohort; ref_id is the cohort, first_user_id the new
--    manager, second_user_id the one it replaced) and `org` (a brand's team asks someone to join; ref_id is the organization,
--    first_user_id the person). SQLite cannot change a CHECK, so the table is built again with every row and index as it was.
-- 2. A brand's team is joined by a yes: adding someone writes organization_members with status 'invited', and only their yes makes it
--    'active'. Every reader of a member already asks for status 'active', so an invited person is listed nowhere as a member. Everyone
--    on a team today is a member already; the UPDATE below says so for any row that is neither of the two words (none was ever written).
CREATE TABLE team_connections_new (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('coach', 'friends', 'agency', 'program', 'product', 'club', 'cohort', 'org')),
  first_user_id TEXT NOT NULL,
  second_user_id TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('ask', 'direct')),
  ref_id TEXT,
  place TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'asked',
  first_said INTEGER,
  second_said INTEGER,
  created_by TEXT,
  created_at TEXT NOT NULL,
  answered_at TEXT,
  ended_at TEXT,
  came_true_at TEXT
);
INSERT INTO team_connections_new (id, kind, first_user_id, second_user_id, mode, ref_id, place, status, first_said, second_said, created_by, created_at, answered_at, ended_at, came_true_at)
  SELECT id, kind, first_user_id, second_user_id, mode, ref_id, place, status, first_said, second_said, created_by, created_at, answered_at, ended_at, came_true_at FROM team_connections;
DROP TABLE team_connections;
ALTER TABLE team_connections_new RENAME TO team_connections;
CREATE INDEX idx_team_connections_created ON team_connections (created_at);
CREATE INDEX idx_team_connections_first ON team_connections (first_user_id, created_at);
CREATE INDEX idx_team_connections_second ON team_connections (second_user_id, created_at);
CREATE UNIQUE INDEX idx_team_connections_open_friends ON team_connections (first_user_id, second_user_id) WHERE kind = 'friends' AND status = 'asked';
-- The list filtered by kind (a staff member sees only their kinds) and an org or cohort row found by what it points at.
CREATE INDEX idx_team_connections_kind ON team_connections (kind, created_at);
CREATE INDEX idx_team_connections_ref ON team_connections (kind, ref_id);

UPDATE organization_members SET status = 'active' WHERE status IS NULL OR status NOT IN ('active', 'invited');
