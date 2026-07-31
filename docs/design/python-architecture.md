# Python Backend Architecture

## Stack

- **Runtime**: Python 3.10+
- **Web framework**: Flask (lightweight, no async needed for V1)
- **WebSocket**: flask-sock (same Flask port, WS path `/ws`)
- **CORS**: flask-cors
- **MCP**: `mcp` PyPI package (MCPServer with SSE transport)
- **Testing**: pytest + pytest-cov
- **Coverage target**: 100%

## Package Layout

```
backend/
├── __init__.py              # Package marker
├── app.py                   # Flask app, REST routes, WebSocket handler, broadcast
├── safe_fs.py               # Atomic file I/O, path resolution, CONFIG_DIR
├── config_manager.py        # Global config.json (activeWorkspace, theme, language)
├── workspace_manager.py     # Workspace CRUD, import/export, conflict versioning
├── file_manager.py          # File CRUD, directory listing, full-text search
├── auth.py                  # PBKDF2 sessions (opt-in via env var or first user)
├── plugin_loader.py         # External plugin system (extensions/ directory)
├── cli.py                   # CLI tool (list, create, show, delete, export, import, search, read)
└── mcp_server.py            # MCP server (8 tools, SSE/stdio transport)
```

## Module Dependencies

```
app.py
  ├── safe_fs.py          (ensure_dirs)
  ├── workspace_manager.py (full workspace CRUD)
  ├── file_manager.py      (file read/write/delete/list/search)
  ├── config_manager.py    (global config)
  ├── plugin_loader.py     (plugin lifecycle)
  └── auth.py              (session auth)

workspace_manager.py
  ├── safe_fs.py           (atomic_write, path helpers)
  └── config_manager.py    (workspace list sync)

file_manager.py
  └── safe_fs.py           (atomic_write, path safety)

config_manager.py
  └── safe_fs.py           (CONFIG_DIR, atomic_write)

mcp_server.py
  ├── workspace_manager.py (workspace CRUD)
  └── file_manager.py      (file CRUD)

cli.py
  └── safe_fs.py           (CONFIG_DIR, WORKSPACES_DIR)
```

## Key Design Decisions

### Atomic Writes
`safe_fs.atomic_write()` writes to a `.tmp.{uuid}` file, then atomically renames. This prevents corruption from concurrent writes or crashes during write. All persistent state uses this method.

### Single Source of Truth
Workspace UI state lives in `workspace.json` on disk. The REST API and WebSocket both read/write this file. No in-memory state duplication — the file is the SSOT.

### Config Manager
Global app config (`config.json`) tracks `activeWorkspace`, `theme`, `language`, and workspace ordering. Uses `copy.deepcopy(DEFAULT_CONFIG)` to avoid mutation bugs from shallow copies. All workspace create/delete operations sync with the config.

### Conflict Resolution
Each `workspace.json` has a `version` field incremented on every write. Clients can send `If-Match` headers with `PUT /api/workspaces/:id`; a mismatch returns 409 with current state. No locking — last-writer-wins without If-Match.

### WebSocket Sync Strategy
Events are sent only on mouse-up/drag-end (not per frame). On WS connect, the server sends a full `state:sync`. All events include `workspace` and `seq` fields for traceability.

### MCP Server Architecture
The MCP server has two code paths:
1. **Real MCPServer** (from the `mcp` PyPI package) — used when available. Decorator-based tool registration (`@mcp.tool()`). Supports both `stdio` and `sse` transport.
2. **SimpleMCP fallback** — used when the `mcp` package isn't installed. Manual JSON-RPC handling over stdio. Only supports `stdio` transport.

The MCP server runs as a separate process via `start.sh` on port 5011 (SSE). Multiple opencode instances can connect simultaneously.

### Auth
Session-based auth is opt-in. It activates if `WORKSPACE_AUTH` env var is set or a first user is registered. Uses PBKDF2 password hashing and token-based sessions. When auth is active, all API routes require a valid session cookie.

### Search
Full-text search across workspace text files. The `file_manager.search_files()` function reads all text files (`.md`, `.txt`, `.html`, etc.) and performs case-insensitive substring matching. Results include file path, line number, and matching text.

### Plugin System
Plugins are Python files in the `extensions/` directory at the workspace root. Each plugin exports a `register(api)` function receiving a `PluginAPI` object with `PUT /api/files`, `tool()` decorator, and `log()` method. The `plugin_loader.py` module handles install (from git URLs or local paths), uninstall, and loading.

## Test Strategy

- **Unit tests** for safe_fs, config_manager, workspace_manager, file_manager (pure functions)
- **Integration tests** for REST API via Flask test client
- **WebSocket tests** using live server fixture + raw HTTP requests
- **MCP tests** using SimpleMCP class directly and _call_tool function
- **CLI tests** via subprocess (not tracked in coverage)
- **100% coverage target** enforced for `backend/` (excluding cli.py which is subprocess-only)

## Server Startup

### start.sh (development)
```bash
# Flask API + WebSocket on port 5010
python -m backend.app &
# MCP server on port 5011
python -m backend.mcp_server --host 127.0.0.1 --port 5011 &
```

### Environment Variables
| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | 5010 | Flask server port |
| `HOST` | 0.0.0.0 | Flask bind address |
| `MCP_PORT` | 5011 | MCP server port |
| `MCP_HOST` | 127.0.0.1 | MCP bind address |
| `WORKSPACE_AUTH` | (unset) | Enable auth |
