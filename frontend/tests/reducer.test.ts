import { describe, it, expect } from 'vitest';
import type { Workspace, WindowState } from '../src/types/index';

// Re-implement the reducer here for testing (it's inside workspaceContext.tsx)
// We test the pure logic in isolation

interface WorkspaceState {
  workspace: Workspace | null;
  loading: boolean;
  error: string | null;
  workspaceList: { id: string; name: string; updatedAt?: string }[];
  connected: boolean;
}

type Action =
  | { type: 'SET_WORKSPACE'; workspace: Workspace }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_WORKSPACE_LIST'; list: { id: string; name: string; updatedAt?: string }[] }
  | { type: 'SET_CONNECTED'; connected: boolean }
  | { type: 'ADD_WINDOW'; window: WindowState }
  | { type: 'REMOVE_WINDOW'; id: string }
  | { type: 'MOVE_WINDOW'; id: string; x: number; y: number }
  | { type: 'RESIZE_WINDOW'; id: string; width: number; height: number }
  | { type: 'FOCUS_WINDOW'; id: string }
  | { type: 'TOGGLE_MINIMIZE'; id: string; minimized?: boolean }
  | { type: 'TOGGLE_MAXIMIZE'; id: string; maximized?: boolean }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<WorkspaceState['workspace']['settings']> }
  | { type: 'UPDATE_WINDOW_METADATA'; id: string; metadata: Record<string, unknown> };

function workspaceReducer(state: WorkspaceState, action: Action): WorkspaceState {
  if (!state.workspace && !['SET_WORKSPACE', 'SET_WORKSPACE_LIST', 'SET_LOADING', 'SET_ERROR', 'SET_CONNECTED', 'ADD_WINDOW'].includes(action.type)) {
    return state;
  }

  switch (action.type) {
    case 'SET_WORKSPACE':
      return { ...state, workspace: action.workspace, loading: false, error: null };
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'SET_ERROR':
      return { ...state, error: action.error, loading: false };
    case 'SET_WORKSPACE_LIST':
      return { ...state, workspaceList: action.list };
    case 'SET_CONNECTED':
      return { ...state, connected: action.connected };
    case 'ADD_WINDOW': {
      if (!state.workspace) return state;
      return { ...state, workspace: { ...state.workspace, windows: [...state.workspace.windows, action.window] } };
    }
    case 'REMOVE_WINDOW': {
      if (!state.workspace) return state;
      return { ...state, workspace: { ...state.workspace, windows: state.workspace.windows.filter(w => w.id !== action.id) } };
    }
    case 'MOVE_WINDOW': {
      if (!state.workspace) return state;
      return { ...state, workspace: { ...state.workspace, windows: state.workspace.windows.map(w => w.id === action.id ? { ...w, x: action.x, y: action.y } : w) } };
    }
    case 'RESIZE_WINDOW': {
      if (!state.workspace) return state;
      return { ...state, workspace: { ...state.workspace, windows: state.workspace.windows.map(w => w.id === action.id ? { ...w, width: action.width, height: action.height } : w) } };
    }
    case 'FOCUS_WINDOW': {
      if (!state.workspace) return state;
      const maxZ = Math.max(...state.workspace.windows.map(w => w.zIndex), 0);
      return { ...state, workspace: { ...state.workspace, windows: state.workspace.windows.map(w => w.id === action.id ? { ...w, zIndex: maxZ + 1 } : w) } };
    }
    case 'TOGGLE_MINIMIZE': {
      if (!state.workspace) return state;
      return { ...state, workspace: { ...state.workspace, windows: state.workspace.windows.map(w => w.id === action.id ? { ...w, minimized: action.minimized !== undefined ? action.minimized : !w.minimized } : w) } };
    }
    case 'TOGGLE_MAXIMIZE': {
      if (!state.workspace) return state;
      return { ...state, workspace: { ...state.workspace, windows: state.workspace.windows.map(w => w.id === action.id ? { ...w, maximized: action.maximized !== undefined ? action.maximized : !w.maximized } : w) } };
    }
    case 'UPDATE_SETTINGS': {
      if (!state.workspace) return state;
      return { ...state, workspace: { ...state.workspace, settings: { ...state.workspace.settings, ...action.settings } } };
    }
    default:
      return state;
  }
}

function makeWindow(overrides: Partial<WindowState> = {}): WindowState {
  return {
    id: 'wnd_test',
    type: 'markdown',
    title: 'Test',
    x: 100, y: 100,
    width: 600, height: 400,
    zIndex: 1,
    minimized: false, maximized: false,
    file: null, filePath: null,
    metadata: {},
    ...overrides,
  };
}

function makeState(overrides: Partial<WorkspaceState> = {}): WorkspaceState {
  return {
    loading: false,
    error: null,
    workspaceList: [],
    connected: true,
    workspace: {
      id: 'ws_test',
      name: 'Test',
      windows: [],
      settings: { zoom: 1, viewportX: 0, viewportY: 0, snapToGrid: false, gridSize: 20 },
    },
    ...overrides,
  };
}

