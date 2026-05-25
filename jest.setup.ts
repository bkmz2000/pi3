import '@testing-library/jest-dom';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// jsdom does not implement OffscreenCanvas or ImageData. Light stubs that
// expose the surface area used by canvas-touching components.
if (typeof (globalThis as unknown as { ImageData: unknown }).ImageData === 'undefined') {
  class StubImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    constructor(data: Uint8ClampedArray, width: number, height: number) {
      this.data = data;
      this.width = width;
      this.height = height;
    }
  }
  (globalThis as unknown as { ImageData: unknown }).ImageData = StubImageData;
}
if (typeof (globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas === 'undefined') {
  class StubOffscreenCanvas {
    width: number;
    height: number;
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
    getContext(): unknown {
      return HTMLCanvasElement.prototype.getContext.call(
        document.createElement('canvas'),
        '2d',
      );
    }
    async convertToBlob(): Promise<Blob> {
      return new Blob([], { type: 'image/png' });
    }
  }
  (globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = StubOffscreenCanvas;
}

// jsdom does not implement HTMLCanvasElement.getContext — returns null and
// any caller that doesn't bounds-check will crash. Stub a chainable 2D
// context so smoke-render tests can mount canvas-using components without
// pulling in a heavy node-canvas dependency.
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    contextId: string,
  ): unknown {
    if (contextId !== '2d') return null;
    const noop = () => undefined;
    return new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'getImageData') {
            return (_sx: number, _sy: number, w: number, h: number) => ({
              data: new Uint8ClampedArray(Math.max(1, w * h * 4)),
              width: w,
              height: h,
            });
          }
          if (prop === 'createImageData') {
            return (w: number, h: number) => ({
              data: new Uint8ClampedArray(Math.max(1, w * h * 4)),
              width: w,
              height: h,
            });
          }
          if (prop === 'measureText') {
            return (s: string) => ({ width: s.length * 8 });
          }
          if (prop === 'createRadialGradient' || prop === 'createLinearGradient') {
            return () => ({ addColorStop: noop });
          }
          if (prop === 'getTransform') {
            return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
          }
          // Property accessors that get set (fillStyle, font, etc.) — return
          // undefined so setters land on the Proxy as no-ops.
          if (typeof prop === 'string' && /^(fillStyle|strokeStyle|lineWidth|font|globalAlpha|globalCompositeOperation|imageSmoothingEnabled|textAlign|textBaseline)$/.test(prop)) {
            return undefined;
          }
          return noop;
        },
        set() {
          return true;
        },
      },
    );
  } as typeof HTMLCanvasElement.prototype.getContext;
}
// jsdom strips TextEncoder/TextDecoder. The naive `util` polyfill produces a
// Uint8Array tied to Node's global realm — JSZip's `instanceof Uint8Array`
// check fails against jsdom's window.Uint8Array. Wrap explicitly via the
// current realm's Uint8Array constructor to keep both happy.
if (typeof globalThis.TextEncoder === 'undefined') {
  class JsdomTextEncoder {
    readonly encoding = 'utf-8';
    encode(input: string): Uint8Array {
      const buf = Buffer.from(input ?? '', 'utf-8');
      return new Uint8Array(buf);
    }
    encodeInto(_src: string, _dest: Uint8Array): { read: number; written: number } {
      return { read: 0, written: 0 };
    }
  }
  (globalThis as unknown as { TextEncoder: unknown }).TextEncoder = JsdomTextEncoder;
}
if (typeof globalThis.TextDecoder === 'undefined') {
  class JsdomTextDecoder {
    readonly encoding: string;
    readonly fatal = false;
    readonly ignoreBOM = false;
    constructor(label: string = 'utf-8') {
      this.encoding = label;
    }
    decode(input?: BufferSource): string {
      if (!input) return '';
      const u8 = input instanceof Uint8Array ? input : new Uint8Array(input as ArrayBuffer);
      return Buffer.from(u8).toString('utf-8');
    }
  }
  (globalThis as unknown as { TextDecoder: unknown }).TextDecoder = JsdomTextDecoder;
}

Object.defineProperty(globalThis, 'import.meta', {
  value: {
    env: {
      VITE_API_URL: '',
    },
  },
});

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: {} },
    ru: { translation: {} },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});
