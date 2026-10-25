-- Links on the public page: the Linktree part. Blocks the creator stacks in order, as JSON on the user.
ALTER TABLE users ADD COLUMN links_json TEXT NOT NULL DEFAULT '[]';
