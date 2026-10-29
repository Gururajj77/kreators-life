-- The assistant: a chat that does things in the app as the person, and the credits that pay for its model.
-- assistant_actions holds what the assistant did (or waits to do, until the person confirms), with how to undo
-- it. It keeps tool names, ids and plain labels, never journal text or log notes. Pending rows keep their
-- arguments until they run; those are ids only.
CREATE TABLE IF NOT EXISTS assistant_actions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL,
  args_json TEXT NOT NULL DEFAULT '',
  undo_json TEXT NOT NULL DEFAULT '',
  refresh_json TEXT NOT NULL DEFAULT '[]',
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS assistant_actions_user ON assistant_actions (user_id, created_at);

-- One account per person: the plan (Pro, Pro Max, Ultra or none) with its period, the plan's credits for
-- that period, and extra credits (top-ups and team grants) that never run out with the period.
CREATE TABLE IF NOT EXISTS credit_accounts (
  user_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL DEFAULT 'none',
  plan_started_at TEXT,
  plan_until TEXT,
  plan_credits INTEGER NOT NULL DEFAULT 0,
  extra_credits INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

-- Every move of credits: a plan's grant, a top-up, a team grant, use by an agent (with its tokens), and plan
-- credits that ran out with their period. Amounts are whole credits; one credit is a tenth of a US cent.
CREATE TABLE IF NOT EXISTS credit_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  bucket TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  agent TEXT,
  model TEXT NOT NULL DEFAULT '',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  actor_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS credit_ledger_user ON credit_ledger (user_id, created_at);
CREATE INDEX IF NOT EXISTS credit_ledger_usage ON credit_ledger (user_id, reason, agent, created_at);
