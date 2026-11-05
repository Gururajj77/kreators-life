-- 0083: an index for Agency pieces by due day (2026-11-05), in the style of 0060: the reason beside it.
--
-- Emerging's agency-load line (routes/insights.ts) reads the days a piece is due in its 84-day window:
--   WHERE user_id = ? AND due_date >= ? AND due_date <= ?.
-- Daily's Agency block (routes/today.ts, agencyToday: the pieces due and their count) asks WHERE user_id = ? AND due_date <= ? ORDER BY
-- due_date, and the private calendar link (routes/calendar.ts) WHERE user_id = ? AND due_date in a range. The only index by person was
-- (user_id, stage), which answers none of these ranges, so each read walked every piece the person ever made.
-- Equality column first, then the range and sort column. IF NOT EXISTS, so running it twice changes nothing.
CREATE INDEX IF NOT EXISTS idx_agency_items_user_due ON agency_items (user_id, due_date);
