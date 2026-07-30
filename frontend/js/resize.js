import { emit } from './state.js';
import { updateWindowSize } from './window-manager.js';

export function createResizeHandle(winId) {
  const el = document.createElement('div');
  el.className = 'resize-handle';

  let dragging = false, startX, startY, origW, origH;

  el.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const elWnd = document.getElementById(`wnd-${winId}`);
    origW = parseInt(elWnd.style.width) || 600;
    origH = parseInt(elWnd.style.height) || 400;
    el.setPointerCapture(e.pointerId);
  });

  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dw = e.clientX - startX;
    const dh = e.clientY - startY;
    updateWindowSize(winId, Math.max(240, origW + dw), Math.max(160, origH + dh));
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
