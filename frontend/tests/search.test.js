import { describe, it, expect, beforeEach, vi } from 'vitest';

// Search is the second LIST consumer in window-factory (search window type).
// Mock api.get so /search returns a fixture; dblclick should open a window.

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));
vi.mock('../js/api.js', () => ({
  get: mockGet,
  post: vi.fn(() => Promise.resolve({ ok: false })),
  put: vi.fn(() => Promise.resolve({ ok: false })),
  del: vi.fn(() => Promise.resolve({ ok: false })),
  upload: vi.fn(() => Promise.resolve({ ok: false })),
}));

import * as wf from '../js/window-factory.js';

function renderSearch(win) {
  const container = document.createElement('div');
  container.id = `wnd-${win.id}-content`;
  document.body.appendChild(container);
  wf.renderWindowContent(win);
  return container;
}
function triggerSearch(container, query) {
  const input = container.querySelector('input[type="text"]');
  input.value = query;
  // click the Go button
  const btn = container.querySelector('button');
  btn.click();
}

describe('window-factory search results', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    mockGet.mockReset();
    window._openWindow = vi.fn();
  });

  it('renders a search input, Go button and empty results container', () => {
    const win = { id: 's1', type: 'search', _wsId: 'ws1', metadata: {} };
    const container = renderSearch(win);
    expect(container.querySelector('input[type="text"]')).not.toBeNull();
    expect(container.querySelector('button')).not.toBeNull();
    expect(container.querySelector(`#search-results-s1`)).not.toBeNull();
  });

  it('shows a prompt when searching with an empty query (no api call)', () => {
    const win = { id: 's2', type: 'search', _wsId: 'ws1', metadata: {} };
    const container = renderSearch(win);
    triggerSearch(container, '   ');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('renders search result rows with path:line and opens a window on dblclick', async () => {
    mockGet.mockResolvedValue({
      ok: true,
      data: [
        { path: 'markdown/readme.md', line: 12, text: '## Section' },
        { path: 'files/notes.txt', line: 3, text: 'hello' },
      ],
    });
    const win = { id: 's3', type: 'search', _wsId: 'ws1', metadata: {} };
    const container = renderSearch(win);
    const input = container.querySelector('input[type="text"]');
    input.value = 'hello';
    const btn = container.querySelector('button');
    btn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockGet).toHaveBeenCalledWith('/api/workspaces/ws1/search?q=hello');
    const rows = container.querySelectorAll('.search-result');
    expect(rows.length).toBe(2);
    // path:line rendered
    expect(rows[0].textContent).toContain('markdown/readme.md:12');
    expect(rows[0].textContent).toContain('## Section');
    expect(rows[1].textContent).toContain('files/notes.txt:3');

    // dblclick opens the correct window type
    const mdRow = container.querySelector('.search-result[data-path="markdown/readme.md"]');
    mdRow.dispatchEvent(new Event('dblclick', { bubbles: true }));
    expect(window._openWindow).toHaveBeenCalledTimes(1);
    const opened = window._openWindow.mock.calls[0][0];
    expect(opened.type).toBe('markdown');
    expect(opened.file).toBe('markdown/readme.md');
    expect(opened.filePath).toBe('markdown/readme.md');
  });

  it('maps unknown extensions to text window on dblclick', async () => {
    mockGet.mockResolvedValue({
      ok: true,
      data: [{ path: 'files/data.bin', line: 1, text: 'x' }],
    });
    const win = { id: 's4', type: 'search', _wsId: 'ws1', metadata: {} };
    const container = renderSearch(win);
    const input = container.querySelector('input[type="text"]');
    input.value = 'x';
    container.querySelector('button').click();
    await Promise.resolve();
    await Promise.resolve();

    const row = container.querySelector('.search-result[data-path="files/data.bin"]');
    row.dispatchEvent(new Event('dblclick', { bubbles: true }));
    expect(window._openWindow.mock.calls[0][0].type).toBe('text');
  });

  it('renders a no-matches message when the search returns empty', async () => {
    mockGet.mockResolvedValue({ ok: true, data: [] });
    const win = { id: 's5', type: 'search', _wsId: 'ws1', metadata: {} };
    const container = renderSearch(win);
    const input = container.querySelector('input[type="text"]');
    input.value = 'zzz';
    container.querySelector('button').click();
    await Promise.resolve();
    await Promise.resolve();
    expect(container.textContent).toContain('No matches');
  });
});
