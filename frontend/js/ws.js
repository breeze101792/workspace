import { emit } from './state.js';

let ws = null;
let wsId = null;
let reconnectTimer = null;

function getUrl() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws?workspace=${wsId}`;
}

export function connect(workspaceId) {
  wsId = workspaceId;
  disconnect();

  ws = new WebSocket(getUrl());

  ws.onopen = () => {
    emit('ws:connected');
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      const type = msg.type;
      const data = msg.data;

      if (type === 'state:sync') {
        emit('state:sync', data);
      } else if (type === 'window:moved') {
        emit('window:moved', data);
      } else if (type === 'window:resized') {
        emit('window:resized', data);
      } else if (type === 'window:focused') {
        emit('window:focused', data);
      } else if (type === 'window:minimized') {
        emit('window:minimized', data);
      } else if (type === 'window:maximized') {
        emit('window:maximized', data);
      } else if (type === 'window:removed') {
        emit('window:removed', data);
      } else if (type === 'window:added') {
        emit('window:added', data);
      } else if (type === 'workspace:updated') {
        emit('workspace:updated', data);
      }
    } catch (e) {
      console.error('WS parse error:', e);
    }
  };

  ws.onclose = () => {
    emit('ws:disconnected');
    reconnectTimer = setTimeout(() => {
      if (wsId) connect(wsId);
    }, 2000);
  };

  ws.onerror = () => {
    ws.close();
  };
}

export function send(type, data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, data }));
  }
}

export function disconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }
}
