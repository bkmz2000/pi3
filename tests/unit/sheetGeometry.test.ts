/**
 * Pure function tests for SheetEditor geometry helpers.
 */
import { describe, test, expect } from '@jest/globals';
import {
  connectedBounds,
  findOverlappingStrips,
  suggestSpriteName,
  validateSpriteName,
  snapRegion,
  hitTestSprites,
  rectsOverlap,
} from '../../src/sheetGeometry';
import type { SheetSprites } from '../../src/state/IdeState';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePixBuf(w: number, h: number): Uint8ClampedArray {
  return new Uint8ClampedArray(w * h * 4);
}

function setPixel(buf: Uint8ClampedArray, w: number, x: number, y: number, alpha = 255) {
  const i = (y * w + x) * 4;
  buf[i] = 255; buf[i + 1] = 0; buf[i + 2] = 0; buf[i + 3] = alpha;
}

function makeSprites(defs: Array<{ name: string; anim?: string; x: number; y: number; w: number; h: number; count?: number }>): SheetSprites {
  const sprites: SheetSprites = {};
  for (const d of defs) {
    const animName = d.anim ?? 'default';
    sprites[d.name] = {
      animations: {
        [animName]: { x: d.x, y: d.y, frameW: d.w, frameH: d.h, frameCount: d.count ?? 1 },
      },
    };
  }
  return sprites;
}

// ── rectsOverlap ──────────────────────────────────────────────────────────────

describe('rectsOverlap', () => {
  test('two clearly overlapping rects return true', () => {
    expect(rectsOverlap(0, 0, 10, 10, 5, 5, 10, 10)).toBe(true);
  });

  test('touching edges return false (strict inequalities)', () => {
    // right edge of A touches left edge of B
    expect(rectsOverlap(0, 0, 10, 10, 10, 0, 10, 10)).toBe(false);
    // bottom edge of A touches top edge of B
    expect(rectsOverlap(0, 0, 10, 10, 0, 10, 10, 10)).toBe(false);
  });

  test('completely separate rects return false', () => {
    expect(rectsOverlap(0, 0, 5, 5, 10, 10, 5, 5)).toBe(false);
  });

  test('one rect inside another returns true', () => {
    expect(rectsOverlap(0, 0, 100, 100, 10, 10, 20, 20)).toBe(true);
  });
});

// ── connectedBounds ───────────────────────────────────────────────────────────

describe('connectedBounds', () => {
  test('transparent click returns null', () => {
    const buf = makePixBuf(8, 8);
    expect(connectedBounds(buf, 8, 8, 3, 3)).toBeNull();
  });

  test('out of bounds click returns null', () => {
    const buf = makePixBuf(8, 8);
    setPixel(buf, 8, 0, 0);
    expect(connectedBounds(buf, 8, 8, -1, 0)).toBeNull();
    expect(connectedBounds(buf, 8, 8, 8, 0)).toBeNull();
  });

  test('single pixel returns 1x1 bounds', () => {
    const buf = makePixBuf(8, 8);
    setPixel(buf, 8, 3, 4);
    expect(connectedBounds(buf, 8, 8, 3, 4)).toEqual({ x: 3, y: 4, w: 1, h: 1 });
  });

  test('8-connectivity: diagonal pixels are connected', () => {
    const buf = makePixBuf(8, 8);
    // Diagonal line: (0,0), (1,1), (2,2)
    setPixel(buf, 8, 0, 0);
    setPixel(buf, 8, 1, 1);
    setPixel(buf, 8, 2, 2);
    const result = connectedBounds(buf, 8, 8, 0, 0);
    expect(result).not.toBeNull();
    // All three pixels should be included
    expect(result!.x).toBe(0);
    expect(result!.y).toBe(0);
    expect(result!.w).toBe(3);
    expect(result!.h).toBe(3);
  });

  test('8-connectivity: two blobs touching diagonally are merged', () => {
    const buf = makePixBuf(10, 10);
    // Blob A at (0,0)-(1,1), Blob B at (2,2)-(3,3) — touch diagonally at (1,1)-(2,2)
    for (let y = 0; y <= 1; y++) for (let x = 0; x <= 1; x++) setPixel(buf, 10, x, y);
    for (let y = 2; y <= 3; y++) for (let x = 2; x <= 3; x++) setPixel(buf, 10, x, y);
    const result = connectedBounds(buf, 10, 10, 0, 0);
    expect(result).not.toBeNull();
    // Both blobs should be included in one region
    expect(result!.x).toBe(0);
    expect(result!.y).toBe(0);
    expect(result!.w).toBe(4);
    expect(result!.h).toBe(4);
  });

  test('two blobs with 1-px transparent gap are separate', () => {
    const buf = makePixBuf(10, 4);
    // Blob A: x=0..3, Blob B: x=5..8 (gap at x=4)
    for (let x = 0; x <= 3; x++) setPixel(buf, 10, x, 1);
    for (let x = 5; x <= 8; x++) setPixel(buf, 10, x, 1);
    const resultA = connectedBounds(buf, 10, 4, 0, 1);
    const resultB = connectedBounds(buf, 10, 4, 5, 1);
    expect(resultA!.x).toBe(0); expect(resultA!.w).toBe(4);
    expect(resultB!.x).toBe(5); expect(resultB!.w).toBe(4);
  });
});

