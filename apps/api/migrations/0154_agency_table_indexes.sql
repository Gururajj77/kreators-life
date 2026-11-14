-- 0154: All tables' Agency and Business metrics tables (2026-11-14, the founder: "ok, add them"), each page's default sort through an index.
-- Every one of these tables opens newest first for its owner; the owner index each had led with a status or a kind (or there was none), so a
-- page sorted every one of the person's rows. With these a page reads about as many rows as it shows. Indexes only; nothing is rewritten.

-- Agency clients, newest first (at most 60 a person, but the page should not sort them all).
CREATE INDEX IF NOT EXISTS idx_agency_clients_user_created ON agency_clients (user_id, created_at);

-- Agency pieces, newest first: a busy agency makes hundreds a year.
CREATE INDEX IF NOT EXISTS idx_agency_items_user_created ON agency_items (user_id, created_at);

-- The lines on pieces, newest first: they had only the piece's own index, so the person's whole thread was read through every piece.
CREATE INDEX IF NOT EXISTS idx_agency_notes_user_created ON agency_notes (user_id, created_at);

-- Invoices, newest first (Agency's list reads them this way too, by user and Agency client, and sorted them all before).
CREATE INDEX IF NOT EXISTS idx_invoices_user_created ON invoices (user_id, created_at);

-- Agreements and other documents, last changed first (their own lists sort the same way).
CREATE INDEX IF NOT EXISTS idx_agency_contracts_user_updated ON agency_contracts (user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_agency_docs_user_updated ON agency_docs (user_id, updated_at);

-- Retainers had no index by their owner at all, only by client and by status.
CREATE INDEX IF NOT EXISTS idx_agency_retainers_user_created ON agency_retainers (user_id, created_at);

-- The client log, newest first: it grows with every stage, password and month, and had only the client's own index.
CREATE INDEX IF NOT EXISTS idx_agency_log_user_created ON agency_log (user_id, created_at);

-- Saved templates, last changed first (Agency's own list sorts the same way).
CREATE INDEX IF NOT EXISTS idx_agency_templates_user_updated ON agency_templates (user_id, updated_at);

-- An Agency's team, the latest ask first.
CREATE INDEX IF NOT EXISTS idx_agency_team_owner_invited ON agency_team (owner_id, invited_at);

-- Business metrics, newest first; it also serves every read of idx_kpis_user (by user_id alone, and Reviews' own ORDER BY created_at), since
-- nothing reads metrics by their cadence in SQL, so that index goes: one write less per metric.
CREATE INDEX IF NOT EXISTS idx_kpis_user_created ON kpis (user_id, created_at);
DROP INDEX IF EXISTS idx_kpis_user;

-- A metric's values have no owner column, so no index of their own can start on the person: their page opens by metric, newest first, then
-- each metric's periods newest first, which this index (with its rowid) and each metric's primary key walk with no sort step. By the period
-- alone, a page would read every value the person typed and sort them (the review, 2026-11-14).

