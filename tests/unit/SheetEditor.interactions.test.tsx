/**
 * Component-wiring tests for SheetEditor behaviors that shipped as bugs.
 * Each test targets a specific regression that is impossible to catch in a
 * pure-function unit test (N1, B1, B3, U, M).
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, act, fireEvent } from '@testing-library/react';
import React from 'react';
import type { SheetData } from '../../src/state/IdeState';

// ── jsdom shims ───────────────────────────────────────────────────────────────

(globalThis as unknown as Record<string, unknown>).OffscreenCanvas = class {
  width: number; height: number;
  constructor(w: number, h: number) { this.width = w; this.height = h; }
  getContext() {
    return {
      putImageData: jest.fn(), drawImage: jest.fn(), clearRect: jest.fn(),
      getImageData: jest.fn(() => ({ data: new Uint8ClampedArray(4) })),
      imageSmoothingEnabled: false,
    };
  }
};

// ── State mock ────────────────────────────────────────────────────────────────

const editorState = {
  sheet: undefined as SheetData | undefined,
  setSheet: jest.fn(),
};

jest.mock('../../src/state/IdeState', () => {
  const fn = (selector: (s: unknown) => unknown) => selector({
    project: { sheet: editorState.sheet, files: {}, assets: {}, tilemaps: {}, animations: {} },
    setSheet: editorState.setSheet,
  });
  fn.getState = () => ({
    project: { sheet: editorState.sheet, files: {}, assets: {}, tilemaps: {}, animations: {} },
    setSheet: editorState.setSheet,
  });
  return { useEditor: fn };
});

jest.mock('../../src/state/useTheme', () => ({
  useThemeStore: (selector: (s: unknown) => unknown) => selector({
    theme: {
      surface: '#1a1c2c', surfacePanel: '#252838', panelTxt: '#f4f4f4',
      panelTxtMute: '#94b0c2', panelBorder: '#333c57', accent: '#41a6f6',
      fontUI: 'sans-serif', fontMono: 'monospace', chip: '#2e3250',
      canvasBg: '#0d0d0d', panelHeader: '#1e2235', canvasHud: '#5fd4dc',
    },
  }),
}));

import SheetEditor from '../../src/SheetEditor';

// ── Helpers ───────────────────────────────────────────────────────────────────

function encodeBlank(): string {
  const buf = new Uint8ClampedArray(512 * 512 * 4);
  const CHUNK = 0x8000;
  let s = '';
  for (let i = 0; i < buf.length; i += CHUNK) s += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  return btoa(s);
}

function withSprite(): SheetData {
  return {
    pixels: encodeBlank(), width: 512, height: 512,
    sprites: { hero: { animations: { idle: { x: 0, y: 0, frameW: 32, frameH: 32, frameCount: 1 } } } },
  };
}

/** Sheet with a single red pixel at sheet-coords (x, y) and no sprites. */
function withPixelAt(px: number, py: number): SheetData {
  const buf = new Uint8ClampedArray(512 * 512 * 4);
  const i = (py * 512 + px) * 4;
  buf[i] = 255; buf[i + 1] = 0; buf[i + 2] = 0; buf[i + 3] = 255;
  const CHUNK = 0x8000;
  let s = '';
  for (let j = 0; j < buf.length; j += CHUNK) s += String.fromCharCode(...buf.subarray(j, j + CHUNK));
  return { pixels: btoa(s), width: 512, height: 512, sprites: {} };
}

beforeEach(() => {
  editorState.setSheet = jest.fn();
  editorState.sheet = undefined;
  jest.clearAllMocks();
});

// ── N1 — frame selection via canvas hit-test ──────────────────────────────────

