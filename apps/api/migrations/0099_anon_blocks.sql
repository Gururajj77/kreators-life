-- 0099: blocking the writer of an anonymous post, reply or line never tells the blocker who it was (the founder's yes, 2026-11-06).
-- Before this, /community/posts/:id/block-author (and the reply, channel and run discussion doors) wrote an ordinary `blocks` row,
-- and Bond's list of blocks named it by the real name and @handle, with the user id for Unblock.
--
-- `blocks` stays the one row the hiding reads (every NOT EXISTS over it is unchanged). `by_name` says whether the blocker named this
-- person themself (Bond's Block, a block from a post that was not anonymous): 1 is listed by name, 0 is only behind made-up names.
-- Rows from before stay 1: whether an older row came from an anonymous post was never kept.
ALTER TABLE blocks ADD COLUMN by_name INTEGER NOT NULL DEFAULT 1;

-- One row for each made-up name a block was made from. Bond lists it as that name with no id or handle, and Unblock sends this row's
-- `id`. Two names of the same writer are two rows, so the list never shows that they are one person. The `blocks` row goes when its
-- last name is lifted and it was not also made by name.
CREATE TABLE IF NOT EXISTS block_aliases (
  id TEXT PRIMARY KEY,
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (blocker_id, blocked_id, alias)
);
-- Bond's list pages a person's blocks newest first.
CREATE INDEX IF NOT EXISTS idx_block_aliases_blocker ON block_aliases (blocker_id, created_at);
