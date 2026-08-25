import { emit } from './state.js';
import { updateWindowPos, focusWindow } from './window-manager.js';
import { snapToGrid, snapToOthers } from './snap.js';

export function createTitleBar(win) {
  const el = document.createElement('div');
  el.className = 'titlebar';

  const title = document.createElement('span');
  title.className = 'titlebar-text';
  title.textContent = win.title;

  // Drag on title text only
  let dragging = false, startX, startY, origX, origY;
  title.addEventListener('pointerdown', (e) => {
    if (win.maximized) return;
    e.stopPropagation();
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    origX = win.x;
    origY = win.y;
    document.getElementById(`wnd-${win.id}`)?.classList.add('window-dragging');
    title.setPointerCapture(e.pointerId);
  });
  title.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = (e.clientX - startX);
    const dy = (e.clientY - startY);
    updateWindowPos(win.id, origX + dx, origY + dy);
  });
  title.addEventListener('pointerup', () => {
    if (dragging) {
      dragging = false;
      document.getElementById(`wnd-${win.id}`)?.classList.remove('window-dragging');
      let { x, y } = win;
      // Try snap to other windows first (excluding the dragged window itself)
      const snap = snapToOthers(x, y, 8, win.id, win.width, win.height);
      x = snap.x;
      y = snap.y;
      // Then snap to grid if enabled
      const gs = window._workspaceSettings?.gridSize || 20;
      if (window._workspaceSettings?.snapToGrid) {
        const g = snapToGrid(x, y, gs);
        x = g.x;
        y = g.y;
      }
      updateWindowPos(win.id, x, y);
      emit('window:request-move', { id: win.id, x, y });
    }
  });

  const buttons = document.createElement('div');
  buttons.className = 'titlebar-buttons';

  const btnMin = document.createElement('button');
  btnMin.className = 'titlebar-btn titlebar-minimize';
  btnMin.textContent = '−';
  btnMin.title = 'Minimize';
  btnMin.addEventListener('click', (e) => { e.stopPropagation(); emit('window:request-minimize', win.id); });

  const btnMax = document.createElement('button');
  btnMax.className = 'titlebar-btn titlebar-maximize';
  btnMax.textContent = '□';
  btnMax.title = 'Maximize';
  btnMax.addEventListener('click', (e) => { e.stopPropagation(); emit('window:request-maximize', win.id); });

  const btnClose = document.createElement('button');
  btnClose.className = 'titlebar-btn titlebar-close';
  btnClose.textContent = '⊗';
  btnClose.title = 'Close';
  btnClose.addEventListener('click', (e) => { e.stopPropagation(); emit('window:request-close', win.id); });

  buttons.appendChild(btnMin);
  buttons.appendChild(btnMax);
  buttons.appendChild(btnClose);

  el.appendChild(title);
  el.appendChild(buttons);
  return el;
}
