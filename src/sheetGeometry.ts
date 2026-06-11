import type { SheetSprites } from "./state/IdeState";

// ── Reserved identifiers (Python Actor attributes) ────────────────────────────

export const ACTOR_RESERVED = new Set([
  "x","y","angle","vx","vy","pos","vel","visible","collidable","image",
  "scale","flip_x","flip_y","collider","center","top","bottom","left",
  "right","top_left","top_right","bottom_left","bottom_right",
  "update","draw","die","is_alive","collides_with","collides_any",
  "future_state","move","move_to","change_x_by","change_y_by",
  "point_towards","rotate","random_position","wrap","wrap_x","wrap_y","in_bounds",
]);

// ── Smart select ──────────────────────────────────────────────────────────────

const DIRS8 = [-1,-1, 0,-1, 1,-1, -1,0, 1,0, -1,1, 0,1, 1,1]; // dx,dy pairs

export function connectedBounds(buf: Uint8ClampedArray, w: number, h: number, px: number, py: number): { x: number; y: number; w: number; h: number } | null {
  if (px < 0 || py < 0 || px >= w || py >= h) return null;
  if (buf[(py * w + px) * 4 + 3] === 0) return null;
  let minX = px, minY = py, maxX = px, maxY = py;
  const visited = new Uint8Array(w * h);
  const stack = [py * w + px];
  visited[py * w + px] = 1;
  while (stack.length) {
    const idx = stack.pop()!;
    const cx = idx % w, cy = (idx / w) | 0;
    if (cx < minX) minX = cx; else if (cx > maxX) maxX = cx;
    if (cy < minY) minY = cy; else if (cy > maxY) maxY = cy;
    for (let d = 0; d < 8; d++) {
      const nx = cx + DIRS8[d*2], ny = cy + DIRS8[d*2+1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (visited[ni] || buf[ni * 4 + 3] === 0) continue;
      visited[ni] = 1;
      stack.push(ni);
    }
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export function padBoundsToGrid(x: number, y: number, w: number, h: number, gridSize: number): { x: number; y: number; w: number; h: number } {
  if (gridSize <= 1) return { x, y, w, h };
  const x2 = Math.floor(x / gridSize) * gridSize;
  const y2 = Math.floor(y / gridSize) * gridSize;
  const x3 = Math.ceil((x + w) / gridSize) * gridSize;
  const y3 = Math.ceil((y + h) / gridSize) * gridSize;
  return { x: x2, y: y2, w: x3 - x2, h: y3 - y2 };
}

// ── Overlap detection ─────────────────────────────────────────────────────────

export function rectsOverlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function anyStripOverlaps(sprites: SheetSprites, x: number, y: number, w: number, h: number, excludeSprite?: string, excludeAnim?: string): boolean {
  for (const [sname, sentry] of Object.entries(sprites)) {
    for (const [aname, strip] of Object.entries(sentry.animations)) {
      if (sname === excludeSprite && aname === excludeAnim) continue;
      if (rectsOverlap(x, y, w, h, strip.x, strip.y, strip.frameW * strip.frameCount, strip.frameH)) return true;
    }
  }
  return false;
}

export function findOverlappingStrips(sprites: SheetSprites, x: number, y: number, w: number, h: number, excludeSprite?: string, excludeAnim?: string): Array<{ name: string; rect: { x: number; y: number; w: number; h: number } }> {
  const result: Array<{ name: string; rect: { x: number; y: number; w: number; h: number } }> = [];
  for (const [sname, sentry] of Object.entries(sprites)) {
    for (const [aname, strip] of Object.entries(sentry.animations)) {
      if (sname === excludeSprite && aname === excludeAnim) continue;
      const sw = strip.frameW * strip.frameCount;
      if (rectsOverlap(x, y, w, h, strip.x, strip.y, sw, strip.frameH))
        result.push({ name: sname, rect: { x: strip.x, y: strip.y, w: sw, h: strip.frameH } });
    }
  }
  return result;
}

// ── Naming helpers ────────────────────────────────────────────────────────────

export function suggestSpriteName(existing: Set<string>, base = "hero"): string {
  if (!existing.has(base)) return base;
  let n = 2;
  while (existing.has(`${base}${n}`)) n++;
  return `${base}${n}`;
}

export function validateSpriteName(name: string, existing: Set<string>): { ok: true } | { ok: false; key: string; args?: Record<string, string> } {
  if (!name) return { ok: false, key: "sheetEditor.nameRequired" };
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) return { ok: false, key: "sheetEditor.nameRules" };
  if (ACTOR_RESERVED.has(name)) return { ok: false, key: "sheetEditor.nameReserved" };
  if (existing.has(name)) return { ok: false, key: "sheetEditor.nameTaken" };
  return { ok: true };
}

// ── Region geometry ───────────────────────────────────────────────────────────

export function snapRegion(sx: number, sy: number, ex: number, ey: number, grid: number): { x: number; y: number; w: number; h: number } {
  if (grid <= 1) {
    const x = Math.min(sx, ex), y = Math.min(sy, ey);
    return { x, y, w: Math.abs(ex - sx), h: Math.abs(ey - sy) };
  }
  const snapX = (v: number) => Math.round(v / grid) * grid;
  const ax = snapX(sx), ay = snapX(sy), bx = snapX(ex), by = snapX(ey);
  const x = Math.min(ax, bx), y = Math.min(ay, by);
  return { x, y, w: Math.abs(bx - ax), h: Math.abs(by - ay) };
}

// ── Hit testing ───────────────────────────────────────────────────────────────

export function hitTestSprites(sprites: SheetSprites, px: number, py: number): { sprite: string; anim: string; idx: number } | null {
  for (const [sname, sentry] of Object.entries(sprites)) {
    for (const [aname, strip] of Object.entries(sentry.animations)) {
      if (py < strip.y || py >= strip.y + strip.frameH) continue;
      if (px < strip.x || px >= strip.x + strip.frameW * strip.frameCount) continue;
      const idx = Math.floor((px - strip.x) / strip.frameW);
      return { sprite: sname, anim: aname, idx };
    }
  }
  return null;
}
