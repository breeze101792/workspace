# Frontend Module Design

## Technology

- **Framework**: React 18+ with TypeScript
- **Build**: Vite (fast dev server, lean config)
- **Styling**: CSS Modules or plain CSS files (no CSS-in-JS library)
- **State**: React context + reducer patterns (no external state library for V1)
- **WebSocket**: Native WebSocket API wrapped in a custom hook
- **Icons**: Inline SVG components (no icon library dependency)

---

## Module Architecture

```
src/
├── main.tsx                       # Entry point, renders App
├── App.tsx                        # Root: workspace routing + global providers
├── types/
│   ├── index.ts                   # Shared types (Window, Workspace, etc.)
│   └── events.ts                  # WebSocket event type definitions
│
├── api/                           # Network layer (reusable fetch wrapper)
│   ├── client.ts                  # Generic fetch() wrapper with error shaping
│   ├── workspace.ts              # Workspace API calls
│   └── files.ts                  # File API calls
│
├── ws/                            # WebSocket layer
│   ├── useWebSocket.ts           # WebSocket connection hook
│   └── syncEngine.ts             # Message dispatch + optimistic updates
│
├── hooks/                         # Reusable React hooks
│   ├── useWindowManager.ts       # Window CRUD + z-index management
│   ├── useDrag.ts                # Draggable behavior (pointer events)
│   ├── useResize.ts              # Resizable behavior
│   ├── useCanvas.ts             # Pan + zoom state
│   └── useAutoSave.ts           # Debounced save on state change
│
├── state/                         # Global state management
│   ├── workspaceContext.tsx       # React context for active workspace
│   ├── windowReducer.ts          # Window state reducer
│   └── canvasReducer.ts          # Canvas (viewport/zoom) reducer
│
├── components/
│   ├── desktop/
│   │   ├── Desktop.tsx           # Full-screen container
│   │   ├── TopBar.tsx            # Workspace name, controls
│   │   ├── Canvas.tsx            # Infinite canvas (pan/zoom transform)
│   │   └── Dock.tsx              # Bottom dock for minimized windows
│   │
│   ├── window/
│   │   ├── Window.tsx            # Generic window frame (title bar + content slot)
│   │   ├── TitleBar.tsx          # Title text, minimize/maximize/close buttons
│   │   ├── ResizeHandle.tsx      # Drag-to-resize (edges + corners)
│   │   └── WindowManager.tsx     # Renders all windows, manages z-index
│   │
│   ├── workspace/
│   │   ├── WorkspaceSelector.tsx # Dropdown to switch workspaces
│   │   ├── WorkspaceList.tsx     # Sidebar/panel listing all workspaces
│   │   └── CreateWorkspaceModal.tsx
│   │
│   ├── windows/                  # Window type implementations
│   │   ├── registry.ts           # WindowRegistry — maps type → component
│   │   ├── MarkdownWindow.tsx    # Markdown editor + preview
│   │   ├── TextWindow.tsx        # Plain text editor
│   │   ├── HtmlWindow.tsx        # Sandboxed iframe preview
│   │   ├── ImageWindow.tsx       # Image display with zoom/pan
│   │   └── FileExplorer.tsx      # File tree navigator
│   │
│   └── common/
│       ├── ContextMenu.tsx       # Right-click menu
│       ├── Toast.tsx             # Notification toasts
│       ├── Modal.tsx             # Generic modal dialog
│       └── Spinner.tsx           # Loading indicator
│
└── styles/
    ├── variables.css             # CSS custom properties (colors, spacing)
    ├── global.css                # Reset, base styles, scrollbar
    ├── desktop.css               # Canvas, top bar, dock
    ├── window.css                # Window frame, title bar, resize handles
    └── windows/                  # Per-window-type styles
        ├── markdown.css
        ├── text.css
        ├── html.css
        ├── image.css
        └── explorer.css
```

---

## Window Registry (Plugin System)

The registry is a simple map that decouples window type logic from the core window manager.

