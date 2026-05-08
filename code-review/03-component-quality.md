# Component Quality Issues

## 1. `SideMenu.tsx` — too many responsibilities (~540 lines)

Contains 4 inline components:
- `ProjectsPanel` (70 lines)
- `AssetsPanel` (60 lines) 
- `AssetTile` (30 lines)
- `SettingsPanel` (20 lines)

Plus all the state wiring, event handlers, asset sorting, and SpriteEditor open/close management. Each panel should be its own file.

## 2. `SpriteEditor.tsx` — ~1070 lines of one component

Single file handles:
- SVG **parsing** (5 different element types)
- Canvas rendering via Konva
- 7 different drawing tools
- Undo/redo stack
- Color picker (two instances, each with palette + custom-color)
- Stroke width slider
- Keyboard shortcuts
- Drag-and-drop shape manipulation

This desperately needs splitting:
- `spriteEditor/` directory
- `spriteEditor/types.ts` — all shape types
- `spriteEditor/tools/` — one file per tool
- `spriteEditor/SVGExporter.ts`
- `spriteEditor/SVGImporter.ts`
- `spriteEditor/ColorPicker.tsx`

## 3. Inline `renderShape` function (lines 515-690)

The `renderShape` switch statement inside `SpriteEditor` is ~175 lines with deeply nested conditions. Each shape type (`rect`, `ellipse`, `line`, `freehand`, `polygon`, `text`) should be its own render function or component.

## 4. `saveSVG` function duplicates SVG string building

The `saveSVG` function (lines 692-746) manually constructs SVG XML strings. The `renderShape` function renders Konva shapes. These are two separate render paths for the same data — any change to shape rendering must be duplicated.

## 5. `indentationGuideField` — performance concern

The custom `StateField` in `editor/theme.ts` iterates every line of the document on **every** transaction, creating individual decoration objects for each whitespace character. On a 1000-line file, this means ~8000 decoration objects per keystroke. Consider using `Decoration.line` instead, or using CSS-based indentation markers.

## 6. Global `* { transition }` in `index.css`

The blanket `transition: background-color 0.15s, border-color 0.15s, color 0.15s` applies to ALL elements. This can cause perceptible lag on large lists, interferes with `transition-transform` used in `SidePanel`, and makes the drag handle in `CanvasWindow` feel sluggish.
