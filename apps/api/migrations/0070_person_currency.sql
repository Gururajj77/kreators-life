-- India first, open to all (2026-11-03): each person keeps their own money in a currency of their choice. Rupees are the
-- default; someone abroad switches under Profile (PATCH /me { currency }, checked by isCurrency in shared). Finance uses it
-- when an entry does not name one.
ALTER TABLE users ADD COLUMN currency TEXT NOT NULL DEFAULT 'INR';
