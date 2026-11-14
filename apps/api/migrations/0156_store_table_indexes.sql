-- 0156: All tables' Content, Store, Tools and Rewards (2026-11-14, the founder: "ok, add them"), each page's default sort through an index.
-- The brand folders' tables walk brands_owner and each kind's own index by folder; a seller's offers and chats walk idx_preowned_seller and
-- the offers' and the chat's own indexes; a buyer's offers read idx_offers_buyer; a game's unlock reads its own key. These three had no index
-- that starts on the person and keeps the page's order, so a page sorted every one of the person's rows. Indexes only; nothing is rewritten.

-- Rewards reserved, newest first (Rewards lists them the same way: WHERE user_id ORDER BY created_at DESC). It also serves every read of
-- idx_redemptions_user (by user_id alone: the export, the delete and its cancel of open ones), so that index goes: one write less per reservation.
CREATE INDEX IF NOT EXISTS idx_redemptions_user_created ON redemptions (user_id, created_at);
DROP INDEX IF EXISTS idx_redemptions_user;

-- A buyer's side of the Store's chats had no index by the buyer at all, only the thread's (by listing, then buyer): a person's chats as a buyer
-- were found by reading every line. It also serves the delete's cascade on the buyer.
CREATE INDEX IF NOT EXISTS idx_preowned_messages_buyer_created ON preowned_messages (buyer_id, created_at);

-- Tools a person suggested had no index by who suggested them; Tools reads them by suggested_by too (a person's own unchecked suggestions).
CREATE INDEX IF NOT EXISTS idx_tools_suggested_created ON tools (suggested_by, created_at);
