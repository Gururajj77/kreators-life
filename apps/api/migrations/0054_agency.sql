-- Agency: a content agency or a freelance creator and their clients. Owner only, in the export, gone with the account.
-- Clients, the pieces of content made for them (a pipeline from idea to published), the time spent, and a link a client can open to
-- approve or send back what is waiting for them. Billing reuses the invoices table.

CREATE TABLE agency_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'INR',
  weekly_hours INTEGER NOT NULL DEFAULT 30,
  -- The person's own business details: who invoices come from, their bank, the look, the defaults. Owner only.
  profile_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE TABLE agency_clients (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  health TEXT NOT NULL DEFAULT 'green',
  channels_json TEXT NOT NULL DEFAULT '[]',
  retainer_cents INTEGER NOT NULL DEFAULT 0,
  pieces_per_month INTEGER NOT NULL DEFAULT 0,
  hours_per_month INTEGER NOT NULL DEFAULT 0,
  renewal_date TEXT,
  notes TEXT NOT NULL DEFAULT '',
  -- An Army campaign this person is a creator on, for a brand they serve there.
  campaign_id TEXT,
  -- What goes in "Billed to" on this client's invoices and in their contracts.
  billing_json TEXT NOT NULL DEFAULT '{}',
  portal_token TEXT UNIQUE,
  -- What the client sees at their link: a switch for each part, and whether they can approve or write.
  portal_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_agency_clients_user ON agency_clients(user_id, status);

CREATE TABLE agency_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES agency_clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'video',
  platform TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT 'idea',
  due_date TEXT,
  publish_date TEXT,
  link TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  -- The Army deliverable this one answers, when the brand is served through a campaign.
  army_deliverable_id TEXT,
  fee_cents INTEGER NOT NULL DEFAULT 0,
  revisions INTEGER NOT NULL DEFAULT 0,
  approved_at TEXT,
  published_at TEXT,
  -- The person's own day for each, from their device, so a month and a metric follow their calendar and not UTC.
  approved_day TEXT,
  published_day TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_agency_items_user ON agency_items(user_id, stage);
CREATE INDEX idx_agency_items_client ON agency_items(client_id, stage);

-- The conversation on a deliverable: what the person wrote, what the client wrote through their link, and what the brand
-- wrote in Army. A person's own note is private unless they share it with the client.
CREATE TABLE agency_notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES agency_items(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  shared INTEGER NOT NULL DEFAULT 0,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_agency_notes_item ON agency_notes(item_id, created_at);

CREATE TABLE agency_time (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES agency_clients(id) ON DELETE CASCADE,
  item_id TEXT REFERENCES agency_items(id) ON DELETE SET NULL,
  day TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  billable INTEGER NOT NULL DEFAULT 1,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_agency_time_user ON agency_time(user_id, day);
CREATE INDEX idx_agency_time_client ON agency_time(client_id, day);

-- An invoice made from a client's page remembers which client it came from.
ALTER TABLE invoices ADD COLUMN agency_client_id TEXT;
-- The designed invoice: title, both parties, bank, look, GST and TDS. The money columns stay the sum of it.
ALTER TABLE invoices ADD COLUMN doc_json TEXT NOT NULL DEFAULT '{}';
-- When the person last changed an invoice the client could already see; the client's page says "Revised".
ALTER TABLE invoices ADD COLUMN revised_at TEXT;
CREATE INDEX idx_invoices_agency_client ON invoices(agency_client_id);

-- Agreements made from a template: sections the person edits, a link the client opens to answer the brief and accept by typing their name.
CREATE TABLE agency_contracts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT REFERENCES agency_clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  template_key TEXT NOT NULL DEFAULT 'custom',
  status TEXT NOT NULL DEFAULT 'draft',
  doc_json TEXT NOT NULL,
  token TEXT UNIQUE,
  answers_json TEXT NOT NULL DEFAULT '{}',
  acceptance_json TEXT,
  sent_at TEXT,
  signed_at TEXT,
  revised_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_agency_contracts_user ON agency_contracts(user_id, status);

-- Comments on an invoice or an agreement: the client writes at their link to ask for a change, the person replies.
CREATE TABLE agency_doc_comments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_agency_doc_comments ON agency_doc_comments(doc_type, doc_id, created_at);

-- Business metrics in Reviews: only for people who switch them on. A metric is typed in each period or read from Agency.
CREATE TABLE kpi_prefs (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE kpis (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'number',
  direction TEXT NOT NULL DEFAULT 'up',
  cadence TEXT NOT NULL DEFAULT 'month',
  target INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_kpis_user ON kpis(user_id, cadence);

CREATE TABLE kpi_values (
  kpi_id TEXT NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
  period_start TEXT NOT NULL,
  value INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (kpi_id, period_start)
);
