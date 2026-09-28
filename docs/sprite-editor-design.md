# Sprite Editor Design (2026-08-15, rev 3)

Design decisions for the pi³ sprite editor, made interactively against the
interactive mockup (`viz/kid-mode-standalone.html`). **Pro mode is dropped** —
kid mode IS the editor. Engine choice deferred (see `docs/pedagogical-audit.md`
§3): the current Konva editor stays the baseline; the mockup defines the UX.

## Editor (kid mode) — decisions

| Area | Decision |
|---|---|
| Default canvas | 64×64 (16 / 32 / 64 / 128); size change prompts **Scale drawing** (nearest-neighbor) vs **Keep as-is** vs Cancel — applies to all animations |
| Palette | Sweetie-16 core plus brown, purple, and pink; familiar grey/light-blue/dark-blue aliases; **color mixing** = two palette colors → **10-step ramp** (i/9); **no RGB sliders** (user decision); ramp endpoints (palette colors) are not saved |
| My colors | Session row of **custom-only** colors (non-palette), **34px swatches**, ≤12 |
| Tools | Pencil, Eraser, Fill, Pick, Line, Rect, Circle — shapes **outline-only** (Fill covers filling); brush 1 / 3 / 5 (default 3) |
| Icons | SVG icons, **no emoji** |
| Colors | Strokes paint one exact color (no auto-blending); scaling nearest-neighbor; the old pro lerp picker is NOT carried over (deliberate mixer replaces it) |
| Animations | Multiple **named animations** per sprite, free-text names, New / Rename / Delete; each has own frames |
| Frames | Chip thumbnails; Add / Copy / Del; **drag-to-reorder** (drop on target chip); Play preview |
| Hotkeys | Ctrl+Z undo · Ctrl+Y / Ctrl+Shift+Z redo · Ctrl+S save (toast) · Ctrl+A select all · Ctrl+C copy frame · Ctrl+V paste · Esc deselect · B/E/G/I/L/R/C tool shortcuts · **Shift+drag with pencil/eraser = straight line** |
| Onion skin | Toggle (default on): **difference outlines** — only pixels that **changed** between frames are drawn, as a 1px **outline** in the ghost's own color (prev blue, next pink, 85% alpha); unchanged pixels get no tint at all and the current frame stays exactly as drawn; legend under the canvas; preview stays clean |
| Polish | Brush ghost cursor, zoom 100–400%, grid toggle, Undo+Redo, current-color chip, toast feedback |

## Data-model mapping (ports 1:1 into SheetData)

`sheet.sprites[name].animations[anim]` = list of frames; at save time frames
pack into horizontal strips (x, y, frameW, frameH, frameCount) per the existing
sheet model. Editor is single-sprite; the sheet/regions layer is storage-only.

## Open items (implementation, not UX)

- PNG import for sprites; ZIP export round-trip for sheet/sound/tilemap data
- Save-flow integration into the existing sheet model + editorStore
- Onion-skin tint/color options (currently fixed opacities; "no restrictions")

## Provenance

Live with the product owner on 2026-08-15 (mockup v1–v5): 64×64 · scale prompt ·
SVG icons · no auto-lerp · full palette · frame chips · named free-text
animations · outline-only shapes + fill tool · pro mode dropped · color mixing
(10-step ramp, no RGB, bigger custom-only swatches) · hotkeys + shift-lines ·
frame reorder · onion skin (fixed under-composite bug in v5; v5.1 on-top tinted ghosts washed out the current frame → v5.2 difference-aware tints washed unchanged pixels → v5.3 outline-only: changed pixels traced as 1px outlines in the ghost's own color (blue prev / pink next), unchanged pixels untouched).

## Implementation (2026-08-15, shipped)

The kid-mode editor is now the sheet editor in the app.

- src/kidSheet.ts - pure logic: kidStateFromSheet (decode + slice strips to frames; non-square frames cropped) and kidStateToSheet (re-pack frames into horizontal strips on the 512x512 sheet, clearing the sprite's old strips, preserving all other sprites byte-for-byte; throws if an animation exceeds 512/size frames or a frame is non-square). Mixer helpers (mixRgb, isPaletteRgb), PALETTE_RGB.
- src/KidSheetEditor.tsx - the React component (port of the approved mockup): 7 tools + shift-lines, brush 1/3/5, 10-step mixer + My-colors (custom-only, 30px), named animations (New/Rename/Delete), frame chips with drag-reorder, hotkeys (Ctrl+Z/Y/S/A/C/V, B/E/G/I/L/R/C, Esc), difference-outline onion skin (blue prev / pink next at 85%), zoom, grid, undo/redo, toast. Saves to SheetData via setSheet on Done and Ctrl+S.
- src/AssetEditor.tsx - mode 'sheet' now mounts KidSheetEditor (the old SheetEditor.tsx stays on disk, un-wired, for reference/tests).
- i18n: kidSheet.* in en.json + ru.json (49 keys, parity-checked).
- Tests: tests/unit/kidSheet.test.ts covers round-trip, sprite preservation, packing, frame caps, and mixing. tests/unit/KidSheetEditor.test.tsx has 11 checks covering persistence, frames, animations, undo, brush preview, shape preview isolation, continuous strokes, outside-pointer release, resize safety, drawer lifecycle, palette order, and inline mixing. `sheetRaster.test.ts` additionally verifies closed circle contours for every diameter from 2 through 64 pixels. Latest gates: lint, typecheck/build, 101 suites / 1017 tests, and 5 sprite browser checks pass.

Known v1 limits: undo does not restore frame order after a reorder; a renamed sprite colliding with an existing sprite name overwrites it; the kid editor edits one sprite at a time (first sprite or initialSprite); frame limit per animation = 512/size.

## Drawing and UX fixes (2026-09-28)

A hands-on review and follow-up found these defects; all were fixed in focused editor/raster changes:

- Resize now clears incompatible undo/redo and frame-clipboard buffers, so Undo cannot restore old-dimension pixel data and crash `ImageData`.
- Pointer capture plus window-level pointer-up/cancel handling ends strokes released outside the canvas; buttonless re-entry cannot paint phantom pixels.
- Pencil and eraser movement interpolates between pointer samples with Bresenham lines, eliminating gaps during fast strokes.
- The animation drawer starts closed and is conditionally mounted with an explicit labelled close button, so hidden controls leave the accessibility tree instead of overlapping another active panel.
- Shape previews track only pixels touched by the preview shape, so overlapping circles no longer recolor or fill existing artwork while dragging.
- The 3×3 and 5×5 brush ghost is centered on the same cell as `paintBrush()`.
- The 19-color palette renders directly in canonical visual order in a wider Colors panel.
- Color mixing is inline beside the always-clickable palette: choose A/B, inspect the 10-step ramp, and save mixed colors without a blocking modal.
- Circle rasterization joins every rounded angular sample to the next—including the closing last-to-first segment—so all 2–64px circles have one continuous, closed 8-connected outline.
- Canvas size moved out of the Colors panel into a compact `16 × 16`–`128 × 128` selector in the top toolbar; resize confirmation behavior is unchanged.
