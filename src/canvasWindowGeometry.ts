// Geometry for the floating canvas window: where a drag puts it, and how much
// it has to shrink to stay on screen. Kept out of the component so the rules
// are testable without a DOM.

/** The subset of DOMRect this module needs. */
export interface Box {
  top: number;
  left: number;
}

export interface Offset {
  x: number;
  y: number;
}

/**
 * Nudge `pos` so the window's top-left corner is not off the top or left edge.
 * Returns the same object when nothing needs to move, so callers can skip a
 * state update.
 */
export function clampIntoView(rect: Box, pos: Offset): Offset {
  const dy = rect.top < 0 ? -rect.top : 0;
  const dx = rect.left < 0 ? -rect.left : 0;
  if (dx === 0 && dy === 0) return pos;
  return { x: pos.x + dx, y: pos.y + dy };
}

/**
 * Translate a pointer move into a new window offset. The title bar is the drag
 * handle and must stay reachable, so downward-free dragging is allowed but the
 * top edge is pinned at the viewport edge.
 *
 * `rect` is the window's current box; pass null when it hasn't mounted yet.
 */
export function dragTo(
  drag: { startX: number; startY: number; baseX: number; baseY: number },
  client: { x: number; y: number },
  pos: Offset,
  rect: Box | null,
): Offset {
  const x = drag.baseX + client.x - drag.startX;
  let y = drag.baseY + client.y - drag.startY;
  if (rect) {
    const projectedTop = rect.top + (y - pos.y);
    if (projectedTop < 0) y -= projectedTop;
  }
  return { x, y };
}

/**
 * Scale factor that fits a `w`×`h` canvas into the viewport, never magnifying
 * (a small canvas stays pixel-exact). Chrome above and below the window is
 * accounted for before the 85% margin.
 */
export function fitScale(w: number, h: number, viewportW: number, viewportH: number): number {
  const maxW = viewportW * 0.85;
  const maxH = (viewportH - 60) * 0.85; // subtract approx title bar + console
  const ws = w > maxW ? maxW / w : 1;
  const hs = h > maxH ? maxH / h : 1;
  return Math.min(ws, hs, 1);
}
