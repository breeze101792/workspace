const HISTORY_LIMIT = 50;
const past = [];
const future = [];
let suppress = false;

export function pushSnapshot(windows) {
  if (suppress) return;
  const snapshot = windows.map(w => ({ id: w.id, x: w.x, y: w.y, width: w.width, height: w.height }));
  past.push(snapshot);
  if (past.length > HISTORY_LIMIT) past.shift();
  future.length = 0;
}

export function undo(windows, applyFn) {
  if (past.length === 0) return false;
  const current = windows.map(w => ({ id: w.id, x: w.x, y: w.y, width: w.width, height: w.height }));
  future.push(current);
  const snapshot = past.pop();
  suppress = true;
  applyFn(snapshot);
  suppress = false;
  return true;
}

export function redo(windows, applyFn) {
  if (future.length === 0) return false;
  const current = windows.map(w => ({ id: w.id, x: w.x, y: w.y, width: w.width, height: w.height }));
  past.push(current);
  const snapshot = future.pop();
  suppress = true;
  applyFn(snapshot);
  suppress = false;
  return true;
}

export function canUndo() { return past.length > 0; }
export function canRedo() { return future.length > 0; }

export function reset() {
  past.length = 0;
  future.length = 0;
}