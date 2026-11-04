-- 2026-11-04 (founder, wave 14): people who work on someone's Agency. role in TEAM_ROLES; status invited, active or removed;
-- access_json is TeamAccess (overview, pipeline, clients, paperwork: off, view or edit), read only through parseTeamAccess in shared.
-- A client member is tied to exactly one of the owner's agency_clients. Owner only to manage, the member only to answer or leave.
-- In both people's export, deleted with either account and with the tied client.
CREATE TABLE agency_team (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                       -- content_creator | videographer | editor | client
  status TEXT NOT NULL DEFAULT 'invited',   -- invited | active | removed
  access_json TEXT NOT NULL,
  client_id TEXT REFERENCES agency_clients(id) ON DELETE CASCADE,  -- set only, and always, for role client
  ended_by TEXT,                            -- owner | member, when removed (a decline is member with joined_at NULL)
  invited_at TEXT NOT NULL,
  joined_at TEXT,
  removed_at TEXT,
  updated_at TEXT NOT NULL,
  CHECK (owner_id != member_id),
  CHECK ((role = 'client') = (client_id IS NOT NULL))
);
-- One open row per pair. A removed row stays for the record, and a new invite is a new row.
CREATE UNIQUE INDEX idx_agency_team_open ON agency_team(owner_id, member_id) WHERE status IN ('invited', 'active');
-- The gate reads by id and member on every member request, and the switcher lists by member.
CREATE INDEX idx_agency_team_member ON agency_team(member_id, status);
-- The owner's Team tab lists by owner.
CREATE INDEX idx_agency_team_owner ON agency_team(owner_id, status);

-- Who did it, when a team member acted. NULL means the owner, the client or the cron, as the actor column already says.
ALTER TABLE agency_log ADD COLUMN actor_id TEXT;
-- A note written by a team member (author 'team'): whose it is, so they can delete only their own.
ALTER TABLE agency_notes ADD COLUMN author_id TEXT;
