-- 2026-11-04 (founder): what kind of day it is, picked on Daily under Tasks ("What kind of day is it?"). One row per person per day,
-- `kind` one of DAY_TYPE_KEYS in shared (dayTypes.ts), read and written only through GET and PUT /today/day-type (owner only; the day
-- comes from the device, today or tomorrow). It only changes how Daily sorts tasks ("By context": P0 first, then the day's lead pillar
-- inside each priority); it pays nothing. In the export, deleted with the account.
CREATE TABLE IF NOT EXISTS day_types (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, day)
);
