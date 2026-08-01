import { on, emit } from './state.js';
import { createTitleBar } from './titlebar.js';
import { createResizeHandle } from './resize.js';
import { renderWindowContent } from './window-factory.js';

let windows = [];
let zCounter = 10;

export function getWindows() { return windows; }

export function setWindows(ws) { windows = ws; }

export function nextZ() { return ++zCounter; }

export function focusWindow(id) {
  const w = windows.find(w => w.id === id);
  if (!w) return;
  const maxZ = windows.reduce((m, x) => (x.zIndex > m ? x.zIndex : m), 0);
  const z = maxZ + 1;
  zCounter = Math.max(zCounter, z);
  w.zIndex = z;
  const el = document.getElementById(`wnd-${id}`);
  if (el) {
    el.style.zIndex = z;
    el.classList.add('window-focused');
  }
  windows.forEach(other => {
    if (other.id !== id) {
      const oel = document.getElementById(`wnd-${other.id}`);
      if (oel) oel.classList.remove('window-focused');
    }
  });
  emit('window:focus-changed', id);
}

export function addWindow(win) {
  windows.push(win);
  renderWindow(win);
  focusWindow(win.id);
  emit('windows:changed', windows);
}

export function removeWindow(id) {
  const el = document.getElementById(`wnd-${id}`);
  if (el) el.remove();
  windows = windows.filter(w => w.id !== id);
  emit('windows:changed', windows);
}

export function updateWindowPos(id, x, y) {
  const w = windows.find(w => w.id === id);
  if (w) { w.x = x; w.y = y; }
  const el = document.getElementById(`wnd-${id}`);
  if (el) {
    const clamped = clampToCanvas(x, y, parseInt(el.style.width) || 600, parseInt(el.style.height) || 400);
    el.style.left = clamped.x + 'px';
    el.style.top = clamped.y + 'px';
  }
}

export function updateWindowSize(id, width, height) {
  const w = windows.find(w => w.id === id);
  if (w) { w.width = width; w.height = height; }
  const el = document.getElementById(`wnd-${id}`);
  if (el) {
    el.style.width = width + 'px';
    el.style.height = height + 'px';
  }
}

export function toggleMinimize(id, val) {
  const w = windows.find(w => w.id === id);
  if (!w) return;
  w.minimized = val !== undefined ? val : !w.minimized;
  const el = document.getElementById(`wnd-${id}`);
  if (el) {
    el.style.display = w.minimized ? 'none' : '';
  }
  emit('windows:changed', windows);
}

export function toggleMaximize(id, val) {
  const w = windows.find(w => w.id === id);
  if (!w) return;
  w.maximized = val !== undefined ? val : !w.maximized;
  const el = document.getElementById(`wnd-${id}`);
  if (el) {
    if (w.maximized) {
      el.dataset.restoreLeft = el.style.left;
      el.dataset.restoreTop = el.style.top;
      el.dataset.restoreWidth = el.style.width;
      el.dataset.restoreHeight = el.style.height;
      el.style.left = '0px';
      el.style.top = '40px';
      el.style.width = '100vw';
      el.style.height = 'calc(100vh - 80px)';
      el.style.position = 'fixed';
    } else {
      el.style.left = el.dataset.restoreLeft || '100px';
      el.style.top = el.dataset.restoreTop || '100px';
      el.style.width = el.dataset.restoreWidth || '600px';
      el.style.height = el.dataset.restoreHeight || '400px';
      el.style.position = 'absolute';
    }
  }
  emit('windows:changed', windows);
}

export function renderAllWindows() {
  document.querySelectorAll('.window').forEach(el => el.remove());
  windows.forEach(renderWindow);
  const top = windows.reduce((m, w) => (w.zIndex > m.zIndex ? w : m), windows[0] || { zIndex: 0 });
  if (top.id) focusWindow(top.id);
}

export function renderWindow(win) {
  const el = document.createElement('div');
  el.id = `wnd-${win.id}`;
  el.className = 'window';
  const clamped = clampToCanvas(win.x, win.y, win.width, win.height);
  el.style.cssText = `left:${clamped.x}px;top:${clamped.y}px;width:${win.width}px;height:${win.height}px;z-index:${win.zIndex}`;

  const tb = createTitleBar(win);
  el.appendChild(tb);

  const content = document.createElement('div');
  content.className = 'window-content';
  content.id = `wnd-${win.id}-content`;
  el.appendChild(content);

  const resize = createResizeHandle(win.id);
  if (resize instanceof DocumentFragment) {
    el.appendChild(resize);
  } else {
    el.appendChild(resize);
  }

  el.addEventListener('mousedown', () => {
    if (!el.classList.contains('window-focused')) {
      focusWindow(win.id);
      emit('window:request-focus', win.id);
    }
  });

  document.getElementById('canvas').appendChild(el);

  setTimeout(() => renderWindowContent(win), 0);
}
