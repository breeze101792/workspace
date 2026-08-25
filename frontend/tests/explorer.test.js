import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the api module so no network/fetch is needed.
const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));
vi.mock('../js/api.js', () => ({
  get: mockGet,
  post: vi.fn(() => Promise.resolve({ ok: false })),
  put: vi.fn(() => Promise.resolve({ ok: false })),
  del: vi.fn(() => Promise.resolve({ ok: false })),
  upload: vi.fn(() => Promise.resolve({ ok: false })),
}));

import * as wf from '../js/window-factory.js';
import { get as apiGet } from '../js/api.js';
function fixture() {
  return {
    entries: [
      { name: 'notes.md', type: 'file', size: 10 },
      { name: 'images', type: 'directory' },
    ],
  };
}

async function renderExplorer(win) {
  const container = document.createElement('div');
  container.id = `wnd-${win.id}-content`;
  document.body.appendChild(container);
  wf.renderWindowContent(win);
  // explorer renderer is sync (no await inside _renderExplorer's initial call chain),
  // but api.get is async; flush microtasks.
  await Promise.resolve();
  await Promise.resolve();
  return container;
}

describe('window-factory explorer list', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    mockGet.mockReset();
    window._openWindow = vi.fn();
  });

  it('renders root listing with entries, icons, data-path and data-type', async () => {
    mockGet.mockResolvedValue({ ok: true, data: fixture() });
    const win = { id: 'expl', type: 'explorer', _wsId: 'ws1', metadata: {} };
    const container = await renderExplorer(win);

    expect(mockGet).toHaveBeenCalledWith('/api/workspaces/ws1/files?dir=');
    const items = container.querySelectorAll('.explorer-item');
    expect(items.length).toBe(2);

    const notes = container.querySelector('.explorer-item[data-name="notes.md"]');
    expect(notes.dataset.path).toBe('notes.md');
    expect(notes.dataset.type).toBe('file');
    expect(notes.textContent).toContain('📄');

    const images = container.querySelector('.explorer-item[data-name="images"]');
    expect(images.dataset.path).toBe('images');
    expect(images.dataset.type).toBe('directory');
    expect(images.textContent).toContain('📁');
  });

  it('clicking a directory navigates into it and keeps win.metadata.dir', async () => {
    mockGet.mockResolvedValue({ ok: true, data: fixture() });
    const win = { id: 'expl2', type: 'explorer', _wsId: 'ws1', metadata: {} };
    const container = await renderExplorer(win);

    const images = container.querySelector('.explorer-item[data-name="images"]');
    images.click();
    await Promise.resolve();
    await Promise.resolve();

    // api called again with dir=images
    expect(mockGet).toHaveBeenLastCalledWith('/api/workspaces/ws1/files?dir=images');
    // win.metadata.dir persists so live refresh keeps position
    expect(win.metadata.dir).toBe('images');
  });

  it('parent row navigates back when inside a directory', async () => {
    mockGet.mockResolvedValue({ ok: true, data: fixture() });
    const win = { id: 'expl3', type: 'explorer', _wsId: 'ws1', metadata: { dir: 'images' } };
    const container = await renderExplorer(win);
    // Root render for dir=images should show a '..' parent row
    expect(container.querySelector('.explorer-item[data-path=""]')).not.toBeNull();

    const parent = container.querySelector('.explorer-item[data-path=""]');
    parent.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockGet).toHaveBeenLastCalledWith('/api/workspaces/ws1/files?dir=');
    expect(win.metadata.dir).toBe('');
  });

  it('clicking a .md file opens a markdown window via window._openWindow', async () => {
    mockGet.mockResolvedValue({ ok: true, data: fixture() });
    const win = { id: 'expl4', type: 'explorer', _wsId: 'ws1', metadata: {} };
    const container = await renderExplorer(win);

    const notes = container.querySelector('.explorer-item[data-name="notes.md"]');
    notes.click();

    expect(window._openWindow).toHaveBeenCalledTimes(1);
    const args = window._openWindow.mock.calls[0][0];
    expect(args.type).toBe('markdown');
    expect(args.file).toBe('notes.md');
    expect(args.filePath).toBe('notes.md');
  });

  it('dragstart only fires for files, not directories', async () => {
    mockGet.mockResolvedValue({ ok: true, data: fixture() });
    const win = { id: 'expl5', type: 'explorer', _wsId: 'ws1', metadata: {} };
    const container = await renderExplorer(win);

    const notes = container.querySelector('.explorer-item[data-name="notes.md"]');
    const images = container.querySelector('.explorer-item[data-name="images"]');

    expect(notes.getAttribute('draggable')).toBe('true');
    expect(images.getAttribute('draggable')).toBe('false');

    const dt = {
      setData: vi.fn(),
      effectAllowed: '',
    };
    const fileEvent = new Event('dragstart', { bubbles: true, cancelable: true });
    Object.defineProperty(fileEvent, 'dataTransfer', { value: dt });
    notes.dispatchEvent(fileEvent);
    expect(dt.setData).toHaveBeenCalledWith('text/x-workspace-path', 'notes.md');

    dt.setData.mockClear();
    const dirEvent = new Event('dragstart', { bubbles: true, cancelable: true });
    Object.defineProperty(dirEvent, 'dataTransfer', { value: dt });
    images.dispatchEvent(dirEvent);
    expect(dirEvent.defaultPrevented).toBe(true);
    expect(dt.setData).not.toHaveBeenCalled();
  });
});
