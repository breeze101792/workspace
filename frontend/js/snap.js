import { getWindows } from './window-manager.js';

export function snapValue(value, gridSize) {
  if (!gridSize || gridSize < 4) return value;
  return Math.round(value / gridSize) * gridSize;
}

export function snapToOthers(x, y, threshold = 8, selfId = null, selfWidth = 0, selfHeight = 0) {
  const others = getWindows().filter(w => w.id !== selfId);
  let bestX = x, bestY = y;
  let bestDX = threshold, bestDY = threshold;
  for (const other of others) {
    const dx1 = Math.abs(x - other.x);
    const dx2 = Math.abs(x - (other.x + other.width));
    const dx3 = Math.abs((x + selfWidth) - other.x);
    if (dx1 < bestDX) { bestDX = dx1; bestX = other.x; }
    if (dx2 < bestDX) { bestDX = dx2; bestX = other.x + other.width; }
    if (dx3 < bestDX) { bestDX = dx3; bestX = other.x - selfWidth; }
    const dy1 = Math.abs(y - other.y);
    const dy2 = Math.abs(y - (other.y + other.height));
    const dy3 = Math.abs((y + selfHeight) - other.y);
    if (dy1 < bestDY) { bestDY = dy1; bestY = other.y; }
    if (dy2 < bestDY) { bestDY = dy2; bestY = other.y + other.height; }
    if (dy3 < bestDY) { bestDY = dy3; bestY = other.y - selfHeight; }
  }
  return { x: bestX, y: bestY, snappedX: bestDX < threshold, snappedY: bestDY < threshold };
}

export function snapToGrid(x, y, gridSize) {
  return { x: snapValue(x, gridSize), y: snapValue(y, gridSize) };
}
