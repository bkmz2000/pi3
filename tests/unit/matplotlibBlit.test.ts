import { blitPngToCanvas, PendingMatplotlibBuffer } from '../../src/runner/matplotlibBlit';

interface Call {
  fill?: [number, number, number, number];
  fillStyle?: string;
  drawImage?: { dx: number; dy: number; dw: number; dh: number; srcW: number; srcH: number };
}

function mockCanvas(width: number, height: number) {
  const calls: Call[] = [];
  const ctx = {
    fillStyle: '',
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push({ fill: [x, y, w, h], fillStyle: this.fillStyle });
    },
    drawImage(bmp: ImageBitmap, dx: number, dy: number, dw: number, dh: number) {
      calls.push({ drawImage: { dx, dy, dw, dh, srcW: bmp.width, srcH: bmp.height } });
    },
  };
  return {
    canvas: {
      width, height,
      getContext(kind: '2d') { return kind === '2d' ? ctx : null; },
    },
    ctx,
    calls,
  };
}

function fakeBitmap(w: number, h: number): ImageBitmap {
  const closed = { was: false };
  return {
    width: w, height: h,
    close() { closed.was = true; },
  } as unknown as ImageBitmap;
}

class FakeBlob {
  size: number;
  type: string;
  constructor(parts: BlobPart[], opts?: BlobPropertyBag) {
    this.size = (parts[0] as ArrayBuffer).byteLength ?? 0;
    this.type = opts?.type ?? '';
  }
}

describe('blitPngToCanvas — letterboxing math', () => {
  it('scales down and centers a wider-than-canvas image', async () => {
    const { canvas, calls } = mockCanvas(400, 300);
    const res = await blitPngToCanvas(new Uint8Array([1, 2, 3]), canvas, {
      createBitmap: async () => fakeBitmap(800, 400),
      BlobCtor: FakeBlob as unknown as typeof Blob,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // scale = min(400/800, 300/400) = min(0.5, 0.75) = 0.5 → 400×200
    expect(res.dw).toBe(400);
    expect(res.dh).toBe(200);
    // centered vertically → dy=50
    expect(res.dx).toBe(0);
    expect(res.dy).toBe(50);
    // background painted first, then drawImage — checks the letterbox fill happens
    expect(calls[0].fillStyle).toBe('#0a1414');
    expect(calls[0].fill).toEqual([0, 0, 400, 300]);
    expect(calls[1].drawImage).toEqual({ dx: 0, dy: 50, dw: 400, dh: 200, srcW: 800, srcH: 400 });
  });

  it('scales up a small square to fit the smaller axis of a rectangle', async () => {
    const { canvas } = mockCanvas(200, 800);
    const res = await blitPngToCanvas(new Uint8Array([1]), canvas, {
      createBitmap: async () => fakeBitmap(100, 100),
      BlobCtor: FakeBlob as unknown as typeof Blob,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // scale = min(2, 8) = 2 → 200×200
    expect(res.dw).toBe(200);
    expect(res.dh).toBe(200);
    expect(res.dx).toBe(0);
    expect(res.dy).toBe(300); // centered
  });

  it('returns ok:false when canvas is null (nothing drawn)', async () => {
    const res = await blitPngToCanvas(new Uint8Array([1]), null, {
      createBitmap: async () => fakeBitmap(10, 10),
      BlobCtor: FakeBlob as unknown as typeof Blob,
    });
    expect(res).toEqual({ ok: false, reason: 'no-canvas' });
  });

  it('returns ok:false when createBitmap throws (corrupt PNG)', async () => {
    const { canvas } = mockCanvas(100, 100);
    const res = await blitPngToCanvas(new Uint8Array([1]), canvas, {
      createBitmap: async () => { throw new Error('decode failed'); },
      BlobCtor: FakeBlob as unknown as typeof Blob,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe('decode failed');
  });

  it('copies bytes off the source view before decoding (Pyodide memory safety)', async () => {
    // Simulate a source view that gets zeroed after the sync section (Pyodide
    // invalidates memory on await). We keep a reference to the Blob's underlying
    // buffer and confirm the bytes still match the ORIGINAL, not the zeroed view.
    const source = new Uint8Array([9, 8, 7, 6]);
    let capturedBlob: FakeBlob | null = null;
    const { canvas } = mockCanvas(50, 50);
    const p = blitPngToCanvas(source, canvas, {
      createBitmap: async (b) => { capturedBlob = b as unknown as FakeBlob; return fakeBitmap(4, 4); },
      BlobCtor: (class extends FakeBlob {
        parts: BlobPart[];
        constructor(parts: BlobPart[], opts?: BlobPropertyBag) { super(parts, opts); this.parts = parts; }
      }) as unknown as typeof Blob,
    });
    // Zero the source *before* the await resolves.
    source.fill(0);
    await p;
    const owned = new Uint8Array((capturedBlob as unknown as { parts: [ArrayBuffer] }).parts[0]);
    expect(Array.from(owned)).toEqual([9, 8, 7, 6]);
  });
});

describe('PendingMatplotlibBuffer', () => {
  it('buffers pushes and drains in FIFO order, then empties', () => {
    const buf = new PendingMatplotlibBuffer();
    expect(buf.size()).toBe(0);
    const a = new Uint8Array([1]);
    const b = new Uint8Array([2]);
    const c = new Uint8Array([3]);
    buf.push(a); buf.push(b); buf.push(c);
    expect(buf.size()).toBe(3);
    const out = buf.drain();
    expect(out).toEqual([a, b, c]);
    expect(buf.size()).toBe(0);
    // second drain is empty (no leftover references)
    expect(buf.drain()).toEqual([]);
  });

  it('accepts new pushes after a drain (separate batches)', () => {
    const buf = new PendingMatplotlibBuffer();
    buf.push(new Uint8Array([1]));
    buf.drain();
    buf.push(new Uint8Array([9]));
    const out = buf.drain();
    expect(out).toHaveLength(1);
    expect(out[0][0]).toBe(9);
  });
});
