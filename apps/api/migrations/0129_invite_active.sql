-- 0129: what a referral and a team connection pay, settled (2026-11-10, the founder's "fix all these properly" on wave 26's open
-- questions and loose ends).
--
-- 1. A referral pays once the person really uses the app: INVITE_REWARD pays the code's maker when the person who joined with it has
--    ticked a task or checked in on Daily on INVITE_ACTIVE_DAYS (3) different days of their own, never at the bare sign-up and never for
--    setup alone. Emails are not verified and plus-addressing would beat a check, so the gate is use, not mail. `active_at` is when the
--    account reached its third day: the claim is one guarded UPDATE (apps/api/src/invites.ts, inviteActiveStmt), so two ticks at once
--    pay once. setup_done_at stays the mark of setup done, for the maker's note and Dev Tools.
ALTER TABLE invite_codes ADD COLUMN active_at TEXT;
-- A join settled under the earlier rule (paid, or not, at setup) stays settled: nothing is paid twice and the invite badges keep it.
UPDATE invite_codes SET active_at = setup_done_at WHERE setup_done_at IS NOT NULL AND active_at IS NULL;

-- 2. A team connection pays once per kind, pair and place, ever (apps/api/src/connectPay.ts): a payment is claimed under that key, not
--    the row's id, so a connection ended and made again never pays again. The payments made before carry the row's id; they take the key,
--    so a pair paid then is not paid a second time now. The expression is CONNECT_PAY_KEY('t') word for word.
UPDATE xp_events SET source_id = (
    SELECT t.kind || ':' || t.first_user_id || ':' || COALESCE(t.second_user_id, '') || ':' || CASE WHEN t.kind IN ('program', 'product', 'cohort', 'org', 'club') THEN COALESCE(t.ref_id, '') ELSE '' END
    FROM team_connections t WHERE t.id = xp_events.source_id)
  WHERE source = 'connect' AND source_id IN (SELECT id FROM team_connections);

-- 3. Every stored email is lower case, as sign-up and sign-in have always written and read it, so a lookup by email is `email = ?` with
--    the typed words lowered and the unique index on users(email) serves it (a LOWER(email) lookup read every account: 3,896 rows on one
--    Connect people send). No path ever wrote one in capitals; this makes sure of it, leaving alone any row whose lower case another
--    account already holds (the unique index would refuse it) and taking only the first of any that differ by case alone.
UPDATE users SET email = LOWER(email)
  WHERE email IS NOT NULL AND email != LOWER(email)
    AND NOT EXISTS (SELECT 1 FROM users u2 WHERE u2.email = LOWER(users.email))
    AND email = (SELECT MIN(u3.email) FROM users u3 WHERE LOWER(u3.email) = LOWER(users.email));
