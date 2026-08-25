import * as api from './api.js';
import { showToast } from './toast.js';

let opts = {};
let overlay = null;
let grid = null;
let countEl = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function buildOverlay() {
  overlay = el('div');
  overlay.id = 'ws-manager';
  overlay.classList.add('hidden');

  const panel = el('div', 'wsm-panel');

  const head = el('div', 'wsm-head');
  const titles = el('div', 'wsm-titles');
  titles.appendChild(el('h2', null, 'Workspaces'));
  countEl = el('span', 'wsm-count');
  titles.appendChild(countEl);

  const createRow = el('div', 'wsm-create');
  const input = el('input');
  input.id = 'wsm-new-name';
  input.type = 'text';
  input.placeholder = 'New workspace name…';
  const createBtn = el('button', 'modal-btn primary', 'Create');
  createBtn.id = 'wsm-new-create';
  createBtn.addEventListener('click', () => createWorkspace(input));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
      createWorkspace(input);
    }
    if (e.key === 'Escape') e.stopPropagation();
  });
  createRow.append(input, createBtn);

  const closeBtn = el('button', 'topbar-btn', '✕');
  closeBtn.id = 'wsm-close';
  closeBtn.title = 'Close';
  closeBtn.addEventListener('click', () => closeWorkspaceManager());

  head.append(titles, createRow, closeBtn);

  grid = el('div', 'wsm-grid');
  panel.append(head, grid);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeWorkspaceManager();
  });
}

async function refresh() {
  const res = await api.get('/api/workspaces');
  const list = res.ok ? res.data : [];
  renderCards(list);
  if (opts.onChanged) opts.onChanged(list);
}

function renderCards(workspaces) {
  grid.innerHTML = '';
  countEl.textContent = workspaces.length ? String(workspaces.length) : '';
  if (!workspaces.length) {
    grid.appendChild(el('div', 'wsm-empty', 'No workspaces yet. Create one above.'));
    return;
  }
  workspaces.forEach((ws) => grid.appendChild(buildCard(ws, workspaces)));
}

function buildCard(ws, all) {
  const card = el('div', 'wsm-card');
  card.dataset.wsId = ws.id;
  if (ws.id === opts.getActiveId()) card.classList.add('active');

  const head = el('div', 'wsm-card-head');
  head.appendChild(el('span', 'wsm-name', ws.name));
  if (ws.id === opts.getActiveId()) head.appendChild(el('span', 'wsm-badge', 'Active'));
  card.appendChild(head);

  card.appendChild(el('div', 'wsm-meta', 'Updated ' + fmtDate(ws.updatedAt)));

  const actions = el('div', 'wsm-actions');
  const openBtn = el('button', 'wsm-btn primary', 'Open');
  openBtn.addEventListener('click', () => opts.onSwitch(ws.id));
  const renameBtn = el('button', 'wsm-btn', 'Rename');
  renameBtn.addEventListener('click', () => startRename(card, ws));
  const deleteBtn = el('button', 'wsm-btn danger', 'Delete');
  deleteBtn.addEventListener('click', () => {
    if (all.length <= 1) {
      showToast('Cannot delete the last workspace', 'error');
      return;
    }
    startDelete(card, ws);
  });
  actions.append(openBtn, renameBtn, deleteBtn);
  card.appendChild(actions);

  card.addEventListener('click', (e) => {
    if (e.target.closest('.wsm-btn') || e.target.closest('.wsm-rename-input')) return;
    opts.onSwitch(ws.id);
  });

  return card;
}

function startRename(card, ws) {
  const head = card.querySelector('.wsm-card-head');
  head.innerHTML = '';
  const input = el('input', 'wsm-rename-input');
  input.type = 'text';
  input.value = ws.name;
  let done = false;
  const commit = async () => {
    if (done) return;
    done = true;
    const name = input.value.trim();
    if (!name || name === ws.name) {
      await refresh();
      return;
    }
    const res = await api.put(`/api/workspaces/${ws.id}`, { name });
    if (res.ok) showToast('Workspace renamed', 'success');
    else showToast('Rename failed: ' + (res.error || 'unknown error'), 'error');
    await refresh();
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') { done = true; refresh(); }
  });
  input.addEventListener('blur', commit);
  head.appendChild(input);
  input.focus();
  input.select();
}

function startDelete(card, ws) {
  const actions = card.querySelector('.wsm-actions');
  actions.innerHTML = '';
  actions.appendChild(el('span', 'wsm-confirm-label', 'Delete?'));
  const confirmBtn = el('button', 'wsm-btn danger', 'Confirm');
  confirmBtn.addEventListener('click', async () => {
    const res = await api.del(`/api/workspaces/${ws.id}`);
    if (res.ok) {
      showToast('Workspace deleted', 'success');
      if (opts.onAfterDelete) opts.onAfterDelete(ws.id);
      await refresh();
    } else {
      showToast('Delete failed: ' + (res.error || 'unknown error'), 'error');
    }
  });
  const cancelBtn = el('button', 'wsm-btn', 'Cancel');
  cancelBtn.addEventListener('click', () => refresh());
  actions.append(confirmBtn, cancelBtn);
  confirmBtn.focus();
}

async function createWorkspace(input) {
  const name = input.value.trim();
  if (!name) return;
  const res = await api.post('/api/workspaces', { name });
  if (res.ok) {
    input.value = '';
    showToast('Workspace created', 'success');
    await refresh();
    if (opts.onSwitch) opts.onSwitch(res.data.id);
  } else {
    showToast('Failed: ' + (res.error || 'unknown error'), 'error');
  }
}

export function openWorkspaceManager() {
  if (!overlay || !overlay.isConnected) buildOverlay();
  overlay.classList.remove('hidden');
  refresh();
}

export function closeWorkspaceManager() {
  if (overlay) overlay.classList.add('hidden');
}

export function initWorkspaceManager(options = {}) {
  opts = options;
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay && !overlay.classList.contains('hidden')) {
      closeWorkspaceManager();
    }
  });
}
