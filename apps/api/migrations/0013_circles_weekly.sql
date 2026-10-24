-- Circles run every week: an occurrence can repeat, chained by series_id, and the cron opens the next one.
-- Each signup records how the person will show up (single, committed, rather not say) so the table can tell them what to wear.
ALTER TABLE circle_events ADD COLUMN repeat TEXT NOT NULL DEFAULT 'none';
ALTER TABLE circle_events ADD COLUMN series_id TEXT;
ALTER TABLE circle_signups ADD COLUMN status TEXT NOT NULL DEFAULT '';
ALTER TABLE circle_members ADD COLUMN status TEXT NOT NULL DEFAULT '';
UPDATE circle_events SET series_id = id WHERE series_id IS NULL;
