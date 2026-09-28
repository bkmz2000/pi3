// Pure shape rasterizers extracted from SheetEditor. No deps.

export function bresenhamLine(x0: number, y0: number, x1: number, y1: number, plot: (x: number, y: number) => void) {
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    plot(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

export function rectOutline(x0: number, y0: number, x1: number, y1: number, plot: (x: number, y: number) => void) {
  const xa = Math.min(x0, x1), xb = Math.max(x0, x1);
  const ya = Math.min(y0, y1), yb = Math.max(y0, y1);
  for (let x = xa; x <= xb; x++) { plot(x, ya); plot(x, yb); }
  for (let y = ya; y <= yb; y++) { plot(xa, y); plot(xb, y); }
}

export function ellipseOutline(x0: number, y0: number, x1: number, y1: number, plot: (x: number, y: number) => void) {
  if (x0 === x1 && y0 === y1) {
    plot(x0, y0);
    return;
  }

  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const rx = Math.abs(x1 - x0) / 2;
  const ry = Math.abs(y1 - y0) / 2;
  const steps = Math.max(16, Math.ceil(2 * Math.PI * Math.max(rx, ry)));
  const samples: [number, number][] = [];

  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const point: [number, number] = [
      Math.round(cx + Math.cos(a) * rx),
      Math.round(cy + Math.sin(a) * ry),
    ];
    const previous = samples[samples.length - 1];
    if (!previous || previous[0] !== point[0] || previous[1] !== point[1]) samples.push(point);
  }

  // Rounded angular samples can land two cells apart, leaving visible holes.
  // Join every neighboring sample, including last → first, to guarantee a
  // continuous closed contour while emitting each raster cell only once.
  const seen = new Set<string>();
  const emit = (x: number, y: number) => {
    const key = `${x},${y}`;
    if (seen.has(key)) return;
    seen.add(key);
    plot(x, y);
  };
  for (let i = 0; i < samples.length; i++) {
    const from = samples[i];
    const to = samples[(i + 1) % samples.length];
    bresenhamLine(from[0], from[1], to[0], to[1], emit);
  }
}
