-- 0086: four states for a School program (the founder, 2026-11-06): draft, private, public, archived.
--
-- Draft: only its creator, the managers of its cohorts and admins see it. Private: invite only, hidden from every list, search and
-- Explore; the people in program_invites see it and can enrol. Public: listed for everyone, as before. Archived: hidden from everyone
-- but its creator, managers and admins, takes no new enrolments, keeps what enrolled people already have, and is the only state a
-- program can be deleted from for good. Admins see and change every program.
--
-- `published` stays and is kept in step (1 exactly when visibility is public), so the older readers (Explore, the books, discount codes,
-- Admin's listings) keep working. Admin's listings still flip `published` on its own, so the routes read the state through one
-- expression (`VIS` in routes/school.ts): published = 1 is public, and a public row whose published went to 0 reads as a draft.

ALTER TABLE programs ADD COLUMN visibility TEXT NOT NULL DEFAULT 'draft';
UPDATE programs SET visibility = CASE WHEN published = 1 THEN 'public' ELSE 'draft' END;

-- The people invited to a private program. Goes with the program (the foreign key, and the delete route) and with the account
-- (account.ts); in the person's export (me.ts).
CREATE TABLE program_invites (
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  invited_by TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (program_id, user_id)
);
-- A person's invites: what they may see on School, their export and the account delete.
CREATE INDEX idx_program_invites_user ON program_invites (user_id);
