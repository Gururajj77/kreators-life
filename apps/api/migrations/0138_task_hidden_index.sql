-- 0138: The index behind Hidden tasks (2026-11-12). GET /today/hidden lists a person's open tasks hidden on their day, ten a page, and
-- GET /today counts them for the fold's number. Without an index both would visit every open task of the person's to find the few
-- hidden ones (CLAUDE.md, Workers Free: a new per-person read must not walk every task). This partial index holds only open tasks that
-- carry a hide, so it stays tiny, and serves the range `hidden_until >= <day>` and the list's order (Until tomorrow first, then Until I
-- unhide it) in one. The queries name the same WHERE terms, `kind = 'task' AND status = 'active' AND hidden_until IS NOT NULL`, and
-- INDEXED BY idx_nodes_user_hidden, so SQLite always takes it. A past Until tomorrow stays in it until the task is hidden again, ticked or
-- unhidden; the range skips those.
CREATE INDEX IF NOT EXISTS idx_nodes_user_hidden ON nodes (user_id, hidden_until) WHERE kind = 'task' AND status = 'active' AND hidden_until IS NOT NULL;
