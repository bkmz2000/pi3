# Graphics Module Reference

**Verified against:** `src/assets/python/graphics/` at HEAD

**Import:** `import graphics as g` — or import names directly from `graphics.actors`.

---

## Module layout

The module is split across several files; `__init__.py` is the only public surface:

| File | Contents |
|------|----------|
| `__init__.py` | Public API, drawing, color, run loop, tilemap, camera, lighting |
| `_color.py` | Sweetie 16 `COLOR_NAMES`, `Colors`, shade math |
| `_vec.py` | `Vector2`, `Point`, `Polar`, `AnchorPoint` |
| `_state.py` | Mutable global state (`_draw_commands`, mouse/keyboard/loop) |
| `_state_ns.py` | `State` dynamic-namespace helper |
| `_sprites.py` | `PixelView`, `_TRANSPARENT` |
| `_sheet.py` | `SheetAnimation`, `SpriteEntry`, `SheetNamespace`, `AnimationController` |
| `_utils.py` | `clamp`, `randint`, `pick`, `Sound`, `Timer` |
| `_lighting_helpers.py` | Ray-cast helpers for `Light` |
| `_errors.py` | `FriendlyError`, `FriendlyAttrError`, `ALL_MESSAGE_KEYS` |
| `_manifest.py` | `EXPORTED_NAMES` — CI enforces parity with `__all__` |
| `actors/__init__.py` | `Actor`, `Rect`, `Circle`, `Group`, `Collider` |
| `animation.py` | `Animation` |

**`_manifest.py` is the single source of truth for the public API surface.** The snapshot test `tests/unit/apiSurfaceSnapshot.test.ts` fails CI if `__all__` and `EXPORTED_NAMES` diverge.

---

## Color palette (Sweetie 16)

`COLOR_NAMES` and `Colors` use the **Sweetie 16** palette, not the old generic web colors:

```python
Colors.black   = (26, 28, 44)
Colors.wine    = (93, 39, 93)
Colors.red     = (177, 62, 83)
Colors.orange  = (239, 125, 87)
Colors.yellow  = (255, 205, 117)
Colors.lime    = (167, 240, 112)
Colors.green   = (56, 183, 100)
Colors.teal    = (37, 113, 121)
Colors.navy    = (41, 54, 111)
Colors.blue    = (59, 93, 201)
Colors.sky     = (65, 166, 246)
Colors.cyan    = (115, 239, 247)
Colors.white   = (244, 244, 244)
Colors.silver  = (148, 176, 194)
Colors.gray    = (86, 108, 134)
Colors.slate   = (51, 60, 87)
```

The SheetEditor's 16-color palette is **this same palette** — they must stay in sync.

Color arguments (`fill`, `stroke`, `background`) accept:
- A `Colors.xxx` tuple: `g.fill(Colors.red)`
- A named string: `g.fill("red")` (looks up `COLOR_NAMES`)
- An RGB tuple: `g.fill((177, 62, 83))`
- Three ints: `g.fill(177, 62, 83)`
- One int (grayscale): `g.fill(128)`
- `None` — disables fill (same as `no_fill()`)

---

## Drawing API

### Canvas

| Function | Signature | Description |
|----------|-----------|-------------|
| `size` | `size(w, h)` | Set canvas dimensions; applied on next `run()` |
| `width` | `width() → int` | Current canvas width |
| `height` | `height() → int` | Current canvas height |

### Shapes

| Function | Signature |
|----------|-----------|
| `circle` | `circle(x, y, r)` |
| `rect` | `rect(x, y, w, h)` |
| `ellipse` | `ellipse(x, y, w, h=None)` — h=w if omitted |
| `line` | `line(x1, y1, x2, y2)` |
| `point` | `point(x, y)` |

### Text

| Function | Signature | Notes |
|----------|-----------|-------|
| `text` | `text(s, x, y)` or `text(s, anchor, padding=6)` | Accepts `AnchorPoint` for anchor-relative placement |
| `text_size` | `text_size(n)` | Font size in px |
| `text_align` | `text_align(horizontal, vertical=None)` | `"left"/"center"/"right"`, `"top"/"middle"/"bottom"` |
| `say` | `say(s, anchor, padding=8)` | Speech bubble with tail pointing at anchor |

