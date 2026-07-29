#!/usr/bin/env bash
set -e

echo "=== Workspace Platform Setup ==="

echo "--- Installing backend dependencies ---"
cd "$(dirname "$0")/backend"
npm install

echo ""
echo "--- Installing frontend dependencies ---"
cd "$(dirname "$0")/../frontend"
npm install

echo ""
echo "=== Setup complete ==="
echo "Run ./start.sh to launch the workspace."
