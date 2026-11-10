-- 0131: the team's connections, after the break-it check of wave 27 (2026-11-10).
--
-- 1. Who made a connection, by rank when it was made (apps/api/src/connectRank.ts): 'key' for the admin key, 'admin' for an admin,
--    'staff' for a staff member. Ending, taking back or replacing a connection an admin or the key made is an admin's (the rank a guide's
--    undo follows, as community_mutes keeps muter_rank): reading the maker's role now let a row read as an admin's after its staff
--    maker was promoted, and as the key's once its maker's account was deleted (created_by goes NULL then). Rows made before read their
--    maker as they stand today, the best there is.
ALTER TABLE team_connections ADD COLUMN made_as TEXT NOT NULL DEFAULT 'staff';
UPDATE team_connections SET made_as = CASE
    WHEN created_by IS NULL THEN 'key'
    WHEN created_by IN (SELECT id FROM users WHERE role = 'admin') THEN 'admin'
    ELSE 'staff' END;

-- 2. One live row per real connection: naming a cohort's manager or a Club member's manager ends every row before it on that place
--    (setCohortManager, nameClubManager), so an older row never reads as live again when the same person is named later. The rows
--    already replaced take their end now: on each cohort and each Club membership, every open row but the newest.
UPDATE team_connections SET ended_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE kind IN ('cohort', 'club') AND ended_at IS NULL
    AND EXISTS (SELECT 1 FROM team_connections n WHERE n.kind = team_connections.kind AND n.ref_id = team_connections.ref_id
                AND (n.created_at > team_connections.created_at OR (n.created_at = team_connections.created_at AND n.id > team_connections.id)));

-- 3. A brand's ask that was answered no is over: it takes its end with its answer (orgs.ts), so it reads "Said no" for good and a later
--    yes to another ask never counts it as come true. The ones answered no before take it now.
UPDATE team_connections SET ended_at = answered_at
  WHERE kind = 'org' AND answered_at IS NOT NULL AND came_true_at IS NULL AND ended_at IS NULL;
