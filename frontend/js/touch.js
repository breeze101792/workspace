// Touch gesture handling for canvas pan and zoom
import { emit } from './state.js';

let panX = 0, panY = 0, zoom = 1;
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
    for (const t of e.changedTouches) {
      touches.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
    if (touches.size === 2) {
      const ts = Array.from(touches.values());
      const dist = Math.hypot(ts[0].x - ts[1].x, ts[0].y - ts[1].y);
      if (lastPinchDist > 0) {
        const delta = dist / lastPinchDist;
        zoom = Math.max(0.25, Math.min(4, zoom * delta));
        updateTransform();
        emit('canvas:zoom', zoom);
      }
      lastPinchDist = dist;
    } else if (touches.size === 1) {
      const t = touches.values().next().value;
      const dx = t.x - lastPanX;
      const dy = t.y - lastPanY;
      panX += dx / zoom;
      panY += dy / zoom;
      updateTransform();
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
      emit('canvas:viewport-changed', { zoom, panX, panY });
    }
  });
}

function updateTransform() {
  canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  canvas.style.transformOrigin = '0 0';
}