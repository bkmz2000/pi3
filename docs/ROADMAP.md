# pi³ Project Roadmap

**Last Updated:** 2026-04-30

This document tracks planned and in-progress features. For completed features, see the main documentation.

---

## Status Legend

| Status | Meaning |
|--------|---------|
| `planned` | Not yet started |
| `in-progress` | Currently being developed |
| `partial` | Started but incomplete |
| `completed` | Finished and shipped |

---

## Features

### Movement Interface Rework

**Status:** `planned`

Clear distinction between movement types:

| Method | Type | Description |
|--------|------|-------------|
| `set_velocity(dx, dy)` | Continuous | Continuous sliding motion |
| `move_forward(distance)` | One-shot | Move in facing direction, ignores velocity |
| `move_to(x, y)` | One-shot | Teleport to position |
| `move_by(dx, dy)` | One-shot | Absolute x/y movement (not polar) |
| `move(distance)` | One-shot | Always calls `move_forward` |

### Collider System

**Status:** `planned`

Replace `radius=N` constructor argument with named collider shapes:

| Component | Description |
|-----------|-------------|
| `assets.colliders` | Named collider shapes, stored separately |
| Sprite matching | Sprites auto-matched to colliders by name (`apple` → `colliders.apple`) |
| Override | `actor.collider = assets.colliders.name` — reassignable |
| Fallback | Default circle collider if not found |
| Collider editor | Circle / rect / polygon modes with visual editing |
| Hitbox debug | Shows actual collider shape |

### Debug Overlay (Hitbox Mode)

**Status:** `planned`

When hitbox debug is enabled:
- Speed arrow showing velocity direction + magnitude
- Coordinates text label: `(x, y) spd:(vx, vy)`

### Sprite Editor Improvements

**Status:** `planned`

- [ ] Layers (background, foreground, effects)
- [ ] Onion skin / frame preview for animation
- [ ] Import external images (PNG, SVG)
- [ ] Flood fill tool
- [ ] Standard shortcuts (Ctrl+Z/Y undo/redo, Ctrl+C/V copy/paste)
- [ ] Undo/redo history persisted to localStorage

### Instructor Sharing System

**Status:** `in-progress`

End-to-end code sharing between students and instructors.

#### Backend (Cloudflare Worker)

| Component | Status |
|-----------|--------|
| KV storage for sessions | `partial` |
| Session creation | `planned` |
| Short session IDs | `planned` |
| Code blob storage (zip) | `planned` |
| Comment storage | `planned` |
| Session expiration (1hr) | `planned` |

#### Instructor Dashboard

| Feature | Status |
|---------|--------|
| View active sessions | `planned` |
| Real-time code display (polling) | `planned` |
| Content-anchored comments | `planned` |
| Session search/filter | `planned` |
| Delete session | `planned` |

#### Student Comment View

| Feature | Status |
|---------|--------|
| "View Teacher Comments" button | `planned` |
| Poll for new comments | `planned` |
| Display comments next to code | `planned` |
| Comment notification indicator | `planned` |

### Single-File Export

**Status:** `planned`

Export project as standalone HTML file:
- Assets inline (base64)
- Self-contained Pyodide runtime
- No server required

### Tile Editor

**Status:** `planned`

Grid-based level editor for creating game levels:
- Tile palette from sprites
- Export as JSON/level format
- Integrate with sokoban, platformer examples

### Explorable Docs

**Status:** `planned`

Built-in help panel in IDE:
- Graphics API reference
- Runnable examples in docs
- i18n support (translatable)

---

## Critical Fixes

| Issue | Status |
|-------|--------|
| SharedArrayBuffer crossOriginIsolated check | `planned` |
| Pyodide load failure handling with retry UI | `planned` |
| Bundle size optimization | `planned` |
| Service worker offline handling | `planned` |
| Tab completion | `planned` |
| Editing for existing sprites | `planned` |
| Remove linter from release (dev-only) | `planned` |

---

## Documentation

| Topic | Status |
|-------|--------|
| Instructor guide for course setup | `planned` |
| Common student mistakes reference | `planned` |
| Graphics API docs (auto-generated or manual) | `planned` |

---

## Completed

None yet — this is a new project.

---

*See also: [AGENTS.md](../AGENTS.md) for current architecture*