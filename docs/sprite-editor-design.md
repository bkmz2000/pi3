# Sprite Editor Design (2026-08-15, rev 3)

Design decisions for the pi³ sprite editor, made interactively against the
interactive mockup (`viz/kid-mode-standalone.html`). **Pro mode is dropped** —
kid mode IS the editor. Engine choice deferred (see `docs/pedagogical-audit.md`
§3): the current Konva editor stays the baseline; the mockup defines the UX.

## Editor (kid mode) — decisions

| Area | Decision |
|---|---|
| Default canvas | 64×64 (16 / 32 / 64 / 128); size change prompts **Scale drawing** (nearest-neighbor) vs **Keep as-is** vs Cancel — applies to all animations |
| Palette | Full 16-color Sweetie-16; **color mixing** = two palette colors → **10-step ramp** (i/9); **no RGB sliders** (user decision); ramp endpoints (palette colors) are not saved |
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
- Tests: tests/unit/kidSheet.test.ts (11: round-trip, sprite preservation, strip clearing, non-overlap packing, frame cap, mixer) and tests/unit/KidSheetEditor.test.tsx (4: render+draw->save, frame add, named animation, Ctrl+Z). Gates: lint, typecheck, test:ci (88 suites / 912 tests) all green.

Known v1 limits: undo does not restore frame order after a reorder; a renamed sprite colliding with an existing sprite name overwrites it; the kid editor edits one sprite at a time (first sprite or initialSprite); frame limit per animation = 512/size.