describe('workspaceReducer', () => {
  it('SET_WORKSPACE replaces workspace', () => {
    const state = makeState({ workspace: null });
    const ws = state.workspace!;
    const next = workspaceReducer(state, { type: 'SET_WORKSPACE', workspace: { ...ws, name: 'New Name' } });
    expect(next.workspace?.name).toBe('New Name');
    expect(next.loading).toBe(false);
  });

  it('ADD_WINDOW appends to windows array', () => {
    const state = makeState();
    const next = workspaceReducer(state, { type: 'ADD_WINDOW', window: makeWindow() });
    expect(next.workspace?.windows).toHaveLength(1);
    expect(next.workspace?.windows[0].id).toBe('wnd_test');
  });

  it('REMOVE_WINDOW removes by id', () => {
    const state = makeState({
      workspace: { ...makeState().workspace!, windows: [makeWindow({ id: 'wnd_1' }), makeWindow({ id: 'wnd_2' })] }
    });
    const next = workspaceReducer(state, { type: 'REMOVE_WINDOW', id: 'wnd_1' });
    expect(next.workspace?.windows).toHaveLength(1);
    expect(next.workspace?.windows[0].id).toBe('wnd_2');
  });

  it('MOVE_WINDOW updates position', () => {
    const state = makeState({ workspace: { ...makeState().workspace!, windows: [makeWindow()] } });
    const next = workspaceReducer(state, { type: 'MOVE_WINDOW', id: 'wnd_test', x: 200, y: 300 });
    expect(next.workspace?.windows[0].x).toBe(200);
    expect(next.workspace?.windows[0].y).toBe(300);
  });

  it('RESIZE_WINDOW updates dimensions', () => {
    const state = makeState({ workspace: { ...makeState().workspace!, windows: [makeWindow()] } });
    const next = workspaceReducer(state, { type: 'RESIZE_WINDOW', id: 'wnd_test', width: 800, height: 600 });
    expect(next.workspace?.windows[0].width).toBe(800);
    expect(next.workspace?.windows[0].height).toBe(600);
  });

  it('FOCUS_WINDOW sets highest zIndex', () => {
    const state = makeState({
      workspace: {
        ...makeState().workspace!,
        windows: [makeWindow({ id: 'wnd_a', zIndex: 1 }), makeWindow({ id: 'wnd_b', zIndex: 2 })]
      }
    });
    const next = workspaceReducer(state, { type: 'FOCUS_WINDOW', id: 'wnd_a' });
    expect(next.workspace?.windows[0].zIndex).toBe(3);
    expect(next.workspace?.windows[1].zIndex).toBe(2);
  });

  it('TOGGLE_MINIMIZE flips minimized state', () => {
    const state = makeState({ workspace: { ...makeState().workspace!, windows: [makeWindow({ minimized: false })] } });
    const next = workspaceReducer(state, { type: 'TOGGLE_MINIMIZE', id: 'wnd_test' });
    expect(next.workspace?.windows[0].minimized).toBe(true);
  });

  it('TOGGLE_MINIMIZE with explicit value sets it', () => {
    const state = makeState({ workspace: { ...makeState().workspace!, windows: [makeWindow({ minimized: false })] } });
    const next = workspaceReducer(state, { type: 'TOGGLE_MINIMIZE', id: 'wnd_test', minimized: true });
    expect(next.workspace?.windows[0].minimized).toBe(true);
  });

  it('TOGGLE_MAXIMIZE flips maximized state', () => {
    const state = makeState({ workspace: { ...makeState().workspace!, windows: [makeWindow({ maximized: false })] } });
    const next = workspaceReducer(state, { type: 'TOGGLE_MAXIMIZE', id: 'wnd_test' });
    expect(next.workspace?.windows[0].maximized).toBe(true);
  });

  it('TOGGLE_MAXIMIZE with explicit value sets it', () => {
    const state = makeState({ workspace: { ...makeState().workspace!, windows: [makeWindow({ maximized: true })] } });
    const next = workspaceReducer(state, { type: 'TOGGLE_MAXIMIZE', id: 'wnd_test', maximized: false });
    expect(next.workspace?.windows[0].maximized).toBe(false);
  });

  it('UPDATE_SETTINGS merges into settings', () => {
    const state = makeState();
    const next = workspaceReducer(state, { type: 'UPDATE_SETTINGS', settings: { zoom: 2, viewportX: 100 } });
    expect(next.workspace?.settings.zoom).toBe(2);
    expect(next.workspace?.settings.viewportX).toBe(100);
    // unchanged fields preserved
    expect(next.workspace?.settings.snapToGrid).toBe(false);
  });

  it('ADD_WINDOW does nothing when workspace is null', () => {
    const state = makeState({ workspace: null });
    const next = workspaceReducer(state, { type: 'ADD_WINDOW', window: makeWindow() });
    // action type IS in the early-return whitelist, so it proceeds
    expect(next.workspace).toBeNull();
  });

  it('REMOVE_WINDOW does nothing when workspace is null', () => {
    const state = makeState({ workspace: null });
    const next = workspaceReducer(state, { type: 'REMOVE_WINDOW', id: 'wnd_test' });
    expect(next).toBe(state); // returns unchanged
  });

  it('SET_CONNECTED updates connection status', () => {
    const state = makeState({ connected: true });
    const next = workspaceReducer(state, { type: 'SET_CONNECTED', connected: false });
    expect(next.connected).toBe(false);
  });
});
