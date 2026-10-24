-- Optional time on tasks, and the Finance module.
ALTER TABLE nodes ADD COLUMN due_time TEXT;
ALTER TABLE nodes ADD COLUMN estimate_min INTEGER;

CREATE TABLE finance_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  category TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  ref TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_fin_tx_user_date ON finance_transactions(user_id, date);

CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL DEFAULT '',
  items_json TEXT NOT NULL DEFAULT '[]',
  total_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'draft',
  issue_date TEXT NOT NULL,
  due_date TEXT,
  note TEXT NOT NULL DEFAULT '',
  token TEXT NOT NULL UNIQUE,
  paid_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, number)
);

CREATE TABLE finance_budgets (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  monthly_cents INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, category)
);
