-- 0133: Daily's task tabs (2026-11-12, the founder): Today, Past due and Upcoming, each with its count. Today and Past due read the open tasks
-- whose day (the do date, else the due date) is the day or before it, which the count read already walks. Upcoming is new: the open tasks whose
-- day is after the person's day, soonest first, ten a page (GET /today/upcoming, prefix `uc`). Without an index on that day, that list would
-- visit every active task of the person's on every page, and a person who plans months ahead pays for all of them each time (CLAUDE.md,
-- Workers Free: a new per-person read must not walk every task). This index serves the range and the order in one: the person, then the
-- day, only for open tasks (most rows are done or a pillar's other layers, so the partial index stays small). The query must name the same
-- expression, COALESCE(do_date, due_date), and the same WHERE terms, `kind = 'task' AND status = 'active'`, so SQLite picks it; INDEXED BY
-- idx_nodes_user_open_day in the route makes sure. Past due's page reads it too, oldest first.
CREATE INDEX IF NOT EXISTS idx_nodes_user_open_day ON nodes (user_id, COALESCE(do_date, due_date)) WHERE kind = 'task' AND status = 'active';
