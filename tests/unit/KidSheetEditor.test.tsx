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

function frameAlpha(sheet: import("../../src/state/IdeState").SheetData, x: number, y: number): number {
  const strip = sheet.sprites.sprite.animations.idle;
  const buf = decodePixels(sheet.pixels);
  return buf[((strip.y + y) * sheet.width + strip.x + x) * 4 + 3];
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

    fireEvent.click(screen.getByTitle("Animations"));
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

    fireEvent.click(screen.getByTitle("Animations"));
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

  test("brush preview ghost is centered on 3px and 5px brushes", () => {
    const { container } = render(<KidSheetEditor onClose={editorState.onClose} />);
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    mockRect(canvas);
    const ghost = screen.getByTestId("kid-ghost") as HTMLDivElement;

    fireEvent.pointerMove(canvas, { clientX: 55, clientY: 55, pointerId: 1 });
    expect(ghost.style.left).toBe("41px");
    expect(ghost.style.top).toBe("41px");
    expect(ghost.style.width).toBe("30px");

    fireEvent.click(screen.getByTitle("Brush size 5"));
    fireEvent.pointerMove(canvas, { clientX: 55, clientY: 55, pointerId: 1 });
    expect(ghost.style.left).toBe("31px");
    expect(ghost.style.top).toBe("31px");
    expect(ghost.style.width).toBe("50px");
  });

  test("shape preview does not repaint unrelated existing pixels", () => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const fillRect = jest.fn();
    HTMLCanvasElement.prototype.getContext = function (contextId: string) {
      const ctx = originalGetContext.call(this, contextId) as CanvasRenderingContext2D | null;
      if (!ctx) return null;
      return new Proxy(ctx, {
        get(target, prop) {
          if (prop === "fillRect") return fillRect;
          const value = Reflect.get(target, prop);
          return typeof value === "function" ? value.bind(target) : value;
        },
        set(target, prop, value) { return Reflect.set(target, prop, value); },
      });
    } as typeof HTMLCanvasElement.prototype.getContext;

    try {
      const { container } = render(<KidSheetEditor onClose={editorState.onClose} />);
      const canvas = container.querySelector("canvas") as HTMLCanvasElement;
      mockRect(canvas);
      fireEvent.click(screen.getByTitle("Brush size 1"));
      fireEvent.pointerDown(canvas, { clientX: 55, clientY: 55, button: 0, pointerId: 1 });
      fireEvent.pointerUp(canvas, { clientX: 55, clientY: 55, button: 0, pointerId: 1 });

      fillRect.mockClear();
      fireEvent.click(screen.getByTitle("Circle (C)"));
      fireEvent.pointerDown(canvas, { clientX: 205, clientY: 205, button: 0, pointerId: 2 });
      fireEvent.pointerMove(canvas, { clientX: 245, clientY: 245, buttons: 1, pointerId: 2 });

      expect(fillRect).not.toHaveBeenCalledWith(5, 5, 1, 1);
      fireEvent.pointerUp(canvas, { clientX: 245, clientY: 245, button: 0, pointerId: 2 });
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    }
  });

  test("fast pencil movement paints a continuous stroke", () => {
    const { container } = render(<KidSheetEditor onClose={editorState.onClose} />);
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    mockRect(canvas);
    fireEvent.click(screen.getByTitle("Brush size 1"));

    fireEvent.pointerDown(canvas, { clientX: 25, clientY: 105, button: 0, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 205, clientY: 105, buttons: 1, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 205, clientY: 105, button: 0, pointerId: 1 });
    fireEvent.click(screen.getByText("Done"));

    const sheet = editorState.setSheet.mock.calls[0][0] as import("../../src/state/IdeState").SheetData;
    expect(Array.from({ length: 64 }, (_, x) => frameAlpha(sheet, x, 10)).filter(Boolean)).toHaveLength(19);
  });

  test("releasing outside the canvas prevents phantom painting on re-entry", () => {
    const { container } = render(<KidSheetEditor onClose={editorState.onClose} />);
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    mockRect(canvas);
    fireEvent.click(screen.getByTitle("Brush size 1"));

    fireEvent.pointerDown(canvas, { clientX: 25, clientY: 25, button: 0, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 35, clientY: 35, buttons: 1, pointerId: 1 });
    fireEvent.pointerUp(window, { buttons: 0, pointerId: 1 });
    fireEvent.pointerMove(canvas, { clientX: 85, clientY: 85, buttons: 0, pointerId: 1 });
    fireEvent.click(screen.getByText("Done"));

    const sheet = editorState.setSheet.mock.calls[0][0] as import("../../src/state/IdeState").SheetData;
    expect(frameAlpha(sheet, 8, 8)).toBe(0);
  });

  test("resize clears incompatible undo history instead of corrupting the frame", () => {
    const { container } = render(<KidSheetEditor onClose={editorState.onClose} />);
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    mockRect(canvas);
    fireEvent.pointerDown(canvas, { clientX: 55, clientY: 55, button: 0, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 55, clientY: 55, button: 0, pointerId: 1 });

    fireEvent.change(screen.getByLabelText("Canvas size"), { target: { value: "32" } });
    fireEvent.click(screen.getByText("Scale drawing"));
    fireEvent.click(screen.getByTitle("Undo (Ctrl+Z)"));
    fireEvent.click(screen.getByText("Done"));

    expect(editorState.setSheet).toHaveBeenCalledTimes(1);
    const sheet = editorState.setSheet.mock.calls[0][0] as import("../../src/state/IdeState").SheetData;
    expect(sheet.sprites.sprite.animations.idle.frameW).toBe(32);
    expect(editorState.onClose).toHaveBeenCalledTimes(1);
  });

  test("animation drawer replaces the color panel while canvas size stays in the toolbar", () => {
    render(<KidSheetEditor onClose={editorState.onClose} />);
    expect(screen.queryByRole("button", { name: "Hide animation menu" })).toBeNull();
    expect(screen.getByLabelText("Canvas size")).toBeInTheDocument();
    expect(screen.getByText("Colors")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Animations"));
    expect(screen.queryByText("Colors")).toBeNull();
    expect(screen.getByLabelText("Canvas size")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide animation menu" }));
    expect(screen.queryByRole("button", { name: "Hide animation menu" })).toBeNull();
    expect(screen.getByText("Colors")).toBeInTheDocument();
  });

  test("palette is visually ordered and color mixing stays inline", () => {
    render(<KidSheetEditor onClose={editorState.onClose} />);
    const swatches = screen.getAllByTitle(/^#[0-9a-f]{6}/i);
    expect(swatches).toHaveLength(19);
    expect(swatches.slice(0, 8).map((s) => s.getAttribute("title")?.split(" — ")[1])).toEqual([
      "black", "wine", "red", "orange", "yellow", "lime", "green", "teal",
    ]);

    fireEvent.click(screen.getByText("Mix colors"));
    fireEvent.click(screen.getByTitle("#1a1c2c — black"));
    fireEvent.click(screen.getByTitle("#f4f4f4 — white"));
    const mixed = screen.getAllByTitle("Mixed color");
    expect(mixed).toHaveLength(10);
    fireEvent.click(mixed[5]);
    expect(screen.getByText("My colors")).toBeTruthy();
    fireEvent.click(screen.getByText("Mix colors"));
    expect(screen.queryAllByTitle("Mixed color")).toHaveLength(0);
  });
});
