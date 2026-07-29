import { useCallback } from 'react';
import { useWorkspace } from '../state/workspaceContext';

export function useWindowManager() {
  const { state, dispatch } = useWorkspace();

  const addWindow = useCallback((win: {
    type: string;
    title: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    file?: string;
  }) => {
    const ws = state.workspace;
    if (!ws) return;
    const maxZ = Math.max(...ws.windows.map((w) => w.zIndex), 0);
    const id = `wnd_${Math.random().toString(36).slice(2, 10)}`;

    dispatch({
      type: 'ADD_WINDOW',
      window: {
        id,
        type: win.type,
        title: win.title,
        x: win.x ?? 100 + ws.windows.length * 30,
        y: win.y ?? 100 + ws.windows.length * 30,
        width: win.width ?? 600,
        height: win.height ?? 400,
        zIndex: maxZ + 1,
        minimized: false,
        maximized: false,
        file: win.file ?? null,
        filePath: win.file ?? null,
        metadata: {},
      },
    });

    return id;
  }, [state.workspace, dispatch]);

  const removeWindow = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_WINDOW', id });
  }, [dispatch]);

  const moveWindow = useCallback((id: string, x: number, y: number) => {
    dispatch({ type: 'MOVE_WINDOW', id, x, y });
  }, [dispatch]);

  const resizeWindow = useCallback((id: string, width: number, height: number) => {
    dispatch({ type: 'RESIZE_WINDOW', id, width, height });
  }, [dispatch]);

  const focusWindow = useCallback((id: string) => {
    dispatch({ type: 'FOCUS_WINDOW', id });
  }, [dispatch]);

  const toggleMinimize = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_MINIMIZE', id });
  }, [dispatch]);

  const toggleMaximize = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_MAXIMIZE', id });
  }, [dispatch]);

  return {
    windows: state.workspace?.windows ?? [],
    addWindow,
    removeWindow,
    moveWindow,
    resizeWindow,
    focusWindow,
    toggleMinimize,
    toggleMaximize,
  };
}
