# UI/UX Design

## Design Language

```
Inspiration: JARVIS / Iron Man HUD
Theme:      Dark
Palette:
  Background:  #0a0a0f (near-black)
  Surface:     rgba(15, 15, 30, 0.85) with blur
  Accent:      #00d4ff (cyan)
  Secondary:   #0088cc (deep blue)
  Text:        #e0e0e0
  TextDim:     #666680
  Border:      rgba(0, 212, 255, 0.15)
  Glow:        rgba(0, 212, 255, 0.08)
  Error:       #ff3355
```

- Glass panels (frosted glass via `backdrop-filter: blur`)
- Subtle cyan glow on interactive elements
- No sharp corners (6px-8px radius)
- Smooth 200ms-300ms ease-out transitions
- No gaming neon — prioritize readability
- Monospace for code/text, sans-serif for UI labels

---

## Desktop Layout

```
┌─────────────────────────────────────────────────────────┐
│  [≡]  Workspace: My Project         [⊗] [−] [□]  │← Title bar
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌──────────┐    ┌─────────────────────┐              │
│   │ Files    │    │ README.md            │              │
│   │          │    │  # Hello World       │              │
│   │ markdown │    │  This is a doc.     │              │
│   │ images   │    │                      │              │
│   │ files    │    │                      │              │
│   └──────────┘    └─────────────────────┘              │
│                                                         │
│           ┌─────────────────────────────┐              │
│           │ Preview                     │              │
│           │  <h1>Hello</h1>            │              │
│           │  <p>Rendered HTML</p>      │              │
│           └─────────────────────────────┘              │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  [ws_1] [ws_2] [ws_3] [+ Add]    [🔍 Search]  │← Dock
└─────────────────────────────────────────────────────────┘
```

### Top Bar
- Left: Workspace switcher dropdown + current workspace name
- Right: Minimize all, Zoom controls, Settings gear

### Desktop / Infinite Canvas
- Background: dark gradient with subtle grid pattern (barely visible)
- Right-click on empty area: context menu (New Markdown, New Text, Upload)
- Middle-click drag or Ctrl+drag: pan the canvas
- Ctrl+scroll: zoom in/out (range 0.25 to 4.0)
- Double-click empty area: create new markdown window

### Dock (bottom)
- Displays all minimized windows as icon+label
- Click to restore
- "+" button opens new window type selector
- Styled as a glass bar at the bottom edge

---

## Window Interactions

### Focus
- Click on any window → brings it to highest z-index
- Focused window has brighter title bar and subtle cyan glow on border
- Unfocused windows have dimmer title bar (opacity 0.6)

### Drag
- Drag by title bar to move
- Window follows cursor in real-time
- On release → send WebSocket event, persist position
- Windows cannot be dragged outside canvas bounds (clamped)

### Resize
- Drag resize handles on right edge, bottom edge, and bottom-right corner
- Minimum size: 240x160px
- During resize → live preview
- On release → send WebSocket event, persist size

### Minimize
- Click [−] → window collapses to dock with animation (shrinks downward)
- Click in dock → window restores at original position with animation
- Minimized windows have `minimized: true` in workspace.json

### Maximize
- Click [□] → window fills viewport (not canvas), ignores pan/zoom transforms
- Title bar remains visible at top
- Click [□] again to restore original size and position

### Close
- Click [⊗] → remove window from workspace
- If window has unsaved content → confirm dialog (future: auto-save tracks this)

---

## States

### Empty Workspace
- First launch with no windows
- Show center-aligned placeholder:
  - "Welcome to your workspace"
  - Quick action buttons: "New Markdown", "New Text", "Upload File"
  - "Drag files here to open"

### Loading
- Workspace list loading: skeleton cards (glass panels with shimmer)
- File loading inside window: content area shows pulse animation
- WebSocket connecting: subtle "reconnecting..." indicator in top bar

### Error
- Workspace load failure: error toast + "Try again" button
- File save failure: red indicator on the window title bar
- WebSocket disconnect: yellow indicator, auto-retry with backoff
- API errors: toast notification at top-right, auto-dismiss after 5s

### Edge Cases
- **Many windows**: z-index management works up to ~50 windows; beyond that, windows list in dock shows overflow menu
- **Overlapping windows**: bring clicked window to front, others stay in place
- **Viewport clipping**: windows partially outside viewport are still present; pan to reveal
- **Rapid resize/drag**: debounced WebSocket events (last event wins)
- **File deleted externally**: window shows "File not found" message, offers to close or recreate
- **Upload during sync**: queue uploads, process sequentially

---

## User Flows

### Opening a File
```
1. User double-clicks file in File Explorer
2. Frontend determines window type from extension (.md → markdown)
3. Frontend sends `window:open` via WebSocket
4. Server creates window entry in workspace.json
5. Server broadcasts `window:added` to all clients
6. Frontend renders the new window, fetches file content via GET /api/files
```

### Moving a Window
```
1. User drags title bar
2. Window follows cursor (local-only, no network)
3. User releases mouse
4. Frontend sends `window:move { id, x, y }` via WebSocket
5. Server updates workspace.json
6. Server broadcasts `window:moved` to other clients
7. Local client already has the new position (optimistic)
```

### Creating a New Workspace
```
1. User clicks "+" in workspace switcher
2. Modal: enter name, optional description
3. POST /api/workspaces
4. Server creates directory + workspace.json
5. Response returns workspace ID
6. Frontend navigates to new workspace (empty state)
```

### Uploading a File
```
1. User drags file onto canvas or clicks Upload button
2. POST /api/workspaces/:id/upload (multipart)
3. Server saves file to files/ or images/ (by MIME type)
4. Server broadcasts `file:changed`
5. File Explorer refreshes
6. If image → optional auto-open image window
```
