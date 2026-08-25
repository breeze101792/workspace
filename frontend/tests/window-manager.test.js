import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { on, emit } from '../js/state.js';
import * as wm from '../js/window-manager.js';

// window-manager imports titlebar/resize/window-factory. window-factory's async
// renderers call api.get() -> fetch, which is not available in jsdom; mock api so
// renderWindowContent resolves cleanly instead of rejecting.
vi.mock('../js/api.js', () => ({
  get: vi.fn(() => Promise.resolve({ ok: false, data: null })),
  post: vi.fn(() => Promise.resolve({ ok: false })),
  put: vi.fn(() => Promise.resolve({ ok: false })),
  del: vi.fn(() => Promise.resolve({ ok: false })),
  upload: vi.fn(() => Promise.resolve({ ok: false })),
}));

// window-manager imports titlebar/resize/window-factory which render into the DOM.
// These all work under jsdom. window-factory's module-level registry also needs to
// render content into `wnd-<id>-content` via setTimeout(0); we provide a canvas
// container so nothing throws.

function makeCanvas({ width = 800, height = 600 } = {}) {
  document.body.innerHTML = `
    <div id="canvas-container" style="width:${width}px;height:${height}px">
      <div id="canvas"></div>
    </div>
  `;
  const container = document.getElementById('canvas-container');
  // jsdom does not compute layout; stub getBoundingClientRect so clampToCanvas works.
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
    title: 'Test',
    x: 0, y: 0, width: 600, height: 400,
    zIndex: 10, minimized: false, maximized: false,
    file: 'files/a.txt', filePath: 'files/a.txt', metadata: {},
    _wsId: 'ws1',
    ...overrides,
  };
}

