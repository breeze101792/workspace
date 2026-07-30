import { emit } from './state.js';

let panX = 0, panY = 0, zoom = 1;

const canvas = document.getElementById('canvas');
const desktop = document.getElementById('desktop');

export function initCanvas() {
  canvas.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      zoom = Math.max(0.25, Math.min(4, zoom * delta));
      updateTransform();
      emit('canvas:zoom', zoom);
    }
  });

  let isPanning = false, startX, startY, origX, origY;

  canvas.addEventListener('mousedown', (e) => {
    if (e.target !== canvas) return;
    if (e.button === 1 || e.ctrlKey) {
      isPanning = true;
      startX = e.clientX;
      startY = e.clientY;
      origX = panX;
      origY = panY;
      canvas.style.cursor = 'grabbing';
      e.preventDefault();
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    panX = origX + (e.clientX - startX) / zoom;
    panY = origY + (e.clientY - startY) / zoom;
    updateTransform();
  });

  window.addEventListener('mouseup', () => {
    if (isPanning) {
      isPanning = false;
      canvas.style.cursor = '';
    }
  });
}

function updateTransform() {
  canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  canvas.style.transformOrigin = '0 0';
}

export function setViewport(x, y, z) {
  panX = x; panY = y; zoom = z;
  updateTransform();
}

export function getViewport() {
  return { x: panX, y: panY, zoom };
}
