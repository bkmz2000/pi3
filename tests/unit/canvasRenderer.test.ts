import { executeDrawCommands } from '../../src/runner/canvasRenderer';

function makeCtx() {
  return {
    save: jest.fn(),
    restore: jest.fn(),
    setTransform: jest.fn(),
    translate: jest.fn(),
    rotate: jest.fn(),
    scale: jest.fn(),
    beginPath: jest.fn(),
    arc: jest.fn(),
    ellipse: jest.fn(),
    rect: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
    fillRect: jest.fn(),
    fillText: jest.fn(),
    drawImage: jest.fn(),
    getTransform: jest.fn(() => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })),
    measureText: jest.fn(() => ({ width: 50 })),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '16px sans-serif',
    textAlign: 'start' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
  } as unknown as OffscreenCanvasRenderingContext2D & { [k: string]: jest.Mock | unknown };
}

const fakeBitmap = (w = 32, h = 32) =>
  ({ width: w, height: h, close: () => {} }) as unknown as ImageBitmap;

// jsdom does not provide OffscreenCanvas or ImageData; the "sprite" draw
// path uses both. Stub them just enough that executeDrawCommands can run.
class FakeImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}
class FakeOffscreenCanvas {
  width: number;
  height: number;
  putCalls: unknown[] = [];
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
  getContext() {
    return {
      putImageData: (img: FakeImageData) => {
        this.putCalls.push(img);
      },
    };
  }
}
(globalThis as unknown as { ImageData: unknown }).ImageData = FakeImageData;
(globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = FakeOffscreenCanvas;

describe('executeDrawCommands', () => {
  it('background fills canvas with color reset to identity transform', () => {
    const ctx = makeCtx();
    executeDrawCommands(ctx, [['background', [10, 20, 30]]], {}, {}, 100, 80);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 100, 80);
    expect(ctx.restore).toHaveBeenCalled();
    expect((ctx as unknown as { fillStyle: string }).fillStyle).toBe('rgb(10,20,30)');
  });

  it('background_image stretches asset to canvas when found', () => {
    const ctx = makeCtx();
    const bm = fakeBitmap();
    executeDrawCommands(
      ctx,
      [['background_image', ['sky']]],
      { sky: bm },
      {},
      200,
      150,
    );
    expect(ctx.drawImage).toHaveBeenCalledWith(bm, 0, 0, 200, 150);
  });

  it('background_image no-ops when asset is missing', () => {
    const ctx = makeCtx();
    executeDrawCommands(ctx, [['background_image', ['missing']]], {}, {}, 100, 80);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('image looks up by name and .png/.svg fallback', () => {
    const ctx = makeCtx();
    const bm = fakeBitmap();
    executeDrawCommands(
      ctx,
      [['image', ['ship', 10, 20, 30, 40]]],
      { 'ship.svg': bm },
      {},
      100,
      80,
    );
    expect(ctx.drawImage).toHaveBeenCalledWith(bm, 10, 20, 30, 40);
  });

  it('image without w/h uses 2-arg drawImage', () => {
    const ctx = makeCtx();
    const bm = fakeBitmap();
    executeDrawCommands(
      ctx,
      [['image', ['ship', 5, 6, null, null]]],
      { ship: bm },
      {},
      100,
      80,
    );
    expect(ctx.drawImage).toHaveBeenCalledWith(bm, 5, 6);
  });

  it('image_centered centers on x,y with default size from bitmap', () => {
    const ctx = makeCtx();
    const bm = fakeBitmap(40, 20);
    executeDrawCommands(
      ctx,
      [['image_centered', ['s', 100, 50, null, null]]],
      { s: bm },
      {},
      200,
      200,
    );
    expect(ctx.drawImage).toHaveBeenCalledWith(bm, 80, 40, 40, 20);
  });

  it('sprite paints RGBA buffer through an OffscreenCanvas to honour transforms', () => {
    const ctx = makeCtx();
    const pixels = new Uint8Array(2 * 1 * 4);
    pixels.set([255, 0, 0, 255, 0, 255, 0, 255]);
    executeDrawCommands(
      ctx,
      [['sprite', [pixels, 2, 1, 10, 20, null, null]]],
      {},
      {},
      100,
      80,
    );
    // 2-arg drawImage when no explicit size — the offscreen carrier is the source.
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.any(FakeOffscreenCanvas), 10, 20);
    const [bm] = (ctx.drawImage as jest.Mock).mock.calls[0] as [FakeOffscreenCanvas];
    expect(bm.width).toBe(2);
    expect(bm.height).toBe(1);
    expect(bm.putCalls).toHaveLength(1);
  });

  it('sprite scales to (w, h) when provided', () => {
    const ctx = makeCtx();
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    executeDrawCommands(
      ctx,
      [['sprite', [pixels, 4, 4, 0, 0, 32, 32]]],
      {},
      {},
      100,
      80,
    );
    expect(ctx.drawImage).toHaveBeenCalledWith(expect.any(FakeOffscreenCanvas), 0, 0, 32, 32);
  });

  it('sprite no-ops on length mismatch (corrupt buffer)', () => {
    const ctx = makeCtx();
    const pixels = new Uint8Array(3);
    executeDrawCommands(
      ctx,
      [['sprite', [pixels, 4, 4, 0, 0, null, null]]],
      {},
      {},
      100,
      80,
    );
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('animation_frame draws frame from animation by index (modulo)', () => {
    const ctx = makeCtx();
    const f0 = fakeBitmap();
    const f1 = fakeBitmap();
    executeDrawCommands(
      ctx,
      [['animation_frame', ['run', 3, 10, 20, null, null]]],
      {},
      { run: { frames: [f0, f1], fps: 8 } },
      100,
      80,
    );
    expect(ctx.drawImage).toHaveBeenCalledWith(f1, 10, 20);
  });

  it('animation_frame no-ops on unknown animation', () => {
    const ctx = makeCtx();
    executeDrawCommands(
      ctx,
      [['animation_frame', ['nope', 0, 0, 0, null, null]]],
      {},
      {},
      100,
      80,
    );
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('shape primitives dispatch beginPath + fill/stroke', () => {
    const ctx = makeCtx();
    executeDrawCommands(
      ctx,
      [
        ['circle', [10, 20, 5]],
        ['rect', [0, 0, 30, 40]],
        ['line', [0, 0, 10, 10]],
        ['ellipse', [50, 50, 20, 10]],
        ['point', [3, 3]],
      ],
      {},
      {},
      100,
      80,
    );
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.rect).toHaveBeenCalledWith(0, 0, 30, 40);
    expect(ctx.lineTo).toHaveBeenCalledWith(10, 10);
    expect(ctx.ellipse).toHaveBeenCalled();
    expect(ctx.beginPath).toHaveBeenCalledTimes(5);
  });

  it('fill / no_fill / stroke / no_stroke / stroke_width set state', () => {
    const ctx = makeCtx();
    executeDrawCommands(
      ctx,
      [
        ['fill', [1, 2, 3]],
        ['stroke', [4, 5, 6]],
        ['stroke_width', [7]],
        ['no_fill', []],
        ['no_stroke', []],
      ],
      {},
      {},
      100,
      80,
    );
    expect((ctx as unknown as { lineWidth: number }).lineWidth).toBe(7);
    expect((ctx as unknown as { fillStyle: string }).fillStyle).toBe('rgba(0,0,0,0)');
    expect((ctx as unknown as { strokeStyle: string }).strokeStyle).toBe('rgba(0,0,0,0)');
  });

  it('push/pop/translate/rotate/scale forward to ctx', () => {
    const ctx = makeCtx();
    executeDrawCommands(
      ctx,
      [
        ['push', []],
        ['translate', [10, 20]],
        ['rotate', [180]],
        ['scale', [2, 3]],
        ['pop', []],
      ],
      {},
      {},
      100,
      80,
    );
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.translate).toHaveBeenCalledWith(10, 20);
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI);
    expect(ctx.scale).toHaveBeenCalledWith(2, 3);
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('tilemap_layer draws each visible cell at col*tileSize', () => {
    const ctx = makeCtx();
    const stone = fakeBitmap(32, 32);
    executeDrawCommands(
      ctx,
      [['tilemap_layer', [[[0, 0, 'stone'], [1, 0, 'stone', 0]], 32, 0, 0]]],
      { stone },
      {},
      200,
      200,
    );
    expect(ctx.drawImage).toHaveBeenNthCalledWith(1, stone, 0, 0, 32, 32);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(2, stone, 32, 0, 32, 32);
    expect(ctx.rotate).not.toHaveBeenCalled();
  });

  it('tilemap_layer rotates around tile center when rotation is non-zero', () => {
    const ctx = makeCtx();
    const stone = fakeBitmap(32, 32);
    executeDrawCommands(
      ctx,
      [['tilemap_layer', [[[2, 3, 'stone', 90]], 32, 0, 0]]],
      { stone },
      {},
      200,
      200,
    );
    // Translate to tile center (2*32 + 16, 3*32 + 16) = (80, 112), rotate 90°, draw centered.
    expect(ctx.translate).toHaveBeenCalledWith(80, 112);
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 2);
    expect(ctx.drawImage).toHaveBeenCalledWith(stone, -16, -16, 32, 32);
  });

  it('text + text_size + text_align', () => {
    const ctx = makeCtx();
    executeDrawCommands(
      ctx,
      [
        ['text_size', [24]],
        ['text_align', ['center', 'middle']],
        ['text', ['hi', 50, 50]],
      ],
      {},
      {},
      100,
      80,
    );
    expect((ctx as unknown as { font: string }).font).toBe('24px sans-serif');
    expect((ctx as unknown as { textAlign: string }).textAlign).toBe('center');
    expect(ctx.fillText).toHaveBeenCalledWith('hi', 50, 50);
  });
});
