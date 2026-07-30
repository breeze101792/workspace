import { WebSocketServer } from 'ws';
import { URL } from 'url';
import * as workspaceManager from '../services/workspace-manager.js';

const clients = new Map();
const workspaceClients = new Map();

export function setupWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const params = new URL(req.url, 'http://localhost').searchParams;
    const workspaceId = params.get('workspace');
    const clientId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (!workspaceId) {
      ws.close(4000, 'workspace parameter required');
      return;
    }

    clients.set(clientId, { ws, workspaceId });

    if (!workspaceClients.has(workspaceId)) {
      workspaceClients.set(workspaceId, new Set());
    }
    workspaceClients.get(workspaceId).add(clientId);

    sendTo(ws, { type: 'state:sync', workspace: workspaceId, data: null, seq: 0 });

    loadAndSendState(ws, workspaceId);

    ws.on('message', async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        sendTo(ws, { type: 'error', data: { error: 'Invalid JSON' } });
        return;
      }

      const { type, data } = msg;

      try {
        await handleMessage(workspaceId, type, data, ws);
      } catch (e) {
        sendTo(ws, { type: 'error', data: { error: e.message } });
      }
    });

    ws.on('close', () => {
      clients.delete(clientId);
      const set = workspaceClients.get(workspaceId);
      if (set) {
        set.delete(clientId);
        if (set.size === 0) workspaceClients.delete(workspaceId);
      }
    });

    ws.on('error', () => {
      clients.delete(clientId);
    });
  });

  return wss;
}

async function handleMessage(workspaceId, type, data, sender) {
  switch (type) {
    case 'window:move': {
      const ws = await workspaceManager.getWorkspace(workspaceId);
      const win = ws.windows.find(w => w.id === data.id);
      if (!win) return;
      win.x = data.x;
      win.y = data.y;
      await workspaceManager.updateWorkspace(workspaceId, { windows: ws.windows });
      broadcast(workspaceId, { type: 'window:moved', workspace: workspaceId, data: { id: data.id, x: data.x, y: data.y } }, sender);
      break;
    }
    case 'window:resize': {
      const ws = await workspaceManager.getWorkspace(workspaceId);
      const win = ws.windows.find(w => w.id === data.id);
      if (!win) return;
      win.width = data.width;
      win.height = data.height;
      await workspaceManager.updateWorkspace(workspaceId, { windows: ws.windows });
      broadcast(workspaceId, { type: 'window:resized', workspace: workspaceId, data: { id: data.id, width: data.width, height: data.height } }, sender);
      break;
    }
    case 'window:focus': {
      const wsState = await workspaceManager.getWorkspace(workspaceId);
      const maxZ = Math.max(...wsState.windows.map(w => w.zIndex), 0);
      const win = wsState.windows.find(w => w.id === data.id);
      if (!win) return;
      win.zIndex = maxZ + 1;
      await workspaceManager.updateWorkspace(workspaceId, { windows: wsState.windows });
      broadcast(workspaceId, { type: 'window:focused', workspace: workspaceId, data: { id: data.id, zIndex: win.zIndex } }, sender);
      break;
    }
    case 'window:minimize': {
      const wsState = await workspaceManager.getWorkspace(workspaceId);
      const win = wsState.windows.find(w => w.id === data.id);
      if (!win) return;
      win.minimized = !win.minimized;
      await workspaceManager.updateWorkspace(workspaceId, { windows: wsState.windows });
      broadcast(workspaceId, { type: 'window:minimized', workspace: workspaceId, data: { id: data.id, minimized: win.minimized } }, sender);
      break;
    }
    case 'window:maximize': {
      const wsState = await workspaceManager.getWorkspace(workspaceId);
      const win = wsState.windows.find(w => w.id === data.id);
      if (!win) return;
      win.maximized = !win.maximized;
      await workspaceManager.updateWorkspace(workspaceId, { windows: wsState.windows });
      broadcast(workspaceId, { type: 'window:maximized', workspace: workspaceId, data: { id: data.id, maximized: win.maximized } }, sender);
      break;
    }
    case 'window:close': {
      const wsState = await workspaceManager.getWorkspace(workspaceId);
      wsState.windows = wsState.windows.filter(w => w.id !== data.id);
      await workspaceManager.updateWorkspace(workspaceId, { windows: wsState.windows });
      broadcast(workspaceId, { type: 'window:removed', workspace: workspaceId, data: { id: data.id } }, sender);
      break;
    }
    case 'window:open': {
      const wsState = await workspaceManager.getWorkspace(workspaceId);
      const maxZ = Math.max(...wsState.windows.map(w => w.zIndex), 0);
      const newWindow = {
        id: `wnd_${Math.random().toString(36).slice(2, 10)}`,
        type: data.type,
        title: data.title || '',
        x: data.x || 100,
        y: data.y || 100,
        width: data.width || 600,
        height: data.height || 400,
        zIndex: maxZ + 1,
        minimized: false,
        maximized: false,
        file: data.file || null,
        filePath: data.file || null,
        metadata: {},
      };
      wsState.windows.push(newWindow);
      await workspaceManager.updateWorkspace(workspaceId, { windows: wsState.windows });
      const addedMsg = { type: 'window:added', workspace: workspaceId, data: newWindow };
      broadcast(workspaceId, addedMsg, sender);
      sendTo(sender, addedMsg);
      break;
    }
    case 'workspace:updateSettings': {
      await workspaceManager.updateWorkspace(workspaceId, { settings: data });
      broadcast(workspaceId, { type: 'workspace:updated', workspace: workspaceId, data }, sender);
      break;
    }
  }
}

function broadcast(workspaceId, message, excludeSender) {
  const set = workspaceClients.get(workspaceId);
  if (!set) return;
  for (const clientId of set) {
    const client = clients.get(clientId);
    if (client && client.ws !== excludeSender && client.ws.readyState === 1) {
      sendTo(client.ws, message);
    }
  }
}

function sendTo(ws, message) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(message));
  }
}

async function loadAndSendState(ws, workspaceId) {
  try {
    const state = await workspaceManager.getWorkspace(workspaceId);
    sendTo(ws, { type: 'state:sync', workspace: workspaceId, data: state, seq: 0 });
  } catch {
    sendTo(ws, { type: 'state:sync', workspace: workspaceId, data: null, seq: 0 });
  }
}
