-- 0113: a lesson holds several resources, in an order (the founder, 2026-11-07: "for link of the book in lessons, add ability to select
-- multiple resources like youtube or book or others"). Each is a YouTube or Vimeo video, one of the founder's books by its key, a file or
-- another link, with an optional short label. `learning_items.content_ref` could hold only one link, so this table is now what a lesson
-- reads; content_ref stays as a copy of the first link (school.ts keeps it true) so a tab of the older app still finds it. Program
-- content, not a person's: no owner column, and it goes with its lesson by the foreign key.
CREATE TABLE IF NOT EXISTS lesson_resources (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES learning_items(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('video', 'book', 'file', 'link')),
  -- The link, or for a book its key in BOOKS.
  ref TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT ''
);
-- A cohort page reads its lessons' resources in order, and every change reads one lesson's list.
CREATE INDEX IF NOT EXISTS idx_lesson_resources_item ON lesson_resources(item_id, position);

-- Every lesson's existing link becomes its first resource, keeping the kind it reads as today (`lessonResourceKindOf` in shared): a path
-- of the app's own is a file, a link to a file is a file, the rest is another link. A link on YouTube's or Vimeo's hosts, or to a video
-- file, is marked a video; the reader turns one that does not play back into a file or a link, so this needs no parsing of video ids.
-- `INSERT OR IGNORE` on a fixed id keeps it safe to run again.
INSERT OR IGNORE INTO lesson_resources (id, item_id, position, kind, ref, label)
SELECT
  'res-' || id,
  id,
  1,
  CASE
    WHEN ref LIKE '/%' THEN 'file'
    WHEN ref LIKE 'https://%' AND (site IN ('youtu.be', 'youtube.com', 'youtube-nocookie.com', 'vimeo.com', 'player.vimeo.com') OR ext IN ('mp4', 'webm', 'mov', 'm4v')) THEN 'video'
    WHEN ext IN ('md', 'txt', 'pdf', 'zip', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv', 'json', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'psd', 'ai', 'fig', 'prproj', 'drp', 'aep', 'cube', 'mp3', 'wav') THEN 'file'
    ELSE 'link'
  END,
  ref,
  ''
FROM (
  -- The site without "www." or "m.", and what follows the path's last dot (rtrim leaves the path up to that dot).
  SELECT
    id,
    ref,
    CASE WHEN host LIKE 'www.%' THEN substr(host, 5) WHEN host LIKE 'm.%' THEN substr(host, 3) ELSE host END AS site,
    substr(path, length(rtrim(path, replace(path, '.', ''))) + 1) AS ext
  FROM (
    SELECT
      id,
      ref,
      lower(substr(bare, 1, min(instr(bare || '/', '/'), instr(bare || ':', ':')) - 1)) AS host,
      CASE WHEN instr(bare, '/') > 0 THEN lower(substr(bare, instr(bare, '/'))) ELSE '' END AS path
    FROM (
      -- What follows the scheme, without the query or the fragment.
      SELECT
        id,
        ref,
        substr(tail, 1, min(instr(tail || '?', '?'), instr(tail || '#', '#')) - 1) AS bare
      FROM (
        SELECT id, trim(content_ref) AS ref, substr(trim(content_ref), instr(trim(content_ref), '://') + 3) AS tail
        FROM learning_items
        WHERE trim(content_ref) LIKE 'https://%' OR trim(content_ref) LIKE 'http://%' OR (trim(content_ref) LIKE '/%' AND trim(content_ref) NOT LIKE '//%')
      )
    )
  )
);
