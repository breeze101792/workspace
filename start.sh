#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT="${PORT:-5010}"
BACKEND_HOST="${HOST:-0.0.0.0}"
MCP_PORT="${MCP_PORT:-5011}"
MCP_HOST="${MCP_HOST:-127.0.0.1}"

cleanup() {
  echo ""
  echo "Shutting down..."
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
  [ -n "$MCP_PID" ] && kill "$MCP_PID" 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

echo "=== Workspace Platform ==="
echo "Flask : http://$BACKEND_HOST:$BACKEND_PORT"
echo "MCP   : http://$MCP_HOST:$MCP_PORT/sse"
echo ""

cd "$SCRIPT_DIR"
source backend/venv/bin/activate
PORT="$BACKEND_PORT" HOST="$BACKEND_HOST" python -m backend.app &
BACKEND_PID=$!

python -m backend.mcp_server --host "$MCP_HOST" --port "$MCP_PORT" &
MCP_PID=$!

wait
