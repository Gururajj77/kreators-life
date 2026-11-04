-- 2026-11-04 (founder): "if void is an option so should be retrieve". A voided invoice or agreement can be restored to exactly the
-- status it had before it was voided, so the void now keeps that status beside it. NULL means no record (a void made before this
-- migration, or never voided); restoring one of those brings it back as a draft. Restore is POST /agency/invoices/:id/restore and
-- /agency/contracts/:id/restore, guarded on status = 'void' so two taps restore once.
ALTER TABLE invoices ADD COLUMN voided_from TEXT DEFAULT NULL;
ALTER TABLE agency_contracts ADD COLUMN voided_from TEXT DEFAULT NULL;
-- Voiding an agreement closes its client link (token = NULL); the link is kept here so a restored sent or signed agreement opens
-- at the same address as before. Never sent to anyone while the agreement is void.
ALTER TABLE agency_contracts ADD COLUMN voided_token TEXT DEFAULT NULL;
-- Other documents have no Void today; the column is here so one added later keeps the same shape.
ALTER TABLE agency_docs ADD COLUMN voided_from TEXT DEFAULT NULL;
