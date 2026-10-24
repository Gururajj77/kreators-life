-- Finance grows up: who the money came from or went to, splits, dues, recurring entries and goals.
ALTER TABLE finance_transactions ADD COLUMN counterparty TEXT NOT NULL DEFAULT '';
ALTER TABLE finance_transactions ADD COLUMN splits_json TEXT NOT NULL DEFAULT '[]';

CREATE TABLE finance_dues (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  counterparty TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  category TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  due_date TEXT,
  recurring TEXT NOT NULL DEFAULT 'none',
  status TEXT NOT NULL DEFAULT 'open',
  settled_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_fin_dues_user ON finance_dues(user_id, status, due_date);

CREATE TABLE finance_recurring (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  category TEXT NOT NULL,
  counterparty TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  day_of_month INTEGER NOT NULL DEFAULT 1,
  next_date TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_fin_recurring_next ON finance_recurring(active, next_date);

CREATE TABLE finance_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'save',
  target_cents INTEGER NOT NULL,
  saved_cents INTEGER NOT NULL DEFAULT 0,
  start_date TEXT NOT NULL,
  deadline TEXT,
  created_at TEXT NOT NULL
);
