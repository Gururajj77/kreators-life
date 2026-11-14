-- 0158: All tables' Party, Kreators Run and Circles (2026-11-14, the founder: "ok, add them"), each page's default sort through an index.
-- These tables had no index that starts on the person and keeps the page's order, so a page read every row of theirs (or, for events and clubs
-- hosted, and runs and lines at a club or a collab, every row of everyone's) and sorted them. Several also serve the app's own reads, which
-- scanned the same way. Indexes only; nothing is rewritten.

-- Events you host, starting last first. Party's own What you host (WHERE host_user_id ORDER BY starts_at DESC) read every event before; and
-- Guests at your events walks the host's events by this index first.
CREATE INDEX IF NOT EXISTS idx_events_host_starts ON events (host_user_id, starts_at);

-- Events you signed up for, newest first. idx_event_reg_user (user_id, status) found them but kept them out of that order.
CREATE INDEX IF NOT EXISTS idx_event_reg_user_registered ON event_registrations (user_id, registered_at);

-- Guests at your events: each event's guests by when they signed up. An event's page lists them the same way for its host (WHERE event_id
-- ORDER BY registered_at); the unique key (event_id, user_id) found them but kept them out of that order.
CREATE INDEX IF NOT EXISTS idx_event_reg_event_registered ON event_registrations (event_id, registered_at);

-- Your event feedback, newest first. There was no index by who left it.
CREATE INDEX IF NOT EXISTS idx_event_feedback_user ON event_feedback (user_id, created_at);

-- Your lines in event talk, newest first. There was no index by who wrote a line; the export and the account delete scanned for them too.
CREATE INDEX IF NOT EXISTS idx_event_messages_user ON event_messages (user_id, created_at);

-- Clubs you host, newest first, and the clubs walked first by Runs you host and Runs logged at your clubs. There was no index by host.
CREATE INDEX IF NOT EXISTS idx_run_clubs_host ON run_clubs (host_user_id, created_at);

-- Clubs you are in, joined last first. idx_run_members_user (user_id, status) found them but kept them out of that order.
CREATE INDEX IF NOT EXISTS idx_run_members_user_joined ON run_members (user_id, joined_at);

-- Runs you logged, newest first, whatever their state. idx_run_entries_user (user_id, status, logged_at) keeps that order only within a state.
CREATE INDEX IF NOT EXISTS idx_run_entries_user_logged ON run_entries (user_id, logged_at);

-- Runs logged at your clubs: each club's entries, newest first. A club's page lists them the same way for its host (WHERE club_id ORDER BY
-- logged_at DESC) and adds up its month's board by club, both of which read every entry before.
CREATE INDEX IF NOT EXISTS idx_run_entries_club_logged ON run_entries (club_id, logged_at);

-- Brand collabs you posted, newest first. There was no index by who posted a collab; Kreators Run's own list of a poster's collabs scanned.
CREATE INDEX IF NOT EXISTS idx_run_collabs_created_by ON run_collabs (created_by, created_at);

-- Collabs your clubs applied to, newest first. There was no index by the club's host who applied.
CREATE INDEX IF NOT EXISTS idx_run_collab_apps_user ON run_collab_applications (user_id, created_at);

-- Clubs that applied to your collabs: each collab's applications, newest first, as Brand collabs lists them for its poster (ORDER BY created_at
-- DESC). The unique key (collab_id, club_id) found them but kept them out of that order.
CREATE INDEX IF NOT EXISTS idx_run_collab_apps_collab ON run_collab_applications (collab_id, created_at);

-- Your lines at circle tables, newest first. There was no index by who wrote a line; the export and the account delete scanned for them too.
CREATE INDEX IF NOT EXISTS idx_circle_messages_user ON circle_messages (user_id, created_at);
