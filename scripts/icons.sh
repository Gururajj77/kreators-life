#!/usr/bin/env bash
# Renders the PNG icons and the share card in apps/web/public from scripts/icons/*.html with headless Chrome.
# CHROME can point at any Chrome or Chromium binary; the default is Playwright's headless shell.
set -e
cd "$(dirname "$0")/.."
CHROME="${CHROME:-$(ls -d ~/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-mac-arm64/chrome-headless-shell 2>/dev/null | tail -1)}"
[ -x "$CHROME" ] || { echo "set CHROME to a Chrome binary"; exit 1; }
shot() { "$CHROME" --headless --hide-scrollbars --disable-gpu --default-background-color="$4" --window-size="$2" --virtual-time-budget=8000 --screenshot="apps/web/public/$3" "file://$PWD/scripts/icons/$1" >/dev/null 2>&1; echo "apps/web/public/$3"; }
shot rounded.html 512,512 icon-512.png 00000000
shot rounded.html 192,192 icon-192.png 00000000
shot square.html 512,512 icon-maskable-512.png ff4f3422
shot square.html 180,180 apple-touch-icon.png ff4f3422
shot og.html 1200,630 og.png ff4f3422
