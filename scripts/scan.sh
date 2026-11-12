#!/usr/bin/env bash
# The spacing and colour scans from "Done means". Exit 1 on any hit.
#
# Spacing: only the tokens xs, sm, md, lg, xl, 2xl (8, 12, 16, 32, 64, 120). Any Tailwind
# numeric spacing class (p-4, gap-3, mt-2) or arbitrary px spacing (p-[10px]) is a hit; zero is fine, so is
# an arbitrary value that equals a token, a hairline gap under 8px between icons or dots, and the 240px
# sidebar offset, which is a layout width rather than spacing.
# Colour: no hex colour in a screen, a site page or a component. The accepted places are the drawn
# art (Avatar, Person, MoodFace, Celebration), the one ink fallback in Button, the theme-color meta in
# lib/theme.ts, a celebration's `color:` prop, an Avatar's `color=`/`deep=`/`text=` props, and a
# comparison against '#FFFFFF' on the site.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/web/src"
hits=0

echo "spacing: numeric Tailwind classes"
out=$(grep -rnoE "\b(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y)-[0-9]+(\.[0-9]+)?\b" . | grep -vE -- '-0$' || true)
if [ -n "$out" ]; then echo "$out"; hits=$((hits + $(echo "$out" | wc -l | tr -d ' '))); fi

echo "spacing: arbitrary px (a token value, a hairline under 8px, or the 240px sidebar offset is fine)"
out=$(grep -rnoE "\b(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y)-\[[0-9.]+(px|rem)\]" . | grep -vE -- "-\[(8|12|16|32|64|120|240|[1-7])px\]" || true)
if [ -n "$out" ]; then echo "$out"; hits=$((hits + $(echo "$out" | wc -l | tr -d ' '))); fi

echo "spacing: raw padding, margin or gap in app.css outside the tokens"
out=$(grep -nE "^\s*(padding|margin|gap)[a-z-]*:\s*[0-9.]+(px|rem)" app.css | grep -vE ":\s*(8|12|16|32|64|120)px" | grep -vE ":\s*0(px)?;" || true)
if [ -n "$out" ]; then echo "$out"; hits=$((hits + $(echo "$out" | wc -l | tr -d ' '))); fi

echo "colour: hex colours in screens, site and components"
out=$(grep -rnE "#[0-9a-fA-F]{6}\b" screens site components App.tsx \
  | grep -vE "^components/(Avatar|Person|MoodFace|Celebration|Button)\.tsx:" \
  | grep -vE "celebrate\(" \
  | grep -vE "\b(color|deep|text)=\"#" \
  | grep -vE "=== '#FFFFFF'" || true)
if [ -n "$out" ]; then echo "$out"; hits=$((hits + $(echo "$out" | wc -l | tr -d ' '))); fi

echo "colour: literal white on the ink fill (use the on-ink tokens)"
out=$(grep -rnE "bg-ink[^\"']*(text-white|bg-white)|(text-white|bg-white)[^\"']*bg-ink" screens site components || true)
if [ -n "$out" ]; then echo "$out"; hits=$((hits + $(echo "$out" | wc -l | tr -d ' '))); fi

echo "links: nothing injects raw HTML (words people write never become links; see components/Inert.tsx)"
out=$(grep -rn "dangerouslySetInnerHTML" screens site components App.tsx || true)
if [ -n "$out" ]; then echo "$out"; hits=$((hits + $(echo "$out" | wc -l | tr -d ' '))); fi

echo "accessibility: every <img> has an alt (a picture that means something says what it is; a decorative one has alt=\"\")"
out=$(grep -rn --include='*.tsx' "<img\b" screens site components App.tsx | while IFS=: read -r f n rest; do
  # The tag may run over several lines: read from its first line to the one that closes it.
  tag=$(awk -v s="$n" 'NR>=s { print; if ($0 ~ /\/>/ || $0 ~ /<\/img>/) exit }' "$f")
  if ! printf '%s' "$tag" | grep -qE "[[:space:]]alt="; then echo "$f:$n: <img> without alt"; fi
done || true)
if [ -n "$out" ]; then echo "$out"; hits=$((hits + $(echo "$out" | wc -l | tr -d ' '))); fi

echo "wording: the old names that must not come back"
out=$(grep -rnwiE "Kreators Life" screens site components ../index.html ../../api/src 2>/dev/null | grep -v "kreators-life" || true)
if [ -n "$out" ]; then echo "$out"; hits=$((hits + $(echo "$out" | wc -l | tr -d ' '))); fi

echo "type: weights after umbrel.com by surface (font-extrabold only on printed paper and the client's .print-doc pages; 2026-11-05)"
out=$(grep -rnw "font-extrabold" --include='*.tsx' --include='*.ts' screens site components lib App.tsx \
  | grep -vE "^components/(InvoiceView|ContractView|PrintSheet|PaperEdit)\.tsx:" \
  | grep -vE "^site/ClientPortal\.tsx:" || true)
if [ -n "$out" ]; then echo "$out"; hits=$((hits + $(echo "$out" | wc -l | tr -d ' '))); fi

