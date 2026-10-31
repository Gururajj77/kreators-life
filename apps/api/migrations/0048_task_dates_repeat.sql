-- A task can have a do date (the day to do it) beside its due date (the deadline), and can repeat. A repeating task carries its rule
-- (see parseRepeat in shared); ticking it makes the next one, which remembers which one it came from so un-ticking can take it back.
ALTER TABLE nodes ADD COLUMN do_date TEXT;
ALTER TABLE nodes ADD COLUMN repeat_json TEXT;
ALTER TABLE nodes ADD COLUMN spawned_from TEXT;
CREATE INDEX idx_nodes_spawned ON nodes(spawned_from);
-- Until now a task's one date was the day to do it, and it held the task back until then. That is now the do date. The due date is the
-- deadline, a different thing, so every date that exists moves to the do date and the due date starts empty.
UPDATE nodes SET do_date = due_date, due_date = NULL WHERE kind = 'task' AND due_date IS NOT NULL AND do_date IS NULL;
