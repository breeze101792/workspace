import { useEffect, useState } from 'react';
import { useWorkspace } from '../../state/workspaceContext';
import { useWebSocket } from '../../ws/useWebSocket';
import { syncEngine } from '../../ws/syncEngine';
import * as workspaceApi from '../../api/workspace';
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
    syncEngine.on('state:sync', (data: unknown) => {
      const ws = data as { id: string; name: string; windows: unknown[]; settings: unknown };
      if (ws && ws.id) {
        dispatch({ type: 'SET_WORKSPACE', workspace: ws as any });
      }
    });
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
    send('window:open', {
      type,
      title: titles[type] || type,
      x: 150 + Math.random() * 100,
      y: 150 + Math.random() * 100,
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
