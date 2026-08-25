import { emit } from './state.js';
import { updateWindowSize } from './window-manager.js';

const HANDLE_TYPES = {
  se: 'resize-handle-se',
  e: 'resize-handle-e',
  s: 'resize-handle-s',
};

function makeHandle(winId, type) {
  const el = document.createElement('div');
  el.className = 'resize-handle ' + HANDLE_TYPES[type];

  let dragging = false, startX, startY, origW, origH, origX, origY;

  el.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const elWnd = document.getElementById(`wnd-${winId}`);
    origW = parseInt(elWnd.style.width) || 600;
    origH = parseInt(elWnd.style.height) || 400;
    origX = parseInt(elWnd.style.left) || 0;
    origY = parseInt(elWnd.style.top) || 0;
    el.setPointerCapture(e.pointerId);
  });

  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dw = e.clientX - startX;
    const dh = e.clientY - startY;
    let w = origW, h = origH;
    if (type === 'se' || type === 'e') w = Math.max(240, origW + dw);
    if (type === 'se' || type === 's') h = Math.max(160, origH + dh);
    updateWindowSize(winId, w, h);
  });

  el.addEventListener('pointerup', () => {
    if (dragging) {
      dragging = false;
      const elWnd = document.getElementById(`wnd-${winId}`);
      emit('window:request-resize', {
        id: winId,
        width: parseInt(elWnd.style.width),
        height: parseInt(elWnd.style.height),
      });
    }
  });

  return el;
}

export function createResizeHandle(winId) {
  const container = document.createDocumentFragment();
  container.appendChild(makeHandle(winId, 'se'));
  container.appendChild(makeHandle(winId, 'e'));
  container.appendChild(makeHandle(winId, 's'));
  return container;
}
