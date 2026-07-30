#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT="${PORT:-5010}"
BACKEND_HOST="${HOST:-0.0.0.0}"

cleanup() {
  echo ""
  echo "Shutting down..."
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

echo "=== Workspace Platform (Python) ==="
echo "Server : http://$BACKEND_HOST:$BACKEND_PORT"
echo ""

cd "$SCRIPT_DIR"
source backend/venv/bin/activate
PORT="$BACKEND_PORT" HOST="$BACKEND_HOST" python -m backend.app &
BACKEND_PID=$!

wait
