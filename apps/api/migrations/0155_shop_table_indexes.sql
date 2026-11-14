-- 0155: All tables' Shop and creator tools (2026-11-14, the founder: "ok, add them"), each page's default sort through an index.
-- Each of these tables opens newest first (session hours by day, as Shop lists them) for its owner; the owner index each had led with a status
-- or a code (or there was none), so a page sorted every one of the person's rows. With these a page reads about as many rows as it shows.
-- Indexes only; nothing is rewritten.

-- Products, newest first. It also walks a creator's courses, newest first, for the course invites table (each course's invites by the index below).
CREATE INDEX IF NOT EXISTS idx_products_owner_created ON products (owner_id, created_at);

-- Coupons, newest first (Shop's own coupon list sorts the same way, and sorted them all before: the unique index leads with the code).
CREATE INDEX IF NOT EXISTS idx_coupons_owner_created ON coupons (owner_id, created_at);

-- Session hours had no index at all: by day, then start, exactly as Shop lists them (ORDER BY weekday, start_min).
CREATE INDEX IF NOT EXISTS idx_availability_owner_day ON availability (owner_id, weekday, start_min);

-- A course's invites, newest first, under each course in turn (the invite has no owner column; it is the person's through the course).
CREATE INDEX IF NOT EXISTS idx_product_invites_product_created ON product_invites (product_id, created_at);

-- Courses someone was invited to, newest first. It also serves every read of idx_product_invites_user (by user_id alone: the export, the delete,
-- Connect people's sheet, which sorts the same way), so that index goes: one write less per invite.
CREATE INDEX IF NOT EXISTS idx_product_invites_user_created ON product_invites (user_id, created_at);
DROP INDEX IF EXISTS idx_product_invites_user;

-- Reviews of a creator's products, newest first, whether shown or not (the older index leads with the approved flag, for the public page).
CREATE INDEX IF NOT EXISTS idx_testimonials_owner_created ON testimonials (owner_id, created_at);

-- Reviews someone wrote had no index by their writer at all.
CREATE INDEX IF NOT EXISTS idx_testimonials_author_created ON testimonials (author_id, created_at);

-- Priority DMs a creator was sent, newest first (the older index is by state, for the questions still to answer).
CREATE INDEX IF NOT EXISTS idx_dm_requests_owner_created ON dm_requests (owner_id, created_at);

-- Questions someone asked had no index by the buyer at all; My purchases reads them this way too (WHERE buyer_id ORDER BY created_at DESC).
CREATE INDEX IF NOT EXISTS idx_dm_requests_buyer_created ON dm_requests (buyer_id, created_at);

-- Broadcasts, after-purchase messages, funnels and Auto-DMs had no index by their owner at all; Audience and Auto-DM list them newest first too.
CREATE INDEX IF NOT EXISTS idx_broadcasts_owner_created ON broadcasts (owner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sequences_owner_created ON sequences (owner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_funnels_owner_created ON funnels (owner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dm_automations_owner_created ON dm_automations (owner_id, created_at);

-- Posts tracked in Content, newest first (the unique index leads with the post's link after the owner, so it sorted them all).
CREATE INDEX IF NOT EXISTS idx_content_items_owner_created ON content_items (owner_id, created_at);
