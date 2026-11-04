-- 2026-11-04: a repeating task can be counted as a habit, or not. NULL keeps the old rule (a repeating task wears the Habit tag);
-- 1 or 0 is the person's own pick from "Count it as a habit". Carried to the next one when a repeat makes it.
ALTER TABLE nodes ADD COLUMN habit INTEGER;
