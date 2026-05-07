# pi³ IDE TODO

## Brainstorm (2026-04-16)

### Movement Interface Rework
- [ ] Clear distinction: velocity (continuous drift) vs one-shot movement
- [ ] `set_velocity(dx, dy)` — continuous sliding motion
- [ ] `move_forward(distance)` — one-shot in facing direction, ignores velocity
- [ ] `move_to(x, y)` — teleport
- [ ] `move_by(dx, dy)` — absolute x/y movement (not polar)
- [ ] `move(distance)` always calls `move_forward`, never uses velocity

### Remove Linter from Release
- [ ] Linter is dev-only, not bundled in student release
- [ ] Runtime validation still active

### Sprite Editor: Standard Shortcuts
- [ ] Ctrl+Z / Ctrl+Y — undo/redo
- [ ] Ctrl+C / Ctrl+V — copy/paste sprite
- [ ] Persist undo history to localStorage

### Collider System
- [ ] `assets.colliders` — named collider shapes, stored separately
- [ ] Sprites auto-matched to colliders by name (apple → colliders.apple)
- [ ] `actor.collider = assets.colliders.name` — reassignable override
- [ ] Fallback default if collider not found (circle, reasonable radius)
- [ ] Collider editor: circle / rect / polygon modes, visual editing
- [ ] Hitbox debug shows actual collider shape
- [ ] Deprecate `radius=N` constructor arg — colliders replace it

### Debug Overlay (hitbox mode only)
- [ ] Speed arrow showing velocity direction + magnitude
- [ ] Coordinates text label: `(x, y) spd:(vx, vy)`
- [ ] Only visible when hitbox debug is on

### Improve Sprite Editor
- [ ] Add layers (background, foreground, effects)
- [ ] Onion skin / frame preview for animation
- [ ] Import external images (PNG, SVG)
- [ ] Flood fill tool
- [ ] Shape tools (rectangle, circle, line)
- [ ] Undo/redo with history (localStorage)

## Critical Fixes (Week 1-2)
- [ ] Fix SharedArrayBuffer crossOriginIsolated check
- [ ] Add Pyodide load failure handling with retry UI
- [ ] Bundle size optimization (compression, splitting)
- [ ] Service worker offline handling
- [ ] Tab complition
- [ ] Editing for the existing sprites

## Features

### Single-File Export (Week 3)
- [ ] Export project as standalone HTML file
- [ ] Include assets inline (base64)
- [ ] Self-contained Pyodide runtime

### Instructor Sharing Backend (Week 4)
- [ ] Cloudflare Worker for code sharing API
- [ ] KV storage for sessions
- [ ] Session creation on student "Share" action
- [ ] Short session IDs (random, e.g., `abc123`)
- [ ] Code blob storage (zip of project)
- [ ] Comment storage per session
- [ ] Session expiration (1 hour since last edit)

### Instructor Dashboard (Week 5)
- [ ] View active sessions list (~20 students)
- [ ] Real-time code display (polling)
- [ ] Add content-anchored comments (not line-based)
- [ ] Delete session
- [ ] Session search/filter

### Student Comment View (Week 6)
- [ ] "View Teacher Comments" button in IDE
- [ ] Poll for new comments (not too frequently)
- [ ] Display comments next to matching code content
- [ ] Comment notification indicator

### Tile Editor (Week 7)
- [ ] Grid-based level editor
- [ ] Tile palette from sprites
- [ ] Export as JSON/level format
- [ ] Integrate with examples (sokoban, platformer)

### Explorable Docs (Week 8)
- [ ] Built-in help panel in IDE
- [ ] Graphics API reference
- [ ] Runnable examples in docs
- [ ] Translatable (i18n support)

## Documentation
- [ ] Instructor guide for course setup
- [ ] Common student mistakes reference
- [ ] Graphics API docs (auto-generated or manual)
