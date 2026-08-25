import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockGet, mockPost, mockPut, mockDel, mockToast } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDel: vi.fn(),
  mockToast: vi.fn(),
}));

vi.mock('../js/api.js', () => ({
  get: mockGet,
  post: mockPost,
  put: mockPut,
  del: mockDel,
  upload: vi.fn(),
}));
vi.mock('../js/toast.js', () => ({ showToast: mockToast }));

import { initWorkspaceManager, openWorkspaceManager } from '../js/manager.js';

const WORKSPACES = [
  { id: 'ws_a', name: 'Alpha', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'ws_b', name: 'Beta', updatedAt: '2026-02-02T00:00:00Z' },
];

function card(id) {
  return document.querySelector(`.wsm-card[data-ws-id="${id}"]`);
}

async function flush(n = 8) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

async function open(list = WORKSPACES) {
  mockGet.mockResolvedValue({ ok: true, data: list });
  openWorkspaceManager();
  await flush();
}

describe('workspace manager', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="toast-container"></div>';
    mockGet.mockReset();
    mockPost.mockReset().mockResolvedValue({ ok: false });
    mockPut.mockReset().mockResolvedValue({ ok: false });
    mockDel.mockReset().mockResolvedValue({ ok: false });
    mockToast.mockClear();

    initWorkspaceManager({
      getActiveId: () => 'ws_a',
      onSwitch: vi.fn(),
      onChanged: vi.fn(),
      onAfterDelete: vi.fn(),
    });
  });

  it('renders a card per workspace with active badge', async () => {
    await open();
    expect(card('ws_a')).toBeTruthy();
    expect(card('ws_b')).toBeTruthy();
    expect(document.querySelectorAll('.wsm-card').length).toBe(2);
    expect(document.querySelector('.wsm-count').textContent).toBe('2');
    const badges = [...document.querySelectorAll('.wsm-badge')].map((b) => b.textContent);
    expect(badges).toEqual(['Active']);
    expect(card('ws_a').classList.contains('active')).toBe(true);
  });

  it('shows empty state when no workspaces exist', async () => {
    await open([]);
    expect(document.querySelector('.wsm-empty')).toBeTruthy();
  });

  it('switches workspaces via Open button and card click', async () => {
    const onSwitch = vi.fn();
    initWorkspaceManager({ getActiveId: () => null, onSwitch });
    await open();

    card('ws_b').querySelector('.wsm-btn.primary').click();
    expect(onSwitch).toHaveBeenCalledWith('ws_b');

    onSwitch.mockClear();
    card('ws_a').querySelector('.wsm-name').click();
    expect(onSwitch).toHaveBeenCalledWith('ws_a');
  });

  it('creates a workspace and switches to it', async () => {
    const onSwitch = vi.fn();
    initWorkspaceManager({ getActiveId: () => null, onSwitch });
    mockPost.mockResolvedValue({ ok: true, data: { id: 'ws_new', name: 'Fresh' } });
    mockGet.mockResolvedValue({ ok: true, data: [...WORKSPACES, { id: 'ws_new', name: 'Fresh' }] });

    await open();
    const input = document.getElementById('wsm-new-name');
    input.value = 'Fresh';
    document.getElementById('wsm-new-create').click();
    await flush();

    expect(mockPost).toHaveBeenCalledWith('/api/workspaces', { name: 'Fresh' });
    expect(onSwitch).toHaveBeenCalledWith('ws_new');
    expect(input.value).toBe('');
  });

  it('renames a workspace via inline editor', async () => {
    const onChanged = vi.fn();
    initWorkspaceManager({ getActiveId: () => null, onChanged });
    mockPut.mockResolvedValue({ ok: true, data: {} });

    await open();
    card('ws_b').querySelector('.wsm-btn:not(.primary):not(.danger)').click();

    const input = card('ws_b').querySelector('.wsm-rename-input');
    expect(input).toBeTruthy();
    input.value = 'Gamma';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await flush();

    expect(mockPut).toHaveBeenCalledWith('/api/workspaces/ws_b', { name: 'Gamma' });
    expect(onChanged).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith('Workspace renamed', 'success');
  });

  it('deletes a workspace after two-step confirm', async () => {
    const onAfterDelete = vi.fn();
    initWorkspaceManager({ getActiveId: () => 'ws_a', onAfterDelete });
    mockDel.mockResolvedValue({ ok: true, data: { deleted: true } });
    mockGet
      .mockResolvedValueOnce({ ok: true, data: WORKSPACES })
      .mockResolvedValue({ ok: true, data: [WORKSPACES[0]] });

    openWorkspaceManager();
    await flush();
    card('ws_b').querySelector('.wsm-btn.danger').click();

    const confirmBtn = card('ws_b').querySelector('.wsm-btn.danger');
    expect(confirmBtn.textContent).toBe('Confirm');
    confirmBtn.click();
    await flush();

    expect(mockDel).toHaveBeenCalledWith('/api/workspaces/ws_b');
    expect(onAfterDelete).toHaveBeenCalledWith('ws_b');
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(card('ws_b')).toBeFalsy();
  });

  it('refuses to delete the last remaining workspace', async () => {
    await open([WORKSPACES[0]]);
    card('ws_a').querySelector('.wsm-btn.danger').click();
    expect(mockToast).toHaveBeenCalledWith('Cannot delete the last workspace', 'error');
    expect(mockDel).not.toHaveBeenCalled();
  });

  it('closes on overlay click and Escape', async () => {
    await open();
    const overlay = document.getElementById('ws-manager');
    expect(overlay.classList.contains('hidden')).toBe(false);

    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(overlay.classList.contains('hidden')).toBe(true);

    overlay.classList.remove('hidden');
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(overlay.classList.contains('hidden')).toBe(true);
  });
});
