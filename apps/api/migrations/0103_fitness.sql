-- Fitness (2026-11-07): movement and a daily eating check-in, both rows of wellbeing_logs, so the export, the account delete and the
-- owner-only reads already cover them and no new table is needed. Movement stays the `move` kind (minutes in value; kind, metres and
-- effort in extra). Eating is the new `eat` kind (how well you ate, 1 to 5, in value; servings of fruit and vegetables, meals with
-- protein and meals without a screen in extra).
--
-- One eating check-in a day: the route replaces the day's row in one batch, and this index holds the rule even for two saves at once.
-- Partial, so mood, sleep and stress (one a day by the route alone) and movement (many a day) are untouched.
CREATE UNIQUE INDEX IF NOT EXISTS idx_wb_eat_one_a_day ON wellbeing_logs(user_id, date) WHERE kind = 'eat';
