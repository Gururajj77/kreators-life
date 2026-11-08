-- 0106: Gratitude prompts per person (2026-11-07, the founder: "can the pillars for gratitude be changed? and the prompts never be
-- repeated?"). The day's prompts were the same for everyone; now each person goes through every prompt of a group before any comes
-- back, can pick the pillar of an empty line, and can pin a usual three. The rules are in '@kreators/shared/gratitude'; these tables
-- keep what the rules need. Journal data, like gratitude_days: owner only, every read and write filters by the session user, in the
-- export, gone with the account, and kept through an erase of progress (the marks with the days they came from).

-- The prompts on a day's three lines, in their order, worked out once when the day is first opened (today or yesterday) and then kept,
-- so a reload, another tab or another device shows the same three. Another prompt and the pillar picker change it, guarded on the
-- exact list they read, so two taps or two tabs never change it twice. Only the open days matter: older rows are pruned as new ones
-- are made, and a written day keeps its own prompts in gratitude_days.
CREATE TABLE gratitude_offers (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- The person's own day, YYYY-MM-DD.
  day TEXT NOT NULL,
  -- ["<group>-NN", x3], three different groups.
  prompts_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, day)
);

-- The prompts a person has seen, by group and round: written under on any day, or skipped with Another prompt. A prompt only shown on
-- a day they did not write is not here, so it can come back. A round is over once it holds every prompt of the group; the next one
-- starts empty. Marks are never taken back, so a line written and then cleared still counts as written.
CREATE TABLE gratitude_seen (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- The prompt's group (the key before its number), so a group's latest round is one lookup.
  grp TEXT NOT NULL,
  prompt TEXT NOT NULL,
  round INTEGER NOT NULL CHECK (round >= 0),
  how TEXT NOT NULL CHECK (how IN ('wrote', 'skipped')),
  -- The person's day it was seen on.
  day TEXT NOT NULL,
  seen_at TEXT NOT NULL,
  -- One mark per prompt and round, so the same save or two taps at once never mark it twice; also the index for a group's rounds.
  PRIMARY KEY (user_id, grp, round, prompt)
);

-- The usual three: when set, each new day starts with these groups, in this order, instead of the rotation. One row per person.
CREATE TABLE gratitude_prefs (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  -- ["<group>", x3], three different groups.
  usual_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- The days already written count as seen: every line with words, in round 0.
INSERT OR IGNORE INTO gratitude_seen (user_id, grp, prompt, round, how, day, seen_at)
SELECT g.user_id,
  substr(json_extract(j.value, '$.prompt'), 1, length(json_extract(j.value, '$.prompt')) - 3),
  json_extract(j.value, '$.prompt'),
  0,
  'wrote',
  g.day,
  g.updated_at
FROM gratitude_days g, json_each(g.lines_json) j
WHERE json_type(j.value, '$.prompt') = 'text'
  AND json_extract(j.value, '$.prompt') LIKE '%-__'
  AND trim(coalesce(json_extract(j.value, '$.text'), '')) <> '';