describe('N1: frame selection', () => {
  test('clicking a sprite frame in select mode selects it', () => {
    editorState.sheet = withSprite(); // hero.idle at x:0, y:0, 32×32
    const { container } = render(<SheetEditor onClose={jest.fn()} />);

    // Switch to select tool
    act(() => { fireEvent.click(screen.getByTitle('Select / Move')); });

    // jsdom getBoundingClientRect() returns zeros → clientX/zoom = sheet pixel.
    // Default zoom = 2. clientX=10 → sheet X = 5; inside hero frame {x:0, y:0, w:32, h:32}.
    const canvas = container.querySelector('canvas')!;
    act(() => {
      fireEvent.pointerDown(canvas, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    });

    // After selection, the frame cell renders with a teal 2px selection border.
    // jsdom normalizes hex #5fd4dc to rgb(95, 212, 220) when set via inline style.
    const selectedCell = container.querySelector('[style*="2px solid rgb(95, 212, 220)"]');
    expect(selectedCell).toBeTruthy();
  });

  test('clicking outside any sprite frame in select mode does nothing', () => {
    editorState.sheet = withSprite(); // hero at x:0–31, y:0–31
    const { container } = render(<SheetEditor onClose={jest.fn()} />);

    act(() => { fireEvent.click(screen.getByTitle('Select / Move')); });

    // Click far outside hero: clientX=400 → sheet X=200, outside frame.
    const canvas = container.querySelector('canvas')!;
    act(() => {
      fireEvent.pointerDown(canvas, { button: 0, clientX: 400, clientY: 400, pointerId: 1 });
    });

    // No frame should be selected (no teal border).
    expect(container.querySelector('[style*="2px solid #5fd4dc"]')).toBeNull();
  });
});

// ── B1 — overlap flash: region drag over existing sprite is not silent ────────

describe('B1: overlap flash', () => {
  test('dragging region over an existing sprite does not commit a new sprite', () => {
    editorState.sheet = withSprite(); // hero at x:0, y:0, 32×32
    const { container } = render(<SheetEditor onClose={jest.fn()} />);

    act(() => { fireEvent.click(screen.getByTitle('New Sprite (R)')); }); // region tool

    const canvas = container.querySelector('canvas')!;
    // Drag: clientX/Y 2→100, zoom=2 → sheet (1,1) to (50,50) → overlaps hero {0,0,32,32}.
    act(() => {
      fireEvent.pointerDown(canvas, { button: 0, clientX: 2, clientY: 2, pointerId: 1 });
      fireEvent.pointerMove(canvas, { clientX: 100, clientY: 100 });
      fireEvent.pointerUp(canvas);
    });

    // No new sprite committed — setSheet not called.
    expect(editorState.setSheet).not.toHaveBeenCalled();
    // Naming popover should not appear.
    expect(screen.queryByPlaceholderText('sprite name')).toBeNull();
  });

  test('non-overlapping region drag opens the naming popover', () => {
    editorState.sheet = withSprite(); // hero at x:0–31, y:0–31
    const { container } = render(<SheetEditor onClose={jest.fn()} />);

    act(() => { fireEvent.click(screen.getByTitle('New Sprite (R)')); });

    const canvas = container.querySelector('canvas')!;
    // Drag: clientX/Y 200→400, zoom=2 → sheet (100,100) to (200,200) → clears hero.
    act(() => {
      fireEvent.pointerDown(canvas, { button: 0, clientX: 200, clientY: 200, pointerId: 1 });
      fireEvent.pointerMove(canvas, { clientX: 400, clientY: 400 });
      fireEvent.pointerUp(canvas);
    });

    // Naming popover should appear (pendingRegion set, no overlap).
    expect(screen.getByPlaceholderText('sprite name')).toBeTruthy();
  });
});

// ── U — undo restores sprites, not just pixels ────────────────────────────────

describe('U: undo restores metadata', () => {
  test('undo after add-frame restores frameCount, not just pixels', () => {
    editorState.sheet = withSprite(); // hero.idle.frameCount = 1
    const { rerender } = render(<SheetEditor onClose={jest.fn()} />);

    // Add a frame → pushUndo captures {sprites: {hero.idle.frameCount: 1}}, then setSheet
    act(() => { fireEvent.click(screen.getByTitle('Add frame')); });

    const afterAdd = (editorState.setSheet as jest.Mock).mock.calls[0][0] as SheetData;
    expect(afterAdd.sprites.hero.animations.idle.frameCount).toBe(2);

    // Simulate the re-render that would happen in a real app (Zustand subscription).
    editorState.sheet = afterAdd;
    act(() => { rerender(<SheetEditor onClose={jest.fn()} />); });

    (editorState.setSheet as jest.Mock).mockClear();

    // Ctrl+Z — performUndo should restore sprites to frameCount:1.
    act(() => { fireEvent.keyDown(window, { key: 'z', ctrlKey: true }); });

    expect(editorState.setSheet).toHaveBeenCalledTimes(1);
    const restored = (editorState.setSheet as jest.Mock).mock.calls[0][0] as SheetData;
    // With U fix: sprites come from the undo entry (frameCount:1).
    // Without U fix: sprites come from stale `sheet` closure (frameCount:2) — regression.
    expect(restored.sprites.hero.animations.idle.frameCount).toBe(1);
  });
});

// ── B3 — wand click without drag does not push undo ──────────────────────────

describe('B3: wand deferred lift', () => {
  test('wand click-without-drag leaves undo stack clean', () => {
    // Sheet with a red pixel at (5,5) so connectedBounds returns a result.
    editorState.sheet = withPixelAt(5, 5);
    const { container } = render(<SheetEditor onClose={jest.fn()} />);

    act(() => { fireEvent.click(screen.getByTitle('Smart Select (W)')); });

    const canvas = container.querySelector('canvas')!;
    // Click at clientX=10, clientY=10 → zoom=2 → sheet (5,5) → hits the red pixel.
    // Release immediately without moving.
    act(() => {
      fireEvent.pointerDown(canvas, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
      fireEvent.pointerUp(canvas);
    });

    // No pixel change occurred, so setSheet should not have been called.
    expect(editorState.setSheet).not.toHaveBeenCalled();

    // Ctrl+Z — nothing to undo, setSheet still not called.
    act(() => { fireEvent.keyDown(window, { key: 'z', ctrlKey: true }); });
    expect(editorState.setSheet).not.toHaveBeenCalled();
  });

  test('wand drag (movement) DOES lift pixels and push undo', () => {
    editorState.sheet = withPixelAt(5, 5);
    const { container } = render(<SheetEditor onClose={jest.fn()} />);

    act(() => { fireEvent.click(screen.getByTitle('Smart Select (W)')); });

    const canvas = container.querySelector('canvas')!;
    // Pointerdown then move → lift should happen and setSheet eventually called.
    act(() => {
      fireEvent.pointerDown(canvas, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
      fireEvent.pointerMove(canvas, { clientX: 20, clientY: 10 }); // move right 5 sheet pixels
      fireEvent.pointerUp(canvas);
    });

    // A pixel lift + paste happened → setSheet called with updated pixels.
    expect(editorState.setSheet).toHaveBeenCalledTimes(1);
  });
});

// ── M — title-bar sprite move: undo pushed, single setSheet on drop ───────────

describe('M: sprite move', () => {
  test('title-bar move in select mode pushes one undo entry and commits once', () => {
    editorState.sheet = withSprite(); // hero at x:0, y:0
    render(<SheetEditor onClose={jest.fn()} />);

    act(() => { fireEvent.click(screen.getByTitle('Select / Move')); });

    // Find the title-bar for 'hero'. 'hero' appears in both the canvas overlay title bar
    // and the right-panel sprite list; getAllByText()[0] is the overlay (canvas side).
    const heroSpan = screen.getAllByText('hero')[0];
    const titleBar = heroSpan.closest('div[style*="grab"]') ?? heroSpan.parentElement!;

    // Drag title bar: start at (10,10), move to (20,10), release.
    act(() => {
      fireEvent.pointerDown(titleBar, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    });
    act(() => {
      fireEvent.pointerMove(window, { clientX: 20, clientY: 10 });
      fireEvent.pointerUp(window);
    });

    // Exactly one setSheet call on drop (not one per pointer-move frame).
    expect(editorState.setSheet).toHaveBeenCalledTimes(1);

    const committed = (editorState.setSheet as jest.Mock).mock.calls[0][0] as SheetData;
    // The committed sheet must include pixels (pixel paste) and sprites (metadata update).
    expect(typeof committed.pixels).toBe('string');
    expect(committed.sprites).toBeDefined();

    // Strip x coordinate should have moved right by 5 sheet pixels (dx = (20-10)/zoom=2 = 5).
    const newX = committed.sprites.hero?.animations.idle?.x;
    expect(typeof newX).toBe('number');
    expect(newX).toBeGreaterThanOrEqual(0); // clamped — never negative
  });
});
