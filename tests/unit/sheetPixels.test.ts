import { describe, test, expect } from '@jest/globals';
import {
  BLANK_W, BLANK_H, SHADE_STEP,
  decodePixels, encodePixels, blankSheet,
  hexToRgb, rgbToHex, lerpCh,
  inClip, paintPixel, paintBrush, stampTile, floodFill,
} from '../../src/sheetPixels';

// ── encode / decode ───────────────────────────────────────────────────────────

describe('encodePixels / decodePixels', () => {
  test('round-trips a zeroed buffer', () => {
    const buf = new Uint8ClampedArray(16);
    expect(decodePixels(encodePixels(buf))).toEqual(buf);
  });

  test('round-trips a non-trivial buffer', () => {
    const buf = new Uint8ClampedArray([255, 128, 0, 255, 0, 64, 192, 100]);
    expect(decodePixels(encodePixels(buf))).toEqual(buf);
  });

  test('large buffer (> CHUNK) round-trips', () => {
    const buf = new Uint8ClampedArray(0x10000).fill(42);
    expect(decodePixels(encodePixels(buf))).toEqual(buf);
  });
});

describe('blankSheet', () => {
  test('produces correct dimensions', () => {
    const s = blankSheet();
    expect(s.width).toBe(BLANK_W);
    expect(s.height).toBe(BLANK_H);
    expect(s.sprites).toEqual({});
  });

  test('pixels decode to all-zero RGBA', () => {
    const buf = decodePixels(blankSheet().pixels);
    expect(buf.every(v => v === 0)).toBe(true);
  });
});

// ── color helpers ─────────────────────────────────────────────────────────────

describe('hexToRgb / rgbToHex', () => {
  test('round-trips black', () => {
    expect(hexToRgb(rgbToHex(0, 0, 0))).toEqual([0, 0, 0]);
  });

  test('round-trips white', () => {
    expect(hexToRgb(rgbToHex(255, 255, 255))).toEqual([255, 255, 255]);
  });

  test('parses known color', () => {
    expect(hexToRgb('#ef7d57')).toEqual([0xef, 0x7d, 0x57]);
  });

  test('formats with padding', () => {
    expect(rgbToHex(1, 2, 3)).toBe('#010203');
  });
});

describe('lerpCh', () => {
  test('t=0 returns a', () => { expect(lerpCh(10, 200, 0)).toBe(10); });
  test('t=1 returns b', () => { expect(lerpCh(10, 200, 1)).toBe(200); });
  test('t=0.5 returns midpoint', () => { expect(lerpCh(0, 200, 0.5)).toBe(100); });
  test('clamps below 0', () => { expect(lerpCh(0, -300, 0.5)).toBe(0); });
  test('clamps above 255', () => { expect(lerpCh(255, 600, 0.5)).toBe(255); });
});

// ── inClip ────────────────────────────────────────────────────────────────────

describe('inClip', () => {
  const clip = { x: 2, y: 2, w: 4, h: 4 };
  test('null clip always passes', () => { expect(inClip(0, 0, null)).toBe(true); });
  test('inside clip passes', () => { expect(inClip(3, 3, clip)).toBe(true); });
  test('left edge passes', () => { expect(inClip(2, 2, clip)).toBe(true); });
  test('right edge (exclusive) fails', () => { expect(inClip(6, 3, clip)).toBe(false); });
  test('outside clip fails', () => { expect(inClip(0, 0, clip)).toBe(false); });
});

// ── paintPixel ────────────────────────────────────────────────────────────────

describe('paintPixel', () => {
  function mkBuf(w = 4, h = 4) { return new Uint8ClampedArray(w * h * 4); }

  test('pencil sets RGBA', () => {
    const buf = mkBuf();
    paintPixel(buf, 4, 4, 1, 1, 'pencil', '#ef7d57', null);
    expect(buf[(1 * 4 + 1) * 4]).toBe(0xef);
    expect(buf[(1 * 4 + 1) * 4 + 3]).toBe(255);
  });

  test('eraser zeroes pixel', () => {
    const buf = new Uint8ClampedArray([255, 0, 0, 255, ...new Array(60).fill(0)]);
    paintPixel(buf, 4, 4, 0, 0, 'eraser', '#000000', null);
    expect(buf[0]).toBe(0);
    expect(buf[3]).toBe(0);
  });

  test('darken skips transparent pixels', () => {
    const buf = mkBuf(); // all zeros (alpha=0)
    paintPixel(buf, 4, 4, 0, 0, 'darken', '#000', null);
    expect(buf[0]).toBe(0); // unchanged
  });

  test('darken dims an opaque pixel', () => {
    const buf = mkBuf();
    buf[3] = 255; buf[0] = 200; // alpha=255, R=200
    paintPixel(buf, 4, 4, 0, 0, 'darken', '#000', null);
    expect(buf[0]).toBeLessThan(200);
  });

  test('lighten skips transparent pixels', () => {
    const buf = mkBuf();
    paintPixel(buf, 4, 4, 0, 0, 'lighten', '#fff', null);
    expect(buf[0]).toBe(0);
  });

  test('out-of-bounds coords are ignored', () => {
    const buf = mkBuf();
    paintPixel(buf, 4, 4, -1, -1, 'pencil', '#ff0000', null);
    expect(buf.every(v => v === 0)).toBe(true);
  });

  test('clip blocks paint', () => {
    const buf = mkBuf();
    paintPixel(buf, 4, 4, 0, 0, 'pencil', '#ff0000', { x: 1, y: 1, w: 2, h: 2 });
    expect(buf[0]).toBe(0); // (0,0) is outside clip
  });
});

