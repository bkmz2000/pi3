/**
 * Smoke test for the lightmap rendering commands.
 *
 * Exercises the three new draw-command cases (`light_begin`, `light_poly`,
 * `light_end`) via the exported `executeDrawCommands` dispatcher. Verifies the
 * dispatcher does not throw and that key canvas calls happen as expected.
 */

import { executeDrawCommands } from '../../src/runner/canvasRenderer';

type Call = { method: string; args: unknown[] };

function makeMockCtx(): { ctx: OffscreenCanvasRenderingContext2D; calls: Call[] } {
  const calls: Call[] = [];
  const transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const handler: ProxyHandler<object> = {
    get(_t, prop) {
      if (prop === 'getTransform') return () => transform;
      if (prop === 'setTransform') {
        return (a: number, b: number, c: number, d: number, e: number, f: number) => {
          transform.a = a; transform.b = b; transform.c = c;
          transform.d = d; transform.e = e; transform.f = f;
          calls.push({ method: 'setTransform', args: [a, b, c, d, e, f] });
        };
      }
      if (prop === 'createRadialGradient') {
        return () => ({ addColorStop: () => {} });
      }
      // Capture every other call as a no-op.
      return (...args: unknown[]) => {
        calls.push({ method: String(prop), args });
      };
    },
    set(_t, prop, value) {
      calls.push({ method: `set:${String(prop)}`, args: [value] });
      return true;
    },
  };
  // OffscreenCanvasRenderingContext2D isn't constructible in jsdom; the Proxy
  // is just a stub that records calls.
  return { ctx: new Proxy({}, handler) as unknown as OffscreenCanvasRenderingContext2D, calls };
}

// Stub OffscreenCanvas if absent (jsdom doesn't ship it).
beforeAll(() => {
  if (typeof (globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas === 'undefined') {
    class StubOffscreenCanvas {
      width: number;
      height: number;
      constructor(w: number, h: number) {
        this.width = w;
        this.height = h;
      }
      getContext() {
        return makeMockCtx().ctx;
      }
    }
    (globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = StubOffscreenCanvas;
  }
});

describe('lightmap draw commands', () => {
  it('runs light_begin / light_poly / light_end without throwing', () => {
    const { ctx } = makeMockCtx();
    const commands: unknown[] = [
      ['light_begin', [30, 30, 50], {}],
      ['light_poly', [[10, 10, 50, 10, 50, 50, 10, 50], 30, 30, 40, [255, 200, 140], 1.0], {}],
      ['light_end', [], {}],
    ];

    expect(() =>
      executeDrawCommands(ctx, commands, {}, {}, 200, 200),
    ).not.toThrow();
  });

  it('composites the lightmap with soft-light by default (HSL-like mode)', () => {
    const { ctx, calls } = makeMockCtx();
    const commands: unknown[] = [
      ['light_begin', [0, 0, 0], {}],
      ['light_end', [], {}],
    ];
    executeDrawCommands(ctx, commands, {}, {}, 100, 100);
    const composite = calls.find((c) => c.method === 'set:globalCompositeOperation');
    expect(composite?.args[0]).toBe('soft-light');
    expect(calls.some((c) => c.method === 'drawImage')).toBe(true);
  });

  it('composites with multiply when mode="overlay" (legacy)', () => {
    const { ctx, calls } = makeMockCtx();
    const commands: unknown[] = [
      ['light_begin', [0, 0, 0], {}],
      ['light_end', ['overlay'], {}],
    ];
    executeDrawCommands(ctx, commands, {}, {}, 100, 100);
    const composite = calls.find((c) => c.method === 'set:globalCompositeOperation');
    expect(composite?.args[0]).toBe('multiply');
  });

  it('handles light_poly with empty polygon gracefully', () => {
    const { ctx } = makeMockCtx();
    const commands: unknown[] = [
      ['light_begin', [10, 10, 10], {}],
      ['light_poly', [[], 50, 50, 30, [255, 255, 255], 1.0], {}],
      ['light_end', [], {}],
    ];
    expect(() =>
      executeDrawCommands(ctx, commands, {}, {}, 100, 100),
    ).not.toThrow();
  });
});
