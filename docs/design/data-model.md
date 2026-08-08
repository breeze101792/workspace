# Data Model / Schema

## Storage Root

All workspace data lives under `~/.config/workspace/`.

```
~/.config/workspace/
├── config.json              # Global application config
├── workspaces/
│   ├── <workspace_id>/
│   │   ├── workspace.json   # Layout, windows, metadata
│   │   ├── markdown/        # .md files
│   │   ├── html/            # .html files
│   │   ├── images/          # .png, .jpg, .gif, .svg
│   │   ├── files/           # Uploaded raw files
│   │   ├── pdf/             # .pdf files (future)
│   │   └── cache/           # Thumbnails, derived data
│   └── <workspace_id>/
│       └── ...
└── extensions/              # Future: plugin storage
```

## Global Config (`config.json`)

```json
{
  "version": 1,
  "activeWorkspace": "ws_abc123",
  "workspaces": ["ws_abc123", "ws_def456"],
  "theme": "dark",
  "language": "en"
}
```

## Workspace Document (`workspace.json`)

This is the single source of truth for the workspace UI state.

```json
{
  "version": 1,
  "id": "ws_abc123",
  "name": "My Project",
  "description": "",
  "createdAt": "2026-07-29T10:00:00.000Z",
  "updatedAt": "2026-07-29T12:30:00.000Z",
  "windows": [
    {
      "id": "wnd_001",
      "type": "markdown",
      "title": "README",
      "x": 80,
      "y": 120,
      "width": 640,
      "height": 480,
      "zIndex": 2,
      "minimized": false,
      "maximized": false,
      "file": "markdown/readme.md",
      "filePath": "markdown/readme.md",
      "metadata": {
        "scrollPosition": 0,
        "cursorLine": 15,
        "cursorColumn": 4
      }
    },
    {
      "id": "wnd_002",
      "type": "html",
      "title": "Preview",
      "x": 750,
      "y": 120,
      "width": 600,
      "height": 480,
      "zIndex": 1,
      "minimized": false,
      "maximized": false,
      "file": "html/index.html",
      "filePath": "html/index.html",
      "metadata": {}
    },
    {
      "id": "wnd_003",
      "type": "image",
      "title": "Diagram",
      "x": 80,
      "y": 630,
      "width": 500,
      "height": 400,
      "zIndex": 3,
      "minimized": false,
      "maximized": false,
      "file": "images/diagram.png",
      "filePath": "images/diagram.png",
      "metadata": {}
    },
    {
      "id": "wnd_004",
      "type": "explorer",
      "title": "Files",
      "x": 0,
      "y": 0,
      "width": 280,
      "height": 600,
      "zIndex": 0,
      "minimized": false,
      "maximized": false,
      "file": null,
      "filePath": null,
      "metadata": {
        "expandedPaths": ["markdown", "images"]
      }
    }
  ],
  "settings": {
    "zoom": 1.0,
    "viewportX": 0,
    "viewportY": 0,
    "snapToGrid": false,
    "gridSize": 20,
    "watchFiles": true
  }
}
```

### Window Type Registry

| Type | Content | Behavior |
|------|---------|----------|
| `markdown` | Renders `.md` as formatted document | Editable text area + live preview |
| `text` | Plain `.txt` content | Monospace editor |
| `html` | Renders `.html` in sandboxed iframe | Preview only (V1), editable later |
| `image` | Displays image files | Zoom to fit, pan |
| `explorer` | File tree of workspace | Navigate, open files in new windows |
| `pdf` | _Deferred to V2_ | Renders via pdf.js |

### Window State Schema (full type)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string (pattern: `wnd_[a-z0-9]{8}`) | yes | Unique window identifier |
| `type` | enum | yes | One of the registered window types |
| `title` | string | yes | Display title in title bar |
| `x` | number | yes | X position in canvas world coordinates |
| `y` | number | yes | Y position in canvas world coordinates |
| `width` | number | yes | Width in pixels |
| `height` | number | yes | Height in pixels |
| `zIndex` | number | yes | Stacking order (higher = on top) |
| `minimized` | boolean | yes | Whether collapsed to taskbar |
| `maximized` | boolean | yes | Whether fills viewport |
| `file` | string | no | Relative path within workspace |
| `metadata` | object | yes | Type-specific state |

## File Content

File contents are NOT stored in workspace.json. They live as actual files in the workspace subdirectories:

- `markdown/note.md` — UTF-8 text
- `text/notes.txt` — UTF-8 text
- `html/index.html` — UTF-8 text
- `images/photo.png` — Binary (served as static files)
- `files/document.pdf` — Binary (future)

## Entity Relationships

```
Config (1)
  │
  ├── Workspace (N)
  │     │
  │     ├── workspace.json (1)
  │     │     └── Window (N)
  │     │
  │     ├── markdown/ (N files)
  │     ├── html/ (N files)
  │     ├── images/ (N files)
  │     ├── files/ (N files)
  │     ├── pdf/ (N files, future)
  │     └── cache/ (N files, derived)
  │
  └── Extension (N) [future]
```

## Path Traversal Prevention

All file operations validate that resolved paths stay within the workspace root. The `safePath` utility computes `path.resolve(workspaceRoot, userPath)` and verifies the result starts with `workspaceRoot`. Any violation returns a 422 error.
