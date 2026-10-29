#!/usr/bin/env bash
# End-to-end smoke test. Runs a second API on port 8788 with its own database under
# scripts/smoke/state, so the dev database on 8787 never sees a test account.
#
#   bash scripts/smoke/blueprint.sh            # migrate, start, check, stop
#   bash scripts/smoke/blueprint.sh --keep     # leave the smoke server running (for shoot.mjs)
#   bash scripts/smoke/blueprint.sh --fresh    # wipe the smoke database first
#   SMOKE_BUILD=1 bash scripts/smoke/blueprint.sh   # rebuild the web app before starting
#   SMOKE_MODEL=real SMOKE_RUN=eval ASSISTANT_API_KEY=... bash scripts/smoke/blueprint.sh
#                                                    # run the assistant eval against a real model instead
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HERE="$ROOT/scripts/smoke"
STATE="$HERE/state"
PORT="${SMOKE_PORT:-8788}"
ORIGIN="http://127.0.0.1:$PORT"
KEEP=0
for a in "$@"; do
  case "$a" in
    --keep) KEEP=1 ;;
    --fresh) rm -rf "$STATE" ;;
  esac
done

cd "$ROOT"
if [ ! -f apps/web/dist/index.html ] || [ "${SMOKE_BUILD:-0}" = "1" ]; then
  echo "building the web app"
  pnpm build >/dev/null
fi

mkdir -p "$STATE"
echo "migrating the smoke database"
pnpm --filter @kreators/api exec wrangler d1 migrations apply kreators-life --local --persist-to "$STATE" >/dev/null

if curl -fsS "$ORIGIN/api/health" >/dev/null 2>&1; then
  echo "a server already answers on $PORT, using it"
  STARTED=0
else
  echo "starting the smoke api on $PORT"
  # The assistant's model: a stand-in smoke.mjs serves on 8799, so the checks never pay for a real one. With
  # SMOKE_MODEL=real the key, model and endpoint come from the shell instead, for the eval.
  if [ "${SMOKE_MODEL:-mock}" = "real" ]; then
    : "${ASSISTANT_API_KEY:?SMOKE_MODEL=real needs ASSISTANT_API_KEY in the shell}"
    MODEL_VARS=(--var "ASSISTANT_API_KEY:$ASSISTANT_API_KEY" --var "ASSISTANT_BASE_URL:${ASSISTANT_BASE_URL:-https://openrouter.ai/api/v1}" --var "ASSISTANT_MODEL:${ASSISTANT_MODEL:-nvidia/nemotron-3-ultra-550b-a55b:free}")
    [ -n "${ASSISTANT_ZDR:-}" ] && MODEL_VARS+=(--var "ASSISTANT_ZDR:$ASSISTANT_ZDR")
  else
    MODEL_VARS=(--var ASSISTANT_API_KEY:smoke --var "ASSISTANT_BASE_URL:http://127.0.0.1:${SMOKE_MODEL_PORT:-8799}/v1" --var ASSISTANT_MODEL:smoke-mock)
  fi
  # Secrets for this server only: an admin key and a founder address the checks sign up with.
  (cd apps/api && exec pnpm exec wrangler dev --port "$PORT" --persist-to "$STATE" --test-scheduled \
      --var ADMIN_KEY:smoke-admin-key --var ADMIN_EMAILS:founder@smoke.test --var CLICK_SALT:smoke-salt "${MODEL_VARS[@]}" \
      > "$HERE/server.log" 2>&1) &
  SERVER_PID=$!
  STARTED=1
  for i in $(seq 1 60); do
    if curl -fsS "$ORIGIN/api/health" >/dev/null 2>&1; then break; fi
    sleep 1
    if [ "$i" = "60" ]; then echo "the smoke api did not come up; see $HERE/server.log"; kill $SERVER_PID 2>/dev/null || true; exit 1; fi
  done
fi

stop() {
  if [ "$STARTED" = "1" ] && [ "$KEEP" = "0" ]; then
    pkill -P "$SERVER_PID" 2>/dev/null || true
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}
trap stop EXIT

SCRIPT="$HERE/smoke.mjs"
[ "${SMOKE_RUN:-smoke}" = "eval" ] && SCRIPT="$ROOT/scripts/assistant/eval.mjs"
set +e
SMOKE_ORIGIN="$ORIGIN" SMOKE_ADMIN_KEY=smoke-admin-key node --experimental-strip-types --no-warnings "$SCRIPT"
STATUS=$?
set -e
if [ "$KEEP" = "1" ] && [ "$STARTED" = "1" ]; then
  echo "smoke server left running on $ORIGIN (pid $SERVER_PID); stop it with: kill $SERVER_PID"
fi
exit $STATUS
