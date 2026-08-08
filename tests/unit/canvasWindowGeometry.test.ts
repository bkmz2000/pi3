/**
 * Placement rules for the floating canvas window. The window is draggable, so
 * these guard the two ways it can end up unreachable: dragged above the
 * viewport, or grown past it by a `size()` call in student code.
 */
import { describe, test, expect } from '@jest/globals';
import { clampIntoView, dragTo, fitScale, screenToBufferPoint, bearingDegrees } from '../../src/canvasWindowGeometry';

describe('clampIntoView', () => {
  test('returns the same offset when the window is fully on screen', () => {
    const pos = { x: 10, y: 20 };
    expect(clampIntoView({ top: 5, left: 5 }, pos)).toBe(pos);
  });

  test('pushes the window down when its top is above the viewport', () => {
    expect(clampIntoView({ top: -30, left: 0 }, { x: 0, y: -100 })).toEqual({ x: 0, y: -70 });
  });

  test('pushes the window right when its left is off screen', () => {
    expect(clampIntoView({ top: 0, left: -12 }, { x: -50, y: 3 })).toEqual({ x: -38, y: 3 });
  });
});

describe('dragTo', () => {
  const drag = { startX: 100, startY: 100, baseX: 0, baseY: 0 };

  test('moves by the pointer delta', () => {
    expect(dragTo(drag, { x: 130, y: 80 }, { x: 0, y: 0 }, { top: 200, left: 0 }))
      .toEqual({ x: 30, y: -20 });
  });

  test('adds the delta to the offset the drag started from', () => {
    expect(dragTo({ ...drag, baseX: 5, baseY: 7 }, { x: 110, y: 110 }, { x: 5, y: 7 }, null))
      .toEqual({ x: 15, y: 17 });
  });

  test('pins the top edge at the viewport when dragged above it', () => {
    // Window top is at 10px; dragging up by 50 would put it at -40.
    const next = dragTo(drag, { x: 100, y: 50 }, { x: 0, y: 0 }, { top: 10, left: 0 });
    expect(next.y).toBe(-10); // exactly enough to land the top edge on 0
  });

  test('skips the pin when there is no measured box yet', () => {
    expect(dragTo(drag, { x: 100, y: 20 }, { x: 0, y: 0 }, null)).toEqual({ x: 0, y: -80 });
  });
});

describe('fitScale', () => {
  test('leaves a canvas that already fits at 1', () => {
    expect(fitScale(300, 300, 1920, 1080)).toBe(1);
  });

  test('never magnifies a small canvas', () => {
    expect(fitScale(64, 64, 1920, 1080)).toBe(1);
  });

  test('shrinks to the width limit on a narrow viewport', () => {
    expect(fitScale(1000, 100, 500, 2000)).toBeCloseTo(0.425);
  });

  test('shrinks to the height limit on a short viewport', () => {
    // (400 - 60) * 0.85 = 289 available for a 1000px-tall canvas.
    expect(fitScale(100, 1000, 4000, 400)).toBeCloseTo(0.289);
  });

  test('uses the tighter of the two limits', () => {
    expect(fitScale(1000, 1000, 500, 400)).toBeCloseTo(0.289);
  });
});

describe('screenToBufferPoint', () => {
  test('subtracts the rect origin and applies the buffer/display scale', () => {
    expect(screenToBufferPoint(110, 220, { top: 20, left: 10 }, 2)).toEqual({ x: 200, y: 400 });
  });

  test('is a no-op at scale 1 with a zero-origin rect', () => {
    expect(screenToBufferPoint(50, 75, { top: 0, left: 0 }, 1)).toEqual({ x: 50, y: 75 });
  });
});

describe('bearingDegrees', () => {
  // Matches actor.angle / Polar(): 0° = north (up, -y), clockwise positive.
  test('straight up is 0 degrees', () => {
    expect(bearingDegrees({ x: 0, y: 0 }, { x: 0, y: -10 })).toBeCloseTo(0);
  });

  test('straight right is 90 degrees', () => {
    expect(bearingDegrees({ x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(90);
  });

  test('straight down is 180 degrees', () => {
    expect(bearingDegrees({ x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(180);
  });

  test('straight left is 270 degrees', () => {
    expect(bearingDegrees({ x: 0, y: 0 }, { x: -10, y: 0 })).toBeCloseTo(270);
  });
});