### Color

| Function | Signature |
|----------|-----------|
| `fill` | `fill(r=None, g=None, b=None)` — `fill(None)` = `no_fill()` |
| `no_fill` | `no_fill()` |
| `stroke` | `stroke(r=None, g=None, b=None)` |
| `no_stroke` | `no_stroke()` |
| `stroke_width` | `stroke_width(w)` |
| `background` | `background(r, g=None, b=None)` — also accepts a sprite asset dict |

### Color math

| Function | Signature | Description |
|----------|-----------|-------------|
| `lerp` | `lerp(a, b, t)` | Linear interpolation — works on numbers OR color tuples |
| `darker` | `darker(c, steps=1)` | Lerp toward black |
| `lighter` | `lighter(c, steps=1)` | Lerp toward white |
| `saturated` | `saturated(c, steps=1)` | HSL saturation increase |
| `desaturated` | `desaturated(c, steps=1)` | HSL saturation decrease |

### Transform

| Function | Signature |
|----------|-----------|
| `push` | `push()` — save canvas state |
| `pop` | `pop()` — restore canvas state |
| `translate` | `translate(x, y)` |
| `rotate` | `rotate(angle)` — degrees |
| `scale` | `scale(x, y=None)` — uniform if y omitted |

### Image

```python
image(img, x, y, w=None, h=None)
```

`img` can be:
- A `Sprite` (pixel buffer) — ships RGBA bytes to renderer
- A `SpriteEntry` / `SheetAnimation` — draws current frame
- An asset dict from `assets.xxx`

---

## Input singletons

### Mouse

```python
Mouse.x          # current x position
Mouse.y          # current y position
Mouse.pos        # Vector2(x, y)
Mouse.pressed    # True on the frame the button was clicked
Mouse.down       # True while button is held
Mouse.released   # True on the frame the button was released
```

### Keyboard

```python
Keyboard.space.down         # True while space is held
Keyboard.arrow_left.pressed # True on the frame the key was first pressed
Keyboard.a.released         # True on the frame the key was released
# Also: Keyboard["space"], Keyboard.key_0..key_9 for digit aliases
```

Each key access returns a `_Key` with `.pressed`, `.down`, `.released`.

### Window

```python
Window.width       # canvas width
Window.height      # canvas height
Window.top_left    # AnchorPoint(0, 0, "left", "top")
Window.top_right   # AnchorPoint(width, 0, "right", "top")
Window.center      # AnchorPoint(width/2, height/2, "center", "middle")
# also: top, bottom, left, right, bottom_left, bottom_right
```

---

## Math helpers

| Name | Signature | Description |
|------|-----------|-------------|
| `clamp` | `clamp(value, lo, hi)` | Clamp to range |
| `randint` | `randint(a, b) → int` | Random integer a..b inclusive |
| `random` | `random(low, high=None) → float` | Random float 0..low or low..high |
| `pick` | `pick(seq)` | Random item from sequence |
| `random_color` | `random_color() → tuple` | Random palette color |
| `noise` | `noise(x, y, scale=0.1, seed=0) → float` | Smooth value noise in [0, 1] |
| `Vector2` | `Vector2(x, y)` | 2D vector |
| `Point` | `Point(x, y)` | Alias for Vector2 |
| `Polar` | `Polar(angle, length)` | Polar → cartesian |
| `AnchorPoint` | — | Canvas anchor with alignment hints for text/say |

---

## Run loop

```python
run(main=None, fps=60)   # start game loop; main() called every frame
stop()                   # request loop stop
frame_count              # module-level int; increments each tick
frame_rate(fps)          # change target FPS at runtime
```

The loop:
1. Flushes draw commands from the previous tick
2. Calls `actor.update()` on all live actors
3. Calls `main()` if provided
4. Flushes draw commands again
5. Resets per-frame input state (`.pressed`, `.released`)
6. Schedules next tick via `setTimeout`

