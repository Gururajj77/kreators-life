-- 0119: A daily protein goal on Fitness (2026-11-07, the founder: "protien calculator should be also there"). Whole grams, nullable until the person sets one.
-- Only the goal is kept: the weight it was worked out from never leaves the browser. The grams themselves live in that day's eating check-in
-- (wellbeing_logs.extra), so nothing else changes. Owner only, in the export (fitnessPrefs), gone with the account, kept through an erase like the trackers.
-- It reaches no coach, Emerging, Reviews, the brief, the leaderboard, a badge, search, the assistant or the public page.
ALTER TABLE fitness_prefs ADD COLUMN protein_goal_g INTEGER;