```typescript
// registry.ts
import { ComponentType } from 'react';
import MarkdownWindow from './MarkdownWindow';
import TextWindow from './TextWindow';
import HtmlWindow from './HtmlWindow';
import ImageWindow from './ImageWindow';
import FileExplorer from './FileExplorer';

interface WindowDescriptor {
  component: ComponentType<WindowProps>;
  label: string;
  icon: string;  // SVG name or icon identifier
  extensions?: string[];  // File extensions that trigger this type
}

const registry = new Map<string, WindowDescriptor>();

export function registerWindowType(type: string, descriptor: WindowDescriptor) {
  registry.set(type, descriptor);
}

export function getWindowType(type: string): WindowDescriptor | undefined {
  return registry.get(type);
}

export function getTypeForExtension(ext: string): string | undefined {
  for (const [type, desc] of registry) {
    if (desc.extensions?.includes(ext)) return type;
  }
  return undefined;
}

// Built-in registrations
registerWindowType('markdown', {
  component: MarkdownWindow,
  label: 'Markdown',
  icon: 'markdown',
  extensions: ['md', 'mdx'],
});
registerWindowType('text', {
  component: TextWindow,
  label: 'Text',
  icon: 'text',
  extensions: ['txt', 'log', 'cfg', 'ini'],
});
registerWindowType('html', {
  component: HtmlWindow,
  label: 'HTML Preview',
  icon: 'html',
  extensions: ['html', 'htm'],
});
registerWindowType('image', {
  component: ImageWindow,
  label: 'Image Viewer',
  icon: 'image',
  extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'],
});
registerWindowType('explorer', {
  component: FileExplorer,
  label: 'File Explorer',
  icon: 'folder',
});
```

**To add a new window type later**, external code just calls:
```typescript
registerWindowType('terminal', {
  component: TerminalWindow,
  label: 'Terminal',
  icon: 'terminal',
});
```
No core files need to change.

---

## WindowManager State (Framework-Agnostic)

The window manager core is designed as pure functions operating on plain data. This makes it testable without React and portable to other frameworks.

```typescript
// Pure state operations (no React dependency)
interface WindowState {
  id: string;
  type: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  minimized: boolean;
  maximized: boolean;
  file: string | null;
  metadata: Record<string, unknown>;
}

function addWindow(windows: WindowState[], w: WindowState): WindowState[] { ... }
function removeWindow(windows: WindowState[], id: string): WindowState[] { ... }
function moveWindow(windows: WindowState[], id: string, x: number, y: number): WindowState[] { ... }
function resizeWindow(windows: WindowState[], id: string, w: number, h: number): WindowState[] { ... }
function focusWindow(windows: WindowState[], id: string): WindowState[] { ... }
function toggleMinimize(windows: WindowState[], id: string): WindowState[] { ... }
function toggleMaximize(windows: WindowState[], id: string): WindowState[] { ... }
function nextZIndex(windows: WindowState[]): number { ... }
```

---

## Communication & Data Flow

```
User Action (drag window)
       │
       ▼
React Component (Window.tsx)
       │
       ├── useDrag.js → local pixel movement (no re-render of other windows)
       │
       ▼ (on mouseup)
useWindowManager.dispatch({ type: 'MOVE_WINDOW', id, x, y })
       │
       ├── Updates local state (optimistic)
       │
       ├── syncEngine.send({ type: 'window:move', data: { id, x, y } })
       │       │
       │       ▼ (WebSocket)
       │    Server receives, persists to workspace.json, broadcasts
       │
       └── Canvas re-renders window at new position
```

All mutations follow this path:
1. **Local** — update state immediately (optimistic)
2. **Sync** — send event via WebSocket
3. **Server** — persist + broadcast to other clients
4. **Reconcile** — if server rejects, revert (future: conflict resolution)

---

## Reusable Libraries

### `api/client.ts` (fetch wrapper)
Can be extracted to a standalone npm package. Used by all API calls.

```typescript
interface ApiResponse<T> {
  ok: true;
  data: T;
} | {
  ok: false;
  error: string;
}

async function get<T>(path: string): Promise<ApiResponse<T>> { ... }
async function post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> { ... }
async function put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> { ... }
async function del<T>(path: string): Promise<ApiResponse<T>> { ... }
async function upload<T>(path: string, file: File): Promise<ApiResponse<T>> { ... }
```

### `syncEngine.ts` (WebSocket manager)
Reusable pattern for any real-time app.

```typescript
class SyncEngine {
  connect(url: string): void;
  send(type: string, data: unknown): void;
  on(type: string, handler: (data: unknown) => void): void;
  disconnect(): void;
  get connected(): boolean;
}
```
