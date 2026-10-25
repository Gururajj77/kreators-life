-- Kreators Run: run clubs, runs with a start code, entries logged by that code, brand collabs with giveaways.
CREATE TABLE run_clubs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  pace TEXT NOT NULL DEFAULT 'all',
  meets TEXT NOT NULL DEFAULT '',
  host_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visibility TEXT NOT NULL DEFAULT 'public',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_run_clubs_city ON run_clubs(status, visibility, city);

CREATE TABLE run_members (
  club_id TEXT NOT NULL REFERENCES run_clubs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL,
  PRIMARY KEY (club_id, user_id)
);
CREATE INDEX idx_run_members_user ON run_members(user_id, status);

-- Brand collabs come first so a run can point at one.
CREATE TABLE run_collabs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  brand_name TEXT NOT NULL DEFAULT '',
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brief TEXT NOT NULL DEFAULT '',
  asks TEXT NOT NULL DEFAULT '',
  giveaway TEXT NOT NULL DEFAULT '',
  giveaway_count INTEGER NOT NULL DEFAULT 0,
  city TEXT NOT NULL DEFAULT '',
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_run_collabs_open ON run_collabs(status, ends_at);

CREATE TABLE run_collab_applications (
  id TEXT PRIMARY KEY,
  collab_id TEXT NOT NULL REFERENCES run_collabs(id) ON DELETE CASCADE,
  club_id TEXT NOT NULL REFERENCES run_clubs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'applied',
  created_at TEXT NOT NULL,
  decided_at TEXT,
  UNIQUE (collab_id, club_id)
);

CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  club_id TEXT NOT NULL REFERENCES run_clubs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  meeting_point TEXT NOT NULL DEFAULT '',
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  metres INTEGER NOT NULL DEFAULT 5000,
  -- The start code the host shows at the line. Six letters, never sent to anyone but the host.
  code TEXT NOT NULL,
  collab_id TEXT REFERENCES run_collabs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_runs_club ON runs(club_id, starts_at);
CREATE INDEX idx_runs_starts ON runs(status, starts_at);

-- One entry per person per run, logged by the start code inside the run's window. Void keeps the row and takes the pay back.
CREATE TABLE run_entries (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  club_id TEXT NOT NULL REFERENCES run_clubs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metres INTEGER NOT NULL DEFAULT 0,
  minutes INTEGER NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'logged',
  logged_at TEXT NOT NULL,
  UNIQUE (run_id, user_id)
);
CREATE INDEX idx_run_entries_user ON run_entries(user_id, status, logged_at);
