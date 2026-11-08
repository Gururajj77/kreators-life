-- 0116: Workers Free (the founder, 2026-11-07). The cron reads what is due 96 times a day whether anyone uses the app or not, and D1 charges every row a statement visits, so what a
-- tick reads must not grow with the number of accounts. docs/performance.md has the numbers.

-- A tick that had to leave work says so here, so the reminders' hour reaches back until the ticks catch up and nobody's reminder is lost. Empty almost always.
CREATE TABLE IF NOT EXISTS cron_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- The daily reminder and your own reminders: in India only the times that can be due now are read (cron.ts `indiaTimes`), and anyone elsewhere is read every tick. Only those rows are in these.
CREATE INDEX IF NOT EXISTS idx_users_reminder_india ON users (reminder_time) WHERE reminder_time IS NOT NULL AND timezone IN ('Asia/Kolkata', 'Asia/Calcutta');
CREATE INDEX IF NOT EXISTS idx_users_abroad ON users (id) WHERE timezone NOT IN ('Asia/Kolkata', 'Asia/Calcutta');
CREATE INDEX IF NOT EXISTS idx_custom_reminders_time ON custom_reminders (time) WHERE enabled = 1;

-- Remember tasks, focus nudges and supplement reminders: only the rows that can ever send one.
CREATE INDEX IF NOT EXISTS idx_nodes_remember ON nodes (COALESCE(do_date, due_date)) WHERE kind = 'task' AND status = 'active' AND remind = 1;
CREATE INDEX IF NOT EXISTS idx_focus_prefs_reminder ON focus_prefs (user_id) WHERE json_extract(settings_json, '$.reminderTime') IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fitness_prefs_remind ON fitness_prefs (user_id) WHERE supplements_on = 1 AND remind_json != '{}';

-- Posts whose numbers the cron refreshes, and money orders waiting to be paid: a few rows each.
CREATE INDEX IF NOT EXISTS idx_content_items_youtube ON content_items (synced_at) WHERE platform = 'youtube';
CREATE INDEX IF NOT EXISTS idx_orders_pending ON orders (created_at) WHERE status = 'pending';