// ── suggestSpriteName ─────────────────────────────────────────────────────────

describe('suggestSpriteName', () => {
  test('empty set returns base name', () => {
    expect(suggestSpriteName(new Set())).toBe('hero');
  });

  test('returns custom base when not taken', () => {
    expect(suggestSpriteName(new Set(['other']), 'ship')).toBe('ship');
  });

  test('base taken returns base2', () => {
    expect(suggestSpriteName(new Set(['hero']))).toBe('hero2');
  });

  test('base and base2 taken returns base3', () => {
    expect(suggestSpriteName(new Set(['hero', 'hero2']))).toBe('hero3');
  });

  test('fills gap: hero and hero3 present returns hero2', () => {
    // Note: algorithm increments from 2 up, so hero+hero2+hero3 → hero4
    // but hero alone → hero2, not filling gap after hero3
    expect(suggestSpriteName(new Set(['hero', 'hero3']))).toBe('hero2');
  });

  test('sequential chain produces next available', () => {
    expect(suggestSpriteName(new Set(['hero', 'hero2', 'hero3']))).toBe('hero4');
  });
});

// ── validateSpriteName ────────────────────────────────────────────────────────

describe('validateSpriteName', () => {
  test('empty name returns nameRequired', () => {
    const result = validateSpriteName('', new Set());
    expect(result).toEqual({ ok: false, key: 'sheetEditor.nameRequired' });
  });

  test('name with uppercase letters fails nameRules', () => {
    const result = validateSpriteName('Hero', new Set());
    expect(result).toEqual({ ok: false, key: 'sheetEditor.nameRules' });
  });

  test('name starting with digit fails nameRules', () => {
    const result = validateSpriteName('2hero', new Set());
    expect(result).toEqual({ ok: false, key: 'sheetEditor.nameRules' });
  });

  test('name with spaces fails nameRules', () => {
    const result = validateSpriteName('my hero', new Set());
    expect(result).toEqual({ ok: false, key: 'sheetEditor.nameRules' });
  });

  test('reserved name returns nameReserved', () => {
    const result = validateSpriteName('x', new Set());
    expect(result).toEqual({ ok: false, key: 'sheetEditor.nameReserved' });
  });

  test('another reserved name (update) returns nameReserved', () => {
    const result = validateSpriteName('update', new Set());
    expect(result).toEqual({ ok: false, key: 'sheetEditor.nameReserved' });
  });

  test('existing name returns nameTaken', () => {
    const result = validateSpriteName('hero', new Set(['hero', 'enemy']));
    expect(result).toEqual({ ok: false, key: 'sheetEditor.nameTaken' });
  });

  test('valid new name returns ok', () => {
    const result = validateSpriteName('hero', new Set(['enemy']));
    expect(result).toEqual({ ok: true });
  });

  test('valid name with underscores and digits', () => {
    const result = validateSpriteName('hero_2a', new Set());
    expect(result).toEqual({ ok: true });
  });

  test('name starting with underscore is valid', () => {
    const result = validateSpriteName('_hero', new Set());
    expect(result).toEqual({ ok: true });
  });
});

// ── snapRegion ────────────────────────────────────────────────────────────────

describe('snapRegion', () => {
  test('grid=1 passthrough (no snap)', () => {
    expect(snapRegion(3, 5, 11, 17, 1)).toEqual({ x: 3, y: 5, w: 8, h: 12 });
  });

  test('grid<=1 passthrough even with 0', () => {
    expect(snapRegion(3, 5, 11, 17, 0)).toEqual({ x: 3, y: 5, w: 8, h: 12 });
  });

  test('snaps to grid=16', () => {
    // sx=2, sy=2, ex=18, ey=18 → snap(2)=0, snap(18)=16 → w=16, h=16
    const result = snapRegion(2, 2, 18, 18, 16);
    expect(result.w).toBe(16);
    expect(result.h).toBe(16);
    expect(result.x % 16).toBe(0);
    expect(result.y % 16).toBe(0);
  });

  test('drag direction: end < start still works', () => {
    // sx=20, sy=20, ex=3, ey=3, grid=16 → snap(20)=16, snap(3)=0
    const result = snapRegion(20, 20, 3, 3, 16);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.w).toBe(16);
    expect(result.h).toBe(16);
  });

  test('already on grid boundary stays put', () => {
    const result = snapRegion(0, 0, 32, 32, 16);
    expect(result).toEqual({ x: 0, y: 0, w: 32, h: 32 });
  });
});

// ── findOverlappingStrips ─────────────────────────────────────────────────────

