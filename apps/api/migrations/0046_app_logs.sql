-- What is happening, where and by whom: one line per change someone makes, per refused or failed request, per cron run and per
-- error the browser reports. For super admins only. Never a request body, never a journal, wellbeing, Companion, Discover or
-- assistant line (those areas only leave a bare server-error line with no person and no path). Lines older than thirty days go.
CREATE TABLE app_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  level TEXT NOT NULL,
  area TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT '',
  path TEXT NOT NULL DEFAULT '',
  status INTEGER NOT NULL DEFAULT 0,
  ms INTEGER NOT NULL DEFAULT 0,
  actor_id TEXT,
  actor_name TEXT,
  message TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_app_logs_at ON app_logs(at);
CREATE INDEX idx_app_logs_level ON app_logs(level, at);
CREATE INDEX idx_app_logs_area ON app_logs(area, at);
