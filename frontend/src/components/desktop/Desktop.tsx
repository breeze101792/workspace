import { useEffect, useState } from 'react';
import { useWorkspace } from '../../state/workspaceContext';
import { useWebSocket } from '../../ws/useWebSocket';
import { syncEngine } from '../../ws/syncEngine';
import * as workspaceApi from '../../api/workspace';
import * as filesApi from '../../api/files';
import { showToast } from '../common/Toast';

import { Canvas } from './Canvas';
import { TopBar } from './TopBar';
import { Dock } from './Dock';
import { WindowManager } from '../window/WindowManager';
import { CreateWorkspaceModal } from '../workspace/CreateWorkspaceModal';
import { NewWindowMenu } from '../workspace/NewWindowMenu';
import { ToastContainer } from '../common/Toast';

export function Desktop() {
  const { state, dispatch } = useWorkspace();
  const [showNewWorkspace, setShowNewWorkspace] = useState(false);
  const [showNewWindow, setShowNewWindow] = useState(false);
  const currentWsId = state.workspace?.id ?? null;

  const { connected, send } = useWebSocket(currentWsId);

  useEffect(() => {
    dispatch({ type: 'SET_CONNECTED', connected });
  }, [connected, dispatch]);

  useEffect(() => {
    const unsubSync = syncEngine.on('state:sync', (data: unknown) => {
      const ws = data as { id: string; name: string; windows: unknown[]; settings: unknown };
      if (ws && ws.id) {
        dispatch({ type: 'SET_WORKSPACE', workspace: ws as any });
      }
    });

    const unsubAdded = syncEngine.on('window:added', (data: unknown) => {
      dispatch({ type: 'ADD_WINDOW', window: data as any });
    });

    const unsubRemoved = syncEngine.on('window:removed', (data: unknown) => {
      dispatch({ type: 'REMOVE_WINDOW', id: (data as any).id });
    });

    const unsubMoved = syncEngine.on('window:moved', (data: unknown) => {
      const d = data as any;
      dispatch({ type: 'MOVE_WINDOW', id: d.id, x: d.x, y: d.y });
    });

    const unsubResized = syncEngine.on('window:resized', (data: unknown) => {
      const d = data as any;
      dispatch({ type: 'RESIZE_WINDOW', id: d.id, width: d.width, height: d.height });
    });

    const unsubFocused = syncEngine.on('window:focused', (data: unknown) => {
      dispatch({ type: 'FOCUS_WINDOW', id: (data as any).id });
    });

    const unsubMinimized = syncEngine.on('window:minimized', (data: unknown) => {
      const d = data as any;
      dispatch({ type: 'TOGGLE_MINIMIZE', id: d.id, minimized: d.minimized });
    });

    const unsubMaximized = syncEngine.on('window:maximized', (data: unknown) => {
      const d = data as any;
      dispatch({ type: 'TOGGLE_MAXIMIZE', id: d.id, maximized: d.maximized });
    });

    const unsubSettings = syncEngine.on('workspace:updated', (data: unknown) => {
      dispatch({ type: 'UPDATE_SETTINGS', settings: data as any });
    });

    return () => {
      unsubSync(); unsubAdded(); unsubRemoved(); unsubMoved(); unsubResized();
      unsubFocused(); unsubMinimized(); unsubMaximized(); unsubSettings();
    };
  }, [dispatch]);

  useEffect(() => {
    loadWorkspaceList();
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      loadWorkspace(hash);
    }
  }, []);

  async function loadWorkspaceList() {
    const res = await workspaceApi.listWorkspaces();
    if (res.ok) {
      dispatch({ type: 'SET_WORKSPACE_LIST', list: res.data });
      if (!currentWsId && res.data.length > 0) {
        loadWorkspace(res.data[0].id);
      }
    }
  }

  async function loadWorkspace(id: string) {
    dispatch({ type: 'SET_LOADING', loading: true });
    const res = await workspaceApi.getWorkspace(id);
    if (res.ok) {
      dispatch({ type: 'SET_WORKSPACE', workspace: res.data });
      window.location.hash = id;
    } else {
      dispatch({ type: 'SET_ERROR', error: res.error });
    }
  }

  async function handleCreateWorkspace(name: string) {
    const res = await workspaceApi.createWorkspace(name);
    if (res.ok) {
      setShowNewWorkspace(false);
      await loadWorkspaceList();
      await loadWorkspace(res.data.id);
    }
  }

  function handleNewWindow(type: string) {
    setShowNewWindow(false);
    const titles: Record<string, string> = {
      markdown: 'New Markdown',
      text: 'New Text',
      html: 'New HTML',
      image: 'Image Viewer',
      explorer: 'File Explorer',
    };

    const id = `wnd_${Math.random().toString(36).slice(2, 10)}`;
    const ws = state.workspace;
    if (!ws) return;

    const maxZ = Math.max(...ws.windows.map(w => w.zIndex), 0);
    const x = 150 + Math.random() * 100;
    const y = 150 + Math.random() * 100;

    if (type === 'explorer' || type === 'image') {
      // Explorer and Image don't need a file
      dispatch({ type: 'ADD_WINDOW', window: {
        id, type, title: titles[type] || type, x, y,
        width: 600, height: 400, zIndex: maxZ + 1,
        minimized: false, maximized: false,
        file: null, filePath: null, metadata: {},
      }});
      send('window:open', { id, type, title: titles[type] || type, x, y });
      return;
    }

    // Create a file for text-based window types
    const typeMap: Record<string, { ext: string; dir: string; template: string }> = {
      markdown: { ext: 'md', dir: 'markdown', template: '# Untitled\n\n' },
      text: { ext: 'txt', dir: 'markdown', template: '' },
      html: { ext: 'html', dir: 'html', template: '<!DOCTYPE html>\n<html>\n<head><title>Page</title></head>\n<body>\n  <h1>Hello</h1>\n</body>\n</html>\n' },
    };
    const cfg = typeMap[type] || { ext: 'txt', dir: 'files', template: '' };
    const fileName = `untitled.${cfg.ext}`;
    const filePath = `${cfg.dir}/${fileName}`;

    filesApi.writeFile(ws.id, filePath, cfg.template).then((res) => {
      if (!res.ok) {
        showToast('Failed to create file: ' + res.error, 'error');
      }
    });

    dispatch({ type: 'ADD_WINDOW', window: {
      id, type, title: fileName, x, y,
      width: 600, height: 400, zIndex: maxZ + 1,
      minimized: false, maximized: false,
      file: filePath, filePath, metadata: {},
    }});

    send('window:open', {
      id, type, title: fileName, x, y, file: filePath,
    });
  }

  if (state.loading) {
    return (
      <div className="desktop">
        <div className="loading-screen">
          <div className="loading-spinner" />
          <span>Loading workspace...</span>
        </div>
      </div>
    );
  }

  if (state.error && !state.workspace) {
    return (
      <div className="desktop">
        <div className="error-screen">
          <span className="error-icon">⚠</span>
          <span>{state.error}</span>
          <button onClick={() => loadWorkspaceList()}>Retry</button>
        </div>
      </div>
    );
  }

  if (!state.workspace) {
    return (
      <div className="desktop">
        <div className="empty-screen">
          <h1>Welcome to Workspace</h1>
          <p>Create a workspace to get started</p>
          <button className="empty-btn" onClick={() => setShowNewWorkspace(true)}>
            Create Workspace
          </button>
        </div>
        <CreateWorkspaceModal
          open={showNewWorkspace}
          onClose={() => setShowNewWorkspace(false)}
          onCreate={handleCreateWorkspace}
        />
      </div>
    );
  }

  return (
    <div className="desktop">
      <TopBar onNewWorkspace={() => setShowNewWorkspace(true)} />
      <Canvas>
        <WindowManager sendWS={send} />
      </Canvas>
      <Dock onNewWindow={() => setShowNewWindow(true)} />
      <ToastContainer />

      <CreateWorkspaceModal
        open={showNewWorkspace}
        onClose={() => setShowNewWorkspace(false)}
        onCreate={handleCreateWorkspace}
      />
      <NewWindowMenu
        open={showNewWindow}
        onClose={() => setShowNewWindow(false)}
        onSelect={handleNewWindow}
      />
    </div>
  );
}
