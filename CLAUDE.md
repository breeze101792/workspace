# Workspace Platform — AI Agent Instructions

## Project Overview

AI-native Workspace platform — a desktop-style environment shared between human and AI. Each workspace maps to a folder on disk. The browser renders the UI; the AI accesses it via MCP.

## Architecture

```
backend/   — Python + Flask (REST) + flask-sock (WebSocket on same port)
frontend/  — Vanilla JS (no build step)
data/      — ~/.config/workspace/ (workspaces, config)
```

## Key Conventions

- **Workspace.json** is the single source of truth for UI state (window positions, sizes, z-index, etc.)
- **File contents** live as real files in workspace subdirectories (markdown/, html/, images/, files/)
- **WebSocket** (on same port as Flask, path `/ws`) for real-time window state sync (events: window:move, window:resize, etc.)
- **REST API** (port 5000) for file CRUD operations and workspace management
- **MCP (stdio)** for AI client access to the workspace
- **Error responses** always `{ ok: true, data }` or `{ ok: false, error }`

## Design Docs

See `docs/design/`:
- `data-model.md` — workspace.json schema, folder layout, entities
- `api-design.md` — REST endpoints, WebSocket protocol, MCP tools
- `ui-ux.md` — Design language, layouts, user flows, states
- `frontend-modules.md` — Module decomposition, component tree, plugin registry
- `python-architecture.md` — Python-specific architecture decisions

## Commands

```bash
./setup.sh              # Install Python venv + deps
./start.sh              # Start server (Flask + WebSocket on ports 5000/5001)
```

## Stack

- **Backend**: Python 3.10+ + Flask + flask-cors + websockets
- **Frontend**: Vanilla JS (ES modules, no build step)
- **Storage**: Filesystem (JSON), atomic writes via tempfile + rename
- **MCP**: Stdio-based MCP server using the `mcp` PyPI package
- **Markdown**: marked.js via CDN + highlight.js via CDN
