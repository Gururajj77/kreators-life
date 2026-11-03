-- Focus sessions, the Toggl pass (2026-11-03). Three columns on focus_rounds, all nullable, so every older row stays as it was.
-- mode: which clock a session came from (timer, pomodoro, stopwatch, or manual for one added afterwards), so Continue can start it again.
-- log_id: the mindful-minutes log (wellbeing_logs.id) written with the round, so changing or deleting the round changes or deletes it too.
-- client_ref: the browser's name for the part that ended (owner, clock and end time), so a duplicated tab that finishes the same part
-- adds no second round; unique per person, and only where it is set.
ALTER TABLE focus_rounds ADD COLUMN mode TEXT;
ALTER TABLE focus_rounds ADD COLUMN log_id TEXT;
ALTER TABLE focus_rounds ADD COLUMN client_ref TEXT;
CREATE UNIQUE INDEX idx_focus_rounds_ref ON focus_rounds(user_id, client_ref) WHERE client_ref IS NOT NULL;
-- The recent tasks in the task sheet read a person's rounds by task, newest first.
CREATE INDEX idx_focus_rounds_user_node ON focus_rounds(user_id, node_id, created_at);
