-- 0161: the You batch's review (2026-11-14). All tables' coaching log was one table over both sides of a link (`student_id = ?1 OR coach_id = ?1`),
-- which SQLite reads by joining two indexes and then sorting every line the person ever had, so a coach with many students read about three rows
-- per log line for each ten-row page. It is now one table a side: Log with your coaches pages straight off coach_log_student (student_id, created_at),
-- and Log with your students off this one. coach_log_pair (coach_id, student_id, created_at) cannot give a coach's lines in time order across
-- students, so it stays for the reads of one pair (the coach's student page) and this serves the coach's whole log, newest first.
-- Nothing is rewritten.
CREATE INDEX IF NOT EXISTS idx_coach_log_coach_created ON coach_log (coach_id, created_at);
