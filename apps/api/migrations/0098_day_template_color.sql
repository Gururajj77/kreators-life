-- 0098: each day template (a kind of day) wears its own colour (2026-11-06, the founder's choice "Own colour per template";
-- docs/time-blocks.md, "A kind's colour"). `color` is a BlockColor like a block's: a swatch key from TIME_BLOCK_SWATCHES in shared
-- (timeBlocks.ts), mapped to a theme token by CSS, or a person's own "#rrggbb". NULL means none picked: `templateColor` in shared then
-- falls back to the colour of the template's longest block, as before.
ALTER TABLE day_templates ADD COLUMN color TEXT;

-- The starting templates each take their starting colour (STARTING_TEMPLATES in shared), so no two kinds look alike. Fourteen
-- templates over the eleven wheel colours means three share: Everyday with Low energy day (indigo; the default is never drawn as a
-- kind), Travel day with Create day (vermilion) and Self love day with Money day (lime). Only rows with no colour yet are touched, by
-- the starting template's key, then (a row made from an old kind of day without a key) by its kind.
UPDATE day_templates SET color = CASE seed
    WHEN 'everyday' THEN 'indigo'
    WHEN 'deep' THEN 'red'
    WHEN 'create' THEN 'vermilion'
    WHEN 'learning' THEN 'teal'
    WHEN 'money' THEN 'lime'
    WHEN 'admin' THEN 'blue'
    WHEN 'family' THEN 'amber'
    WHEN 'recovery' THEN 'green'
    WHEN 'social' THEN 'orange'
    WHEN 'date' THEN 'magenta'
    WHEN 'reflection' THEN 'purple'
    WHEN 'lowenergy' THEN 'indigo'
    WHEN 'selflove' THEN 'lime'
    WHEN 'travel' THEN 'vermilion'
  END
WHERE color IS NULL AND seed IN ('everyday', 'deep', 'create', 'learning', 'money', 'admin', 'family', 'recovery', 'social', 'date', 'reflection', 'lowenergy', 'selflove', 'travel');

UPDATE day_templates SET color = CASE source_kind
    WHEN 'deep_work' THEN 'red'
    WHEN 'create' THEN 'vermilion'
    WHEN 'learning' THEN 'teal'
    WHEN 'money' THEN 'lime'
    WHEN 'admin' THEN 'blue'
    WHEN 'family' THEN 'amber'
    WHEN 'rest' THEN 'green'
    WHEN 'friends' THEN 'orange'
    WHEN 'date' THEN 'magenta'
    WHEN 'reset' THEN 'purple'
    WHEN 'low_energy' THEN 'indigo'
  END
WHERE color IS NULL AND source_kind IN ('deep_work', 'create', 'learning', 'money', 'admin', 'family', 'rest', 'friends', 'date', 'reset', 'low_energy');
