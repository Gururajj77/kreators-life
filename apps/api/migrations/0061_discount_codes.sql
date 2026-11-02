-- 0061: discount codes the team makes, and what they took off.
--
-- A code is made by an admin (never by a creator: creators keep their own `coupons`, which are a separate thing and unchanged).
-- It takes a percent (basis points, 2500 = 25%) or a fixed amount (cents) off one of the paid areas, and the PLATFORM pays the
-- difference: the buyer is charged less, the seller is still credited on the list price. Whole numbers only.

CREATE TABLE IF NOT EXISTS discount_codes (
  id TEXT PRIMARY KEY,
  -- Upper case, letters, numbers and dashes. What a person types is looked up through this column.
  code TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('percent', 'fixed')),
  -- percent: 1 to 10000 (10000 = 100% off). fixed: 0.
  percent_bps INTEGER NOT NULL DEFAULT 0,
  -- fixed: the cents taken off, in `currency`. percent: 0.
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  -- JSON list of areas: product, program, event, plan, topup.
  applies_to TEXT NOT NULL DEFAULT '[]',
  -- Optional: one product, program, event, plan key or top-up key. NULL means every item in the areas.
  item_id TEXT,
  -- The least the list price must be, in cents, for the code to work. 0 means no least.
  min_cents INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  per_person_limit INTEGER NOT NULL DEFAULT 1,
  starts_at TEXT,
  ends_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
-- Every checkout looks a typed code up by this column, and it is how two codes are kept from sharing a word.
CREATE UNIQUE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes (code);
-- Admin, Discount codes: the newest first, filtered by on/off.
CREATE INDEX IF NOT EXISTS idx_discount_codes_list ON discount_codes (active, created_at DESC);

CREATE TABLE IF NOT EXISTS discount_redemptions (
  id TEXT PRIMARY KEY,
  code_id TEXT NOT NULL REFERENCES discount_codes(id),
  user_id TEXT NOT NULL,
  area TEXT NOT NULL,
  -- The order, enrolment or registration the code was used on. One redemption per code and thing, so a retry cannot redeem twice.
  ref TEXT NOT NULL,
  item_id TEXT,
  off_cents INTEGER NOT NULL DEFAULT 0,
  off_points INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  -- Set when the payment failed or never finished, which gives the use back. A refund does not set it.
  released_at TEXT,
  created_at TEXT NOT NULL
);
-- A retry of the same order cannot redeem the same code twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_discount_redemptions_ref ON discount_redemptions (code_id, ref);
-- "How many times has this person used this code": WHERE code_id = ? AND user_id = ? AND released_at IS NULL, inside the guarded insert.
CREATE INDEX IF NOT EXISTS idx_discount_redemptions_person ON discount_redemptions (code_id, user_id, released_at);
-- Giving a use back when a payment fails or expires finds the redemption by the order: WHERE ref = ?.
CREATE INDEX IF NOT EXISTS idx_discount_redemptions_order ON discount_redemptions (ref);
-- The person's export and the delete: WHERE user_id = ?.
CREATE INDEX IF NOT EXISTS idx_discount_redemptions_user ON discount_redemptions (user_id);

-- What an order was before and after a code. `cents` and `points` stay what the buyer actually paid (the webhook checks `cents`
-- against the provider's amount, and a refund returns it); the list_* columns are the price before the code, which is what the
-- seller is settled on and what a refund takes back from them. 0 on an order made before this migration or without a code.
ALTER TABLE orders ADD COLUMN list_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN list_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN discount_code_id TEXT;
ALTER TABLE orders ADD COLUMN discount_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN discount_points INTEGER NOT NULL DEFAULT 0;

-- A ticket paid with a code costs less than the list price, so cancelling must give back what was paid. NULL means the full price.
ALTER TABLE event_registrations ADD COLUMN paid_points INTEGER;
