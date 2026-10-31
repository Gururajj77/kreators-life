-- A person's own starting points for invoices and agreements: saved from one they made, used to begin the next.
-- Owner only, in the export, gone with the account. An invoice template keeps the look, the sender, the bank, GST and TDS and the lines
-- but never who it is billed to; an agreement template keeps the sections but not the names filled in.
CREATE TABLE agency_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  doc_json TEXT NOT NULL,
  items_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_agency_templates_user ON agency_templates(user_id, kind);
