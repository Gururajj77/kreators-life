-- 0137: Hidden tasks (2026-11-12, the founder: "tasks that go under a toggle tab below called hidden tasks"; "let me pick each time").
-- A task can be hidden until tomorrow or until the person unhides it. NULL is shown. A day 'YYYY-MM-DD' is the last day it stays hidden:
-- Until tomorrow writes the person's own today (their device's day, else their zone's), so it is back on their next day by their clock,
-- never the server's UTC date. '9999-12-31' (`HIDDEN_ALWAYS` in shared) is Until I unhide it. Read only through `taskHiddenOn` and
-- `taskHideOf` in shared, and in SQL as `(hidden_until IS NULL OR hidden_until < <the person's day>)`. A hidden task keeps its dates, its
-- tags and its pay; it leaves Daily's lists and counts and sends no reminder note while hidden. Set and cleared with PATCH /nodes/:id
-- {hide}; in the export with the rest of nodes (`SELECT *`); gone with the account; a repeating task's next one is never hidden (spawnNext
-- names its columns and leaves this one out).
ALTER TABLE nodes ADD COLUMN hidden_until TEXT;
