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
| `push()` | Function | Save the current transform (matrix stack). Now in `__all__` (existed + rendered, but wasn't exported) |
| `pop()` | Function | Restore the last saved transform |
| `translate(x, y)` | Function | Shift the origin of following draws by (x, y) |
| `rotate(angle)` | Function | Rotate following draws by `angle` radians around the origin |
| `Line(a, b, thickness=2)` | Class | Straight wall geometry: `segments`, `bounds`, `normal_at()`, `draw()`. First of the Shape family (Polygon/Spline follow) |
| `Polygon(points, thickness=2)` | Class | Closed region geometry: `contains(point)`, closest-edge `normal_at(point)`, `segments`, `bounds`, filled `draw()` |
| `Spline(points, closed=False, thickness=6)` | Class | Smooth cardinal curve; O(1) `add(point)` tail growth; `closed` toggles region/loop vs open curve; `contains`/`normal_at`/`bounce_of` |
| `Shape.texture(sprite, mode="tile", spacing=None)` | Method | Tile a repeating sprite along a Line/Polygon/Spline outline (rotated to follow it) instead of stroking; draw-only, decoupled from collision. Accepts a `Sprite` or sheet entry. Returns self |
| `Shape.contains(point)` | Method | Membership test — inside a closed region (Polygon / closed Spline), or nearness to an open outline (Line / open Spline) |
| `point in shape` | Operator | `Shape.__contains__`; same as `shape.contains(point)` |
| `Shape.random(rect=None, n=1)` | Method | Random point(s) inside the shape (reject-sampled); `n=1` returns a Vector2, `n>1` a list. Raises `shapeRandomFailed` if it can't fit enough |
| `Vector2.distance_to(shape)` | Method | Now also accepts a Line/Polygon/Spline — distance from the point to the shape's outline |
| `Vector2.bounce_of(shape, at=None, restitution=1.0)` | Method | Reflect a velocity off a Shape's surface normal; `restitution` scales the bounced speed |

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
