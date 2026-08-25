# Agent Guide — Workspace Platform

This is a guide for AI agents using the Workspace platform. The platform is a
desktop-style environment shared between a human and an AI. Each workspace maps
to a folder on disk. The browser renders the UI. Agents read and write through
the HTTP API, the WebSocket, or MCP.

## Transports

| Transport | Address | Purpose |
|-----------|---------|---------|
| HTTP REST | `http://<host>:5010` (`PORT` env overrides) | File CRUD, workspace management, search, import/export, auth |
| WebSocket | `ws://<host>:5010/ws?workspace={id}` | Real-time window state sync |
| MCP | `http://<host>:5011` (SSE; stdio JSON-RPC fallback) | Agent access with eight tools |

## Response Envelope

Every HTTP response uses one shape:

```json
{ "ok": true, "data": { ... } }
{ "ok": false, "error": "Human-readable message" }
```

Status codes: 200 success, 201 created, 400 bad request, 404 not found,
409 conflict (duplicate or stale version), 422 validation error (path traversal,
invalid type), 500 internal error.

## Core Concepts

- `workspace.json` is the single source of truth for UI state: windows,
  positions, sizes, z-index, settings. File contents live as real files in
  workspace subdirectories (`markdown/`, `html/`, `images/`, `files/`).
- Text files return `{ content, mime }` inside the envelope. Binary files
  (`.png`, `.jpg`, `.gif`, `.svg`) return raw bytes with the correct
  Content-Type. Add `?type=text` to force text mode.
- Optimistic concurrency: send `If-Match: <version>` on
  `PUT /api/workspaces/{id}`. A stale version returns 409. Read the current
  version with `GET /api/workspaces/{id}/version`.
- To show a file to the user, send `window:open` over the WebSocket, or add a
  window object via `PUT /api/workspaces/{id}`.
- File writes broadcast `file:changed` on the WebSocket only when the
  workspace's `settings.watchFiles` is `true` (the default).

## Getting Started

1. `GET /api/workspaces` — list workspaces.
2. `GET /api/workspaces/{id}` — read full state (windows + settings).
3. `GET /api/workspaces/{id}/files?dir=` — list a directory.
4. `GET`/`PUT /api/workspaces/{id}/files/{path}` — read and write content.
5. Prefer MCP tools when an MCP client is connected. The REST API is the
   full-featured superset.
6. Connect the WebSocket to observe and react to the user in real time.

## REST Endpoints

### Workspaces

| Method | Path | Body / Notes |
|--------|------|--------------|
| GET | `/api/workspaces` | List all workspaces |
| POST | `/api/workspaces` | `{ name, description }` — create (201) |
| GET | `/api/workspaces/{id}` | Full workspace.json |
| PUT | `/api/workspaces/{id}` | `{ windows?, settings? }`; optional `If-Match` header |
| DELETE | `/api/workspaces/{id}` | Delete workspace and its files |
| GET | `/api/workspaces/{id}/version` | Current version for `If-Match` |
| PUT | `/api/workspaces/{id}/wallpaper` | `{ wallpaper }` |
| GET | `/api/workspaces/{id}/export` | Download workspace as zip |
| POST | `/api/workspaces/import` | Multipart `file` (zip), optional `name` field |

### Files

| Method | Path | Body / Notes |
|--------|------|--------------|
| GET | `/api/workspaces/{id}/files?dir={dir}` | List directory entries |
| GET | `/api/workspaces/{id}/files/{path}` | Read file (text or binary); `?type=text` forces text |
| PUT | `/api/workspaces/{id}/files/{path}` | `{ content }` — write; creates parent dirs |
| PATCH | `/api/workspaces/{id}/files/{path}` | `{ newPath }` — rename/move |
| DELETE | `/api/workspaces/{id}/files/{path}` | Delete file |
| POST | `/api/workspaces/{id}/upload` | Multipart `file`, optional `path` field (defaults to `files/`) |
| GET | `/api/workspaces/{id}/search?q={query}&dir={dir}` | Search file contents |

### Config, Plugins, Auth

| Method | Path | Body / Notes |
|--------|------|--------------|
| GET | `/api/config` | `{ activeWorkspace, theme, language }` |
| PUT | `/api/config` | Same fields, any subset |
| GET | `/api/plugins` | List plugins |
| POST | `/api/plugins/{id}/load` | Load one plugin |
| POST | `/api/plugins/load_all` | Load all plugins |
| DELETE | `/api/plugins/{id}` | Uninstall plugin |
| GET | `/api/auth/status` | `{ required: bool }` |
| POST | `/api/auth/register` | `{ username, password }` |
| POST | `/api/auth/login` | Returns `{ token, username }` |
| POST | `/api/auth/logout` | `Authorization: Bearer <token>` |
| GET | `/api/auth/me` | Verify token |

## MCP Tools

Connect via MCP (default port 5011, SSE transport, stdio JSON-RPC fallback).

| Tool | Input | Output |
|------|-------|--------|
| `workspace_list` | — | `[{ id, name, updatedAt }]` |
| `workspace_read` | `{ workspaceId }` | Full workspace state |
| `workspace_update` | `{ workspaceId, windows?, settings? }` | `{ updatedAt }` |
| `file_read` | `{ workspaceId, path }` | `{ content, mime }` |
| `file_write` | `{ workspaceId, path, content }` | `{ path, size }` |
| `file_list` | `{ workspaceId, dir? }` | `{ entries: [{ name, type, size }] }` |
| `file_delete` | `{ workspaceId, path }` | `{ deleted: true }` |
| `ui_context` | `{ workspaceId }` | `{ focusedWindow, viewport, openedFiles }` |

## WebSocket Protocol

Connect with the workspace id as a query parameter:

```
ws://<host>:5010/ws?workspace=ws_abc123
```

On connect the server sends a full `state:sync` snapshot of workspace.json.
Every message is JSON with the shape `{ type, workspace, data, seq }`.

### Client → Server

| Event | Data |
|-------|------|
| `window:open` | `{ type, file, title, x?, y?, width?, height? }` — open a file in a new window |
| `window:move` | `{ id, x, y }` |
| `window:resize` | `{ id, width, height }` |
| `window:focus` | `{ id }` |
| `window:minimize` | `{ id, minimized? }` |
| `window:maximize` | `{ id, maximized? }` |
| `window:close` | `{ id }` |
| `window:rename` | `{ id, title?, file? }` |
| `workspace:updateSettings` | `{ zoom?, viewportX?, viewportY?, watchFiles? }` |

### Server → Client

| Event | Data |
|-------|------|
| `state:sync` | Full workspace.json (on connect) |
| `window:added` | Full window object |
| `window:removed` | `{ id }` |
| `window:moved` | `{ id, x, y }` |
| `window:resized` | `{ id, width, height }` |
| `window:focused` | `{ id }` |
| `window:minimized` | `{ id, minimized }` |
| `window:maximized` | `{ id, maximized }` |
| `window:renamed` | `{ id, title, file }` |
| `workspace:updated` | Updated settings or full workspace |
| `file:changed` | `{ path, action: write\|delete\|rename }` |

Events are sent on drag end and resize end, not per frame. The server persists
each event to workspace.json and broadcasts it to all other clients in the same
workspace.
