-- Magic links were tried and taken out again: email and password is the one way in.
DROP TABLE IF EXISTS login_tokens;
ALTER TABLE users DROP COLUMN email_verified_at;