// ── paintBrush ────────────────────────────────────────────────────────────────

describe('paintBrush', () => {
  test('size=1 paints single pixel', () => {
    const buf = new Uint8ClampedArray(100 * 100 * 4);
    paintBrush(buf, 100, 100, 50, 50, 'pencil', '#ff0000', 1, null);
    const idx = (50 * 100 + 50) * 4;
    expect(buf[idx]).toBe(0xff);
    expect(buf[idx + 3]).toBe(255);
  });

  test('size=4 paints a 4x4 block', () => {
    const buf = new Uint8ClampedArray(100 * 100 * 4);
    paintBrush(buf, 100, 100, 50, 50, 'pencil', '#ff0000', 4, null);
    let count = 0;
    for (let y = 48; y < 52; y++)
      for (let x = 48; x < 52; x++)
        if (buf[(y * 100 + x) * 4 + 3] === 255) count++;
    expect(count).toBe(16);
  });
});

// ── stampTile ────────────────────────────────────────────────────────────────

describe('stampTile', () => {
  test('copies opaque pixels', () => {
    const src = new Uint8ClampedArray(4 * 4); // 1×1
    src[0] = 100; src[1] = 150; src[2] = 200; src[3] = 255;
    const dst = new Uint8ClampedArray(4 * 4);
    stampTile(dst, 1, 1, src, 1, 0, 0, 1, 1, 0, 0);
    expect(dst[0]).toBe(100);
    expect(dst[3]).toBe(255);
  });

  test('skips transparent pixels', () => {
    const src = new Uint8ClampedArray(4); // alpha=0
    src[0] = 255;
    const dst = new Uint8ClampedArray(4);
    stampTile(dst, 1, 1, src, 1, 0, 0, 1, 1, 0, 0);
    expect(dst[0]).toBe(0); // not overwritten
  });
});

// ── floodFill ────────────────────────────────────────────────────────────────

describe('floodFill (pixel buffer)', () => {
  test('no-op when start already matches color', () => {
    const buf = new Uint8ClampedArray([255, 0, 0, 255, ...new Array(60).fill(0)]);
    const copy = buf.slice();
    floodFill(buf, 4, 4, 0, 0, '#ff0000', null);
    expect(buf).toEqual(copy);
  });

  test('fills a uniform region', () => {
    const buf = new Uint8ClampedArray(2 * 2 * 4); // 2×2 all transparent
    floodFill(buf, 2, 2, 0, 0, '#ff0000', null);
    // All 4 pixels should now be #ff0000
    for (let i = 0; i < 4; i++) {
      expect(buf[i * 4]).toBe(0xff);
      expect(buf[i * 4 + 3]).toBe(255);
    }
  });

  test('bounded by color boundary', () => {
    // 3×1: [empty, red, empty] — fill empty starting from px 0
    const buf = new Uint8ClampedArray(3 * 1 * 4);
    buf[4] = 255; buf[7] = 255; // px(1,0) = opaque red
    floodFill(buf, 3, 1, 0, 0, '#0000ff', null);
    expect(buf[0]).toBe(0); // R of px(0,0) → 0 (blue fill)
    expect(buf[2]).toBe(255); // B of px(0,0) → 255
    // px(1,0) unchanged (it was red, different target)
    expect(buf[4]).toBe(255);
    // px(2,0) was empty but PAST the red border — should NOT be filled
    // (stack-based fill: (2,0) won't be reached because (1,0) blocks it)
    expect(buf[8]).toBe(0);
  });

  test('respects clip rect', () => {
    const buf = new Uint8ClampedArray(4 * 1 * 4); // 4 transparent pixels
    floodFill(buf, 4, 1, 0, 0, '#ff0000', { x: 0, y: 0, w: 2, h: 1 });
    // px 0 and 1 filled, px 2 and 3 untouched
    expect(buf[0 * 4 + 3]).toBe(255);
    expect(buf[1 * 4 + 3]).toBe(255);
    expect(buf[2 * 4 + 3]).toBe(0);
    expect(buf[3 * 4 + 3]).toBe(0);
  });

  test('out-of-bounds start is ignored', () => {
    const buf = new Uint8ClampedArray(4);
    floodFill(buf, 1, 1, -1, 0, '#ff0000', null);
    expect(buf.every(v => v === 0)).toBe(true);
  });
});

// ── SHADE_STEP sanity ─────────────────────────────────────────────────────────

test('SHADE_STEP is the documented value', () => {
  expect(SHADE_STEP).toBeCloseTo(0.13);
});
