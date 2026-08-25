import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { on, emit } from '../js/state.js';
import { createTitleBar, startTitleRename } from '../js/titlebar.js';
import * as wm from '../js/window-manager.js';

// titlebar imports window-manager -> window-factory -> api; mock api so the
// async renderers resolve cleanly under jsdom.
vi.mock('../js/api.js', () => ({
  get: vi.fn(() => Promise.resolve({ ok: false, data: null })),
  post: vi.fn(() => Promise.resolve({ ok: false })),
  put: vi.fn(() => Promise.resolve({ ok: false })),
  patch: vi.fn(() => Promise.resolve({ ok: false })),
  del: vi.fn(() => Promise.resolve({ ok: false })),
  upload: vi.fn(() => Promise.resolve({ ok: false })),
}));

function makeCanvas({ width = 800, height = 600 } = {}) {
  document.body.innerHTML = `
    <div id="canvas-container" style="width:${width}px;height:${height}px">
      <div id="canvas"></div>
    </div>
  `;
  const container = document.getElementById('canvas-container');
  container.getBoundingClientRect = () => ({
    width, height, top: 0, left: 0,
    right: width, bottom: height,
    x: 0, y: 0,
    toJSON: () => ({}),
  });
}

function makeWindow(overrides = {}) {
  return {
    id: 'w1',
    type: 'text',
    title: 'untitled.txt',
    x: 0, y: 0, width: 600, height: 400,
    zIndex: 10, minimized: false, maximized: false,
    file: 'markdown/untitled.txt', filePath: 'markdown/untitled.txt', metadata: {},
    _wsId: 'ws1',
    ...overrides,
  };
}

function mountTitleBar(win) {
  const frame = document.createElement('div');
  frame.id = `wnd-${win.id}`;
  frame.appendChild(createTitleBar(win));
  document.getElementById('canvas').appendChild(frame);
  return frame;
}

function fire(el, type, init = {}) {
  el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true, ...init }));
}

function fireKey(el, key) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

describe('titlebar context menu', () => {
  beforeEach(() => {
    makeCanvas();
    wm.setWindows([]);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('emits window:contextmenu with id and coords on titlebar right-click', () => {
    const win = makeWindow();
    mountTitleBar(win);
    let payload = null;
    on('window:contextmenu', (d) => { payload = d; });

    const bar = document.querySelector('#wnd-w1 .titlebar');
    bar.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 120, clientY: 40 }));

    expect(payload).toEqual({ id: 'w1', x: 120, y: 40 });
  });

  it('suppresses the native context menu event', () => {
    const win = makeWindow();
    mountTitleBar(win);
    const bar = document.querySelector('#wnd-w1 .titlebar');
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 });
    bar.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });
});

describe('startTitleRename', () => {
  beforeEach(() => {
    makeCanvas();
    wm.setWindows([]);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('replaces title with an input prefilled with current title', () => {
    const win = makeWindow();
    mountTitleBar(win);
    startTitleRename(win, () => {});

    const input = document.querySelector('#wnd-w1 .titlebar-rename-input');
    expect(input).toBeTruthy();
    expect(input.value).toBe('untitled.txt');
    expect(document.querySelector('#wnd-w1 .titlebar-text')).toBeNull();
  });

  it('commits on Enter with the trimmed new name', () => {
    const win = makeWindow();
    mountTitleBar(win);
    const commit = vi.fn();
    startTitleRename(win, commit);

    const input = document.querySelector('#wnd-w1 .titlebar-rename-input');
    input.value = '  notes.txt  ';
    fireKey(input, 'Enter');

    expect(commit).toHaveBeenCalledWith('notes.txt');
    // Title span restored
    expect(document.querySelector('#wnd-w1 .titlebar-text')).toBeTruthy();
    expect(document.querySelector('#wnd-w1 .titlebar-rename-input')).toBeNull();
  });

  it('cancels on Escape without committing', () => {
    const win = makeWindow();
    mountTitleBar(win);
    const commit = vi.fn();
    startTitleRename(win, commit);

    const input = document.querySelector('#wnd-w1 .titlebar-rename-input');
    input.value = 'changed.txt';
    fireKey(input, 'Escape');

    expect(commit).not.toHaveBeenCalled();
    expect(document.querySelector('#wnd-w1 .titlebar-text')).toBeTruthy();
  });

  it('does not commit when the name is unchanged or empty', () => {
    const win = makeWindow();
    mountTitleBar(win);
    const commit = vi.fn();
    startTitleRename(win, commit);

    const input = document.querySelector('#wnd-w1 .titlebar-rename-input');
    input.value = 'untitled.txt';
    fireKey(input, 'Enter');
    expect(commit).not.toHaveBeenCalled();

    startTitleRename(win, commit);
    const input2 = document.querySelector('#wnd-w1 .titlebar-rename-input');
    input2.value = '   ';
    fireKey(input2, 'Enter');
    expect(commit).not.toHaveBeenCalled();
  });

  it('commits on blur', () => {
    const win = makeWindow();
    mountTitleBar(win);
    const commit = vi.fn();
    startTitleRename(win, commit);

    const input = document.querySelector('#wnd-w1 .titlebar-rename-input');
    input.value = 'blurred.txt';
    fire(input, 'blur');

    expect(commit).toHaveBeenCalledWith('blurred.txt');
  });
});
