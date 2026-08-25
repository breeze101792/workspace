// Touch gesture handling for canvas pan and zoom
import { emit } from './state.js';
import { getViewport, setViewport } from './canvas.js';

let canvas;
let touches = new Map();
let lastPinchDist = 0;
let lastPanX = 0, lastPanY = 0;

export function initTouch() {
  canvas = document.getElementById('canvas');

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      touches.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
    if (touches.size === 2) {
      const ts = Array.from(touches.values());
      lastPinchDist = Math.hypot(ts[0].x - ts[1].x, ts[0].y - ts[1].y);
    } else if (touches.size === 1) {
      lastPanX = touches.values().next().value.x;
      lastPanY = touches.values().next().value.y;
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const { x: panX, y: panY, zoom } = getViewport();
    for (const t of e.changedTouches) {
      touches.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
    if (touches.size === 2) {
      const ts = Array.from(touches.values());
      const dist = Math.hypot(ts[0].x - ts[1].x, ts[0].y - ts[1].y);
      if (lastPinchDist > 0) {
        const delta = dist / lastPinchDist;
        const newZoom = Math.max(0.25, Math.min(4, zoom * delta));
        setViewport(panX, panY, newZoom);
        emit('canvas:zoom', newZoom);
      }
      lastPinchDist = dist;
    } else if (touches.size === 1) {
      const t = touches.values().next().value;
      const dx = t.x - lastPanX;
      const dy = t.y - lastPanY;
      setViewport(panX + dx / zoom, panY + dy / zoom, zoom);
      lastPanX = t.x;
      lastPanY = t.y;
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) {
      touches.delete(t.identifier);
    }
    if (touches.size < 2) lastPinchDist = 0;
    if (touches.size === 0) {
      const { x: panX, y: panY, zoom } = getViewport();
      emit('canvas:viewport-changed', { zoom, panX, panY });
    }
  });
}
