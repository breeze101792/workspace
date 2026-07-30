import * as api from './api.js';
import { connect, send, disconnect } from './ws.js';
import { on, emit } from './state.js';
import { initCanvas, getViewport, setViewport } from './canvas.js';
import {
  setWindows, addWindow, removeWindow, focusWindow,
  toggleMinimize, toggleMaximize, renderAllWindows, getWindows
} from './window-manager.js';

let currentWsId = null;

// --- Toast ---

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 5000);
}

// --- Welcome state ---

function showWelcome(show) {
  document.getElementById('welcome-placeholder').classList.toggle('hidden', !show);
}

// --- Context menu ---

function showContextMenu(x, y) {
  const menu = document.getElementById('context-menu');
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.classList.remove('hidden');
}

function hideContextMenu() {
  document.getElementById('context-menu').classList.add('hidden');
}

// --- Bootstrap ---

async function init() {
  initCanvas();
  setupUI();
  await loadWorkspace();
}

function renderDock() {
  const dock = document.getElementById('dock-minimized');
  dock.innerHTML = '';
  getWindows().filter(w => w.minimized).forEach(w => {
    const item = document.createElement('div');
    item.className = 'dock-item';
    item.textContent = w.title;
    item.addEventListener('click', () => {
      toggleMinimize(w.id, false);
      focusWindow(w.id);
      send('window:minimize', { id: w.id, minimized: false });
    });
    dock.appendChild(item);
  });
}

