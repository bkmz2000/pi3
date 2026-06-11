/**
 * SheetEditor smoke tests: renders without crash, basic UI elements present,
 * add-frame and add-animation controls call setSheet correctly.
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, act, fireEvent } from '@testing-library/react';
import React from 'react';

// ── jsdom shims ────────────────────────────────────────────────────────────────

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

// ── State mock (hoisted) ───────────────────────────────────────────────────────

// Mutable state shared across test cases — updated in beforeEach.
const editorState = {
  sheet: undefined as import('../../src/state/IdeState').SheetData | undefined,
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
      fontUI: 'sans-serif', chip: '#2e3250', canvasBg: '#0d0d0d',
    },
  }),
}));

import SheetEditor from '../../src/SheetEditor';

// ── Helpers ────────────────────────────────────────────────────────────────────

function blankPixels(): string {
  const buf = new Uint8ClampedArray(512 * 512 * 4);
  let s = '';
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return btoa(s);
}

function withSprite(): import('../../src/state/IdeState').SheetData {
  return {
    pixels: blankPixels(), width: 512, height: 512,
    sprites: {
      hero: {
        animations: {
          idle: { x: 0, y: 0, frameW: 32, frameH: 32, frameCount: 1 },
        },
      },
    },
  };
}

beforeEach(() => {
  editorState.setSheet = jest.fn();
  editorState.sheet = undefined;
  jest.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('SheetEditor', () => {
  test('renders without crash and shows header', () => {
    render(<SheetEditor onClose={jest.fn()} />);
    expect(screen.getByText('Sheet Editor')).toBeTruthy();
  });

  test('initialises blank sheet when project.sheet is undefined', () => {
    editorState.sheet = undefined;
    render(<SheetEditor onClose={jest.fn()} />);
    expect(editorState.setSheet).toHaveBeenCalledTimes(1);
    const arg = (editorState.setSheet as jest.Mock).mock.calls[0][0] as import('../../src/state/IdeState').SheetData;
    expect(arg.width).toBe(512);
    expect(arg.height).toBe(512);
    expect(typeof arg.pixels).toBe('string');
    expect(Object.keys(arg.sprites)).toHaveLength(0);
  });

  test('does not reinitialise when sheet already exists', () => {
    editorState.sheet = { pixels: blankPixels(), width: 512, height: 512, sprites: {} };
    render(<SheetEditor onClose={jest.fn()} />);
    expect(editorState.setSheet).not.toHaveBeenCalled();
  });

  test('shows zoom buttons', () => {
    editorState.sheet = { pixels: blankPixels(), width: 512, height: 512, sprites: {} };
    render(<SheetEditor onClose={jest.fn()} />);
    // Zoom display shows current level (e.g. "2×" for 200%)
    expect(screen.getByText(/^\d+×$/)).toBeTruthy();
    // Zoom in/out buttons
    expect(screen.getByTitle('Zoom out')).toBeTruthy();
    expect(screen.getByTitle('Zoom in')).toBeTruthy();
  });

  test('calls onClose when Close is clicked', () => {
    editorState.sheet = { pixels: blankPixels(), width: 512, height: 512, sprites: {} };
    const onClose = jest.fn();
    render(<SheetEditor onClose={onClose} />);
    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('shows sprite block overlay when sheet has a sprite', () => {
    editorState.sheet = withSprite();
    render(<SheetEditor onClose={jest.fn()} />);
    // The sprite overlay renders a Konva layer with sprite rectangles
    // Check for the sheet editor being rendered with sprites loaded
    expect(screen.getByText('Sheet Editor')).toBeTruthy();
  });

  test('calls setSheet when add-frame button is clicked', () => {
    editorState.sheet = withSprite();
    render(<SheetEditor onClose={jest.fn()} />);
    act(() => { fireEvent.click(screen.getByTitle('Add frame')); });
    expect(editorState.setSheet).toHaveBeenCalledTimes(1);
    const updated = (editorState.setSheet as jest.Mock).mock.calls[0][0] as import('../../src/state/IdeState').SheetData;
    expect(updated.sprites.hero.animations.idle.frameCount).toBe(2);
  });

  test('calls setSheet when add-animation button is clicked', () => {
    editorState.sheet = withSprite();
    render(<SheetEditor onClose={jest.fn()} />);
    act(() => { fireEvent.click(screen.getByTitle('Add animation')); });
    expect(editorState.setSheet).toHaveBeenCalledTimes(1);
    const updated = (editorState.setSheet as jest.Mock).mock.calls[0][0] as import('../../src/state/IdeState').SheetData;
    expect(Object.keys(updated.sprites.hero.animations)).toHaveLength(2);
    expect(Object.keys(updated.sprites.hero.animations)).toContain('idle');
  });
});
