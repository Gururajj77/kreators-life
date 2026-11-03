-- The strategy session's "Not part of my life right now" for love, teachers and faith (OPTIONAL_PILLARS in shared).
-- Why a column: no JSON on the assessment row can hold it. scores_json and real_day_json are typed objects other code
-- reads whole (the scorecard, the routine), and the placements table keeps one row of levels per pillar. The list is the
-- optional pillars the person set aside; they are placed at Neutrality (250) and left out of the focus and the order.
ALTER TABLE assessments ADD COLUMN away_json TEXT NOT NULL DEFAULT '[]';
