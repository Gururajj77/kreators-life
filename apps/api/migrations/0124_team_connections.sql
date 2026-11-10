-- 0124: Connect people (2026-11-09, the founder: "can u add ability to connect people in admin center? ... say a coach and student had to be
-- connected, and similar powers in admin are must for better management"). One row for each connection the team made from Admin, Connect
-- people (routes/adminConnect.ts), so the list "Connections the team made" can show every kind in one place. Each kind still goes through the
-- app's own action and its own table (coach_links, agency_team, program_invites, product_invites, memberships); `ref_id` points at that row
-- and the list reads the state from it. The one kind with no table of its own is `friends`: the team suggests two people become friends, each
-- answers on their Profile tab, the first yes sends an ordinary friend request (requestFriend in bond.ts) and the second accepts it, so this row
-- keeps the two answers. A reason typed for a direct link lives only in the audit row, never here and never sent to anyone.
CREATE TABLE team_connections (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('coach', 'friends', 'agency', 'program', 'product', 'club')),
  -- coach | the first person suggested | agency owner | the invited person | the invited person | the Club member
  first_user_id TEXT NOT NULL,
  -- student | the second person | the team member | none | none | the staff manager
  second_user_id TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('ask', 'direct')),
  -- coach_links.id | none | agency_team.id | programs.id | products.id | memberships.id
  ref_id TEXT,
  -- What the row is about, for the list: a program's or course's name, an Agency role. Never a reason or anything someone wrote.
  place TEXT NOT NULL DEFAULT '',
  -- friends only: asked | accepted | declined | ended. The other kinds read their state from ref_id.
  status TEXT NOT NULL DEFAULT 'asked',
  -- friends only: each side's answer, 1 yes or 0 no, NULL until they answer.
  first_said INTEGER,
  second_said INTEGER,
  created_by TEXT,
  created_at TEXT NOT NULL,
  answered_at TEXT,
  ended_at TEXT
);
-- The list, newest first, and a person's own connections (the People sheet, their Profile card, the export and the delete).
CREATE INDEX idx_team_connections_created ON team_connections (created_at);
CREATE INDEX idx_team_connections_first ON team_connections (first_user_id, created_at);
CREATE INDEX idx_team_connections_second ON team_connections (second_user_id, created_at);
-- One open friend suggestion per pair (the two ids are stored in order), so asking twice never makes two.
CREATE UNIQUE INDEX idx_team_connections_open_friends ON team_connections (first_user_id, second_user_id) WHERE kind = 'friends' AND status = 'asked';
