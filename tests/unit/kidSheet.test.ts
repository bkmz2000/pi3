import {
  kidStateFromSheet,
  kidStateToSheet,
  kidDefaultState,
  blankKidFrame,
  maxFramesPerStrip,
  mixRgb,
  isPaletteRgb,
  PALETTE_RGB,
} from "../../src/kidSheet";
import { blankSheet, encodePixels } from "../../src/sheetPixels";
import type { SheetData } from "../../src/state/projectTypes";

type Rgb = [number, number, number];

function solidFrame(size: number, [r, g, b]: Rgb): Uint8ClampedArray {
  const f = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < f.length; i += 4) {
    f[i] = r; f[i + 1] = g; f[i + 2] = b; f[i + 3] = 255;
  }
  return f;
}

function frameWithPixel(size: number, px: number, py: number, [r, g, b]: Rgb): Uint8ClampedArray {
  const f = blankKidFrame(size);
  const i = (py * size + px) * 4;
  f[i] = r; f[i + 1] = g; f[i + 2] = b; f[i + 3] = 255;
  return f;
}

function makeSheet(sprites: SheetData["sprites"] = {}, pixels = new Uint8ClampedArray(512 * 512 * 4)): SheetData {
  return { pixels: encodePixels(pixels), width: 512, height: 512, sprites };
}

describe("kidSheet round-trip", () => {
  test("save then load preserves size, animation names, frame counts and pixels", () => {
    const idleA = solidFrame(64, [239, 125, 87]);
    const idleB = solidFrame(64, [41, 166, 246]);
    const runA = frameWithPixel(64, 3, 5, [167, 240, 112]);
    const runB = frameWithPixel(64, 10, 20, [56, 183, 100]);
    const runC = frameWithPixel(64, 30, 30, [255, 205, 117]);

    const sheet = kidStateToSheet(blankSheet(), "hero", 64, [
      { name: "idle", frames: [idleA, idleB] },
      { name: "run", frames: [runA, runB, runC] },
    ]);

    const loaded = kidStateFromSheet(sheet, "hero");
    expect(loaded).not.toBeNull();
    expect(loaded!.size).toBe(64);
    expect(loaded!.anims.map((a) => a.name)).toEqual(["idle", "run"]);
    expect(loaded!.anims[0].frames.length).toBe(2);
    expect(loaded!.anims[1].frames.length).toBe(3);
    expect(Array.from(loaded!.anims[0].frames[0])).toEqual(Array.from(idleA));
    expect(Array.from(loaded!.anims[0].frames[1])).toEqual(Array.from(idleB));
    expect(Array.from(loaded!.anims[1].frames[2])).toEqual(Array.from(runC));
  });

  test("preserves other sprites byte-for-byte", () => {
    const buf = new Uint8ClampedArray(512 * 512 * 4);
    buf[0] = 255; buf[1] = 0; buf[2] = 0; buf[3] = 255; // red pixel at (0,0)
    const sheet = makeSheet(
      { coin: { animations: { spin: { x: 0, y: 0, frameW: 16, frameH: 16, frameCount: 1 } } } },
      buf,
    );

    const heroSheet = kidStateToSheet(sheet, "hero", 64, [{ name: "idle", frames: [solidFrame(64, [0, 255, 0])] }]);

    // coin still loads and its red pixel is untouched
    const coin = kidStateFromSheet(heroSheet, "coin");
    expect(coin).not.toBeNull();
    expect(coin!.anims[0].frames.length).toBe(1);
    const c0 = coin!.anims[0].frames[0];
    expect([c0[0], c0[1], c0[2], c0[3]]).toEqual([255, 0, 0, 255]);

    // hero reads back correctly
    const hero = kidStateFromSheet(heroSheet, "hero");
    expect(hero!.anims[0].frames[0][0]).toBe(0);
    expect(hero!.anims[0].frames[0][1]).toBe(255);
  });

  test("clears the sprite's old strips on resize/re-save", () => {
    const s1 = kidStateToSheet(blankSheet(), "hero", 64, [
      { name: "idle", frames: [solidFrame(64, [1, 2, 3]), solidFrame(64, [4, 5, 6])] },
    ]);
    const old = s1.sprites.hero!.animations.idle;
    const oldRect = { x: old.x, y: old.y, w: old.frameW * old.frameCount, h: old.frameH };

    const s2 = kidStateToSheet(s1, "hero", 32, [{ name: "idle", frames: [solidFrame(32, [7, 8, 9])] }]);
    const buf = Uint8ClampedArray.from(atob(s2.pixels), (c) => c.charCodeAt(0));

    // inside the old rect but outside the new 32×32 strip → transparent
    expect(buf[( (oldRect.y + 40) * 512 + (oldRect.x + 60) ) * 4 + 3]).toBe(0);
    // the new strip at the origin holds the new frame
    expect([buf[0], buf[1], buf[2], buf[3]]).toEqual([7, 8, 9, 255]);
  });

  test("animations pack into non-overlapping strips", () => {
    const eight = Array.from({ length: 8 }, () => solidFrame(64, [10, 10, 10]));
    const sheet = kidStateToSheet(blankSheet(), "hero", 64, [
      { name: "a", frames: eight },
      { name: "b", frames: eight },
    ]);
    const a = sheet.sprites.hero!.animations.a;
    const b = sheet.sprites.hero!.animations.b;
    // 8 × 64 = 512 → each animation fills a full row; rows must differ
    expect(a.x).toBe(0);
    expect(b.x).toBe(0);
    expect(b.y).not.toBe(a.y);
    expect(a.frameCount).toBe(8);
    expect(b.frameCount).toBe(8);
  });

  test("throws when an animation exceeds one strip", () => {
    const nine = Array.from({ length: 9 }, () => solidFrame(64, [1, 1, 1]));
    expect(() =>
      kidStateToSheet(blankSheet(), "hero", 64, [{ name: "x", frames: nine }]),
    ).toThrow(/max 8/);
  });

  test("throws on non-square frames", () => {
    const bad = new Uint8ClampedArray(64 * 32 * 4);
    expect(() =>
      kidStateToSheet(blankSheet(), "hero", 64, [{ name: "x", frames: [bad] }]),
    ).toThrow(/non-square/);
  });
});

