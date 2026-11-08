-- 0120: Close the unfinished (2026-11-07, the founder's ask): a task can carry one kind of open business, so Daily's Unfinished business view
-- can list it in its kind's box and the task can be ended. NULL is an ordinary task; 'unfinished', 'unresolved' and 'undecided' are the three
-- kinds (`OPEN_KINDS`, read only through `parseOpenKind` in shared). A tag and a view only: it never changes what a tick pays. Letting one go
-- is the archive the nodes table already has (status 'archived'), so no new state. Owner only, in the export with the rest of nodes, gone
-- with the account, kept through an erase like any task.
ALTER TABLE nodes ADD COLUMN open_kind TEXT;

-- The view, the count on Home and the open-business cut read a person's open business; most tasks carry none, so a partial index stays small.
CREATE INDEX IF NOT EXISTS idx_nodes_user_open ON nodes (user_id, open_kind) WHERE open_kind IS NOT NULL;