---

## Pixel (Sprite) API

```python
Sprite(width, height, pixels=None)   # mutable RGBA pixel buffer
create_sprite(width, height, fill=None) → Sprite
get_pixel(sprite, x, y) → (r, g, b) | None  # None if transparent or OOB
set_pixel(sprite, x, y, color)        # silently ignores OOB
palette_swap(sprite, old_color, new_color)   # exact RGB match replacement
flood_fill(sprite, x, y, color)       # 4-connected bucket fill

# Mutating shade ops (single pixel in-place):
darken(sprite, x, y, steps=1)
lighten(sprite, x, y, steps=1)
saturate(sprite, x, y, steps=1)
desaturate(sprite, x, y, steps=1)
```

`PixelView` — yielded by iterating a `Sprite`; provides `.x`, `.y`, `.color`.

At run time, `sheet` (dict `name → Sprite`) is populated from editor-authored pixel assets. Access via `g.sheet["name"]` or through actor `image` / `SpriteEntry`.

---

## Actor system

```python
from graphics.actors import Actor, Rect, Circle, Group, Collider
```

### Actor constructor

```python
Actor(asset=None, **kwargs)
# Valid kwargs: x, y, vx, vy, angle, image, scale, flip_x, flip_y,
#               pos, vel, visible, width, height, radius, color,
#               stroke_color, stroke_width
```

Passing an unknown kwarg raises `FriendlyError` with a typo suggestion.

Subclass and override `init()` to declare custom attributes (called before the instance is sealed):
```python
class Player(Actor):
    def init(self):
        self.health = 3
        self.speed = 4
```

### Actor properties

| Name | Type | Notes |
|------|------|-------|
| `x`, `y` | float | Position |
| `vx`, `vy` | float | Velocity (applied each tick) |
| `angle` | float | Degrees |
| `scale` | float | Uniform draw scale |
| `flip_x`, `flip_y` | bool | Mirror on draw |
| `visible` | bool | |
| `image` | asset / SpriteEntry | What to draw |
| `collider` | `Collider` | Hitbox |

### Collider

```python
actor.collider.set_circle(radius, dx=0, dy=0)
actor.collider.set_rect(width, height, dx=0, dy=0)
actor.collider.disable()
actor.collider.shape    # "circle" | "rect" | None
```

### Subclasses

`Rect(x, y, width, height, color, stroke_color, stroke_width)` — auto-draws a rectangle.

`Circle(x, y, radius, color, stroke_color, stroke_width)` — auto-draws a circle.

`Group` — iterable container of actors. Used by collision, tilemap areas, lighting obstacles.

### Static / class methods

```python
Actor.all_actors() → list    # all live actors in draw order
Actor.random_coords() → (x, y)
```

### Key instance methods

```python
actor.die()            # mark dead, remove from registry
actor.is_alive() → bool
actor.hide()           # invisible + non-collidable
actor.ghost()          # visible but non-collidable
actor.bring_to_front() # move to end of draw order
actor.send_to_back()
actor.point_to(x, y)  # rotate to face coordinate
actor.collides_with(other) → bool
actor.collides_any(group) → Actor | None  # first hit in group
actor.draw()           # override to draw custom shapes
actor.update()         # called every tick (override or leave empty)
```

---

## Tilemap

```python
TilemapLayer   # single named layer; cells by (col, row)
TileMap        # collection of layers + named areas
TileRef        # lightweight rect collider (managed by TileMap areas)
TileGroup      # set of (col, row) cells with transform/mutation ops
TileCollision  # result of tilemap.collides_with(); truthy if hit
Cell           # namedtuple(x, y) — grid coordinates
Bounds         # namedtuple(min, max, width, height)
```

### TilemapLayer

```python
layer.draw(x=0, y=0)
layer.tile_at(px, py) → str | None   # pixel coords → tile name
layer.get_tile(col, row) → str | None
layer.tiles() → iter (col, row, name)
layer.set(col, row, name, rotation=0)  # write/clear a cell
layer.get(col, row) → (name, rotation) | None
layer.count_neighbors(col, row, name) → int  # 8-neighborhood count
layer.group(name) → TileGroup         # named area → editable group
```