function setupUI() {
  // New workspace button
  document.getElementById('btn-new-ws').addEventListener('click', showCreateWorkspace);

  // New window button
  document.getElementById('btn-new-window').addEventListener('click', () => {
    document.getElementById('new-window-menu').classList.toggle('visible');
  });

  // New window type buttons
  document.querySelectorAll('[data-wnd-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('new-window-menu').classList.remove('visible');
      handleNewWindow(btn.dataset.wndType);
    });
  });

  // Close modal
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) hideModal();
  });

  // Create workspace form
  document.getElementById('btn-create-ws').addEventListener('click', createWorkspace);

  // Welcome buttons
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'upload') {
        document.getElementById('file-upload-input').click();
      } else {
        handleNewWindow(action);
      }
    });
  });

  // Context menu actions
  document.querySelectorAll('#context-menu .menu-item[data-action]').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      hideContextMenu();
      if (action === 'upload') {
        document.getElementById('file-upload-input').click();
      } else {
        handleNewWindow(action);
      }
    });
  });

  // Hide context menu on click outside
  document.addEventListener('click', (e) => {
    if (!document.getElementById('context-menu').contains(e.target)) {
      hideContextMenu();
    }
  });

  // Window events from titlebar/resize
  on('windows:changed', renderDock);
  on('window:request-move', (data) => send('window:move', data));
  on('window:request-resize', (data) => send('window:resize', data));
  on('window:request-focus', (id) => send('window:focus', { id }));
  on('window:request-minimize', (id) => {
    toggleMinimize(id);
    send('window:minimize', { id, minimized: true });
  });
  on('window:request-maximize', (id) => {
    toggleMaximize(id);
    send('window:maximize', { id, maximized: getWindows().find(w => w.id === id)?.maximized });
  });
  on('window:request-close', (id) => {
    removeWindow(id);
    send('window:close', { id });
  });

  // Canvas events
  on('canvas:contextmenu', (data) => showContextMenu(data.x, data.y));
  on('canvas:dblclick', (data) => {
    handleNewWindow('markdown', { x: data.x, y: data.y });
  });
  on('canvas:viewport-changed', (data) => {
    if (currentWsId) {
      send('workspace:updateSettings', { zoom: data.zoom, viewportX: data.panX, viewportY: data.panY });
    }
  });

  // WS connection state
  on('ws:connected', () => {
    document.getElementById('reconnecting-indicator').classList.add('hidden');
  });
  on('ws:disconnected', () => {
    document.getElementById('reconnecting-indicator').classList.remove('hidden');
  });

  // WS events from other clients
  on('state:sync', (data) => {
    const wins = (data.windows || []).map(w => ({ ...w, _wsId: currentWsId }));
    setWindows(wins);
    renderAllWindows();
    showWelcome(!wins.length);
  });
  on('window:moved', (data) => {
    const w = getWindows().find(ww => ww.id === data.id);
    if (w) { w.x = data.x; w.y = data.y; }
    const el = document.getElementById(`wnd-${data.id}`);
    if (el) { el.style.left = data.x + 'px'; el.style.top = data.y + 'px'; }
  });
  on('window:resized', (data) => {
    const w = getWindows().find(ww => ww.id === data.id);
    if (w) { w.width = data.width; w.height = data.height; }
    const el = document.getElementById(`wnd-${data.id}`);
    if (el) { el.style.width = data.width + 'px'; el.style.height = data.height + 'px'; }
  });
  on('window:focused', (data) => focusWindow(data.id));
  on('window:minimized', (data) => toggleMinimize(data.id, data.minimized));
  on('window:maximized', (data) => toggleMaximize(data.id, data.maximized));
  on('window:removed', (data) => removeWindow(data.id));
  on('window:added', (data) => {
    if (!getWindows().find(w => w.id === data.id)) {
      data._wsId = currentWsId;
      addWindow(data);
      showWelcome(false);
    }
  });
  on('file:changed', () => {
    // Refresh file explorer windows
    getWindows().filter(w => w.type === 'explorer').forEach(w => {
      const content = document.getElementById(`wnd-${w.id}-content`);
      if (content) {
        import('./window-factory.js').then(m => m.renderWindowContent(w));
      }
    });
  });

  // Upload button
  const uploadInput = document.getElementById('file-upload-input');
  document.getElementById('btn-upload').addEventListener('click', () => uploadInput.click());
  uploadInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !currentWsId) return;
    const res = await api.upload(currentWsId, file);
    if (res.ok) {
      showToast('Uploaded ' + file.name, 'success');
      if (res.data.mime.startsWith('image/')) {
        const id = 'wnd_' + Math.random().toString(36).slice(2, 10);
        handleNewWindow('image', { id, file: res.data.path, title: file.name });
      }
    } else {
      showToast('Upload failed: ' + (res.error || 'unknown error'), 'error');
    }
    uploadInput.value = '';
  });

  // Drag-and-drop file upload
  const container = document.getElementById('canvas-container');
  container.addEventListener('dragover', (e) => { e.preventDefault(); container.style.outline = '2px dashed var(--accent)'; });
  container.addEventListener('dragleave', () => { container.style.outline = ''; });
  container.addEventListener('drop', async (e) => {
    e.preventDefault();
    container.style.outline = '';
    if (!currentWsId) return;
    for (const file of e.dataTransfer.files) {
      const res = await api.upload(currentWsId, file);
      if (res.ok) {
        showToast('Uploaded ' + file.name, 'success');
        if (res.data.mime.startsWith('image/')) {
          const id = 'wnd_' + Math.random().toString(36).slice(2, 10);
          handleNewWindow('image', { id, file: res.data.path, title: file.name });
        }
      } else {
        showToast('Upload failed: ' + (res.error || 'unknown error'), 'error');
      }
    }
  });

  // Make _openWindow accessible to explorer
  window._openWindow = (win) => {
    win._wsId = currentWsId;
    addWindow(win);
    showWelcome(false);
    if (win.type !== 'explorer') {
      send('window:open', {
        id: win.id, type: win.type, title: win.title,
        x: win.x, y: win.y, width: win.width, height: win.height,
        file: win.file,
      });
    }
  };
}

async function loadWorkspace() {
  const res = await api.get('/api/workspaces');
  if (!res.ok || !res.data.length) {
    showCreateWorkspace();
    return;
  }

  const ws = res.data[0];
  await switchToWorkspace(ws.id);
  renderWorkspaceList(res.data);
}