describe("kidSheet helpers", () => {
  test("maxFramesPerStrip matches sheet width", () => {
    expect(maxFramesPerStrip(16)).toBe(32);
    expect(maxFramesPerStrip(32)).toBe(16);
    expect(maxFramesPerStrip(64)).toBe(8);
    expect(maxFramesPerStrip(128)).toBe(4);
  });

  test("mixRgb interpolates channel-wise", () => {
    expect(mixRgb([239, 125, 87], [167, 240, 112], 0)).toEqual([239, 125, 87]);
    expect(mixRgb([239, 125, 87], [167, 240, 112], 1)).toEqual([167, 240, 112]);
    expect(mixRgb([239, 125, 87], [167, 240, 112], 0.5)).toEqual([203, 183, 100]);
  });

  test("isPaletteRgb recognizes Sweetie-16 and rejects customs", () => {
    expect(isPaletteRgb(PALETTE_RGB[3])).toBe(true);
    expect(isPaletteRgb([0, 255, 0])).toBe(false);
  });

  test("kidDefaultState starts with one blank idle frame", () => {
    const d = kidDefaultState(64);
    expect(d.length).toBe(1);
    expect(d[0].name).toBe("idle");
    expect(d[0].frames[0].length).toBe(64 * 64 * 4);
    expect(d[0].frames[0][3]).toBe(0);
  });

  test("kidStateFromSheet returns null for missing sprite", () => {
    expect(kidStateFromSheet(blankSheet(), "nope")).toBeNull();
  });
});
