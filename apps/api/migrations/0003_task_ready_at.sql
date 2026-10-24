-- When a task can first be ticked. Set when it is written or renamed, never
-- moved by unticking or editing its note or date. Older rows fall back to
-- created_at plus the wait.
ALTER TABLE nodes ADD COLUMN ready_at TEXT;