async function switchToWorkspace(wsId) {
  currentWsId = wsId;
  disconnect();
  connect(wsId);

  const res = await api.get(`/api/workspaces/${wsId}`);
  if (!res.ok) return;

  const ws = res.data;
  document.getElementById('ws-name').textContent = ws.name;

  const settings = ws.settings || {};
  setViewport(settings.viewportX || 0, settings.viewportY || 0, settings.zoom || 1);

  const wins = (ws.windows || []).map(w => ({ ...w, _wsId: wsId }));
  setWindows(wins);
  renderAllWindows();
  showWelcome(!wins.length);
}

function renderWorkspaceList(workspaces) {
  const list = document.getElementById('ws-list');
  list.innerHTML = '';
  workspaces.forEach(ws => {
    const item = document.createElement('div');
    item.className = 'ws-item' + (ws.id === currentWsId ? ' active' : '');
    item.textContent = ws.name;
    item.addEventListener('click', () => switchToWorkspace(ws.id));
    list.appendChild(item);
  });
}

async function createWorkspace() {
  const name = document.getElementById('ws-name-input').value.trim();
  if (!name) return;
  const res = await api.post('/api/workspaces', { name });
  if (res.ok) {
    hideModal();
    showToast('Workspace created', 'success');
    const list = await api.get('/api/workspaces');
    if (list.ok) renderWorkspaceList(list.data);
    await switchToWorkspace(res.data.id);
  } else {
    showToast('Failed: ' + (res.error || 'unknown error'), 'error');
  }
}

function showCreateWorkspace() {
  document.getElementById('modal-title').textContent = 'New Workspace';
  document.getElementById('ws-name-input').value = '';
  document.getElementById('modal-overlay').classList.add('visible');
}

function hideModal() {
  document.getElementById('modal-overlay').classList.remove('visible');
}

function handleNewWindow(type, overrides = {}) {
  const titles = { markdown: 'New Markdown', text: 'New Text', html: 'New HTML', image: 'Image Viewer', explorer: 'File Explorer' };
  const id = overrides.id || 'wnd_' + Math.random().toString(36).slice(2, 10);
  const x = overrides.x || (150 + Math.random() * 100);
  const y = overrides.y || (150 + Math.random() * 100);

  if (type === 'explorer' || (type === 'image' && overrides.file)) {
    const win = { id, type, title: overrides.title || titles[type], x, y, width: 600, height: 400, zIndex: 100, minimized: false, maximized: false, file: overrides.file || null, filePath: overrides.file || null, metadata: {}, _wsId: currentWsId };
    addWindow(win);
    showWelcome(false);
    if (type !== 'explorer') send('window:open', { id, type, title: win.title, x, y, file: win.file });
    return;
  }

  const extMap = { markdown: 'md', text: 'txt', html: 'html' };
  const dirMap = { markdown: 'markdown', text: 'markdown', html: 'html' };
  const ext = extMap[type] || 'txt';
  const dir = dirMap[type] || 'files';
  const fileName = `untitled.${ext}`;
  const filePath = `${dir}/${fileName}`;
  const templates = {
    markdown: '# Untitled\n\n',
    text: '',
    html: '<!DOCTYPE html>\n<html>\n<head><title>Page</title></head>\n<body>\n  <h1>Hello</h1>\n</body>\n</html>\n',
  };

  api.put(`/api/workspaces/${currentWsId}/files/${filePath}`, { content: templates[type] || '' });

  const win = { id, type, title: fileName, x, y, width: 600, height: 400, zIndex: 100, minimized: false, maximized: false, file: filePath, filePath, metadata: {}, _wsId: currentWsId };
  addWindow(win);
  showWelcome(false);
  send('window:open', { id, type, title: fileName, x, y, file: filePath });
}

// --- Start ---
init();