### TileMap

```python
level = assets.tilemaps.level_name

level.draw(x=0, y=0)
level.layers["name"]       # TilemapLayer by name
level.areas.ground         # Group of merged TileRef colliders
level.collides_with(actor, "ground") → TileCollision | None
level.collides_with_any(actor, ["ground", "walls"]) → TileCollision | None
level.group("ground") → TileGroup
```

### TileCollision

```python
hit = level.collides_with(hero, "ground")
if hit:
    hit.area   # "ground"
    hit.tile   # "grass"
    hit.col, hit.row  # grid coords
    hit.rect   # the TileRef that was hit
```

### TileGroup mutations

```python
group.fill("grass")
group.scatter("coin", count=5)
group.fill_random(["grass", "dirt"])
group.fill_random({"grass": 3, "dirt": 1})  # weighted
group.shrink(n=1) → TileGroup   # erosion
group.border() → TileGroup      # perimeter cells
group.bounds() → Bounds
group.random_cell() → Cell | None
```

---

## Camera

```python
cam = Camera()           # fixed at (0, 0)
cam = Camera(player)     # follow actor from construction
cam.follow(player, lerp=1.0)   # lerp < 1 smooths (0.1 = slow follow)
cam.unfollow()

# Context manager applies the view transform:
with cam:
    level.draw()
    player.draw()
```

---

## Lighting

```python
light = Light(ambient=(40, 40, 60), radius=200, mode="hsl")
light.add_obstacles(level.areas.walls)  # Group, list, or single Actor
light.add_source(torch)   # Actor, Group, (x, y) tuple, or Vector2
light.shade("warm")       # "neutral" | "warm" | "cool" | "moonlight" | "candle"
light.flicker(True)
light.radius(250)

# In draw(): call last so it composites over everything
light.draw()
```

`mode="hsl"` (default) — soft-light composite, perceptually correct.  
`mode="overlay"` — legacy alpha-blend.

---

## Animation

`Animation` — frame sequencer tied to `frame_count`. Constructed from `_sheet.py` types.

`SheetAnimation` / `SpriteEntry` / `SheetNamespace` / `AnimationController` — loaded from the pixel-sheet asset pipeline. Access via `assets.sprites.name` (which returns a `SpriteEntry`).

---

## Utility types

```python
Timer(seconds)          # tick-based countdown; .expired, .reset()
State()                 # dynamic SimpleNamespace for game state
Sound                   # audio clip: .play(), .loop(), .pause(), .stop(), .set_volume(v)
```

---

## Full `__all__` (pinned by CI)

```python
"_version",
"size", "width", "height",
"circle", "rect", "ellipse", "line", "point",
"text", "text_size", "text_align", "say",
"fill", "no_fill", "stroke", "no_stroke", "stroke_width",
"background", "image",
"frame_rate", "frame_count",
"random", "random_color",
"clamp", "randint", "pick",
"Colors", "AnchorPoint",
"lerp", "darker", "lighter", "saturated", "desaturated",
"Sprite", "PixelView", "create_sprite", "get_pixel", "set_pixel",
"palette_swap", "flood_fill",
"darken", "lighten", "saturate", "desaturate",
"Vector2", "Point", "Polar",
"Mouse", "Keyboard", "Window",
"Actor", "Rect", "Circle", "Group", "Collider",
"Camera",
"TilemapLayer", "TileMap", "TileRef",
"TileGroup", "Cell", "Bounds", "noise",
"Light",
"Animation",
"SheetAnimation", "SpriteEntry", "SheetNamespace", "AnimationController",
"Timer", "State",
"run", "stop",
"assets", "sheet",
```

**Any add/remove of a public name must update `_manifest.py` `EXPORTED_NAMES` and `tests/unit/api-surface.json` in the same commit, or CI fails.**

---

*Verified against live source at HEAD. Update this doc whenever `__init__.py` or `_manifest.py` changes.*
