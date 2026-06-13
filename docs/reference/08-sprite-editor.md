# Sheet Editor (Pixel Sprite Editor) Reference

**Verified against:** `src/SheetEditor.tsx`, `src/sheetPixels.ts`, `src/sheetGeometry.ts` at HEAD

> **Note:** The earlier "Sprite Editor" was a Konva-based vector editor (`SpriteEditor.tsx`) that has been removed. The current editor (`SheetEditor.tsx`) is a pixel editor. This doc describes the pixel editor.

---

## Overview

`SheetEditor` is a pixel art editor that manages a shared **512 × 512 RGBA canvas** (the "sheet") containing all of a project's sprites and animation strips. Each named sprite occupies a rectangular region on the sheet; animation frames are horizontal strips within that region.

The sheet is stored in `project.sheet` (`SheetData`) and round-trips through the server as sparse-chunk-encoded data (see `sheetCodec.ts`).

---

## Component

```typescript
// Opened via AssetEditor.tsx
// Reads/writes: useEditor().project.sheet via useEditor().setSheet(data)
```

`SheetEditor` is a modal-style full-screen overlay. It is the leaf editor dispatched from `AssetEditor.tsx` when editing sprites.

---

## Color palette

16-color **Sweetie 16** palette — identical to `graphics.Colors` so Python code colors match what the editor shows:

```
#1a1c2c  #5d275d  #b13e53  #ef7d57
#ffcd75  #a7f070  #38b764  #257179
#29366f  #3b5dc9  #41a6f6  #73eff7
#f4f4f4  #94b0c2  #566c86  #333c57
```

The color picker shows:
- Primary color (A) and secondary color (B)
- A 10-step lerp strip between A and B
- Toggle A/B editing

---

## Tools

| Tool | Key / Icon | Description |
|------|-----------|-------------|
| `pencil` | Pencil | Draw with brush; left=primary, right=secondary |
| `eraser` | Eraser | Erase to transparent |
| `fill` | Paint bucket | Flood-fill region |
| `line` | Spline | Bresenham line (click-drag) |
| `rect` | Square | Rectangle outline or filled |
| `ellipse` | Circle | Ellipse outline or filled |
| `region` | LayoutGrid | Drag to define a sprite region |
| `select` | MousePointer2 | Select and move pixel content |
| `tile` | Stamp | Stamp a frame copy |
| `wand` | Wand2 | Magic-wand contiguous color select |

Brush sizes: 1, 2, 4, 8 pixels.

---

## Sprite / animation model

Each sprite is a named entry in `SheetData.sprites`:

```typescript
interface SheetSpriteEntry {
  x: number;         // top-left on the sheet
  y: number;
  frameW: number;    // single frame width
  frameH: number;    // single frame height
  frameCount: number; // animation frames (1 = static)
  // animation sub-strips share frameW/frameH
}
```

Multiple animation strips (e.g. `walk`, `run`) can live within one sprite region as horizontal rows. The editor lets you add/rename/delete strips and resize individual frames.

---

## Sheet data types

```typescript
interface SheetData {
  pixels: string;              // RLE-like encoded pixel buffer (sheetPixels.ts)
  width: number;               // always 512
  height: number;              // always 512
  sprites: Record<string, SheetSprites>;
}

interface SheetSprites {
  [animName: string]: SheetSpriteEntry;
}
```

Encoding: `encodePixels` / `decodePixels` in `sheetPixels.ts`; the wire format is sparse-chunk via `sheetCodec.ts` (`encodeSheet`).

---

## Undo/redo

Implemented via `makeUndoStack` (unbounded history). Each destructive pixel operation commits a snapshot. Keyboard: `Ctrl+Z` / `Ctrl+Y`.

---

## Grid and zoom

Grid sizes: 1, 2, 4, 8, 16, 32, 64, 128 pixels. Toggled with the grid button; size cycles with `[`/`]` (or the size buttons). Zoom is continuous via scroll or pinch.

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `[` / `]` | Cycle grid size |
| `B` | Pencil |
| `E` | Eraser |
| `F` | Fill |
| `Delete` | Clear selection |

---

## Python access

At runtime, the worker populates `graphics.sheet` with a dict of `name → Sprite` built from the sheet data. Access via:

```python
import graphics as g
g.sheet["player"]          # Sprite object
g.sheet["enemy"]           # Sprite object

# Or through assets:
assets.sprites.player      # SpriteEntry with animation support
```

Actor `image` can be set to a `SpriteEntry` from `assets.sprites.name`; `AnimationController` drives frame selection each tick.

---

*Verified against live source at HEAD.*
