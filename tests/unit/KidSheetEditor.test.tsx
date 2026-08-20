/**
 * KidSheetEditor smoke tests: renders, draws a pixel, adds frames and
 * animations, and writes the packed sheet back through setSheet on Done.
 */
import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

const editorState = {
  sheet: undefined as import("../../src/state/IdeState").SheetData | undefined,
  setSheet: jest.fn(),
  onClose: jest.fn(),
};

jest.mock("../../src/state/IdeState", () => {
  const fn = (selector: (s: unknown) => unknown) =>
    selector({
      project: {
        sheet: editorState.sheet,
        files: {},
        assets: {},
        tilemaps: {},
        animations: {},
      },
      setSheet: editorState.setSheet,
    });
  fn.getState = () => ({
    project: { sheet: editorState.sheet, files: {}, assets: {}, tilemaps: {}, animations: {} },
    setSheet: editorState.setSheet,
  });
  return { useEditor: fn };
});

jest.mock("../../src/state/useTheme", () => ({
  useThemeStore: (selector: (s: unknown) => unknown) =>
    selector({
      theme: {
        surface: "#1a1c2c", surfacePanel: "#252838", panelTxt: "#f4f4f4",
        panelTxtMute: "#94b0c2", panelBorder: "#333c57", accent: "#41a6f6",
        fontUI: "sans-serif", fontMono: "monospace", chip: "#2e3250",
      },
    }),
}));

import KidSheetEditor from "../../src/KidSheetEditor";
import { blankSheet, decodePixels } from "../../src/sheetPixels";

function mockRect(canvas: HTMLCanvasElement, px = 640) {
  Object.defineProperty(canvas, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      left: 0, top: 0, right: px, bottom: px, width: px, height: px,
      x: 0, y: 0, toJSON: () => ({}),
    }),
  });
}

function paintedPixels(sheet: import("../../src/state/IdeState").SheetData): number {
  const buf = decodePixels(sheet.pixels);
  let n = 0;
  for (let i = 3; i < buf.length; i += 4) if (buf[i] > 0) n++;
  return n;
}

describe("KidSheetEditor", () => {
  beforeEach(() => {
    editorState.sheet = blankSheet();
    editorState.setSheet.mockClear();
    editorState.onClose.mockClear();
  });

  test("renders and draws a pixel that persists on Done", () => {
    const { container } = render(<KidSheetEditor onClose={editorState.onClose} />);
    expect(screen.getByText("Sprite editor")).toBeTruthy();

    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    expect(canvas).toBeTruthy();
    mockRect(canvas);

    // draw at cell (5,5) on a 64×64 canvas (640px display → 10px cells)
    fireEvent.pointerDown(canvas, { clientX: 55, clientY: 55, button: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 55, clientY: 55, button: 0, pointerId: 1 });

    fireEvent.click(screen.getByText("Done"));
    expect(editorState.setSheet).toHaveBeenCalledTimes(1);
    const sheet = editorState.setSheet.mock.calls[0][0] as import("../../src/state/IdeState").SheetData;
    expect(sheet.sprites["sprite"].animations.idle.frameCount).toBe(1);
    expect(paintedPixels(sheet)).toBeGreaterThan(0);
    expect(editorState.onClose).toHaveBeenCalledTimes(1);
  });

  test("adding frames increases the saved frameCount", () => {
    const { container } = render(<KidSheetEditor onClose={editorState.onClose} />);
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    mockRect(canvas);

    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, button: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 10, clientY: 10, button: 0, pointerId: 1 });

    const add = screen.getAllByText("Add");
    expect(add.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(add[0]);
    fireEvent.click(add[0]);

    fireEvent.click(screen.getByText("Done"));
    const sheet = editorState.setSheet.mock.calls[0][0] as import("../../src/state/IdeState").SheetData;
    expect(sheet.sprites["sprite"].animations.idle.frameCount).toBe(3);
  });

  test("adding a named animation creates a second strip", () => {
    render(<KidSheetEditor onClose={editorState.onClose} />);

    fireEvent.click(screen.getByText("New"));
    const input = screen.getByPlaceholderText("walk");
    fireEvent.change(input, { target: { value: "run" } });
    fireEvent.click(screen.getByText("OK"));

    fireEvent.click(screen.getByText("Done"));
    const sheet = editorState.setSheet.mock.calls[0][0] as import("../../src/state/IdeState").SheetData;
    const anims = sheet.sprites["sprite"].animations;
    expect(Object.keys(anims).sort()).toEqual(["idle", "run"]);
    expect(anims.run.frameCount).toBe(1);
  });

  test("Ctrl+Z undo works on a stroke", () => {
    const { container } = render(<KidSheetEditor onClose={editorState.onClose} />);
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    mockRect(canvas);

    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 30, button: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 30, clientY: 30, button: 0, pointerId: 1 });
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });

    fireEvent.click(screen.getByText("Done"));
    const sheet = editorState.setSheet.mock.calls[0][0] as import("../../src/state/IdeState").SheetData;
    expect(paintedPixels(sheet)).toBe(0);
  });
});
