import { describe, it, expect, vi, beforeEach } from 'vitest';

// snap.js imports getWindows() from './window-manager.js'. To unit-test the pure
// snapping logic without needing a DOM, mock window-manager to return a controlled
// window list for snapToOthers, and mock the heavy transitive deps so importing
// window-manager does not require DOM APIs.

vi.mock('../js/window-manager.js', () => ({
  getWindows: vi.fn(() => []),
  setWindows: vi.fn(),
  getWindowsAll: vi.fn(() => []),
}));

import * as snap from '../js/snap.js';
import { getWindows } from '../js/window-manager.js';

describe('snapValue grid rounding', () => {
  it('snaps to the nearest grid multiple', () => {
    expect(snap.snapValue(17, 20)).toBe(20);
    expect(snap.snapValue(23, 20)).toBe(20);
    expect(snap.snapValue(10, 20)).toBe(20);
    expect(snap.snapValue(9, 20)).toBe(0);
    expect(snap.snapValue(25, 20)).toBe(20);
    expect(snap.snapValue(30, 20)).toBe(40);
  });

  it('snaps negative values correctly', () => {
    // Math.round(-0.35) is -0 in JS; the source returns -0 * 20 === -0.
    expect(snap.snapValue(-7, 20)).toBe(-0);
    expect(snap.snapValue(-13, 20)).toBe(-20);
  });

  it('returns value unchanged when gridSize is missing or < 4', () => {
    expect(snap.snapValue(17, undefined)).toBe(17);
    expect(snap.snapValue(17, 0)).toBe(17);
    expect(snap.snapValue(17, 3)).toBe(17);
  });
});

describe('snapToGrid', () => {
  it('returns snapped x and y', () => {
    expect(snap.snapToGrid(17, 23, 20)).toEqual({ x: 20, y: 20 });
    expect(snap.snapToGrid(9, 41, 20)).toEqual({ x: 0, y: 40 });
  });
});

describe('snapToOthers', () => {
  const otherA = { id: 'a', x: 0, y: 0, width: 100, height: 50 };
  const otherB = { id: 'b', x: 200, y: 200, width: 80, height: 40 };

  beforeEach(() => {
    getWindows.mockReturnValue([otherA, otherB]);
  });

  it('snaps x to an edge of another window within threshold', () => {
    // x=104 is within 8px of otherA's right edge (100) -> snaps to 100
    const r = snap.snapToOthers(104, 0, 8, 'self', 30, 30);
    expect(r.x).toBe(100);
    expect(r.snappedX).toBe(true);
  });

  it('snaps x to left edge of another window when close', () => {
    // x=198 is within 8 of otherB.x=200 -> snaps to 200
    const r = snap.snapToOthers(198, 250, 8, 'self', 30, 30);
    expect(r.x).toBe(200);
    expect(r.snappedX).toBe(true);
  });

  it('snaps to right edge via selfWidth when self right-edge aligns', () => {
    // self.x=170, selfWidth=30 -> self right edge = 200, aligns with otherB.x=200
    const r = snap.snapToOthers(170, 250, 8, 'self', 30, 30);
    // Wait: self right edge = 170+30=200 aligns with otherB.x=200 -> bestX = other.x - selfWidth = 170
    expect(r.x).toBe(170);
    expect(r.snappedX).toBe(true);
  });

  it('snaps y to an edge within threshold', () => {
    // otherB.y=200, self at y=198 -> snap y to 200
    const r = snap.snapToOthers(500, 198, 8, 'self', 30, 30);
    expect(r.y).toBe(200);
    expect(r.snappedY).toBe(true);
  });

  it('excludes selfId from snapping targets', () => {
    // self has same coords as otherA; if selfId excluded, no snap should occur from
    // the excluded window itself. otherA is at x=0. If selfId='a' and we place self
    // near x=104, it could snap to otherB (x=200) but not to otherA (x=0) because
    // selfId === 'a' is excluded.
    getWindows.mockReturnValue([otherA]);
    const r = snap.snapToOthers(2, 0, 8, 'a', 30, 30);
    // x=2 is within 8 of otherA.x=0 BUT selfId 'a' excludes it -> no snap
    expect(r.snappedX).toBe(false);
    expect(r.x).toBe(2);
  });

  it('returns original coords when nothing is within threshold', () => {
    const r = snap.snapToOthers(5000, 5000, 8, 'self', 30, 30);
    expect(r.x).toBe(5000);
    expect(r.y).toBe(5000);
    expect(r.snappedX).toBe(false);
    expect(r.snappedY).toBe(false);
  });

  it('snaps to the closest edge among multiple candidates', () => {
    // otherA right edge=100, otherB left edge=200. self at x=105: dx to 100 =5, dx to 200=95
    // choose 100. 
    getWindows.mockReturnValue([otherA, otherB]);
    const r = snap.snapToOthers(105, 0, 8, 'self', 30, 30);
    expect(r.x).toBe(100);
    expect(r.snappedX).toBe(true);
  });
});
