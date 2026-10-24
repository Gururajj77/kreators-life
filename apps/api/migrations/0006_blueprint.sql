ALTER TABLE users ADD COLUMN permissions TEXT NOT NULL DEFAULT '[]';
ALTER TABLE users ADD COLUMN skills TEXT NOT NULL DEFAULT '[]';
ALTER TABLE users ADD COLUMN categories TEXT NOT NULL DEFAULT '[]';
ALTER TABLE users ADD COLUMN goals TEXT NOT NULL DEFAULT '[]';
ALTER TABLE users ADD COLUMN experience_level TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN availability TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN location TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN open_to_intros INTEGER NOT NULL DEFAULT 0;
ALTER TABLE module_settings ADD COLUMN rollout INTEGER NOT NULL DEFAULT 100;

CREATE TABLE flag_overrides (
  id TEXT PRIMARY KEY,
  flag_key TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  expires_at TEXT,
  reason TEXT NOT NULL DEFAULT '',
  created_by TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_flag_overrides_key ON flag_overrides(flag_key);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  before_summary TEXT NOT NULL DEFAULT '',
  after_summary TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'brand',
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE organization_members (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE portfolio_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public',
  created_at TEXT NOT NULL
);

CREATE TABLE support_tickets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  reply TEXT NOT NULL DEFAULT '',
  replied_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE blocks (
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);

-- Army
CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_user_id TEXT,
  name TEXT NOT NULL,
  brief TEXT NOT NULL DEFAULT '',
  budget_amount INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  start_date TEXT,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'lead',
  usage_rights TEXT NOT NULL DEFAULT '',
  exclusivity_terms TEXT NOT NULL DEFAULT '',
  brand_restrictions TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_campaigns_org ON campaigns(organization_id);
CREATE TABLE campaign_deliverables (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT '',
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  approved_at TEXT,
  final_url TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE campaign_assignments (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  creator_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'creator',
  fee_amount INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'offered',
  terms_accepted_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (campaign_id, creator_user_id)
);
CREATE TABLE deliverable_versions (
  id TEXT PRIMARY KEY,
  deliverable_id TEXT NOT NULL REFERENCES campaign_deliverables(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  url TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  submitted_by TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending'
);
CREATE TABLE feedback_items (
  id TEXT PRIMARY KEY,
  deliverable_version_id TEXT NOT NULL REFERENCES deliverable_versions(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL,
  comment TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL
);
CREATE TABLE campaign_events (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  actor_user_id TEXT,
  event_type TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

-- School
CREATE TABLE programs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_points INTEGER NOT NULL DEFAULT 0,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  delivery_mode TEXT NOT NULL DEFAULT 'online',
  published INTEGER NOT NULL DEFAULT 0,
  outcomes TEXT NOT NULL DEFAULT '',
  prerequisites TEXT NOT NULL DEFAULT '',
  created_by TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE cohorts (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'upcoming',
  manager_user_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE enrollments (
  id TEXT PRIMARY KEY,
  cohort_id TEXT NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  learner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'enrolled',
  payment_status TEXT NOT NULL DEFAULT 'free',
  enrolled_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE (cohort_id, learner_user_id)
);
CREATE TABLE learning_items (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  module_title TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'lesson',
  content_ref TEXT,
  body TEXT NOT NULL DEFAULT '',
  sequence INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE course_assignments (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  rubric TEXT NOT NULL DEFAULT '',
  due_days INTEGER NOT NULL DEFAULT 7,
  sequence INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES course_assignments(id) ON DELETE CASCADE,
  cohort_id TEXT NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  learner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT,
  text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'submitted',
  submitted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (assignment_id, cohort_id, learner_user_id)
);
CREATE TABLE submission_feedback (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  reviewer_user_id TEXT NOT NULL,
  comment TEXT NOT NULL,
  grade TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE cohort_sessions (
  id TEXT PRIMARY KEY,
  cohort_id TEXT NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  online_url TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE attendance (
  session_id TEXT NOT NULL REFERENCES cohort_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'present',
  checked_in_at TEXT NOT NULL,
  PRIMARY KEY (session_id, user_id)
);

-- Work
CREATE TABLE opportunities (
  id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  created_by TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  opportunity_type TEXT NOT NULL DEFAULT 'gig',
  skills_required TEXT NOT NULL DEFAULT '[]',
  location_mode TEXT NOT NULL DEFAULT 'remote',
  location_text TEXT NOT NULL DEFAULT '',
  compensation_min INTEGER,
  compensation_max INTEGER,
  currency TEXT NOT NULL DEFAULT 'INR',
  deliverables TEXT NOT NULL DEFAULT '',
  deadline TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  eligibility TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  published_at TEXT,
  closed_at TEXT
);
CREATE INDEX idx_opportunities_status ON opportunities(status, deadline);
CREATE TABLE applications (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  creator_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cover_note TEXT NOT NULL DEFAULT '',
  portfolio_snapshot TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'submitted',
  submitted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  decision_at TEXT,
  UNIQUE (opportunity_id, creator_user_id)
);
CREATE TABLE application_events (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  actor_user_id TEXT,
  event_type TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

-- Party
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  event_type TEXT NOT NULL DEFAULT 'meetup',
  host_user_id TEXT NOT NULL,
  venue TEXT NOT NULL DEFAULT '',
  online_url TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  capacity INTEGER,
  price_points INTEGER NOT NULL DEFAULT 0,
  visibility TEXT NOT NULL DEFAULT 'public',
  status TEXT NOT NULL DEFAULT 'published',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_events_starts ON events(starts_at);
CREATE TABLE event_registrations (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'registered',
  registered_at TEXT NOT NULL,
  checked_in_at TEXT,
  networking_opt_in INTEGER NOT NULL DEFAULT 0,
  UNIQUE (event_id, user_id)
);
CREATE TABLE event_feedback (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE (event_id, user_id)
);

-- Club, Win, Bond, Tools, proposals
CREATE TABLE memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  membership_type TEXT NOT NULL DEFAULT 'club',
  status TEXT NOT NULL DEFAULT 'applied',
  note TEXT NOT NULL DEFAULT '',
  decision_note TEXT NOT NULL DEFAULT '',
  approved_by TEXT,
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, membership_type)
);
CREATE TABLE bounties (
  id TEXT PRIMARY KEY,
  created_by TEXT NOT NULL,
  organization_id TEXT,
  title TEXT NOT NULL,
  brief TEXT NOT NULL DEFAULT '',
  budget_points INTEGER NOT NULL DEFAULT 0,
  reward_rule TEXT NOT NULL DEFAULT '',
  eligibility TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT '',
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE bounty_submissions (
  id TEXT PRIMARY KEY,
  bounty_id TEXT NOT NULL REFERENCES bounties(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted',
  evidence_views INTEGER,
  evidence_note TEXT NOT NULL DEFAULT '',
  payout_points INTEGER NOT NULL DEFAULT 0,
  reviewer_id TEXT,
  dispute_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (bounty_id, user_id)
);
CREATE TABLE introductions (
  id TEXT PRIMARY KEY,
  requester_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  context TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'proposed',
  consent_at TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Editing',
  url TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  affiliate INTEGER NOT NULL DEFAULT 0,
  verified INTEGER NOT NULL DEFAULT 0,
  suggested_by TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE proposals (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  pitch TEXT NOT NULL DEFAULT '',
  budget_amount INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  stage TEXT NOT NULL DEFAULT 'submitted',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE decision_log (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  actor_user_id TEXT,
  from_stage TEXT NOT NULL,
  to_stage TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

INSERT INTO tools (id, name, category, url, description, affiliate, verified, suggested_by, created_at) VALUES
('tool-capcut', 'CapCut', 'Editing', 'https://www.capcut.com', 'Free phone and desktop editor with captions and templates.', 0, 1, NULL, '2026-10-24T00:00:00Z'),
('tool-davinci', 'DaVinci Resolve', 'Editing', 'https://www.blackmagicdesign.com/products/davinciresolve', 'Professional editing and color, free tier.', 0, 1, NULL, '2026-10-24T00:00:00Z'),
('tool-descript', 'Descript', 'Audio', 'https://www.descript.com', 'Edit audio and video by editing the transcript.', 0, 1, NULL, '2026-10-24T00:00:00Z'),
('tool-canva', 'Canva', 'Design', 'https://www.canva.com', 'Thumbnails, carousels and simple motion.', 0, 1, NULL, '2026-10-24T00:00:00Z'),
('tool-notion', 'Notion', 'Scheduling', 'https://www.notion.so', 'Content calendar and briefs in one place.', 0, 1, NULL, '2026-10-24T00:00:00Z');
