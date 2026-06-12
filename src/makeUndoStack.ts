import type { SheetSprites } from "./state/projectTypes";

export type UndoEntry = { pixels: Uint8ClampedArray; sprites: SheetSprites };

function snapshot(pixels: Uint8ClampedArray, sprites: SheetSprites): UndoEntry {
  return { pixels: new Uint8ClampedArray(pixels), sprites: structuredClone(sprites) };
}

export function makeUndoStack(limit = 50) {
  const undo: UndoEntry[] = [];
  const redo: UndoEntry[] = [];

  return {
    push(pixels: Uint8ClampedArray, sprites: SheetSprites) {
      undo.push(snapshot(pixels, sprites));
      if (undo.length > limit) undo.shift();
      redo.length = 0;
    },
    popUndo(currentPixels: Uint8ClampedArray, currentSprites: SheetSprites): UndoEntry | null {
      if (!undo.length) return null;
      redo.push(snapshot(currentPixels, currentSprites));
      return undo.pop()!;
    },
    popRedo(currentPixels: Uint8ClampedArray, currentSprites: SheetSprites): UndoEntry | null {
      if (!redo.length) return null;
      undo.push(snapshot(currentPixels, currentSprites));
      return redo.pop()!;
    },
    // Cancel the last push without creating a redo entry — used when an
    // operation is rolled back immediately (escape during select drag,
    // collision-detected move revert).
    cancelLast() { undo.pop(); },
    canUndo: () => undo.length > 0,
    canRedo: () => redo.length > 0,
  };
}
