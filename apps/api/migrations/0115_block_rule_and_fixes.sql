-- 0115: what the code now holds to, put right in the rows already stored (the review of 2026-11-07).

-- A block by name ends any coaching between the two (`endLinksOnBlock`). A pair blocked before this kept its link, so the coach went on reading and writing. The change log
-- says the coaching ended, in the words ending it by hand uses, with no mention of a block.
INSERT INTO coach_log (id, link_id, coach_id, student_id, actor_id, action, label, target_id, before_json, after_json, created_at)
SELECT 'block-end-' || l.id, l.id, l.coach_id, l.student_id, NULL, 'link.end', 'The coaching ended', NULL, '', '', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM coach_links l
WHERE l.status IN ('pending', 'active')
  AND EXISTS (SELECT 1 FROM blocks b WHERE b.by_name = 1 AND ((b.blocker_id = l.coach_id AND b.blocked_id = l.student_id) OR (b.blocker_id = l.student_id AND b.blocked_id = l.coach_id)));
UPDATE coach_links SET status = 'ended', ended_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), ended_by = NULL
WHERE status IN ('pending', 'active')
  AND EXISTS (SELECT 1 FROM blocks b WHERE b.by_name = 1 AND ((b.blocker_id = coach_links.coach_id AND b.blocked_id = coach_links.student_id) OR (b.blocker_id = coach_links.student_id AND b.blocked_id = coach_links.coach_id)));

-- Nobody alive may be named "Deleted member": they vanish from every list `liveUser` guards. A deleted account has no handle, and everyone else always has one.
UPDATE users SET display_name = '' WHERE display_name = 'Deleted member' AND handle IS NOT NULL;

-- A stretch a supplement was paused and came back from, so those days are never counted as due: `[from, to]` days in the person's zone (`supplementOnList`). Paused and
-- resumed before this, the stretch was not kept, so it cannot be told.
ALTER TABLE supplements ADD COLUMN pauses_json TEXT NOT NULL DEFAULT '[]';

-- 0113 copied a lesson's link only when it began https://, http:// or a single /. The route once stored any words, and the first change to a lesson's resources overwrites
-- content_ref, so a link written another way would be lost. Those that can be read as a link come across too: no scheme (www.…), a protocol-relative one (//…), a path with
-- no leading slash under resources/. Anything else (ftp, mailto, words) never opened from the screen and stays as it is in content_ref until a change replaces it.
INSERT OR IGNORE INTO lesson_resources (id, item_id, position, kind, ref, label)
SELECT 'res-' || id, id, 1, CASE WHEN ref LIKE '/resources/%' THEN 'file' ELSE 'link' END, ref, ''
FROM (
  SELECT id,
    CASE
      WHEN trim(content_ref) LIKE 'www.%' THEN 'https://' || trim(content_ref)
      WHEN trim(content_ref) LIKE '//%' THEN 'https:' || trim(content_ref)
      WHEN trim(content_ref) LIKE 'resources/%' THEN '/' || trim(content_ref)
    END AS ref
  FROM learning_items
  WHERE content_ref IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM lesson_resources r WHERE r.item_id = learning_items.id)
)
WHERE ref IS NOT NULL AND instr(ref, ' ') = 0;
