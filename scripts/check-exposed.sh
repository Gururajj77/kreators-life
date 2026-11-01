#!/usr/bin/env bash
# Asks one site for the files that should never be public and prints the status of each.
#   bash scripts/check-exposed.sh kreators.app
#   bash scripts/check-exposed.sh http://127.0.0.1:8788      (a local server)
# Only run this against a site you own. Anything that answers 200 is shown with !!! and the script exits 1.
# A 200 for an HTML page is the app shell: check what came back before you decide it is a leak.
set -u

if [ "$#" -ne 1 ]; then
  echo "usage: bash scripts/check-exposed.sh <domain>   (only a site you own)"
  exit 2
fi
BASE="$1"
case "$BASE" in
  http://*|https://*) ;;
  *) BASE="https://$BASE" ;;
esac
BASE="${BASE%/}"

echo "Checking $BASE for files that should not be public."
echo "Only run this against your own domain."
echo

PATHS=(
  /.env /.env.local /.env.production /.env.development /.env.backup /.env.example /.env.save /.env.old
  /.dev.vars /.git/config /.git/HEAD /.git/index /.git/logs/HEAD /.gitignore /.gitattributes /.svn/entries /.hg/hgrc
  /.DS_Store /.htaccess /.htpasswd /.npmrc /.yarnrc /.aws/credentials /.ssh/id_rsa /.bash_history /.idea/workspace.xml /.vscode/settings.json
  /backup.zip /backup.tar.gz /backup.tar /backup.sql /backup.bak /backups.zip /backup/ /backups/
  /db.sql /db.sqlite /db.sqlite3 /db.bak /database.sql /database.sqlite /dump.sql /dump.sql.gz /data.sql /data.zip /site.zip /www.zip /website.zip /public_html.zip /old.zip
  /config.json /config.js /config.yml /config.yaml /config.php /config.xml /configuration.json /settings.json /secrets.json /credentials.json
  /package.json /package-lock.json /pnpm-lock.yaml /yarn.lock /composer.json /composer.lock /tsconfig.json /vite.config.ts
  /wrangler.toml /wrangler.json /wrangler.jsonc /docker-compose.yml /Dockerfile /Makefile
  /id_rsa /id_rsa.pub /server.key /private.key /cert.pem /privkey.pem
  /assets/index.js.map /index.js.map /main.js.map /app.js.map /sw.js.map /src/main.tsx /src/App.tsx
  /server-status /phpinfo.php /info.php /test.php /admin.php /wp-config.php /wp-login.php /wp-admin/ /xmlrpc.php /phpmyadmin/ /cgi-bin/ /node_modules/
  /error.log /access.log /debug.log /npm-debug.log /logs/ /tmp/ /temp/
  /api/admin /api/internal/logs /api/debug /api/env
)

FOUND=0
for p in "${PATHS[@]}"; do
  out=$(curl -s -o /dev/null -w "%{http_code} %{content_type} %{size_download}" --max-time 10 "$BASE$p" 2>/dev/null || echo "000 - 0")
  code="${out%% *}"
  if [ "$code" = "200" ]; then
    printf '!!! %-32s %s\n' "$p" "$out"
    FOUND=$((FOUND + 1))
  else
    printf '    %-32s %s\n' "$p" "$out"
  fi
done

echo
if [ "$FOUND" -gt 0 ]; then
  echo "$FOUND path(s) answered 200. Open each one and look at what came back."
  exit 1
fi
echo "Nothing answered 200."
