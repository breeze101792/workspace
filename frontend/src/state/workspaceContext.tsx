import { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { Workspace, WindowState, WorkspaceSettings } from '../types';

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
  | { type: 'TOGGLE_MINIMIZE'; id: string }
  | { type: 'TOGGLE_MAXIMIZE'; id: string }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<WorkspaceSettings> }
  | { type: 'UPDATE_WINDOW_METADATA'; id: string; metadata: Record<string, unknown> };

function workspaceReducer(state: WorkspaceState, action: Action): WorkspaceState {
  if (!state.workspace && action.type !== 'SET_WORKSPACE' && action.type !== 'SET_WORKSPACE_LIST' && action.type !== 'SET_LOADING' && action.type !== 'SET_ERROR' && action.type !== 'SET_CONNECTED' && action.type !== 'ADD_WINDOW') {
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
      return {
        ...state,
        workspace: {
          ...state.workspace,
          windows: [...state.workspace.windows, action.window],
        },
      };
    }

    case 'REMOVE_WINDOW': {
      if (!state.workspace) return state;
      return {
        ...state,
        workspace: {
          ...state.workspace,
          windows: state.workspace.windows.filter((w) => w.id !== action.id),
        },
      };
    }

    case 'MOVE_WINDOW': {
      if (!state.workspace) return state;
      return {
        ...state,
        workspace: {
          ...state.workspace,
          windows: state.workspace.windows.map((w) =>
            w.id === action.id ? { ...w, x: action.x, y: action.y } : w
          ),
        },
      };
    }

    case 'RESIZE_WINDOW': {
      if (!state.workspace) return state;
      return {
        ...state,
        workspace: {
          ...state.workspace,
          windows: state.workspace.windows.map((w) =>
            w.id === action.id ? { ...w, width: action.width, height: action.height } : w
          ),
        },
      };
    }

    case 'FOCUS_WINDOW': {
      if (!state.workspace) return state;
      const maxZ = Math.max(...state.workspace.windows.map((w) => w.zIndex), 0);
      return {
        ...state,
        workspace: {
          ...state.workspace,
          windows: state.workspace.windows.map((w) =>
            w.id === action.id ? { ...w, zIndex: maxZ + 1 } : w
          ),
        },
      };
    }

    case 'TOGGLE_MINIMIZE': {
      if (!state.workspace) return state;
      return {
        ...state,
        workspace: {
          ...state.workspace,
          windows: state.workspace.windows.map((w) =>
            w.id === action.id ? { ...w, minimized: !w.minimized } : w
          ),
        },
      };
    }

    case 'TOGGLE_MAXIMIZE': {
      if (!state.workspace) return state;
      return {
        ...state,
        workspace: {
          ...state.workspace,
          windows: state.workspace.windows.map((w) =>
            w.id === action.id ? { ...w, maximized: !w.maximized } : w
          ),
        },
      };
    }

    case 'UPDATE_SETTINGS': {
      if (!state.workspace) return state;
      return {
        ...state,
        workspace: {
          ...state.workspace,
          settings: { ...state.workspace.settings, ...action.settings },
        },
      };
    }

    case 'UPDATE_WINDOW_METADATA': {
      if (!state.workspace) return state;
      return {
        ...state,
        workspace: {
          ...state.workspace,
          windows: state.workspace.windows.map((w) =>
            w.id === action.id ? { ...w, metadata: { ...w.metadata, ...action.metadata } } : w
          ),
        },
      };
    }

    default:
      return state;
  }
}

const initialState: WorkspaceState = {
  workspace: null,
  loading: false,
  error: null,
  workspaceList: [],
  connected: false,
};

const WorkspaceContext = createContext<{
  state: WorkspaceState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(workspaceReducer, initialState);

  return (
    <WorkspaceContext.Provider value={{ state, dispatch }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
