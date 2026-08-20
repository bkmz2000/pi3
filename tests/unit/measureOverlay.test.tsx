/**
 * MeasureOverlay: the ruler/measure tool on the canvas window. Verifies
 * tick generation (nice 1/2/5 steps), the cursor crosshair + coordinate
 * label, and the drag measurement (distance + bearing) label.
 */
import { describe, test, expect } from '@jest/globals';
import { render, cleanup, act } from '@testing-library/react';
import React from 'react';

import { MeasureOverlay } from '../../src/components/MeasureOverlay';

const theme = {
  fontMono: 'monospace',
  accent: '#0ea5e9',
};

function makeCanvas() {
  const el = document.createElement('canvas');
  el.getBoundingClientRect = () => ({ left: 10, top: 10, width: 400, height: 300, right: 410, bottom: 310, x: 10, y: 10, toJSON: () => ({}) }) as DOMRect;
  return { current: el };
}

function fireMouse(canvas: HTMLElement, type: string, x: number, y: number) {
  const ev = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
  act(() => { canvas.dispatchEvent(ev); });
}

afterEach(cleanup);

describe('MeasureOverlay', () => {
  test('renders nothing when inactive', () => {
    const { container } = render(
      <MeasureOverlay canvasRef={makeCanvas()} w={400} h={300} visualScale={1} canvasScale={1} active={false} theme={theme as never} />,
    );
    expect(container.firstChild).toBeNull();
  });

  test('renders rulers with major/minor ticks when active', () => {
    const { container } = render(
      <MeasureOverlay canvasRef={makeCanvas()} w={400} h={300} visualScale={1} canvasScale={1} active theme={theme as never} />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    // A 400px canvas at scale 1 with ~60px major ticks → minor step ~12,
    // so ~34 x-ticks and ~25 y-ticks.
    const lines = svg!.querySelectorAll('line');
    expect(lines.length).toBeGreaterThan(30);
  });

  test('shows cursor coordinates on mousemove', () => {
    const canvas = makeCanvas();
    const { container } = render(
      <MeasureOverlay canvasRef={canvas} w={400} h={300} visualScale={1} canvasScale={1} active theme={theme as never} />,
    );
    // clientX=110, clientY=60 → buffer (100, 50) at canvasScale 1.
    fireMouse(canvas.current, 'mousemove', 110, 60);
    expect(container.textContent).toContain('100, 50');
  });

  test('shows distance + bearing label while dragging', () => {
    const canvas = makeCanvas();
    const { container } = render(
      <MeasureOverlay canvasRef={canvas} w={400} h={300} visualScale={1} canvasScale={1} active theme={theme as never} />,
    );
    // Drag from buffer (0,0) to (30, 40) → dist 50, bearing ~53.1°.
    fireMouse(canvas.current, 'mousedown', 10, 10);
    fireMouse(canvas.current, 'mousemove', 40, 50);
    expect(container.textContent).toContain('50px');
  });

  test('clears cursor on mouseleave', () => {
    const canvas = makeCanvas();
    const { container } = render(
      <MeasureOverlay canvasRef={canvas} w={400} h={300} visualScale={1} canvasScale={1} active theme={theme as never} />,
    );
    fireMouse(canvas.current, 'mousemove', 110, 60);
    expect(container.textContent).toContain('100, 50');
    fireMouse(canvas.current, 'mouseleave', 0, 0);
    expect(container.textContent).not.toContain('100, 50');
  });
});