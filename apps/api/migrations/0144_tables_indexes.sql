-- 0144: indexes for All tables (2026-11-13, the founder: every list of a person's own data as a table). Each table page reads one person's rows,
-- sorted, a page at a time (LIMIT size + 1). D1 charges every row a statement visits, so a read that has no index on its owner column visits every
-- row of the whole table for every page anyone opens. Indexes only; nothing else changes.

-- Life map: a person's placements, newest first. Placements were found only by their assessment, so every page read every placement of everyone.
CREATE INDEX IF NOT EXISTS idx_placements_user ON placements (user_id, created_at);

-- Enrolments: the programs a person joined, newest first. Only (cohort, learner) was indexed, which a read by learner alone cannot use.
CREATE INDEX IF NOT EXISTS idx_enrollments_learner ON enrollments (learner_user_id, enrolled_at);

-- Hand-ins: a learner's own work, newest first. Only (assignment, cohort, learner) was indexed.
CREATE INDEX IF NOT EXISTS idx_submissions_learner ON submissions (learner_user_id, submitted_at);

-- Attendance: the sessions a person checked in to. The key leads with the session, so a read by person visited every check-in.
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance (user_id, checked_in_at);

-- Tasks and pyramids open newest first. (user_id, kind, status) found the rows but then sorted all of a person's tasks for each page; with the
-- time in the index a page stops after its rows. Tasks are written far less often than they are read, so the extra write a new task costs is small.
CREATE INDEX IF NOT EXISTS idx_nodes_user_kind_created ON nodes (user_id, kind, created_at);

-- Points, newest first: a person's ledger grows with every check-in, like and sale, and was indexed by person alone, so each page sorted all of it.
CREATE INDEX IF NOT EXISTS idx_points_user_created ON points_ledger (user_id, created_at);

-- Orders as the buyer, newest first: indexed by buyer alone, so each page sorted every order the person ever made.
CREATE INDEX IF NOT EXISTS idx_orders_buyer_created ON orders (buyer_id, created_at);
