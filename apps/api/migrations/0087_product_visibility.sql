-- 0087: who can see a private course in the Shop (2026-11-06, the founder: courses are Draft, Private, Public or Archived).
--
-- A course product's status keeps its stored words: 'live' is shown as Public, and 'private' is new. A private course is invite only:
-- it is in no list, search, Explore, public page, storefront or bundle, and its page and checkout answer 404 to anyone but its owner,
-- an admin and the people on this list. The owner (or an admin) adds people by email, @username or friend code, and each invitee is
-- told in the inbox. A row goes with the product (ON DELETE CASCADE) and with either account (account.ts), and is in the export.
CREATE TABLE IF NOT EXISTS product_invites (
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_by TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (product_id, user_id)
);
-- The product page and checkout ask "is this person invited?" by (product_id, user_id), which the primary key answers. A person's
-- export and the account delete ask by user_id alone, which it does not, so this index answers those.
CREATE INDEX IF NOT EXISTS idx_product_invites_user ON product_invites (user_id);
