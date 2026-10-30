-- Card games: a game is unlocked once with points (a reward of kind unlock) and played for good. The card text itself is
-- code (apps/api/src/cards-data.json), served only to a person who has the unlock, or to the team.
CREATE TABLE card_unlocks (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_key TEXT NOT NULL,
  redemption_id TEXT,
  unlocked_at TEXT NOT NULL,
  PRIMARY KEY (user_id, game_key)
);
