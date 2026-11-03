-- Safety indexes (2026-11-03, redundancy wave 2). Each one is the database's own last guard behind a check the code
-- already makes, so a race the code missed can never write a second row. Duplicates that may already exist are removed
-- first, keeping the earliest row (the lowest rowid), or the index could not be made.

-- dm_requests: one question per order. go.ts inserts it with WHERE NOT EXISTS (… order_id = ?), which two webhook
-- deliveries at the same instant could both pass. Partial on purpose: order_id is NOT NULL today, the WHERE keeps the
-- index honest if that ever changes.
DELETE FROM dm_requests
 WHERE order_id IS NOT NULL
   AND rowid NOT IN (SELECT MIN(rowid) FROM dm_requests WHERE order_id IS NOT NULL GROUP BY order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dm_requests_order ON dm_requests(order_id) WHERE order_id IS NOT NULL;

-- finance_transactions: an invoice is booked as income once. setInvoiceStatus in routes/finance.ts moves the status first
-- with a guarded UPDATE and books only when it moved; this index makes a second booking of the same invoice impossible.
-- Partial on purpose: a 'recurring' row reuses its recurring entry's id as ref every month (runRecurring), and a 'manual'
-- row has no ref, so only invoice rows are unique.
DELETE FROM finance_transactions
 WHERE source = 'invoice' AND ref IS NOT NULL
   AND rowid NOT IN (SELECT MIN(rowid) FROM finance_transactions WHERE source = 'invoice' AND ref IS NOT NULL GROUP BY user_id, source, ref);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_tx_invoice_once ON finance_transactions(user_id, source, ref) WHERE source = 'invoice' AND ref IS NOT NULL;