echo "inbox: every note is written by noteStmt in notes.ts (its kind an InboxKind, so every kind has a tab); no other INTO notifications (2026-11-07)"
out=$(grep -rniE "into[[:space:]]+notifications" ../../api/src 2>/dev/null | grep -vE "^\.\./\.\./api/src/notes\.ts:" || true)
if [ -n "$out" ]; then echo "$out"; hits=$((hits + $(echo "$out" | wc -l | tr -d ' '))); fi

echo "time blocks: someone with no rows has the starting set in code, so only timeBlocks.ts, its route file, insights.ts (startingSet) and the export read these tables (2026-11-07)"
out=$(grep -rnE "(FROM|JOIN)[[:space:]]+(time_blocks|day_templates|day_template_slots)\b" ../../api/src 2>/dev/null | grep -vE "^\.\./\.\./api/src/(timeBlocks\.ts|routes/timeBlocks\.ts|routes/insights\.ts|routes/me\.ts|account\.ts):" || true)
if [ -n "$out" ]; then echo "$out"; hits=$((hits + $(echo "$out" | wc -l | tr -d ' '))); fi

echo "inbox: every note's link is a route in App.tsx and its hash an id the app draws, so it lands (scripts/check-note-links.mjs; 2026-11-07)"
out=$(node "$ROOT/scripts/check-note-links.mjs" 2>/dev/null)
if [ "$?" != "0" ] && [ -z "$out" ]; then out="scripts/check-note-links.mjs did not run"; fi
if [ -n "$out" ]; then echo "$out"; hits=$((hits + $(echo "$out" | wc -l | tr -d ' '))); fi

echo "apps: every module brings its picture for Home's tiles, and no two share one (scripts/app-art/build.mjs --check; 2026-11-07)"
out=$(node --experimental-strip-types "$ROOT/scripts/app-art/build.mjs" --check 2>/dev/null)
if [ "$?" != "0" ] && [ -z "$out" ]; then out="scripts/app-art/build.mjs --check did not run"; fi
if [ -n "$out" ]; then echo "$out"; hits=$((hits + $(echo "$out" | wc -l | tr -d ' '))); fi

echo "privacy: every table that names a person says what the export and the delete do with it, and the code does it (scripts/data-coverage.mjs; 2026-11-07)"
out=$(node "$ROOT/scripts/data-coverage.mjs" 2>/dev/null)
if [ "$?" != "0" ] && [ -z "$out" ]; then out="scripts/data-coverage.mjs did not run"; fi
if [ -n "$out" ]; then echo "$out"; hits=$((hits + $(echo "$out" | wc -l | tr -d ' '))); fi

echo "dev tools: every file, check and route the build map names is real, and every built item has a check behind it (scripts/check-buildmap.mjs; 2026-11-09)"
out=$(node --experimental-strip-types --no-warnings "$ROOT/scripts/check-buildmap.mjs" 2>/dev/null)
if [ "$?" != "0" ] && [ -z "$out" ]; then out="scripts/check-buildmap.mjs did not run"; fi
if [ -n "$out" ]; then echo "$out"; hits=$((hits + $(echo "$out" | wc -l | tr -d ' '))); fi

echo "logs: every route file is mounted under an area, and the person's own files under a private one (scripts/check-log-areas.mjs; 2026-11-09)"
out=$(node "$ROOT/scripts/check-log-areas.mjs" 2>/dev/null)
if [ "$?" != "0" ] && [ -z "$out" ]; then out="scripts/check-log-areas.mjs did not run"; fi
if [ -n "$out" ]; then echo "$out"; hits=$((hits + $(echo "$out" | wc -l | tr -d ' '))); fi

echo "dates: an instant is never cut to its UTC day before a date helper shows it, or the day is wrong ahead of UTC (lib/date.ts takes an instant; 2026-11-07)"
out=$(grep -rnE "\b(prettyDate|shortDay|shortDate|longDate|dayLabel|fullDay|monthYear)\([^()]*[A-Za-z]+(At|Until)\.slice\(0, 10\)\)" "$ROOT/apps/web/src" 2>/dev/null)
if [ -n "$out" ]; then echo "$out"; hits=$((hits + $(echo "$out" | wc -l | tr -d ' '))); fi

echo "tooltips: a control with a label takes data-tip for its name, never a native title the browser draws over the page (lib/smartTip.ts; 2026-11-12)"
out=$(grep -rnE --include='*.tsx' '<[A-Za-z][^>]*aria-label=[^>]*[[:space:]]title=|<[A-Za-z][^>]*[[:space:]]title=[^>]*aria-label=' screens site components App.tsx | sed 's/$/  (use data-tip, not title, beside aria-label)/' || true)
if [ -n "$out" ]; then echo "$out"; hits=$((hits + $(echo "$out" | wc -l | tr -d ' '))); fi
out=$(grep -nE "attr\(data-tip\)" app.css | grep -v "tip fallback" | sed 's/$/  (a CSS name only in the stand-in rules marked tip fallback)/' || true)
if [ -n "$out" ]; then echo "$out"; hits=$((hits + $(echo "$out" | wc -l | tr -d ' '))); fi

if [ "$hits" = "0" ]; then echo "clean"; exit 0; fi
echo "$hits hit(s)"
exit 1
