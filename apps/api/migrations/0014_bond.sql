-- Bond: friends, and anonymous one-to-one chats under aliases. Nobody's name moves through a chat.
CREATE TABLE friendships (
  id TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  answered_at TEXT,
  UNIQUE (requester_id, recipient_id)
);
CREATE INDEX idx_friendships_recipient ON friendships(recipient_id, status);
CREATE INDEX idx_friendships_requester ON friendships(requester_id, status);

CREATE TABLE bond_chats (
  id TEXT PRIMARY KEY,
  a_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  b_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  a_alias TEXT NOT NULL,
  b_alias TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'bond',
  created_at TEXT NOT NULL,
  last_message_at TEXT,
  UNIQUE (a_user_id, b_user_id)
);
CREATE INDEX idx_bond_chats_a ON bond_chats(a_user_id, last_message_at);
CREATE INDEX idx_bond_chats_b ON bond_chats(b_user_id, last_message_at);

CREATE TABLE bond_messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES bond_chats(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_bond_messages_chat ON bond_messages(chat_id, created_at);
