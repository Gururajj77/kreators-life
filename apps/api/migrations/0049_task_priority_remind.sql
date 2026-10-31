-- A task can carry a priority (0 = P0 … 3 = P3, null = none) and ask to be reminded on its day.
ALTER TABLE nodes ADD COLUMN priority INTEGER;
ALTER TABLE nodes ADD COLUMN remind INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_nodes_remind ON nodes(remind, status) WHERE remind = 1;

-- Where a task came from: 'build' for the ones the strategy session and the vibe check made from the pillars.
ALTER TABLE nodes ADD COLUMN origin TEXT;

-- Subtasks: a small checklist inside a task. They pay nothing; the task itself is what is ticked for xp.
CREATE TABLE subtasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_subtasks_task ON subtasks(task_id, sort_order);
CREATE INDEX idx_subtasks_user ON subtasks(user_id);
