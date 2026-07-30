# pi³ Project Roadmap

**Last Updated:** 2026-07-30

---

## Status legend

| Status | Meaning |
|--------|---------|
| `done` | Shipped and in production |
| `in-progress` | Currently being developed |
| `planned` | Not yet started |
| `deferred` | Intentionally postponed |

---

## Shipped (major milestones since 2026-04-30)

| Feature | Notes |
|---------|-------|
| Graphics API v1 freeze | `api-v1.md`; `_manifest.py` + CI snapshot test enforce parity |
| Error system (phases D–E) | Structured i18n keys via `FriendlyError`; `error_hook.py`, `syntax_hints.py`, all-key registry |
| Pixel sprite sheet editor | `SheetEditor.tsx` — 512×512 canvas, Sweetie 16 palette, animations |
| Tilemap editor + API | `TileEditor.tsx`; `TilemapLayer`, `TileMap`, `TileCollision`, `TileGroup` |
| Actor system overhaul | `Rect`, `Circle`, `Group`, `Collider`; sealed attrs; kwarg typo detection |
| Save-flow overhaul | Debounced auto-save, offline queue, anon stash, save chip, beforeunload guard |
| Loginus OAuth | Full OAuth 2.0 with signed state, cookie path fix (2026-05-20) |
| Camera | `Camera` with follow + lerp |
| Lighting | `Light` — multiply overlay + shadow-cast visibility polygons |
| Vector math | `Vector2`, `Point`, `Polar`, `AnchorPoint` |
| Jedi dot-completion | Debounced 300 ms, fires on `.` only |
| Test suite (T1/T2/T3) | Frontend + server coverage gates; interaction tests |
| Codebase decomposition (D1–D4) | Split `IdeState.ts`, `graphics/__init__.py` into focused modules |
| Pixel API | `Sprite`, `get_pixel`, `set_pixel`, `palette_swap`, `flood_fill`, shade ops |
| Color math | `lerp`, `darker`, `lighter`, `saturated`, `desaturated` |
| Collision API | `TileCollision` object with `.area`, `.tile`, `.col`, `.row` |
| Smart Select (SheetEditor) | Wand tool, region ops, stamp, move-sprite drag |
| HTML export | Single-file standalone export |
| Noise | `noise(x, y, scale, seed)` — value noise |
| Sound API | `Sound` class; `assets.sounds.name.play/loop/pause/stop/set_volume` |
| Geometry shapes (phases 1-6) | `Line`, `Polygon`, `Spline`, texture-along-outline, `contains`/`random`/`in`/`distance_to`, `bounce_of`; draw-command marshalling perf pass |
| Turtle module | `pi3.turtle` — classic turtle-graphics surface over the same runtime |
| Compete mode | `/compete/:slug` problems, teacher problem authoring/import/publish, submission tiers |
| Instructor dashboard / live session panel | Teacher live-activity roster + live code pane (`/teacher`); symmetric peer sessions joined by signed link; emoji reactions |
| Floating canvas window | Canvas detached from docked layout, draggable/resizable (`CanvasWindow.tsx`) |
| Matplotlib blit | Fast-path re-render for matplotlib figures in the worker |
| `show()` | One-shot still-picture render, counterpart to `run()` |
| Billing caps + freeze flag | Usage caps; freeze-updates toggle so a class's pinned version doesn't drift mid-term |

---

## In progress

| Feature | Status | Notes |
|---------|--------|-------|
| Example set v1 | `in-progress` | 17 examples planned (7 topics, all games); ~7 to write, 1 to fix (sokoban) |
| Docs taxonomy rewrite | `in-progress` | Recipe-style docs + concept pages + A-Z reference |

---

## Planned

| Feature | Priority | Notes |
|---------|----------|-------|
| Docs: recipe pages for common patterns | high | Collision, camera, tilemaps, lighting |
| Docs: A-Z reference rebuild | high | Against live `_manifest.py` |
| Student comment view | medium | Instructor sharing flow |
| Public project discovery/listing | parked | Snapshot/problem "request public listing" is implemented and recorded, but has no reviewer approve/reject surface — intentionally not being pursued right now (see `docs/doctrine.md` CORE-7). Undiscoverable, link-only sharing is fine for now. |
| Sprite editor: onion skin | low | Animation frame preview |
| Sprite editor: import external PNG | low | |
| Debug overlay improvements | low | Speed arrow, coordinate label with hitbox mode |
| Bundle size optimization | low | |

---

## Completed (pre-2026-04-30, carried forward)

| Feature |
|---------|
| Pyodide WASM runtime (Web Worker) |
| CodeMirror 6 integration |
| i18next bilingual support (ru/en) |
| PWA service worker (`webide-v4` cache) |
| IndexedDB project persistence |
| ZIP import/export |
| Cross-Origin isolation headers (SharedArrayBuffer) |
| Tab completion (basic) |

---

*See [CLAUDE.md](../CLAUDE.md) for architecture details. See [docs/api-v1.md](api-v1.md) for the graphics API changelog.*
