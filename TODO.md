# TODO — Deferred Features & Known Gaps

## Deferred from V1

### Features
- [ ] **External plugins** — The `WindowRegistry` is ready but plugin loading from `extensions/` directory is not implemented. V2.
- [ ] **Drag-and-drop between windows** — e.g., drag image from explorer into markdown (drop inserts reference; full preview-in-drop pending).
- [ ] **Window tabbing** — Group multiple windows into tabs (basic tabbed container exists; drag-to-tab pending).

### Window Types
- [ ] **PDF Viewer** — requires pdf.js integration. Post-V1 once core stable.
- [ ] **Video Player** — V2+.
- [ ] **Audio Player** — V2+.
- [ ] **Browser/WebView** — V2+.
- [ ] **Terminal** — requires xterm.js + backend PTY. V2+.
- [ ] **Code Editor** — requires Monaco/CodeMirror integration. V2+.

## Pending
- [ ] **Electron/Tauri wrapper** — Native desktop app packaging.
- [ ] **HTTPS / TLS** — For production/cloud use. Local V1 runs on HTTP.
