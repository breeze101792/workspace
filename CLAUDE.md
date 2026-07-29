# Workspace Platform — AI Agent Instructions

## Project Overview

AI-native Workspace platform — a desktop-style environment shared between human and AI. Each workspace maps to a folder on disk. The browser renders the UI; the AI accesses it via MCP.

## Architecture

```
backend/   — Node.js + Express (REST + WebSocket + MCP)
frontend/  — React + TypeScript + Vite
data/      — ~/.config/workspace/ (workspaces, config)
```

## Key Conventions

- **Workspace.json** is the single source of truth for UI state (window positions, sizes, z-index, etc.)
- **File contents** live as real files in workspace subdirectories (markdown/, html/, images/, files/)
- **WebSocket** for real-time window state sync (events: window:move, window:resize, etc.)
- **REST API** for file CRUD operations
- **MCP (stdio)** for AI client access to the workspace
- **Error responses** always `{ ok: true, data }` or `{ ok: false, error }`

## Design Docs

See `docs/design/`:
- `data-model.md` — workspace.json schema, folder layout, entities
- `api-design.md` — REST endpoints, WebSocket protocol, MCP tools
- `ui-ux.md` — Design language, layouts, user flows, states
- `frontend-modules.md` — Module decomposition, component tree, plugin registry

## Commands

```bash
# Backend
cd backend && npm run dev      # Start dev server with hot reload
cd backend && npm test         # Run tests

# Frontend
cd frontend && npm run dev     # Start Vite dev server
cd frontend && npm run build   # Production build
cd frontend && npm test        # Run tests
```

## Stack

- **Backend**: Node.js + Express + ws (WebSocket)
- **Frontend**: React 18 + TypeScript + Vite
- **Storage**: Filesystem (JSON), atomic writes via tempfile + rename
- **MCP**: Stdio-based MCP server using official @modelcontextprotocol/sdk
