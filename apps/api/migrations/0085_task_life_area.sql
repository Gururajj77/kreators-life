-- 2026-11-06: a task (and so a habit, a repeating task) can carry one area of life beside its pillar: physical, financial,
-- mental, emotional or spiritual (`LIFE_AREA_ORDER` in shared), or NULL for none. Checked in code (`parseLifeArea`,
-- `lifeAreaProblem`), carried to the next one when a repeat makes it, and never changes what a tick pays.
-- No index: every read of it is already narrowed to one person's tasks (by user_id), and Life's count reads
-- the person's ticked tasks of the last week through the existing user_id filter.
ALTER TABLE nodes ADD COLUMN life_area TEXT;
