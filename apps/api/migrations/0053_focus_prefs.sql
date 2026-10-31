-- What a person chose for their Mindful minutes timers: lengths, counts, what counts as mindful minutes, sounds and the background sound.
-- One row a person, owner only, so the choices follow them to every device.
CREATE TABLE focus_prefs (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  settings_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
