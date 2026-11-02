-- Agency documents: other kinds of paper beside invoices and agreements (a strategy session summary, trial video terms, a retainer
-- proposal, a monthly report), house templates the super admin makes for everyone, and a private log of what was done with a document.
-- The look of a document (letterhead, font, size, page, margins, footer) lives inside each document's own JSON, so no column is added for it.

-- One generic table for the other documents. body_json is a document in the same shape as an agreement (title, sections, vars, style), so the
-- same page, the same text version and the same editor serve every kind. Owner only; the client sees one by its token, once it is sent.
CREATE TABLE agency_docs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT REFERENCES agency_clients(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  body_json TEXT NOT NULL,
  token TEXT UNIQUE,
  answers_json TEXT NOT NULL DEFAULT '{}',
  approval_json TEXT,
  sent_at TEXT,
  approved_at TEXT,
  revised_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_agency_docs_user ON agency_docs(user_id, kind, status);
CREATE INDEX idx_agency_docs_client ON agency_docs(client_id);

-- Templates the super admin makes for every Agency user to start from. A person uses one by copying it into their own documents;
-- nobody but an admin changes one. It never carries who a document was for, and carries the admin's own business details (sender, bank,
-- tax numbers, logo) only when include_business is set. Nothing is seeded.
CREATE TABLE agency_house_templates (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  doc_json TEXT NOT NULL,
  items_json TEXT NOT NULL DEFAULT '[]',
  include_business INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_agency_house_templates_status ON agency_house_templates(status, kind);

-- What was done with a document, for its owner only: emailed a copy, approved. A line, never the document's words.
CREATE TABLE agency_doc_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  event TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_agency_doc_log_doc ON agency_doc_log(user_id, doc_type, doc_id, created_at);
