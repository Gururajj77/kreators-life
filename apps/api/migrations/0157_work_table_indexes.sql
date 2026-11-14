-- 0157: All tables' Work, Win, Army, TV, Fund and Club (2026-11-14, the founder: "ok, add them"), each page's default sort through an index.
-- These tables had no index that starts on the person and keeps the page's order, so a page read every row of theirs (or, for listings,
-- applications, roles, work sent and pitches, every row of everyone's) and sorted them. Several also serve the app's own reads, which scanned
-- the same way. Indexes only; nothing is rewritten.

-- Listings you posted, newest first. Work's own read of a poster's drafts (created_by) scanned every listing; and Applications to your listings
-- walks the poster's listings by this index first.
CREATE INDEX IF NOT EXISTS idx_opportunities_created_by ON opportunities (created_by, created_at);

-- Your applications, changed last first: Work lists them the same way (WHERE creator_user_id ORDER BY updated_at DESC), which read every
-- application before. Application history walks them by this index first.
CREATE INDEX IF NOT EXISTS idx_applications_creator_updated ON applications (creator_user_id, updated_at);

-- Applications to your listings, each listing's newest first: a listing's page lists them the same way (WHERE opportunity_id ORDER BY
-- submitted_at DESC); the unique key (opportunity_id, creator_user_id) found them but kept them out of that order.
CREATE INDEX IF NOT EXISTS idx_applications_opportunity_submitted ON applications (opportunity_id, submitted_at);

-- Application history: each application's steps, newest first. There was no index by application at all.
CREATE INDEX IF NOT EXISTS idx_application_events_application ON application_events (application_id, created_at);

-- Rewards you launched, newest first. There was no index by who launched a reward.
CREATE INDEX IF NOT EXISTS idx_bounties_created_by ON bounties (created_by, created_at);

-- Your campaign roles, newest first: Army's own list of offers waiting (WHERE creator_user_id AND status) read every role before.
CREATE INDEX IF NOT EXISTS idx_campaign_assignments_creator ON campaign_assignments (creator_user_id, created_at);

-- Work you sent in Army, newest first, and Feedback on your work, which walks the person's versions by this index first.
CREATE INDEX IF NOT EXISTS idx_deliverable_versions_submitted_by ON deliverable_versions (submitted_by, submitted_at);

-- Feedback on your work: each version's comments, newest first. There was no index by version; a campaign's page read every comment.
CREATE INDEX IF NOT EXISTS idx_feedback_items_version ON feedback_items (deliverable_version_id, created_at);

-- Your brands' campaigns, each brand's changed last first (Army lists a brand's campaigns the same way). It serves every read of
-- idx_campaigns_org (by organization_id alone), so that index goes: one write less per campaign.
CREATE INDEX IF NOT EXISTS idx_campaigns_org_updated ON campaigns (organization_id, updated_at);
DROP INDEX IF EXISTS idx_campaigns_org;

-- A campaign's pieces, in the order a campaign's page lists them (WHERE campaign_id ORDER BY created_at), and the count of pieces on each row
-- of Your brands' campaigns. There was no index by campaign, so each count read every piece of every campaign.
CREATE INDEX IF NOT EXISTS idx_campaign_deliverables_campaign ON campaign_deliverables (campaign_id, created_at);

-- Your brands' campaign log: each campaign's lines, newest first (a campaign's page reads What happened the same way, and scanned every line).
CREATE INDEX IF NOT EXISTS idx_campaign_events_campaign ON campaign_events (campaign_id, created_at);

-- Your brands, the one joined last first, and the brands walked first by Your brands' teams, campaigns and campaign log.
CREATE INDEX IF NOT EXISTS idx_org_members_user_created ON organization_members (user_id, created_at);

-- Your brands' teams: each brand's team, newest first (Army's team list reads WHERE organization_id ORDER BY created_at the same way).
CREATE INDEX IF NOT EXISTS idx_org_members_org_created ON organization_members (organization_id, created_at);

-- TV pitches and Fund applications, each by its kind, changed last first: TV and Fund list a person's own the same way (WHERE kind AND
-- user_id ORDER BY updated_at DESC), which read every pitch before. There was no index by who pitched.
CREATE INDEX IF NOT EXISTS idx_proposals_user_kind_updated ON proposals (user_id, kind, updated_at);
