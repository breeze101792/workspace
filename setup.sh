#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Workspace Platform Setup (Python) ==="
echo ""

echo "--- Installing backend dependencies ---"
cd "$SCRIPT_DIR/backend"

if [ ! -d venv ]; then
  python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt

echo ""
echo "=== Setup complete ==="
echo "Run ./start.sh to launch the workspace."
