# API Design

## Transport Protocols

| Protocol | Purpose | Port |
|----------|---------|------|
| HTTP REST | File CRUD, workspace management | 5010 (override with `PORT` env) |
| WebSocket | Real-time window state sync | Same server (flask-sock, `/ws`) |
| MCP (SSE) | AI agent access | 5011 (stdio JSON-RPC fallback) |

## Agent Guide

`GET /agent.md` serves the static guide file `agent.md` from the repo root.
It documents all three transports, the REST endpoints, the MCP tools, and the
WebSocket protocol for AI agents.

## Response Envelope

Every HTTP response uses a consistent shape:

```json
// Success
{ "ok": true, "data": { ... } }

// Error
{ "ok": false, "error": "Human-readable message" }

// List
{ "ok": true, "data": [ ... ] }
```

HTTP status codes:
- 200 — Success
- 201 — Created
- 400 — Bad request (missing/invalid fields)
- 404 — Not found
- 409 — Conflict (duplicate, stale version)
- 422 — Validation error (path traversal, invalid type)
- 500 — Internal server error

---

## REST Endpoints

### Workspace Management

#### `GET /api/workspaces`
List all workspaces.

Response:
```json
{
  "ok": true,
  "data": [
    { "id": "ws_abc123", "name": "My Project", "updatedAt": "..." },
    { "id": "ws_def456", "name": "Research", "updatedAt": "..." }
  ]
}
```

#### `POST /api/workspaces`
Create a new workspace.

Request:
```json
{
  "name": "My Project",
  "description": ""
}
```

Response (201):
```json
{
  "ok": true,
  "data": {
    "id": "ws_abc123",
    "name": "My Project",
    "path": "~/.config/workspace/workspaces/ws_abc123"
  }
}
```

Errors: `name` is required and must be 1-200 characters.

#### `GET /api/workspaces/:id`
Get full workspace state (contents of workspace.json).

Response:
```json
{
  "ok": true,
  "data": {
    "id": "ws_abc123",
    "name": "My Project",
    "windows": [ ... ],
    "settings": { ... }
  }
}
```

#### `PUT /api/workspaces/:id`
Update workspace metadata or window layout (full replace).

Request:
```json
{
  "name": "Renamed",
  "windows": [ ... ],
  "settings": { ... }
}
```

Response:
```json
{
  "ok": true,
  "data": { "updatedAt": "..." }
}
```

#### `DELETE /api/workspaces/:id`
Delete workspace and all its files.

Response:
```json
{
  "ok": true,
  "data": { "deleted": true }
}
```

Errors: Cannot delete the active workspace if it's the only one. Returns 409.

---

### File Operations

#### `GET /api/workspaces/:id/files/*filepath`
Read a file's content.

- Text files (`.md`, `.txt`, `.html`, `.json`, `.css`, `.js`): returns `{ ok: true, data: { content: "...", mime: "text/markdown" } }`
- Binary files (`.png`, `.jpg`, `.gif`, `.svg`): returns raw binary with correct Content-Type header

Query params: `?type=text` (force text mode for unknown extensions)

Errors:
- 404 if file doesn't exist
- 422 if path escapes workspace root

#### `PUT /api/workspaces/:id/files/*filepath`
Write content to a file. Creates parent directories if they don't exist.

Request:
```json
{
  "content": "# Hello\nWorld"
}
```

Response:
```json
{
  "ok": true,
  "data": { "path": "markdown/note.md", "size": 14 }
}
```

#### `DELETE /api/workspaces/:id/files/*filepath`
Delete a file or empty directory.

Response:
```json
{
  "ok": true,
  "data": { "deleted": true }
}
```

#### `POST /api/workspaces/:id/upload`
Upload a file. Accepts `multipart/form-data`.

- Field `file`: the file data
- Field `path` (optional): target subdirectory, defaults to `files/`

