#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT="${PORT:-3001}"
BACKEND_HOST="${HOST:-0.0.0.0}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

cleanup() {
  echo ""
  echo "Shutting down..."
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

echo "=== Workspace Platform ==="
echo "Backend : http://$BACKEND_HOST:$BACKEND_PORT"
echo "Frontend: http://$BACKEND_HOST:$FRONTEND_PORT"
echo ""

# Start backend
cd "$SCRIPT_DIR/backend"
PORT="$BACKEND_PORT" HOST="$BACKEND_HOST" node src/index.js &
BACKEND_PID=$!

# Start frontend
cd "$SCRIPT_DIR/frontend"
npx vite --port "$FRONTEND_PORT" --host "$BACKEND_HOST" &
FRONTEND_PID=$!

# Wait for both
wait