describe('window-manager', () => {
  let listeners;

  beforeEach(() => {
    document.body.innerHTML = '';
    makeCanvas();
    listeners = [];
    wm.setWindows([]);
  });

  afterEach(() => {
    listeners.forEach((u) => u());
    listeners = [];
  });

  it('clampToCanvas keeps a window inside canvas bounds (regression: deleted fn)', () => {
    // Add a window way off to the bottom-right; renderWindow must clamp it into the
    // 800x600 canvas via clampToCanvas.
    const win = makeWindow({ id: 'off', x: 5000, y: 5000, width: 600, height: 400 });
    wm.addWindow(win);
    const el = document.getElementById('wnd-off');
    // maxX = max(0, 800-600)=200; maxY = max(0,600-400)=200
    expect(parseInt(el.style.left)).toBe(200);
    expect(parseInt(el.style.top)).toBe(200);
  });

  it('clamps negative coordinates to 0', () => {
    const win = makeWindow({ id: 'neg', x: -50, y: -90, width: 300, height: 200 });
    wm.addWindow(win);
    const el = document.getElementById('wnd-neg');
    expect(parseInt(el.style.left)).toBe(0);
    expect(parseInt(el.style.top)).toBe(0);
  });

  it('does not clamp coordinates already within bounds', () => {
    const win = makeWindow({ id: 'ok', x: 100, y: 100, width: 300, height: 200 });
    wm.addWindow(win);
    const el = document.getElementById('wnd-ok');
    expect(parseInt(el.style.left)).toBe(100);
    expect(parseInt(el.style.top)).toBe(100);
  });

  it('clamps when window larger than container (max clamp = 0)', () => {
    const win = makeWindow({ id: 'big', x: 50, y: 50, width: 900, height: 700 });
    wm.addWindow(win);
    const el = document.getElementById('wnd-big');
    // maxX = max(0, 800-900)=0, maxY=max(0,600-700)=0
    expect(parseInt(el.style.left)).toBe(0);
    expect(parseInt(el.style.top)).toBe(0);
  });

  it('addWindow appends DOM element wnd-<id> and emits windows:changed', () => {
    const changed = vi.fn();
    const un = on('windows:changed', changed);
    listeners.push(un);
    const win = makeWindow({ id: 'abc' });
    wm.addWindow(win);
    expect(document.getElementById('wnd-abc')).not.toBeNull();
    expect(changed).toHaveBeenCalled();
    expect(wm.getWindows().some((w) => w.id === 'abc')).toBe(true);
  });

  it('addWindow focuses the new window (adds .window-focused)', () => {
    const win = makeWindow({ id: 'abc' });
    wm.addWindow(win);
    expect(document.getElementById('wnd-abc').classList.contains('window-focused')).toBe(true);
  });

  it('focusWindow gives z-index maxZ+1 and adds focus class, removes from others', () => {
    const w1 = makeWindow({ id: 'a', zIndex: 10 });
    const w2 = makeWindow({ id: 'b', zIndex: 5 });
    wm.addWindow(w1);
    wm.addWindow(w2);
    // addWindow itself focuses (bumps zCounter), so compute current max before focus.
    const maxBefore = Math.max(
      ...wm.getWindows().map((w) => w.zIndex)
    );
    // Focus w1 now.
    wm.focusWindow('a');
    const aZ = wm.getWindows().find((w) => w.id === 'a').zIndex;
    const bZ = wm.getWindows().find((w) => w.id === 'b').zIndex;
    expect(aZ).toBe(maxBefore + 1);
    expect(aZ).toBeGreaterThan(bZ);
    expect(document.getElementById('wnd-a').classList.contains('window-focused')).toBe(true);
    expect(document.getElementById('wnd-b').classList.contains('window-focused')).toBe(false);
    expect(parseInt(document.getElementById('wnd-a').style.zIndex)).toBe(aZ);
  });

  it('focusWindow emits window:focus-changed', () => {
    const focused = vi.fn();
    const un = on('window:focus-changed', focused);
    listeners.push(un);
    const win = makeWindow({ id: 'a' });
    wm.addWindow(win);
    focused.mockClear();
    wm.focusWindow('a');
    expect(focused).toHaveBeenCalledWith('a');
  });

  it('removeWindow removes DOM element and state', () => {
    const changed = vi.fn();
    const un = on('windows:changed', changed);
    listeners.push(un);
    const win = makeWindow({ id: 'x' });
    wm.addWindow(win);
    changed.mockClear();
    wm.removeWindow('x');
    expect(document.getElementById('wnd-x')).toBeNull();
    expect(wm.getWindows().find((w) => w.id === 'x')).toBeUndefined();
    expect(changed).toHaveBeenCalled();
  });

  it('updateWindowPos mutates state and element style', () => {
    const win = makeWindow({ id: 'p', x: 0, y: 0 });
    wm.addWindow(win);
    wm.updateWindowPos('p', 120, 200);
    expect(wm.getWindows().find((w) => w.id === 'p').x).toBe(120);
    expect(wm.getWindows().find((w) => w.id === 'p').y).toBe(200);
    expect(parseInt(document.getElementById('wnd-p').style.left)).toBe(120);
    expect(parseInt(document.getElementById('wnd-p').style.top)).toBe(200);
  });

  it('updateWindowSize mutates state and element style', () => {
    const win = makeWindow({ id: 's', width: 600, height: 400 });
    wm.addWindow(win);
    wm.updateWindowSize('s', 300, 250);
    expect(wm.getWindows().find((w) => w.id === 's').width).toBe(300);
    expect(wm.getWindows().find((w) => w.id === 's').height).toBe(250);
    expect(parseInt(document.getElementById('wnd-s').style.width)).toBe(300);
    expect(parseInt(document.getElementById('wnd-s').style.height)).toBe(250);
  });

  it('toggleMinimize hides element and updates state', () => {
    const win = makeWindow({ id: 'm', minimized: false });
    wm.addWindow(win);
    wm.toggleMinimize('m', true);
    expect(wm.getWindows().find((w) => w.id === 'm').minimized).toBe(true);
    expect(document.getElementById('wnd-m').style.display).toBe('none');
    wm.toggleMinimize('m', false);
    expect(wm.getWindows().find((w) => w.id === 'm').minimized).toBe(false);
    expect(document.getElementById('wnd-m').style.display).toBe('');
  });

  it('toggleMinimize without a value toggles the current state', () => {
    const win = makeWindow({ id: 'mt', minimized: false });
    wm.addWindow(win);
    wm.toggleMinimize('mt');
    expect(wm.getWindows().find((w) => w.id === 'mt').minimized).toBe(true);
    wm.toggleMinimize('mt');
    expect(wm.getWindows().find((w) => w.id === 'mt').minimized).toBe(false);
  });

  it('toggleMinimize emits windows:changed', () => {
    const changed = vi.fn();
    const un = on('windows:changed', changed);
    listeners.push(un);
    wm.addWindow(makeWindow({ id: 'mc' }));
    changed.mockClear();
    wm.toggleMinimize('mc', true);
    expect(changed).toHaveBeenCalled();
  });

  it('toggleMaximize stores restore coordinates and fills viewport', () => {
    const win = makeWindow({ id: 'mx', x: 100, y: 80, width: 500, height: 300, maximized: false });
    wm.addWindow(win);
    // position element at 100,80 500,300 first via updateWindowPos/Size so restore is realistic
    wm.updateWindowPos('mx', 100, 80);
    wm.updateWindowSize('mx', 500, 300);
    wm.toggleMaximize('mx', true);
    const el = document.getElementById('wnd-mx');
    expect(wm.getWindows().find((w) => w.id === 'mx').maximized).toBe(true);
    expect(el.dataset.restoreLeft).toBe('100px');
    expect(el.dataset.restoreTop).toBe('80px');
    expect(el.dataset.restoreWidth).toBe('500px');
    expect(el.dataset.restoreHeight).toBe('300px');
    expect(el.style.left).toBe('0px');
    expect(el.style.top).toBe('40px');
    expect(el.style.width).toBe('100vw');
    // un-maximize restores
    wm.toggleMaximize('mx', false);
    expect(el.style.left).toBe('100px');
    expect(el.style.top).toBe('80px');
    expect(el.style.width).toBe('500px');
    expect(el.style.height).toBe('300px');
    expect(el.style.position).toBe('absolute');
  });

  it('toggleMaximize without val toggles and restores previously stored coords', () => {
    const win = makeWindow({ id: 'mx2', maximized: false });
    wm.addWindow(win);
    wm.updateWindowPos('mx2', 150, 60);
    wm.updateWindowSize('mx2', 420, 310);
    wm.toggleMaximize('mx2');
    expect(wm.getWindows().find((w) => w.id === 'mx2').maximized).toBe(true);
    wm.toggleMaximize('mx2');
    expect(wm.getWindows().find((w) => w.id === 'mx2').maximized).toBe(false);
    // restore returns the coordinates stored at maximize time
    expect(document.getElementById('wnd-mx2').style.left).toBe('150px');
    expect(document.getElementById('wnd-mx2').style.top).toBe('60px');
    expect(document.getElementById('wnd-mx2').style.width).toBe('420px');
  });

  it('renderAllWindows re-renders all and focuses topmost', () => {
    wm.addWindow(makeWindow({ id: 'r1', zIndex: 5 }));
    wm.addWindow(makeWindow({ id: 'r2', zIndex: 20 }));
    wm.addWindow(makeWindow({ id: 'r3', zIndex: 8 }));
    // All three present
    expect(document.getElementById('wnd-r1')).not.toBeNull();
    expect(document.getElementById('wnd-r2')).not.toBeNull();
    expect(document.getElementById('wnd-r3')).not.toBeNull();
    // Topmost window carries the .window-focused class after re-render.
    const focused = [...document.querySelectorAll('.window.window-focused')];
    expect(focused.length).toBe(1);
    const focusedId = focused[0].id;
    const topZ = Math.max(...wm.getWindows().map((w) => w.zIndex));
    expect(parseInt(focused[0].style.zIndex)).toBe(topZ);
    // The focused window is the one with the maximum z-index in state.
    const topWin = wm.getWindows().find((w) => w.zIndex === topZ);
    expect(focusedId).toBe('wnd-' + topWin.id);
  });

  it('renderWindow emits nothing but appends a .window element with correct id', () => {
    const win = makeWindow({ id: 'rw' });
    wm.addWindow(win);
    const el = document.getElementById('wnd-rw');
    expect(el.className).toContain('window');
    expect(el.querySelector('.titlebar')).not.toBeNull();
    expect(el.querySelector('.window-content')).not.toBeNull();
  });
});
