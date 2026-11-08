-- 0114: indexes for reads a quiet cron tick, an open page or a delete made over whole tables (the review of 2026-11-07, docs/performance.md). D1 charges every row a
-- statement visits, and the cron runs 96 times a day, so each of these was paid for whether anyone used the app or not.

-- syncStageFromAgreements looks for a client's agreements, per early-stage client, on every tick and on each client page and client link opened. Agreements were only
-- indexed by owner. 100 agencies with 1,000 clients and agreements read 251,000 rows a tick.
CREATE INDEX IF NOT EXISTS idx_agency_contracts_client ON agency_contracts (client_id, status);
-- And only the clients still early on are looked at: every other client's row is never read.
CREATE INDEX IF NOT EXISTS idx_agency_clients_early ON agency_clients (id) WHERE stage IN ('enquiry', 'agreement_sent');

-- tidyOld, every tick: rate limits past their window. Without it the whole table is read to delete a few rows.
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits (window_start);

-- tidyOld, every tick: notes written to a deleted account. Only the deleted rows are in this one, so the rest of users is never read.
CREATE INDEX IF NOT EXISTS idx_users_deleted ON users (id) WHERE display_name = 'Deleted member' AND handle IS NULL;

-- The life dashboard's stillness read checks each mindful log against the person's focus rounds by `log_id`, so the cost grew with the square of how much someone focuses:
-- 441,332 rows for one open at four rounds a day for 300 days.
CREATE INDEX IF NOT EXISTS idx_focus_rounds_log ON focus_rounds (log_id, user_id) WHERE log_id IS NOT NULL;

-- sendAgencyDueNotes and sendInvoiceNotes, every tick: what falls due within a day or a week. Without these every person's pieces and invoices were read.
CREATE INDEX IF NOT EXISTS idx_agency_items_due ON agency_items (due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_sent_due ON invoices (due_date) WHERE status = 'sent' AND due_date IS NOT NULL;

-- deleteAccount: mail and audit lines are few, so an index costs little beside the whole-table reads it saves. app_logs is left out on purpose: it is written on every logged
-- change, and rows written are the scarcer budget. rate_limits' delete matches the end of a key, which no index can serve, and that table holds only live windows.
CREATE INDEX IF NOT EXISTS idx_email_outbox_user ON email_outbox (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_outbox_to ON email_outbox (to_email);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs (resource_type, resource_id);
