-- 2026-11-13, the founder: the routine's other blocks on Daily (food and water, work, people, learning, lights out) can be ticked too.
-- Which blocks were ticked that day, by key. A tick pays nothing and never changes `done`, which stays the morning's every step.
ALTER TABLE routine_days ADD COLUMN blocks_json TEXT NOT NULL DEFAULT '[]';
