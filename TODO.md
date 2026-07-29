# TODO — Deferred Features & Known Gaps

## Deferred from V1

### Window Types
- [ ] **PDF Viewer** — requires pdf.js integration. Post-V1 once core stable.
- [ ] **Video Player** — V2+.
- [ ] **Audio Player** — V2+.
- [ ] **Browser/WebView** — V2+.
- [ ] **Terminal** — requires xterm.js + backend PTY. V2+.
- [ ] **Code Editor** — requires Monaco/CodeMirror integration. V2+.

### Features
- [ ] **External plugins** — The `WindowRegistry` is ready but plugin loading from `extensions/` directory is not implemented. V2.
- [ ] **Auth** — Session-based auth with login page. Not needed for local-only V1, required for cloud deployment.
- [ ] **HTTPS / TLS** — For production/cloud use. Local V1 runs on HTTP.
- [ ] **Workspace import/export** — Zip/tar export or import from directory.
- [ ] **File search** — Full-text search across workspace files.
- [ ] **Drag-and-drop between windows** — e.g., drag image from explorer into markdown.
- [ ] **Snap-to-grid / snap-to-window** — Alignment guides when dragging windows.
- [ ] **Window tabbing** — Group multiple windows into tabs.
- [ ] **Undo/redo** — For window positions and file edits.
- [ ] **Conflict resolution** — What happens when two clients modify the same window simultaneously.

### Polish
- [ ] **Window shake / minimize animation** — Smooth animations for minimize/maximize.
- [ ] **Desktop wallpaper / custom background** — User-settable background.
- [ ] **Keyboard shortcuts** — Cmd+W close, Cmd+N new window, etc.
- [ ] **Multi-monitor support** — Spawn windows across screens.
- [ ] **Touch support** — Touch gestures for mobile/tablet.

### Infrastructure
- [ ] **Tests** — Unit tests for window manager state functions, integration tests for API, WebSocket sync tests.
- [ ] **CI/CD** — GitHub Actions or similar.
- [ ] **Docker** — Containerized deployment.
- [ ] **CLI tool** — A `workspace` CLI for workspace management from terminal.
- [ ] **Electron/Tauri wrapper** — Native desktop app packaging.
