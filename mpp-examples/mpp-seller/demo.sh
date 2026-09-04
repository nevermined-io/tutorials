#!/usr/bin/env bash
# One-command run of the MPP seller tutorial.
#
#   ./demo.sh --selfcheck           # offline guards only: no network, no credentials
#   ./demo.sh                       # provision (once) + serve + buy + tear down
#   FORCE_PROVISION=yes ./demo.sh   # publish a fresh plan/agent pair first
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

if [[ ! -d node_modules ]]; then
  echo "installing dependencies"
  yarn install --silent 2>/dev/null || npm install --no-audit --no-fund
fi

if [[ "${1:-}" == "--selfcheck" ]]; then
  exec node selfcheck.mjs
fi

node provision.mjs

SERVER_LOG="$(mktemp -t mpp-seller-XXXXXX.log)"
node agent.mjs >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
  echo
  echo "--- seller log ------------------------------------------------------"
  cat "$SERVER_LOG"
  rm -f "$SERVER_LOG"
}
trap cleanup EXIT

PORT="${PORT:-8790}"
for _ in $(seq 1 60); do
  curl -sf "http://localhost:${PORT}/health" >/dev/null 2>&1 && break
  sleep 0.5
done
curl -sf "http://localhost:${PORT}/health" >/dev/null || {
  echo "the agent never came up on port ${PORT}"
  exit 1
}

node client.mjs