describe('findOverlappingStrips', () => {
  test('no sprites returns empty array', () => {
    expect(findOverlappingStrips({}, 0, 0, 16, 16)).toEqual([]);
  });

  test('non-overlapping sprite returns empty array', () => {
    const sprites = makeSprites([{ name: 'hero', x: 100, y: 100, w: 16, h: 16 }]);
    expect(findOverlappingStrips(sprites, 0, 0, 16, 16)).toEqual([]);
  });

  test('overlapping sprite is returned', () => {
    const sprites = makeSprites([{ name: 'hero', x: 0, y: 0, w: 16, h: 16 }]);
    const result = findOverlappingStrips(sprites, 8, 8, 16, 16);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('hero');
  });

  test('touching edges (not overlapping) returns empty', () => {
    const sprites = makeSprites([{ name: 'hero', x: 0, y: 0, w: 16, h: 16 }]);
    // x=16 is right at the edge of hero (0+16=16), so no overlap
    expect(findOverlappingStrips(sprites, 16, 0, 16, 16)).toEqual([]);
  });

  test('excludes specified sprite+anim', () => {
    const sprites = makeSprites([{ name: 'hero', x: 0, y: 0, w: 16, h: 16 }]);
    const result = findOverlappingStrips(sprites, 0, 0, 16, 16, 'hero', 'default');
    expect(result).toHaveLength(0);
  });

  test('returns multiple overlapping sprites', () => {
    const sprites = makeSprites([
      { name: 'hero', x: 0, y: 0, w: 16, h: 16 },
      { name: 'enemy', x: 8, y: 8, w: 16, h: 16 },
    ]);
    const result = findOverlappingStrips(sprites, 4, 4, 16, 16);
    expect(result).toHaveLength(2);
  });

  test('multi-frame strip: total width = frameW * frameCount', () => {
    const sprites: SheetSprites = {
      hero: { animations: { default: { x: 0, y: 0, frameW: 16, frameH: 16, frameCount: 4 } } },
    };
    // Total width = 64. Query at x=48 should overlap.
    const result = findOverlappingStrips(sprites, 48, 0, 16, 16);
    expect(result).toHaveLength(1);
    expect(result[0].rect.w).toBe(64); // total strip width
  });
});

// ── hitTestSprites ────────────────────────────────────────────────────────────

describe('hitTestSprites', () => {
  test('miss returns null', () => {
    const sprites = makeSprites([{ name: 'hero', x: 100, y: 100, w: 16, h: 16 }]);
    expect(hitTestSprites(sprites, 0, 0)).toBeNull();
  });

  test('hit returns correct sprite, anim, and idx=0', () => {
    const sprites = makeSprites([{ name: 'hero', x: 0, y: 0, w: 16, h: 16 }]);
    const result = hitTestSprites(sprites, 8, 8);
    expect(result).toEqual({ sprite: 'hero', anim: 'default', idx: 0 });
  });

  test('frame index arithmetic: second frame', () => {
    const sprites: SheetSprites = {
      hero: { animations: { default: { x: 0, y: 0, frameW: 16, frameH: 16, frameCount: 3 } } },
    };
    // Frame 1 is at x=16..31
    expect(hitTestSprites(sprites, 20, 8)).toEqual({ sprite: 'hero', anim: 'default', idx: 1 });
  });

  test('frame index arithmetic: third frame', () => {
    const sprites: SheetSprites = {
      hero: { animations: { default: { x: 0, y: 0, frameW: 16, frameH: 16, frameCount: 3 } } },
    };
    // Frame 2 is at x=32..47
    expect(hitTestSprites(sprites, 40, 4)).toEqual({ sprite: 'hero', anim: 'default', idx: 2 });
  });

  test('miss past last frame returns null', () => {
    const sprites: SheetSprites = {
      hero: { animations: { default: { x: 0, y: 0, frameW: 16, frameH: 16, frameCount: 2 } } },
    };
    // x=32 is past the last frame (0+16*2=32, not included)
    expect(hitTestSprites(sprites, 32, 8)).toBeNull();
  });

  test('multi-animation sprite: hits correct anim', () => {
    const sprites: SheetSprites = {
      hero: {
        animations: {
          idle: { x: 0, y: 0, frameW: 16, frameH: 16, frameCount: 1 },
          walk: { x: 0, y: 16, frameW: 16, frameH: 16, frameCount: 2 },
        },
      },
    };
    const walkHit = hitTestSprites(sprites, 8, 20);
    expect(walkHit).not.toBeNull();
    expect(walkHit!.anim).toBe('walk');
    expect(walkHit!.idx).toBe(0);

    const walkFrame1 = hitTestSprites(sprites, 20, 20);
    expect(walkFrame1!.idx).toBe(1);
  });

  test('y boundary: just above strip returns null', () => {
    const sprites = makeSprites([{ name: 'hero', x: 0, y: 10, w: 16, h: 16 }]);
    expect(hitTestSprites(sprites, 8, 9)).toBeNull();
  });

  test('y boundary: just at bottom edge returns null', () => {
    const sprites = makeSprites([{ name: 'hero', x: 0, y: 10, w: 16, h: 16 }]);
    // y=26 is at strip.y + strip.frameH = 10+16=26, not included
    expect(hitTestSprites(sprites, 8, 26)).toBeNull();
  });
});
