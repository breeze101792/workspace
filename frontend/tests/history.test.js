import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as history from '../js/history.js';

// Pure module — no DOM. state (past/future/suppress) is module-scoped, so reset
// before each test via reset().

function windows(...items) {
  // Build a minimal window-like array for snapshot capture.
  return items.map((w) => ({
    id: w.id,
    x: w.x ?? 0,
    y: w.y ?? 0,
    width: w.width ?? 100,
    height: w.height ?? 100,
  }));
}

describe('history.js snapshots / undo / redo', () => {
  beforeEach(() => {
    history.reset();
  });

  it('pushSnapshot captures x/y/width/height and canUndo becomes true', () => {
    const wins = windows({ id: 'a', x: 5, y: 6, width: 200, height: 150 });
    history.pushSnapshot(wins);
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);
  });

  it('undo applies the previous snapshot and returns true', () => {
    history.pushSnapshot(windows({ id: 'a', x: 0, y: 0 }));
    const applyFn = vi.fn();
    const applied = history.undo(windows({ id: 'a', x: 40, y: 50 }), applyFn);
    expect(applied).toBe(true);
    expect(applyFn).toHaveBeenCalledTimes(1);
    expect(applyFn.mock.calls[0][0]).toEqual([{ id: 'a', x: 0, y: 0, width: 100, height: 100 }]);
  });

  it('undo returns false when there is no history', () => {
    const applyFn = vi.fn();
    expect(history.undo(windows({ id: 'a' }), applyFn)).toBe(false);
    expect(applyFn).not.toHaveBeenCalled();
  });

  it('redo returns false when nothing was undone', () => {
    const applyFn = vi.fn();
    expect(history.redo(windows({ id: 'a' }), applyFn)).toBe(false);
    expect(applyFn).not.toHaveBeenCalled();
  });

  it('undo then redo round-trips the snapshot', () => {
    // state before an action is recorded, then the action moves to x:40.
    const before = windows({ id: 'a', x: 0 });
    history.pushSnapshot(before);
    const moved = windows({ id: 'a', x: 40 }); // current (post-action) state
    const undoApply = vi.fn();
    expect(history.undo(moved, undoApply)).toBe(true);
    expect(undoApply.mock.calls[0][0]).toEqual([{ id: 'a', x: 0, y: 0, width: 100, height: 100 }]);
    expect(history.canRedo()).toBe(true);
    // Undo restored us to x:0; now redo should take us back to x:40.
    const redoApply = vi.fn();
    expect(history.redo(before, redoApply)).toBe(true);
    expect(redoApply.mock.calls[0][0]).toEqual([{ id: 'a', x: 40, y: 0, width: 100, height: 100 }]);
    expect(history.canRedo()).toBe(false);
    expect(history.canUndo()).toBe(true);
  });

  it('pushSnapshot clears the future stack', () => {
    history.pushSnapshot(windows({ id: 'a', x: 0 }));
    history.pushSnapshot(windows({ id: 'a', x: 40 }));
    // undo once -> future has one entry
    history.undo(windows({ id: 'a', x: 40 }), vi.fn());
    expect(history.canRedo()).toBe(true);
    // new push clears future
    history.pushSnapshot(windows({ id: 'a', x: 90 }));
    expect(history.canRedo()).toBe(false);
  });

  it('enforces the history limit (keeps only the last N snapshots)', () => {
    // HISTORY_LIMIT is 50; push 60 snapshots and ensure only the most recent are kept.
    for (let i = 0; i < 60; i++) {
      history.pushSnapshot(windows({ id: 'a', x: i }));
    }
    const applyFn = vi.fn();
    history.undo(windows({ id: 'a', x: 59 }), applyFn);
    const applied = applyFn.mock.calls[0][0];
    // The oldest 10 (x=0..9) should have been shifted out; the last snapshot is x=59.
    expect(applied).toEqual([{ id: 'a', x: 59, y: 0, width: 100, height: 100 }]);
  });

  it('suppress semantics: applyFn runs but does not re-record the snapshot', () => {
    // When undo/redo calls applyFn, suppress=true so any pushSnapshot inside applyFn
    // is ignored, preventing infinite loop / duplicate recording.
    history.pushSnapshot(windows({ id: 'a', x: 0 }));
    let suppressedObserved = false;
    history.undo(windows({ id: 'a', x: 40 }), (snap) => {
      // This simulates an applyFn that (via a handler) pushes a new snapshot; it
      // should NOT add to the undo stack because suppress is set.
      history.pushSnapshot(snap);
      suppressedObserved = true;
    });
    expect(suppressedObserved).toBe(true);
    // canUndo should be false because the inner push was suppressed.
    expect(history.canUndo()).toBe(false);
  });

  it('reset clears both undo and redo stacks', () => {
    history.pushSnapshot(windows({ id: 'a', x: 0 }));
    history.pushSnapshot(windows({ id: 'a', x: 40 }));
    history.undo(windows({ id: 'a', x: 40 }), vi.fn());
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(true);
    history.reset();
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });
});
