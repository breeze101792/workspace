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

  // Right-click context menu on the title bar
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    focusWindow(win.id);
    emit('window:contextmenu', { id: win.id, x: e.clientX, y: e.clientY });
  });

  return el;
}

export function startTitleRename(win, onCommit) {
  const bar = document.querySelector(`#wnd-${win.id} .titlebar`);
  const span = bar?.querySelector('.titlebar-text');
  if (!span || bar.querySelector('.titlebar-rename-input')) return;

  const input = document.createElement('input');
  input.className = 'titlebar-rename-input';
  input.type = 'text';
  input.value = win.title;
  let done = false;
  const finish = (commit) => {
    if (done) return;
    done = true;
    const name = input.value.trim();
    input.replaceWith(span);
    if (commit && name && name !== win.title) onCommit(name);
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('pointerdown', (e) => e.stopPropagation());
  span.replaceWith(input);
  input.focus();
  input.select();
}
