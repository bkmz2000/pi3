// Extracted from worker.ts so it can be unit-tested without a real Web Worker /
// Pyodide. The IDE canvas receives matplotlib figures as PNG byte arrays; this
// helper decodes the PNG, letterboxes it onto the target canvas (aspect ratio
// preserved), and returns the placement rect for tests to assert on.

export interface BlitTarget {
  width: number;
  height: number;
  getContext(kind: "2d"): BlitContext | null;
}

export interface BlitContext {
  fillStyle: unknown;
  fillRect(x: number, y: number, w: number, h: number): void;
  drawImage(bmp: ImageBitmap, dx: number, dy: number, dw: number, dh: number): void;
}

export interface BlitPlacement {
  ok: true;
  bg: string;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  srcW: number;
  srcH: number;
}

export type BlitResult = BlitPlacement | { ok: false; reason: string };

export async function blitPngToCanvas(
  pngBytes: Uint8Array,
  canvas: BlitTarget | null,
  deps: {
    createBitmap: (b: Blob) => Promise<ImageBitmap>;
    BlobCtor?: typeof Blob;
  },
): Promise<BlitResult> {
  if (!canvas) return { ok: false, reason: "no-canvas" };
  const BlobImpl = deps.BlobCtor ?? Blob;
  // Copy into a fresh ArrayBuffer so Blob typechecks even if the source view
  // sits on a SharedArrayBuffer (Pyodide memory).
  const buf = new ArrayBuffer(pngBytes.byteLength);
  new Uint8Array(buf).set(pngBytes);
  let bmp: ImageBitmap;
  try {
    const blob = new BlobImpl([buf], { type: "image/png" });
    bmp = await deps.createBitmap(blob);
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "decode" };
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    (bmp as unknown as { close?: () => void }).close?.();
    return { ok: false, reason: "no-2d-context" };
  }
  const cw = canvas.width;
  const ch = canvas.height;
  const bg = "#0a1414";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cw, ch);
  const scale = Math.min(cw / bmp.width, ch / bmp.height);
  const dw = bmp.width * scale;
  const dh = bmp.height * scale;
  const dx = (cw - dw) / 2;
  const dy = (ch - dh) / 2;
  ctx.drawImage(bmp, dx, dy, dw, dh);
  const srcW = bmp.width;
  const srcH = bmp.height;
  (bmp as unknown as { close?: () => void }).close?.();
  return { ok: true, bg, dx, dy, dw, dh, srcW, srcH };
}

// Buffer figures that arrive before the canvas is attached; drain in-order
// once the target lands. Kept as a class so worker.ts can own one instance
// and tests can spin up their own.
export class PendingMatplotlibBuffer {
  private queue: Uint8Array[] = [];
  push(bytes: Uint8Array): void {
    this.queue.push(bytes);
  }
  size(): number {
    return this.queue.length;
  }
  drain(): Uint8Array[] {
    const out = this.queue;
    this.queue = [];
    return out;
  }
}
