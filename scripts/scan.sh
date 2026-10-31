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

echo "wording: the old names that must not come back"
out=$(grep -rnwiE "Kreators Life" screens site components ../index.html ../../api/src 2>/dev/null | grep -v "kreators-life" || true)
if [ -n "$out" ]; then echo "$out"; hits=$((hits + $(echo "$out" | wc -l | tr -d ' '))); fi

if [ "$hits" = "0" ]; then echo "clean"; exit 0; fi
echo "$hits hit(s)"
exit 1