Response:
```json
{
  "ok": true,
  "data": {
    "path": "files/photo.png",
    "size": 102400,
    "mime": "image/png"
  }
}
```

#### `GET /api/workspaces/:id/files?dir=path`
List files and directories in a workspace subdirectory.

Response:
```json
{
  "ok": true,
  "data": {
    "path": "markdown",
    "entries": [
      { "name": "readme.md", "type": "file", "size": 1200, "mime": "text/markdown", "updatedAt": "..." },
      { "name": "notes", "type": "directory" }
    ]
  }
}
```

---

## WebSocket Protocol

### Connection

```
ws://localhost:5010/ws?workspace=ws_abc123
```

### Message Format

All messages are JSON over WebSocket:

```json
{
  "type": "event_type",
  "workspace": "ws_abc123",
  "data": { ... },
  "seq": 42
}
```

### Server → Client Events

| Event | When | Data |
|-------|------|------|
| `window:added` | Window created | Full window object |
| `window:removed` | Window deleted | `{ id: "wnd_001" }` |
| `window:moved` | Position changed | `{ id, x, y }` |
| `window:resized` | Size changed | `{ id, width, height }` |
| `window:focused` | Focus changed | `{ id }` |
| `window:minimized` | Minimized | `{ id, minimized: true }` |
| `window:maximized` | Maximized | `{ id, maximized: true }` |
| `workspace:updated` | Metadata/settings changed | Full settings object |
| `file:changed` | File created/updated/deleted | `{ path, action: "write"\|"delete" }` |

> **Note**: `file:changed` broadcasts are only emitted when the workspace's
> `settings.watchFiles` is `true` (the default). Set `watchFiles: false` to
> disable live file-change notifications for a workspace.
| `state:sync` | Full state snapshot (on connect) | Full workspace.json |

### Client → Server Events

| Event | When | Data |
|-------|------|------|
| `window:move` | Drag end | `{ id, x, y }` |
| `window:resize` | Resize end | `{ id, width, height }` |
| `window:focus` | Click on window | `{ id }` |
| `window:minimize` | Click minimize | `{ id }` |
| `window:maximize` | Click maximize | `{ id }` |
| `window:close` | Click close | `{ id }` |
| `window:open` | Open file in new window | `{ type, file, title }` |
| `workspace:updateSettings` | Zoom/pan/theme/watchFiles change | `{ zoom, viewportX, viewportY, watchFiles }` |

### Sync Strategy

- **On mouse-up / drag-end**: send the WebSocket event. The server persists to workspace.json and broadcasts to all other clients.
- **No per-frame emissions**: no event on every mousemove during drag — only on release.
- **On connect**: server sends full `state:sync` so the client has the complete picture.

---

## MCP Server (Stdio)

### Tool Definitions

#### `workspace_list`
List all available workspaces.
- Input: none
- Output: `[{ id, name, updatedAt }]`

#### `workspace_read`
Read full workspace state.
- Input: `{ workspaceId: string }`
- Output: `{ id, name, windows, settings }`

#### `workspace_update`
Update window positions, add/remove windows.
- Input: `{ workspaceId, windows?: Window[], settings?: object }`
- Output: `{ updatedAt }`

#### `file_read`
Read a file from the workspace.
- Input: `{ workspaceId, path: string }`
- Output: `{ content, mime }`

#### `file_write`
Write content to a file.
- Input: `{ workspaceId, path: string, content: string }`
- Output: `{ path, size }`

#### `file_list`
List directory contents.
- Input: `{ workspaceId, dir?: string }`
- Output: `{ entries: [{ name, type, size }] }`

#### `file_delete`
Delete a file.
- Input: `{ workspaceId, path: string }`
- Output: `{ deleted: true }`

#### `ui_context`
Get the current UI context (focused window, viewport, etc.).
- Input: `{ workspaceId }`
- Output: `{ focusedWindow, viewport, openedFiles }`
