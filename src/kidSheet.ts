// Pure kid-mode sprite editor logic: frames <-> SheetData round-trip.
//
// Kid mode edits ONE sprite: named animations, each a horizontal strip of
// square frames packed into the 512×512 sheet. Other sprites in the sheet
// are preserved byte-for-byte. No DOM/React dependencies — unit-testable
// in isolation.

import type { SheetData, SheetSprites, SheetAnimationStrip } from "./state/projectTypes";
import { decodePixels, encodePixels, BLANK_W, BLANK_H, hexToRgb } from "./sheetPixels";
import { PAL_NAMES } from "./palette";

/** One square RGBA frame buffer (size × size × 4). */
export type KidFrame = Uint8ClampedArray;
export type KidAnimation = { name: string; frames: KidFrame[] };
export type Rgb = [number, number, number];
export interface KidState {
  size: number;
  anims: KidAnimation[];
}

export const KID_SIZES = [16, 32, 64, 128] as const;
export type KidSize = (typeof KID_SIZES)[number];
export const KID_DEFAULT_SIZE = 64;
export const KID_DEFAULT_SPRITE = "sprite";

/** Sweetie-16 palette, in canonical order (matches palette.ts / _color.py). */
export const PALETTE_HEX: string[] = Object.keys(PAL_NAMES);
export const PALETTE_RGB: Rgb[] = PALETTE_HEX.map((h) => hexToRgb(h));

export function blankKidFrame(size: number): KidFrame {
  return new Uint8ClampedArray(size * size * 4);
}

export function kidDefaultState(size: number): KidAnimation[] {
  return [{ name: "idle", frames: [blankKidFrame(size)] }];
}

export function maxFramesPerStrip(size: number): number {
  return Math.floor(BLANK_W / size);
}

export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.max(0, Math.min(255, Math.round(a[0] + (b[0] - a[0]) * t))),
    Math.max(0, Math.min(255, Math.round(a[1] + (b[1] - a[1]) * t))),
    Math.max(0, Math.min(255, Math.round(a[2] + (b[2] - a[2]) * t))),
  ];
}

export function isPaletteRgb(c: Rgb): boolean {
  return PALETTE_RGB.some((p) => p[0] === c[0] && p[1] === c[1] && p[2] === c[2]);
}

// ── Geometry ────────────────────────────────────────────────────────────────

type Rect = { x: number; y: number; w: number; h: number };

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Bounding rects of every strip in the sheet, optionally excluding one sprite. */
export function spriteRects(sprites: SheetSprites, except?: string): Rect[] {
  const out: Rect[] = [];
  for (const [name, entry] of Object.entries(sprites)) {
    if (name === except) continue;
    for (const s of Object.values(entry.animations)) {
      out.push({ x: s.x, y: s.y, w: s.frameW * s.frameCount, h: s.frameH });
    }
  }
  return out;
}

function clearRect(buf: Uint8ClampedArray, w: number, h: number, x: number, y: number, rw: number, rh: number) {
  for (let row = Math.max(0, y); row < Math.min(h, y + rh); row++) {
    const start = Math.max(0, x);
    const end = Math.min(w, x + rw);
    buf.fill(0, (row * w + start) * 4, (row * w + end) * 4);
  }
}

function findStrip(occupied: Rect[], width: number, height: number, size: number, n: number): Rect | null {
  const runW = n * size;
  for (let y = 0; y + size <= height; y++) {
    for (let x = 0; x + runW <= width; x++) {
      const cand = { x, y, w: runW, h: size };
      if (!occupied.some((o) => intersects(cand, o))) return cand;
    }
  }
  return null;
}

// ── Load / save ─────────────────────────────────────────────────────────────

/** Read a sprite's animations out of a sheet. Non-square frames are cropped to
 *  square (kid mode is square-only). Returns null when the sprite is absent or
 *  has no animations. */
export function kidStateFromSheet(sheet: SheetData, spriteName: string): KidState | null {
  const entry = sheet.sprites[spriteName];
  if (!entry) return null;
  const names = Object.keys(entry.animations);
  if (names.length === 0) return null;
  const buf = decodePixels(sheet.pixels);
  const size = entry.animations[names[0]].frameW;
  const anims: KidAnimation[] = names.map((name) => {
    const s = entry.animations[name];
    const frames: KidFrame[] = [];
    for (let i = 0; i < s.frameCount; i++) {
      const f = new Uint8ClampedArray(size * size * 4);
      const cropH = Math.min(s.frameH, size);
      for (let row = 0; row < cropH; row++) {
        const srcOff = ((s.y + row) * sheet.width + (s.x + i * s.frameW)) * 4;
        const take = Math.min(s.frameW, size);
        f.set(buf.subarray(srcOff, srcOff + take * 4), row * size * 4);
      }
      frames.push(f);
    }
    return { name, frames };
  });
  return { size, anims };
}

/** Pack kid state back into the sheet, preserving every other sprite. Frames
 *  must be square (size × size). Throws when an animation exceeds the frames
 *  that fit in one horizontal strip or no free space exists. */
export function kidStateToSheet(prev: SheetData, spriteName: string, size: number, anims: KidAnimation[]): SheetData {
  const width = prev.width || BLANK_W;
  const height = prev.height || BLANK_H;
  const buf = decodePixels(prev.pixels);

  // Clear this sprite's old strips so resized/removed frames don't leave ghosts.
  const oldEntry = prev.sprites[spriteName];
  if (oldEntry) {
    for (const s of Object.values(oldEntry.animations)) {
      clearRect(buf, width, height, s.x, s.y, s.frameW * s.frameCount, s.frameH);
    }
  }

  const occupied = spriteRects(prev.sprites, spriteName);
  const perRow = maxFramesPerStrip(size);
  const newStrips: Record<string, SheetAnimationStrip> = {};

  for (const anim of anims) {
    const n = anim.frames.length;
    if (n < 1) continue;
    if (n > perRow) {
      throw new Error(
        `kidSheet: animation "${anim.name}" has ${n} frames; max ${perRow} for ${size}px frames`
      );
    }
    for (const f of anim.frames) {
      if (f.length !== size * size * 4) {
        throw new Error(`kidSheet: animation "${anim.name}" has a non-square frame`);
      }
    }
    const strip = findStrip(occupied, width, height, size, n);
    if (!strip) {
      throw new Error(`kidSheet: no free space for animation "${anim.name}"`);
    }
    occupied.push(strip);
    for (let i = 0; i < n; i++) {
      const f = anim.frames[i];
      for (let row = 0; row < size; row++) {
        const dstOff = ((strip.y + row) * width + (strip.x + i * size)) * 4;
        buf.set(f.subarray(row * size * 4, (row + 1) * size * 4), dstOff);
      }
    }
    newStrips[anim.name] = { x: strip.x, y: strip.y, frameW: size, frameH: size, frameCount: n };
  }

  const sprites: SheetSprites = { ...prev.sprites, [spriteName]: { animations: newStrips } };
  return { pixels: encodePixels(buf), width, height, sprites };
}
