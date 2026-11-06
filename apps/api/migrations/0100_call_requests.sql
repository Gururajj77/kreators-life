-- 0100: the live call with a coach is a paid service the person asks for (the founder, 2026-11-06: "register it as a paid service").
-- Before this, ticking "I would like a live call" on the strategy session's contract only opened a note; nothing was kept and the
-- team never heard of it.
--
-- One row per ask. `status` is the one state (LIVE_CALL_STATUSES in shared): `asked` waits for the team while payments are not live,
-- `paying` has a provider order open, `paid` is written only by the payment webhook after its signature is checked (guarded on the
-- status it came from, so two events pay once), `booked` and `done` are the team's, `cancelled` ends an unpaid ask. The price is
-- kept as it was when asked, in paise. `user_id` is NULL only for a paid ask whose account was deleted: it stays for the books with
-- its amount and loses who it was for, like an invoice.
CREATE TABLE IF NOT EXISTS call_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'asked',
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  provider TEXT,
  provider_order_id TEXT,
  provider_payment_id TEXT,
  created_at TEXT NOT NULL,
  paid_at TEXT,
  updated_at TEXT NOT NULL
);
-- One open ask per person: asking again while one waits, is being paid or is paid and not yet held returns that one, and tells the
-- team nothing new. INSERT OR IGNORE leans on it.
CREATE UNIQUE INDEX IF NOT EXISTS idx_call_requests_open ON call_requests (user_id) WHERE status IN ('asked', 'paying', 'paid', 'booked');
-- The webhook finds an ask by the provider's order id.
CREATE INDEX IF NOT EXISTS idx_call_requests_order ON call_requests (provider_order_id) WHERE provider_order_id IS NOT NULL;
