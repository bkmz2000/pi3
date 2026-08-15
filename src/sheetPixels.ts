// Pure pixel-buffer helpers extracted from SheetEditor. No DOM/React deps
// except for the typed arrays and btoa/atob (available in all targets).

import type { SheetData } from "./state/projectTypes";

export const BLANK_W = 512;
export const BLANK_H = 512;
export const SHADE_STEP = 0.13;

export type DrawTool = "pencil" | "eraser" | "darken" | "lighten";
export type Clip = { x: number; y: number; w: number; h: number };

// ── Encode / decode ───────────────────────────────────────────────────────────

export function decodePixels(pixels: string): Uint8ClampedArray {
  const raw = atob(pixels);
  const buf = new Uint8ClampedArray(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf;
}

export function encodePixels(buf: Uint8ClampedArray): string {
  // Chunk to avoid stack overflow from spread; much faster than per-char concatenation.
  const CHUNK = 0x8000;
  let s = "";
  for (let i = 0; i < buf.length; i += CHUNK)
    s += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  return btoa(s);
}

export function blankSheet(): SheetData {
  return { pixels: encodePixels(new Uint8ClampedArray(BLANK_W * BLANK_H * 4)), width: BLANK_W, height: BLANK_H, sprites: {} };
}

// ── Color helpers ─────────────────────────────────────────────────────────────

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${clamp(r)}${clamp(g)}${clamp(b)}`;
}

export function lerpCh(a: number, b: number, t: number): number {
  return Math.max(0, Math.min(255, Math.round(a + (b - a) * t)));
}

// ── Pixel operations ──────────────────────────────────────────────────────────

export function inClip(px: number, py: number, clip: Clip | null): boolean {
  if (!clip) return true;
  return px >= clip.x && py >= clip.y && px < clip.x + clip.w && py < clip.y + clip.h;
}

export function paintPixel(buf: Uint8ClampedArray, w: number, h: number, px: number, py: number, tool: DrawTool, color: string, clip: Clip | null) {
  if (px < 0 || py < 0 || px >= w || py >= h) return;
  if (!inClip(px, py, clip)) return;
  const idx = (py * w + px) * 4;
  if (tool === "eraser") {
    buf[idx] = buf[idx + 1] = buf[idx + 2] = buf[idx + 3] = 0;
  } else if (tool === "pencil") {
    const [r, g, b] = hexToRgb(color);
    buf[idx] = r; buf[idx + 1] = g; buf[idx + 2] = b; buf[idx + 3] = 255;
  } else if (tool === "darken") {
    if (buf[idx + 3] === 0) return;
    buf[idx] = lerpCh(buf[idx], 0x1a, SHADE_STEP);
    buf[idx + 1] = lerpCh(buf[idx + 1], 0x1c, SHADE_STEP);
    buf[idx + 2] = lerpCh(buf[idx + 2], 0x2c, SHADE_STEP);
  } else if (tool === "lighten") {
    if (buf[idx + 3] === 0) return;
    buf[idx] = lerpCh(buf[idx], 0xf4, SHADE_STEP);
    buf[idx + 1] = lerpCh(buf[idx + 1], 0xf4, SHADE_STEP);
    buf[idx + 2] = lerpCh(buf[idx + 2], 0xf4, SHADE_STEP);
  }
}

export function paintBrush(buf: Uint8ClampedArray, w: number, h: number, cx: number, cy: number, tool: DrawTool, color: string, size: number, clip: Clip | null) {
  if (size <= 1) { paintPixel(buf, w, h, cx, cy, tool, color, clip); return; }
  const r = Math.floor(size / 2);
  for (let dy = -r; dy < size - r; dy++)
    for (let dx = -r; dx < size - r; dx++)
      paintPixel(buf, w, h, cx + dx, cy + dy, tool, color, clip);
}

export function stampTile(dst: Uint8ClampedArray, dstW: number, dstH: number, src: Uint8ClampedArray, srcW: number, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number) {
  for (let row = 0; row < sh; row++) {
    const srcRow = (sy + row) * srcW * 4 + sx * 4;
    const dstRow = (dy + row) * dstW * 4 + dx * 4;
    for (let col = 0; col < sw; col++) {
      const si = srcRow + col * 4, di = dstRow + col * 4;
      if (dx + col < 0 || dx + col >= dstW || dy + row < 0 || dy + row >= dstH) continue;
      if (src[si + 3] === 0) continue;
      dst[di] = src[si]; dst[di + 1] = src[si + 1]; dst[di + 2] = src[si + 2]; dst[di + 3] = src[si + 3];
    }
  }
}

export function floodFill(buf: Uint8ClampedArray, w: number, h: number, px: number, py: number, color: string, clip: Clip | null) {
  if (px < 0 || py < 0 || px >= w || py >= h) return;
  const i0 = (py * w + px) * 4;
  const [tr, tg, tb, ta] = [buf[i0], buf[i0 + 1], buf[i0 + 2], buf[i0 + 3]];
  const [nr, ng, nb] = hexToRgb(color);
  if (tr === nr && tg === ng && tb === nb && ta === 255) return;
  const stack: [number, number][] = [[px, py]];
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
    if (!inClip(cx, cy, clip)) continue;
    const ci = (cy * w + cx) * 4;
    if (buf[ci] !== tr || buf[ci + 1] !== tg || buf[ci + 2] !== tb || buf[ci + 3] !== ta) continue;
    buf[ci] = nr; buf[ci + 1] = ng; buf[ci + 2] = nb; buf[ci + 3] = 255;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
}
