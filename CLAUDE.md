# Workspace Platform — AI Agent Instructions

## Project Overview

AI-native Workspace platform — a desktop-style environment shared between human and AI. Each workspace maps to a folder on disk. The browser renders the UI; the AI accesses it via MCP.

## Architecture

```
backend/   — Python + Flask (REST + WebSocket via flask-sock, same port) + MCP server
frontend/  — Vanilla JS (ES modules, no build step) + Vitest test suite (frontend/tests/)
data/      — ~/.config/workspace/ (workspaces, config)
```

## Key Conventions

- **Workspace.json** is the single source of truth for UI state (window positions, sizes, z-index, etc.)
- **File contents** live as real files in workspace subdirectories (markdown/, html/, images/, files/)
- **WebSocket** (flask-sock, same port as Flask, path `/ws`) for real-time window state sync (events: window:move, window:resize, etc.) — implemented in `backend/app.py`
- **REST API** (default port 5010, `PORT` env overrides) for file CRUD operations and workspace management
- **MCP** server (separate process, default port 5011 over SSE; stdio fallback) for AI client access — `backend/mcp_server.py`
- **Error responses** always `{ ok: true, data }` or `{ ok: false, error }`

## Design Docs

See `docs/design/`:
- `data-model.md` — workspace.json schema, folder layout, entities
- `api-design.md` — REST endpoints, WebSocket protocol, MCP tools
- `ui-ux.md` — Design language, layouts, user flows, states
- `ui-refresh.md` — Current design token system (implement UI changes against this)
- `frontend-modules.md` — Module decomposition (historical; frontend is vanilla JS, not React)
- `python-architecture.md` — Python-specific architecture decisions

## Commands

```bash
./setup.sh              # Install Python venv + deps
./start.sh              # Start server (Flask REST+WS on 5010, MCP on 5011)
npm test                # Frontend tests (Vitest + jsdom)
./backend/venv/bin/python -m pytest -q   # Backend tests (265+ tests)
```

## Stack

- **Backend**: Python 3.10+ + Flask + flask-cors + flask-sock
- **Frontend**: Vanilla JS (ES modules, no build step); tests via Vitest + jsdom
- **Storage**: Filesystem (JSON), atomic writes via tempfile + rename
- **MCP**: `mcp` PyPI package (SSE transport with stdio JSON-RPC fallback)
- **Markdown**: marked.js via CDN + highlight.js via CDN
