-- 0095: the order of School's programs, set by an admin from School (the founder, 2026-11-06: Onboarding is the first course in
-- School for everyone, and the order stays editable).
--
-- `sort_position`: NULL until an admin places it. School lists programs by state as before (public, private, draft, archived), and
-- inside each state the placed ones first by position, then the rest newest first (`PROGRAM_ORDER` in routes/school.ts). "Show
-- first", "Move up" and "Move down" (POST /school/programs/:id/move, admin only, audited `program.order`) number every program again
-- from 1 in the order School shows, so the first move keeps what people already saw. 0096 places Onboarding at 0, first of all.
-- No index: School reads programs a page at a time and the table holds tens of rows.

ALTER TABLE programs ADD COLUMN sort_position INTEGER;
