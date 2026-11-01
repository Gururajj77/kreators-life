# Restoring the database

The only store of record is the Cloudflare D1 database `kreators-life` (id in `apps/api/wrangler.jsonc`). The code is in git; static files are rebuilt from git with `pnpm build`. Nothing else holds user data.

## Fast undo: D1 Time Travel (no setup, last 30 days)

D1 keeps a point-in-time history for 30 days. You can restore the whole database to any minute in that window.

1. Pick the time you want, in UTC (for example just before a bad change). Write it down.
2. Look at what the database was at that time without changing anything:
   `pnpm --filter @kreators/api exec wrangler d1 time-travel info kreators-life --timestamp "2026-11-01T09:30:00Z"`
   This prints a bookmark for that moment.
3. Restore (this replaces the live database; everything written after that moment is lost):
   `pnpm --filter @kreators/api exec wrangler d1 time-travel restore kreators-life --timestamp "2026-11-01T09:30:00Z"`
   The command prints the bookmark of the state **before** the restore. Keep it: restoring to that bookmark undoes the restore.
4. Check the app: sign in, open Daily and Admin, run `curl https://<your domain>/api/health`.
5. Tell people if their last few minutes of work are gone.

## Practice it once, away from production

Time Travel works on a local copy too, but the safest practice is a throwaway database:

1. `pnpm --filter @kreators/api exec wrangler d1 create kreators-restore-test`
2. Export production: `pnpm --filter @kreators/api exec wrangler d1 export kreators-life --remote --output restore-test.sql` (the file holds personal data: keep it off shared drives and delete it after).
3. Import into the test database: `pnpm --filter @kreators/api exec wrangler d1 execute kreators-restore-test --remote --file restore-test.sql`
4. Count rows in `users` in both; they should match.
5. Delete the test database and the file.

Do this once before launch and write the date here: ____________.

## Longer-term copies

Time Travel stops at 30 days. For a copy you keep, export on a schedule (weekly is enough to start) with the `d1 export` command above and store the file in an encrypted place you control. An export contains passwords hashes, phone numbers and birth dates: treat it like the database.

## After a restore

- Sessions are in the database, so a restore brings back signed-in devices as they were then.
- Money: compare `orders` with Razorpay's dashboard for the gap window; paid orders only exist because of a webhook, so replay missing ones from Admin (webhook replay) rather than editing rows.
- The cron fills in anything due on its next fifteen-minute run.
