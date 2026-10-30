-- Every account has a unique username (handle) and a friend code for Bond requests.
ALTER TABLE users ADD COLUMN friend_code TEXT;
UPDATE users SET handle = 'user_' || lower(hex(randomblob(4))) WHERE handle IS NULL AND display_name != 'Deleted member';
UPDATE users SET friend_code = upper(hex(randomblob(4))) WHERE friend_code IS NULL AND display_name != 'Deleted member';
CREATE UNIQUE INDEX idx_users_friend_code ON users(friend_code) WHERE friend_code IS NOT NULL;
