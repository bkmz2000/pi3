import { describe, test, expect } from '@jest/globals';
import { bresenhamLine, rectOutline, ellipseOutline } from '../../src/sheetRaster';

function collect(fn: (plot: (x: number, y: number) => void) => void): [number, number][] {
  const pts: [number, number][] = [];
  fn((x, y) => pts.push([x, y]));
  return pts;
}

describe('bresenhamLine', () => {
  test('single point', () => {
    const pts = collect(p => bresenhamLine(2, 3, 2, 3, p));
    expect(pts).toEqual([[2, 3]]);
  });

  test('horizontal line', () => {
    const pts = collect(p => bresenhamLine(0, 0, 3, 0, p));
    expect(pts).toEqual([[0,0],[1,0],[2,0],[3,0]]);
  });

  test('vertical line', () => {
    const pts = collect(p => bresenhamLine(0, 0, 0, 3, p));
    expect(pts).toEqual([[0,0],[0,1],[0,2],[0,3]]);
  });

  test('diagonal', () => {
    const pts = collect(p => bresenhamLine(0, 0, 2, 2, p));
    expect(pts).toEqual([[0,0],[1,1],[2,2]]);
  });

  test('reverse direction produces same number of points and same endpoints', () => {
    // Bresenham may choose different staircase pixels by direction, but the
    // count and the two endpoints are always the same.
    const fwd = collect(p => bresenhamLine(0, 0, 4, 2, p));
    const bwd = collect(p => bresenhamLine(4, 2, 0, 0, p));
    expect(fwd.length).toBe(bwd.length);
    const fwdSet = new Set(fwd.map(([x,y]) => `${x},${y}`));
    const bwdSet = new Set(bwd.map(([x,y]) => `${x},${y}`));
    expect(fwdSet.has('0,0') && fwdSet.has('4,2')).toBe(true);
    expect(bwdSet.has('0,0') && bwdSet.has('4,2')).toBe(true);
  });

  test('start and end are always included', () => {
    const pts = collect(p => bresenhamLine(1, 3, 7, 5, p));
    expect(pts[0]).toEqual([1, 3]);
    expect(pts[pts.length - 1]).toEqual([7, 5]);
  });
});

describe('rectOutline', () => {
  test('1×1 rect produces single point', () => {
    const pts = collect(p => rectOutline(2, 2, 2, 2, p));
    expect(pts.every(([x,y]) => x === 2 && y === 2)).toBe(true);
  });

  test('2×2 rect corners all present', () => {
    const pts = collect(p => rectOutline(0, 0, 1, 1, p));
    const set = new Set(pts.map(([x,y]) => `${x},${y}`));
    expect(set.has('0,0')).toBe(true);
    expect(set.has('1,0')).toBe(true);
    expect(set.has('0,1')).toBe(true);
    expect(set.has('1,1')).toBe(true);
  });

  test('no interior pixels for a 4×4 rect', () => {
    const pts = collect(p => rectOutline(0, 0, 3, 3, p));
    const interior = pts.filter(([x,y]) => x > 0 && x < 3 && y > 0 && y < 3);
    expect(interior).toHaveLength(0);
  });

  test('argument order does not matter (min/max clamping)', () => {
    const a = collect(p => rectOutline(3, 3, 0, 0, p)).map(([x,y])=>`${x},${y}`).sort();
    const b = collect(p => rectOutline(0, 0, 3, 3, p)).map(([x,y])=>`${x},${y}`).sort();
    expect(a).toEqual(b);
  });
});

describe('ellipseOutline', () => {
  test('produces at least 16 points', () => {
    const pts = collect(p => ellipseOutline(0, 0, 10, 10, p));
    expect(pts.length).toBeGreaterThanOrEqual(16);
  });

  test('no duplicate points', () => {
    const pts = collect(p => ellipseOutline(0, 0, 8, 6, p));
    const set = new Set(pts.map(([x,y]) => `${x},${y}`));
    expect(set.size).toBe(pts.length);
  });

  test('all points within bounding box', () => {
    const pts = collect(p => ellipseOutline(2, 2, 8, 6, p));
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(2);
      expect(x).toBeLessThanOrEqual(8);
      expect(y).toBeGreaterThanOrEqual(2);
      expect(y).toBeLessThanOrEqual(6);
    }
  });

  test('degenerate (zero size) does not crash', () => {
    expect(() => collect(p => ellipseOutline(5, 5, 5, 5, p))).not.toThrow();
  });
});
