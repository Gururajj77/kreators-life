-- 0102: Gratitude for the day, on Journal (2026-11-07, the founder: "gratitude for the day with prompts is missing for journal").
-- Its own small table rather than a `kind` on journal_entries: a day holds three lines, each under a prompt (a key from
-- '@kreators/shared/gratitude'), and there is one per person per day by the person's own day, which the primary key makes true
-- without a second check. Kept apart, it leaves every count read from journal_entries as it was (the journal streak, the badges,
-- Life's journal line, Emerging's journal days, the review numbers). Journal data: owner only, in the export, gone with the account,
-- and kept through an erase of progress like a journal entry.
CREATE TABLE gratitude_days (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- The person's own day, YYYY-MM-DD, from their device.
  day TEXT NOT NULL,
  -- [{ "prompt": "<group>-NN", "text": "..." }] x 3, read through parseGratitudeLines. A day with no words in any line has no row.
  lines_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  -- One day per person, and the index for a month's marks and a period's count (user_id, day range).
  PRIMARY KEY (user_id, day)
);
