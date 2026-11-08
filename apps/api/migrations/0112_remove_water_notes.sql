-- Water reminders are gone (the founder, 2026-11-07: "remove notifications for water from inbox"). Nothing writes a water note
-- any more, and the cron that cleared past days' lines no longer looks at them, so every stored one goes here: read, unread or
-- archived. The range is the one the cron used on the primary key: every id `water-<user>-<day>`, and '.' is the character after '-'.
-- Water itself stays. Goal and glass live in reminder_prefs, so no column is dropped; water_on, water_every_min, water_from,
-- water_to and last_water_at are simply no longer read or written.
DELETE FROM notifications WHERE id >= 'water-' AND id < 'water.';
