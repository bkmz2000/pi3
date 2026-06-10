# pi3 Graphics API v1 Changelog

## Breaking changes from pre-v1 (0.9.x)

### Movement
- **`move()` no longer auto-applied by the game loop.** Every actor that sets
  `vx`/`vy` must now call `actor.move()` once per frame in its `update()` or
  the game-loop tick function.
- **`move(distance)` removed.** The old single-argument `move()` moved along
  the facing direction. Use the new `forward(distance)` for directional
  movement and `move()` (no args) for velocity-based movement.
- **`change_x_by(dx)` and `change_y_by(dy)` removed.** Use `actor.x += dx`
  or `actor.move_to(x, y)` instead.

### Removed names (no longer in `from graphics import *`)
- `push`, `pop`, `translate`, `rotate` (canvas transform), `scale` — still
  importable explicitly: `from graphics import rotate, push, pop`
- `Window.size()`, `Window.run()`, `Window.stop()` — use the global `size()`,
  `run()`, `stop()` functions. `Window.width`/`Window.height` properties and
  anchor points remain.

### Actor sealing
- **Actor attributes are now closed after construction.** Custom attributes
  must be declared in the constructor (`Actor(hp=100)`) or inside the `init()`
  hook. Assigning a new attribute after `__init__` completes raises a friendly
  error with a suggestion.

### Error system
- All library-raised teaching errors now use structured i18n keys
  (`FriendlyError`) instead of English prose. The frontend renders all text
  through i18next for full bilingual support (English + Russian).
- Syntax errors are now classified by a shared pattern engine (see
  `syntax_hints.py`) — both the linter and runtime error hook produce the
  same structured keys.

## New names

| Name | Kind | Description |
|------|------|-------------|
| `State(**kwargs)` | Class | Mutable namespace for module-level game state |
| `forward(distance)` | Method | Move along current `angle` (replaces old `move(distance)`) |
| `bounce()` | Method | Reflect velocity off canvas edges using collider extents |
| `keep_in_bounds()` | Method | Clamp position inside canvas (no velocity change) |
| `distance_to(target)` | Method | Distance to another actor, Mouse, Vector2, or (x, y) |
| `clamp(v, lo, hi)` | Function | Clamp a value between bounds |
| `randint(low, high)` | Function | Random integer (inclusive) |
| `pick(seq)` | Function | Random item from a sequence |
| `Mouse.pos` | Property | Mouse position as a `Vector2` |
| `Timer` | Class | Now in `__all__` (previously existed but was undocumented) |

## Pattern-based error hints (Phase E)

The IDE now detects and explains these specific mistakes:

- **Smart quotes**: typographic quotes «»""''„ replaced with straight quotes
- **Empty import**: `from graphics import ` → suggests adding `*`
- **Missing dot**: `circle(Mouse x, 10)` → suggests `Mouse.x`
- **Assignment in condition**: `if x = 5:` → suggests `==`
- **Missing call parens**: `background` without `()` → suggests `background()`
- **Missing def parens**: `def foo:` → suggests `def foo():`
- **Wrong keyboard layout**: Cyrillic homoglyphs (`сircle`) detected and
  transliterated to Latin

## Version

**1.0** — stable API surface snapshot at `tests/unit/api-surface.json`.
Any future add/remove of a public name turns CI red until the snapshot and
docs are deliberately updated.
