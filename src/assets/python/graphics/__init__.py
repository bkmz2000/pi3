"""
graphics module

Provides a simple graphics API for creating games and visualizations.
Import as: import graphics as g
from graphics.actors import Actor, Rect, Circle, Group
"""

import math
import traceback
from typing import Any, Callable, Optional, Union

_version = "1.0"

# === GLOBAL STATE ===

_width = 300
_height = 300
_running = False
_stop_requested = False

_draw_commands = []
_pending_size = None

_fill_color = (255, 255, 255)
_stroke_color = (0, 0, 0)
_stroke_width = 1
_current_fill = True
_current_stroke = True

_mouse_x = 0
_mouse_y = 0
_mouse_down = False
_mouse_clicked = False
_mouse_released = False

_keys_down = set()
_keys_pressed = set()
_keys_released = set()

frame_count = 0
_target_fps = 60
_pending_timer_id = None
_loop_generation = 0
_show_hitboxes = False

# === COLORS ===

COLOR_NAMES = {
    "red": (255, 0, 0),
    "green": (0, 255, 0),
    "blue": (0, 0, 255),
    "yellow": (255, 255, 0),
    "cyan": (0, 255, 255),
    "magenta": (255, 0, 255),
    "white": (255, 255, 255),
    "black": (0, 0, 0),
    "gray": (128, 128, 128),
    "grey": (128, 128, 128),
    "orange": (255, 165, 0),
    "purple": (128, 0, 128),
    "pink": (255, 192, 203),
    "brown": (139, 69, 19),
    "lime": (0, 255, 0),
    "navy": (0, 0, 128),
    "teal": (0, 128, 128),
    "olive": (128, 128, 0),
    "maroon": (128, 0, 0),
    "silver": (192, 192, 192),
    "aqua": (0, 255, 255),
    "fuchsia": (255, 0, 255),
}


class _Colors:
    """Named color palette. Use fill(Colors.red) for theme-aware colors."""
    red    = (220,  60,  60)
    green  = ( 50, 200,  80)
    blue   = ( 60, 120, 255)
    yellow = (255, 220,  40)
    orange = (255, 140,  40)
    purple = (180,  80, 220)
    pink   = (255, 130, 180)
    cyan   = ( 40, 210, 220)
    white  = (255, 255, 255)
    black  = (  0,   0,   0)
    gray   = (150, 150, 150)
    brown  = (160,  90,  40)

    def _update_theme(self, palette: dict):
        for name, rgb in palette.items():
            if hasattr(self, name):
                setattr(self, name, tuple(rgb))


Colors = _Colors()


_KEY_CODES = {
    "arrow_left": 37,
    "arrow_up": 38,
    "arrow_right": 39,
    "arrow_down": 40,
    "space": 32,
    "escape": 27,
    "enter": 13,
    "backspace": 8,
    "tab": 9,
    "shift": 16,
    "ctrl": 17,
    "alt": 18,
    "a": 65, "b": 66, "c": 67, "d": 68, "e": 69,
    "f": 70, "g": 71, "h": 72, "i": 73, "j": 74,
    "k": 75, "l": 76, "m": 77, "n": 78, "o": 79,
    "p": 80, "q": 81, "r": 82, "s": 83, "t": 84,
    "u": 85, "v": 86, "w": 87, "x": 88, "y": 89,
    "z": 90,
    "0": 48, "1": 49, "2": 50, "3": 51, "4": 52,
    "5": 53, "6": 54, "7": 55, "8": 56, "9": 57,
    # Prefixed aliases for number keys (since Keyboard.0 is invalid Python)
    "key_0": 48, "key_1": 49, "key_2": 50, "key_3": 51, "key_4": 52,
    "key_5": 53, "key_6": 54, "key_7": 55, "key_8": 56, "key_9": 57,
}

_CODE_TO_NAME = {v: k for k, v in _KEY_CODES.items()}

assets = None


# === VECTOR ===


class Vector2:
    """2D vector with arithmetic and geometry helpers.

    Vector2(3, 4); Vector2((3, 4)); Vector2(other_vec). Mutable x, y.
    Use `Point` as an alias when reading as a position is clearer.
    """

    def __init__(self, x=0.0, y=0.0):
        if isinstance(x, Vector2):
            self.x, self.y = float(x.x), float(x.y)
        elif isinstance(x, (tuple, list)):
            self.x, self.y = float(x[0]), float(x[1])
        else:
            self.x, self.y = float(x), float(y)

    def __repr__(self):
        return f"Vector2({self.x}, {self.y})"

    def __iter__(self):
        yield self.x
        yield self.y

    def __eq__(self, other):
        if isinstance(other, Vector2):
            return self.x == other.x and self.y == other.y
        if isinstance(other, (tuple, list)) and len(other) == 2:
            return self.x == other[0] and self.y == other[1]
        return NotImplemented

    def __hash__(self):
        return hash((self.x, self.y))

    def __add__(self, other):
        ox, oy = _vec_pair(other)
        return Vector2(self.x + ox, self.y + oy)

    def __radd__(self, other):
        return self.__add__(other)

    def __sub__(self, other):
        ox, oy = _vec_pair(other)
        return Vector2(self.x - ox, self.y - oy)

    def __rsub__(self, other):
        ox, oy = _vec_pair(other)
        return Vector2(ox - self.x, oy - self.y)

    def __neg__(self):
        return Vector2(-self.x, -self.y)

    def __mul__(self, scalar):
        return Vector2(self.x * scalar, self.y * scalar)

    def __rmul__(self, scalar):
        return Vector2(self.x * scalar, self.y * scalar)

    def __truediv__(self, scalar):
        return Vector2(self.x / scalar, self.y / scalar)

    def __iadd__(self, other):
        ox, oy = _vec_pair(other)
        self.x += ox
        self.y += oy
        return self

    def __isub__(self, other):
        ox, oy = _vec_pair(other)
        self.x -= ox
        self.y -= oy
        return self

    @property
    def length(self):
        return math.sqrt(self.x * self.x + self.y * self.y)

    @property
    def length_sq(self):
        return self.x * self.x + self.y * self.y

    def distance_to(self, other):
        ox, oy = _vec_pair(other)
        dx = self.x - ox
        dy = self.y - oy
        return math.sqrt(dx * dx + dy * dy)

    def dot(self, other):
        ox, oy = _vec_pair(other)
        return self.x * ox + self.y * oy

    def normalized(self):
        n = self.length
        if n == 0:
            return Vector2(0, 0)
        return Vector2(self.x / n, self.y / n)


def _vec_pair(other):
    if isinstance(other, Vector2):
        return other.x, other.y
    if isinstance(other, (tuple, list)) and len(other) == 2:
        return float(other[0]), float(other[1])
    raise TypeError(f"Expected Vector2 or 2-tuple, got {type(other).__name__}")


# `Point` reads more naturally for positions; same class as Vector2.
Point = Vector2


def Polar(magnitude, angle_degrees):
    """Vector2 from a magnitude and angle in degrees.

    Angle convention matches actor.angle and actor.move(): 0° = east (+x),
    90° = south (+y) — counterclockwise increases in math but clockwise on
    screen because the y axis points down.

    Common uses:
        player.vel = Polar(120, 60)         # 120 px/frame at 60°
        bullet.vel = Polar(8, ship.angle)   # match the ship's facing
        wind = Polar(2, 0)                  # blow east
    """
    rad = math.radians(float(angle_degrees))
    return Vector2(float(magnitude) * math.cos(rad), float(magnitude) * math.sin(rad))


from graphics.actors import Actor, Rect, Circle, Group, Collider  # noqa: E402


# === ANCHOR POINT ===


class AnchorPoint(Vector2):
    """A resolved position with alignment hints for text() and say().

    Behaves as a Vector2 for arithmetic and `tile_at(anchor)`; its x/y may be
    lazy (e.g. Window.center recomputes when the canvas size changes).
    """

    def __init__(self, x, y, h_align="left", v_align="top"):
        self._x = x        # callable or number
        self._y = y
        self.h_align = h_align   # "left" | "center" | "right"
        self.v_align = v_align   # "top" | "middle" | "bottom"

    @property
    def x(self):
        return self._x() if callable(self._x) else self._x

    @x.setter
    def x(self, value):
        self._x = value

    @property
    def y(self):
        return self._y() if callable(self._y) else self._y

    @y.setter
    def y(self, value):
        self._y = value


# === MOUSE SINGLETON ===


class _Mouse:
    @property
    def x(self):
        return _mouse_x

    @property
    def y(self):
        return _mouse_y

    @property
    def pressed(self):
        return _mouse_clicked

    @property
    def down(self):
        return _mouse_down

    @property
    def released(self):
        return _mouse_released


Mouse = _Mouse()


# === KEYBOARD SINGLETON ===


class _Key:
    def __init__(self, code):
        self._code = code

    @property
    def pressed(self):
        return self._code in _keys_pressed

    @property
    def down(self):
        return self._code in _keys_down

    @property
    def released(self):
        return self._code in _keys_released


class _Keyboard:
    def __getattr__(self, name):
        code = _KEY_CODES.get(name.lower(), 0)
        if code == 0:
            raise AttributeError(f"Unknown key: {name!r}. Try Keyboard.arrow_left, Keyboard.space, Keyboard.a, Keyboard.key_1, etc.")
        return _Key(code)

    def __getitem__(self, name: str) -> _Key:
        code = _KEY_CODES.get(str(name).lower(), 0)
        if code == 0:
            raise KeyError(f"Unknown key: {name!r}")
        return _Key(code)


Keyboard = _Keyboard()


# === WINDOW SINGLETON ===


class _Window:
    """Canvas window singleton. Access size, anchors, and run the game loop."""

    @property
    def width(self):
        return _width

    @property
    def height(self):
        return _height

    def size(self, w, h):
        _size(w, h)

    def run(self, main=None, fps=60):
        _run(main, fps)

    def stop(self):
        _stop()

    # --- anchor points ---

    @property
    def top_left(self):
        return AnchorPoint(0, 0, "left", "top")

    @property
    def top_right(self):
        return AnchorPoint(lambda: _width, 0, "right", "top")

    @property
    def bottom_left(self):
        return AnchorPoint(0, lambda: _height, "left", "bottom")

    @property
    def bottom_right(self):
        return AnchorPoint(lambda: _width, lambda: _height, "right", "bottom")

    @property
    def center(self):
        return AnchorPoint(lambda: _width / 2, lambda: _height / 2, "center", "middle")

    @property
    def top(self):
        return AnchorPoint(lambda: _width / 2, 0, "center", "top")

    @property
    def bottom(self):
        return AnchorPoint(lambda: _width / 2, lambda: _height, "center", "bottom")

    @property
    def left(self):
        return AnchorPoint(0, lambda: _height / 2, "left", "middle")

    @property
    def right(self):
        return AnchorPoint(lambda: _width, lambda: _height / 2, "right", "middle")


Window = _Window()


# === LOW-LEVEL HELPERS ===


def _color_str(r, g=None, b=None):
    if g is None:
        return f"rgb({int(r)},{int(r)},{int(r)})"
    return f"rgb({int(r)},{int(g)},{int(b)})"


def _resolve_color(r, g=None, b=None):
    """Returns an (r, g, b) tuple from various input forms."""
    if isinstance(r, tuple):
        return (int(r[0]), int(r[1]), int(r[2]))
    if isinstance(r, str):
        return COLOR_NAMES.get(r.lower(), (255, 255, 255))
    if g is None:
        return (int(r), int(r), int(r))
    return (int(r), int(g), int(b))


def _anchor_pad_x(anchor, padding):
    if anchor.h_align == "left":
        return anchor.x + padding
    if anchor.h_align == "right":
        return anchor.x - padding
    return anchor.x


def _anchor_pad_y(anchor, padding):
    if anchor.v_align == "top":
        return anchor.y + padding
    if anchor.v_align == "bottom":
        return anchor.y - padding
    return anchor.y


def _init(canvas=None):
    pass


# === SIZE ===


def _size(w, h):
    global _pending_size, _width, _height
    _pending_size = (int(w), int(h))
    _width = int(w)
    _height = int(h)


def size(w: Union[int, float], h: Union[int, float]) -> None:
    _size(w, h)


def width() -> int:
    return _width


def height() -> int:
    return _height


# === DRAWING ===


def circle(x, y, r) -> None:
    _draw_commands.append(("circle", (float(x), float(y), float(r)), {}))


def rect(x, y, w, h) -> None:
    _draw_commands.append(("rect", (float(x), float(y), float(w), float(h)), {}))


def ellipse(x, y, w, h=None) -> None:
    if h is None:
        h = w
    _draw_commands.append(("ellipse", (float(x), float(y), float(w), float(h)), {}))


def line(x1, y1, x2, y2) -> None:
    _draw_commands.append(("line", (float(x1), float(y1), float(x2), float(y2)), {}))


def point(x, y) -> None:
    _draw_commands.append(("point", (float(x), float(y)), {}))


def text(s: Any, x_or_anchor, y=None, *, padding: int = 6) -> None:
    if isinstance(x_or_anchor, AnchorPoint):
        a = x_or_anchor
        _draw_commands.append(("text_align", (a.h_align, a.v_align), {}))
        px = _anchor_pad_x(a, padding)
        py = _anchor_pad_y(a, padding)
        _draw_commands.append(("text", (str(s), px, py), {}))
    else:
        _draw_commands.append(("text", (str(s), float(x_or_anchor), float(y)), {}))


def say(s: Any, anchor, *, padding: int = 8) -> None:
    """Draw a speech bubble with a tail pointing at anchor."""
    _draw_commands.append(("say", (str(s), float(anchor.x), float(anchor.y), anchor.h_align, anchor.v_align, int(padding)), {}))


def text_size(n) -> None:
    _draw_commands.append(("text_size", (int(n),), {}))


def text_align(horizontal: str, vertical: Optional[str] = None) -> None:
    h = horizontal.lower() if isinstance(horizontal, str) else horizontal
    v = vertical.lower() if vertical and isinstance(vertical, str) else vertical
    _draw_commands.append(("text_align", (h, v), {}))


# === COLOR ===


def fill(r=None, g=None, b=None) -> None:
    global _fill_color, _current_fill
    if r is None:
        _current_fill = False
        _draw_commands.append(("no_fill", (), {}))
        return
    color = _resolve_color(r, g, b)
    _fill_color = color
    _current_fill = True
    _draw_commands.append(("fill", color, {}))


def no_fill() -> None:
    global _current_fill
    _current_fill = False
    _draw_commands.append(("no_fill", (), {}))


def stroke(r=None, g=None, b=None) -> None:
    global _stroke_color, _current_stroke
    if r is None:
        _current_stroke = False
        _draw_commands.append(("no_stroke", (), {}))
        return
    color = _resolve_color(r, g, b)
    _stroke_color = color
    _current_stroke = True
    _draw_commands.append(("stroke", color, {}))


def no_stroke() -> None:
    global _current_stroke
    _current_stroke = False
    _draw_commands.append(("no_stroke", (), {}))


def stroke_width(w) -> None:
    global _stroke_width
    _stroke_width = int(w)
    _draw_commands.append(("stroke_width", (int(w),), {}))


def background(r, g=None, b=None) -> None:
    color = _resolve_color(r, g, b)
    _draw_commands.append(("background", color, {}))


# === TRANSFORM ===


def push() -> None:
    _draw_commands.append(("push", (), {}))


def pop() -> None:
    _draw_commands.append(("pop", (), {}))


def translate(x, y) -> None:
    _draw_commands.append(("translate", (float(x), float(y)), {}))


def rotate(angle) -> None:
    _draw_commands.append(("rotate", (float(angle),), {}))


def scale(x, y=None) -> None:
    if y is None:
        y = x
    _draw_commands.append(("scale", (float(x), float(y)), {}))


# === IMAGE ===


def image(img_result: Any, x, y, w=None, h=None) -> None:
    if isinstance(img_result, dict):
        if not img_result.get("done"):
            return
        if "anim_name" in img_result:
            anim_name = img_result["anim_name"]
            frame_idx = img_result.get("frame_idx", 0)
            _draw_commands.append(("animation_frame", (anim_name, frame_idx, float(x), float(y), w, h), {}))
        elif "name" in img_result:
            name = img_result["name"]
            _draw_commands.append(("image", (name, float(x), float(y), w, h), {}))
    else:
        _draw_commands.append(("image", (str(img_result), float(x), float(y), w, h), {}))


# === RANDOM HELPERS ===


def random(low, high=None) -> float:
    import random as _random
    if high is None:
        return _random.uniform(0, low)
    return _random.uniform(low, high)


def random_color() -> tuple:
    import random as _random
    names = [n for n in dir(Colors) if not n.startswith("_") and isinstance(getattr(Colors, n), tuple)]
    if names:
        return getattr(Colors, _random.choice(names))
    return _random.choice(list(COLOR_NAMES.values()))


def frame_rate(fps) -> None:
    global _target_fps
    _target_fps = int(fps)


# === RUN ===


def _tick(main, my_generation):
    global _pending_timer_id, frame_count, _mouse_clicked, _mouse_released
    global _running, _stop_requested, _loop_generation
    from js import clearTimeout, setTimeout, _ide_flush_draw_commands
    from pyodide.ffi import create_proxy, to_js
    from graphics.actors import Actor

    if _loop_generation != my_generation:
        return
    if not _running:
        return
    if _stop_requested:
        _running = False
        return

    try:
        _ide_flush_draw_commands(to_js(_draw_commands))
        _draw_commands.clear()

        for actor in Actor.all_actors():
            if actor.is_alive():
                actor._apply_velocity()
                actor.update()

        if main is not None:
            main()

        _mouse_clicked = False
        _mouse_released = False
        _keys_pressed.clear()
        _keys_released.clear()

        _ide_flush_draw_commands(to_js(_draw_commands))
        _draw_commands.clear()
        frame_count += 1

    except Exception:
        traceback.print_exc()
        _running = False
        return

    elapsed = 1000 / _target_fps
    _pending_timer_id = setTimeout(tick_proxy, int(elapsed))


tick_proxy = None


def _run(main=None, fps=60) -> None:
    from js import setTimeout, _ide_canvas_resize  # type: ignore
    from pyodide.ffi import create_proxy

    global _running, _stop_requested, _loop_generation, frame_count, _target_fps
    global _pending_timer_id, tick_proxy, _width, _height

    _target_fps = int(fps)

    if _pending_timer_id is not None:
        from js import clearTimeout
        clearTimeout(_pending_timer_id)

    if _pending_size:
        _width, _height = _pending_size

    _ide_canvas_resize(_width, _height)

    _running = True
    _stop_requested = False
    _loop_generation += 1
    my_generation = _loop_generation
    frame_count = 0

    tick_proxy = create_proxy(lambda: _tick(main, my_generation))
    _pending_timer_id = setTimeout(tick_proxy, 0)


def run(main=None, fps=60) -> None:
    _run(main, fps)


# === STOP ===


def _stop() -> None:
    global _stop_requested, _pending_timer_id
    from js import clearTimeout
    if _pending_timer_id is not None:
        clearTimeout(_pending_timer_id)
        _pending_timer_id = None
    _stop_requested = True


def stop() -> None:
    _stop()


# === EVENT INJECTION ===


def _inject_event(kind, data):
    global _mouse_x, _mouse_y, _mouse_down, _mouse_clicked, _mouse_released, _keys_down

    if not isinstance(data, dict):
        data = data.to_py() if hasattr(data, "to_py") else {}

    if kind == "mousemove":
        _mouse_x = float(data.get("x", 0))
        _mouse_y = float(data.get("y", 0))
    elif kind == "mousedown":
        _mouse_down = True
        _mouse_clicked = True
    elif kind == "mouseup":
        _mouse_down = False
        _mouse_released = True
    elif kind == "keydown":
        key_code = int(data.get("keyCode", 0))
        if key_code not in _keys_down:
            _keys_down.add(key_code)
            _keys_pressed.add(key_code)
    elif kind == "keyup":
        key_code = int(data.get("keyCode", 0))
        _keys_down.discard(key_code)
        _keys_released.add(key_code)


# === CLEAR ===


def _reset_run_state():
    """Reset state between program runs while maintaining monotonic loop generation."""
    global frame_count, _loop_generation
    global _mouse_x, _mouse_y, _mouse_down, _mouse_clicked, _mouse_released
    global _keys_down, _keys_pressed, _keys_released

    frame_count = 0
    _loop_generation += 1
    _mouse_x = 0
    _mouse_y = 0
    _mouse_down = False
    _mouse_clicked = False
    _mouse_released = False
    _keys_down = set()
    _keys_pressed = set()
    _keys_released = set()


def _clear():
    global _draw_commands, _pending_size
    global frame_count, _stop_requested, _running, _loop_generation
    global _mouse_x, _mouse_y, _mouse_down, _mouse_clicked, _mouse_released
    global _keys_down, _keys_pressed, _keys_released
    global _fill_color, _stroke_color, _stroke_width, _width, _height
    global _current_fill, _current_stroke, _pending_timer_id
    from js import clearTimeout
    from graphics.actors import Actor

    if _pending_timer_id is not None:
        clearTimeout(_pending_timer_id)
        _pending_timer_id = None

    _draw_commands = []
    _pending_size = None
    frame_count = 0
    _stop_requested = False
    _running = False
    _loop_generation = 0
    _mouse_x = 0
    _mouse_y = 0
    _mouse_down = False
    _mouse_clicked = False
    _mouse_released = False
    _keys_down = set()
    _keys_pressed = set()
    _keys_released = set()
    _fill_color = (255, 255, 255)
    _stroke_color = (0, 0, 0)
    _stroke_width = 1
    _current_fill = True
    _current_stroke = True
    Actor._registry.clear()
    Actor._id_counter = 0


class TileRef(Rect):
    """Lightweight tile collider returned by `all_tiles`.

    Subclass of Rect that removes itself from the global Actor registry so the
    game loop does not tick or auto-draw it. The TilemapLayer renders its tiles
    via `tilemap_layer` draw commands; TileRefs exist purely as colliders.

    `size` is a shortcut for square cells (the default `all_tiles` behavior);
    pass `width`/`height` instead for merged multi-cell rectangles produced by
    `all_tiles(tag, merge=True)`.
    """

    def __init__(self, x, y, size=None, *, width=None, height=None):
        if size is not None:
            width = height = size
        super().__init__(x=x, y=y, width=width, height=height, color="white")
        if self in Actor._registry:
            Actor._registry.remove(self)

    def draw(self):
        # No-op: actual tile pixels are drawn by TilemapLayer.draw.
        pass


def _merge_tile_rects(cells_set, tile_size):
    """Greedy 2D rectangle merger over a set of (col, row) tile coordinates.

    Returns a list of (cx, cy, w, h) tuples covering exactly the input cells
    with the fewest axis-aligned rectangles found by a one-pass greedy:
    pick the lowest (col, row) cell remaining, grow the strip right until it
    breaks, then grow it down as long as every column in the strip stays
    filled. Repeat. Strictly worse than minimum-rect-cover in pathological
    cases but optimal for typical level layouts (long walls, blocks).
    """
    remaining = set(cells_set)
    rects = []
    while remaining:
        # Lowest-(col, row) for deterministic output.
        c0, r0 = min(remaining)
        # Grow east.
        c1 = c0
        while (c1 + 1, r0) in remaining:
            c1 += 1
        # Grow south while every column in [c0..c1] of the next row is filled.
        r1 = r0
        while True:
            next_row = r1 + 1
            if any((c, next_row) not in remaining for c in range(c0, c1 + 1)):
                break
            r1 = next_row
        for c in range(c0, c1 + 1):
            for r in range(r0, r1 + 1):
                remaining.discard((c, r))
        w = (c1 - c0 + 1) * tile_size
        h = (r1 - r0 + 1) * tile_size
        cx = c0 * tile_size + w / 2
        cy = r0 * tile_size + h / 2
        rects.append((cx, cy, w, h))
    return rects


class TilemapLayer:
    """A single named layer in a tilemap. Cells addressed by (col, row) integers."""

    def __init__(self, name: str, tile_size: int, cells: dict, bitmaps: dict = {}):
        self.name = name
        self.tile_size = tile_size
        self._cells = cells    # dict[int, dict[int, str]]
        self._tags = {}        # dict[str, set[str]]  — tile_name → set of tag strings
        self._tag_group_cache = {}  # dict[str, Group]

    def tag(self, name, *tags):
        """Associate one or more tags with a tile name. Idempotent (set semantics)."""
        existing = self._tags.setdefault(name, set())
        for t in tags:
            existing.add(t)
        self._tag_group_cache.clear()
        return self

    def all_tiles(self, tag, merge=False):
        """Return a Group of TileRef colliders for every cell whose tile-name has `tag`.

        With `merge=True`, run a greedy 2D rectangle merger so adjacent tagged
        cells collapse into larger rectangles. Identical collision behavior,
        but obstacle count drops dramatically — critical when feeding the
        result to `Light.add_obstacles` since the raycaster is O(N^2) per
        source. A wall stripe of 30 tiles becomes 1 rectangle.
        """
        cache_key = (tag, bool(merge))
        cached = self._tag_group_cache.get(cache_key)
        if cached is not None:
            return cached
        result = Group()
        matching = {n for n, ts in self._tags.items() if tag in ts}
        if matching:
            if merge:
                tagged_cells = {
                    (col, row)
                    for col, rows in self._cells.items()
                    for row, name in rows.items()
                    if name in matching
                }
                for cx, cy, w, h in _merge_tile_rects(tagged_cells, self.tile_size):
                    result.add(TileRef(cx, cy, width=w, height=h))
            else:
                half = self.tile_size / 2
                for col, rows in self._cells.items():
                    for row, name in rows.items():
                        if name in matching:
                            cx = col * self.tile_size + half
                            cy = row * self.tile_size + half
                            result.add(TileRef(cx, cy, self.tile_size))
        self._tag_group_cache[cache_key] = result
        return result

    def _has_tile_name(self, name):
        for rows in self._cells.values():
            for n in rows.values():
                if n == name:
                    return True
        return False

    def draw(self, x=0, y=0):
        cells_flat = [[col, row, name] for col, rows in self._cells.items() for row, name in rows.items()]
        _draw_commands.append(("tilemap_layer", (cells_flat, self.tile_size, float(x), float(y)), {}))

    def tile_at(self, px, py=None):
        if py is None:
            # Accept Vector2/AnchorPoint/tuple
            if isinstance(px, Vector2):
                px, py = px.x, px.y
            elif isinstance(px, (tuple, list)) and len(px) == 2:
                px, py = px[0], px[1]
            else:
                raise TypeError("tile_at requires (x, y) or a Vector2/Point")
        col = int(px // self.tile_size)
        row = int(py // self.tile_size)
        return self._cells.get(col, {}).get(row)

    def get_tile(self, col, row):
        return self._cells.get(col, {}).get(row)

    def tiles(self):
        for col, rows in self._cells.items():
            for row, name in rows.items():
                yield (col, row, name)


class TileMap:
    """A collection of named TilemapLayers, drawn bottom-to-top."""

    def __init__(self, layers: list, layer_by_name: dict):
        self._layers = layers
        self.layers = layer_by_name

    def __getattr__(self, name):
        try:
            return self.layers[name]
        except KeyError:
            raise AttributeError(f"TileMap has no layer '{name}'")

    def draw(self, x=0, y=0):
        for layer in self._layers:
            layer.draw(x, y)

    def tag(self, name, *tags):
        """Apply tags to every layer that contains the given tile name."""
        for layer in self._layers:
            if layer._has_tile_name(name):
                layer.tag(name, *tags)
        return self

    def all_tiles(self, tag, merge=False):
        """Aggregate `all_tiles(tag)` across every layer in this tilemap.

        `merge` is applied per layer — adjacent cells inside one layer collapse
        into rectangles, but cells in different layers are not merged across
        layer boundaries.
        """
        result = Group()
        for layer in self._layers:
            for actor in layer.all_tiles(tag, merge=merge):
                result.add(actor)
        return result


from graphics.animation import Animation  # noqa: E402


# === CAMERA ===


class Camera:
    """A 2D camera offset. Use as a context manager:

        cam = Camera()
        cam.follow(player)
        def main():
            with cam:
                level.draw()
                player.draw()

    On __enter__ the camera pushes a transform that shifts the view so its
    position is at the center of the canvas. On __exit__ it restores.
    """

    def __init__(self, x=0.0, y=0.0):
        self.pos = Vector2(x, y)
        self._target = None
        self._lerp = 1.0

    @property
    def x(self):
        return self.pos.x

    @x.setter
    def x(self, value):
        self.pos.x = float(value)

    @property
    def y(self):
        return self.pos.y

    @y.setter
    def y(self, value):
        self.pos.y = float(value)

    def follow(self, actor, lerp=1.0):
        """Center the view on `actor` each frame. lerp=1.0 snaps; <1 smooths."""
        self._target = actor
        self._lerp = float(lerp)
        return self

    def unfollow(self):
        self._target = None
        return self

    def _update_follow(self):
        if self._target is None:
            return
        tx = self._target.x
        ty = self._target.y
        if self._lerp >= 1.0:
            self.pos.x = tx
            self.pos.y = ty
        else:
            self.pos.x += (tx - self.pos.x) * self._lerp
            self.pos.y += (ty - self.pos.y) * self._lerp

    def __enter__(self):
        self._update_follow()
        push()
        # Center the view on `pos`: translate so world point `pos` lands at canvas center.
        translate(_width / 2 - self.pos.x, _height / 2 - self.pos.y)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pop()
        return False


# === THEMES ===


THEMES_DATA = {
    "default": {
        "palette": {
            "red":    (220,  60,  60),
            "green":  ( 50, 200,  80),
            "blue":   ( 60, 120, 255),
            "yellow": (255, 220,  40),
            "orange": (255, 140,  40),
            "purple": (180,  80, 220),
            "pink":   (255, 130, 180),
            "cyan":   ( 40, 210, 220),
            "white":  (255, 255, 255),
            "black":  (  0,   0,   0),
            "gray":   (150, 150, 150),
            "brown":  (160,  90,  40),
        },
        "ambient": (255, 255, 255),
        "light_shade": (255, 255, 255),
    },
    "summer": {
        "palette": {
            "red":    (255,  95,  60),
            "green":  (120, 220,  80),
            "blue":   ( 90, 170, 255),
            "yellow": (255, 230,  80),
            "orange": (255, 165,  60),
            "purple": (200, 120, 230),
            "pink":   (255, 165, 200),
            "cyan":   ( 80, 230, 230),
            "white":  (255, 250, 230),
            "black":  ( 40,  30,  20),
            "gray":   (180, 170, 140),
            "brown":  (180, 110,  60),
        },
        "ambient": (220, 210, 180),
        "light_shade": (255, 230, 180),
    },
    "dungeon": {
        "palette": {
            "red":    (180,  40,  40),
            "green":  ( 60, 140,  60),
            "blue":   ( 40,  80, 160),
            "yellow": (200, 170,  40),
            "orange": (200, 100,  40),
            "purple": (120,  60, 160),
            "pink":   (180,  90, 130),
            "cyan":   ( 40, 160, 170),
            "white":  (200, 200, 210),
            "black":  ( 10,  10,  15),
            "gray":   ( 90,  90, 100),
            "brown":  (110,  70,  40),
        },
        "ambient": (35, 30, 50),
        "light_shade": (255, 180, 110),
    },
    "moonlit": {
        "palette": {
            "red":    (200,  80,  90),
            "green":  (100, 180, 140),
            "blue":   (110, 150, 220),
            "yellow": (230, 220, 160),
            "orange": (220, 160, 100),
            "purple": (180, 140, 220),
            "pink":   (220, 170, 200),
            "cyan":   (140, 200, 220),
            "white":  (220, 230, 255),
            "black":  ( 10,  15,  30),
            "gray":   (120, 130, 160),
            "brown":  (120,  90,  80),
        },
        "ambient": (60, 70, 110),
        "light_shade": (190, 210, 255),
    },
}


class _Theme:
    """A named color theme. Access palette colors via attribute (`theme.green`)."""

    def __init__(self, name, data):
        # Use object.__setattr__ to avoid triggering __getattr__ during init.
        object.__setattr__(self, "name", name)
        object.__setattr__(self, "_palette", dict(data["palette"]))
        object.__setattr__(self, "ambient", tuple(data["ambient"]))
        object.__setattr__(self, "light_shade", tuple(data["light_shade"]))

    def __getattr__(self, name):
        # Called only when normal lookup fails.
        palette = object.__getattribute__(self, "_palette")
        if name in palette:
            return palette[name]
        raise AttributeError(
            f"Theme '{self.name}' has no color '{name}'. "
            f"Available: {sorted(palette.keys())}"
        )

    def __repr__(self):
        return f"_Theme({self.name!r})"


# Active theme name, set by the worker on each run via
# `graphics._active_theme_name = "<name>"`. Resolved dynamically by
# `Themes.current` so user code can do `Light.style(Themes.current)` without
# threading the name through itself.
_active_theme_name = "default"


class _Themes:
    """Top-level themes container; expose as module-level `Themes`.

    Attribute access returns a `_Theme` (e.g. `Themes.dungeon`). The special
    name `Themes.current` resolves to the active project theme at access time;
    holding it in a variable captures a snapshot of whichever theme was active
    at that moment.
    """

    def __init__(self):
        object.__setattr__(
            self, "_themes",
            {name: _Theme(name, data) for name, data in THEMES_DATA.items()},
        )

    def __getattr__(self, name):
        themes = object.__getattribute__(self, "_themes")
        if name == "current":
            # Resolve dynamically from the module-level active name; fall back
            # to "default" if a stale name slipped through.
            active = globals().get("_active_theme_name", "default")
            return themes.get(active, themes["default"])
        if name in themes:
            return themes[name]
        raise AttributeError(
            f"Unknown theme '{name}'. Available: {sorted(themes.keys())}"
        )

    def __contains__(self, name):
        return name in object.__getattribute__(self, "_themes")


Themes = _Themes()


# === LIGHTING ===


SHADES = {
    "neutral":   (255, 255, 255),
    "warm":      (255, 200, 140),
    "cool":      (180, 200, 255),
    "moonlight": (200, 220, 255),
    "candle":    (255, 180, 100),
}


def _flicker_value(seed, frame):
    """Deterministic noise in [0.85, 1.0] from (seed, frame_count)."""
    h = (seed * 2654435761 + frame * 40503) & 0xFFFFFFFF
    h = ((h >> 16) ^ h) * 0x45D9F3B & 0xFFFFFFFF
    h = ((h >> 16) ^ h) & 0xFFFFFFFF
    return 0.85 + (h / 0xFFFFFFFF) * 0.15


def _ray_rect(ox, oy, dx, dy, xmin, ymin, xmax, ymax):
    """Slab ray-AABB intersection; returns smallest non-negative t or None."""
    tmin = -math.inf
    tmax = math.inf
    if abs(dx) < 1e-9:
        if ox < xmin or ox > xmax:
            return None
    else:
        tx1 = (xmin - ox) / dx
        tx2 = (xmax - ox) / dx
        tmin = max(tmin, min(tx1, tx2))
        tmax = min(tmax, max(tx1, tx2))
    if abs(dy) < 1e-9:
        if oy < ymin or oy > ymax:
            return None
    else:
        ty1 = (ymin - oy) / dy
        ty2 = (ymax - oy) / dy
        tmin = max(tmin, min(ty1, ty2))
        tmax = min(tmax, max(ty1, ty2))
    if tmax < tmin or tmax < 0:
        return None
    return tmin if tmin >= 0 else tmax


def _ray_circle(ox, oy, dx, dy, cx, cy, r):
    fx, fy = ox - cx, oy - cy
    a = dx * dx + dy * dy
    b = 2 * (fx * dx + fy * dy)
    c = fx * fx + fy * fy - r * r
    disc = b * b - 4 * a * c
    if disc < 0:
        return None
    sq = math.sqrt(disc)
    t1 = (-b - sq) / (2 * a)
    t2 = (-b + sq) / (2 * a)
    if t1 >= 0:
        return t1
    if t2 >= 0:
        return t2
    return None


def _obstacle_rect(obs):
    """Return (xmin, ymin, xmax, ymax) bounding rect for an obstacle, or None."""
    col = getattr(obs, "collider", None)
    if col is None or col.shape is None:
        return None
    cx, cy = col.active_x, col.active_y
    if col.shape == "rect":
        hw, hh = col.width / 2, col.height / 2
        return (cx - hw, cy - hh, cx + hw, cy + hh)
    if col.shape == "circle":
        r = col.radius
        return (cx - r, cy - r, cx + r, cy + r)
    return None


def _compute_visibility_polygon(sx, sy, radius, obstacles):
    """Cast rays to obstacle bbox corners ± epsilon; return ordered polygon."""
    EPS = 1e-4
    angles = []
    rects = [r for r in (_obstacle_rect(o) for o in obstacles) if r is not None]

    for (xmin, ymin, xmax, ymax) in rects:
        for (px, py) in ((xmin, ymin), (xmax, ymin), (xmax, ymax), (xmin, ymax)):
            base = math.atan2(py - sy, px - sx)
            angles.append(base - EPS)
            angles.append(base)
            angles.append(base + EPS)

    if not angles:
        # No obstacles → emit a regular polygon approximating the radius circle.
        N = 24
        angles = [2 * math.pi * i / N for i in range(N)]

    angles.sort()

    poly = []
    for ang in angles:
        dx = math.cos(ang)
        dy = math.sin(ang)
        t_min = radius
        for (xmin, ymin, xmax, ymax) in rects:
            t = _ray_rect(sx, sy, dx, dy, xmin, ymin, xmax, ymax)
            if t is not None and 0 <= t < t_min:
                t_min = t
        poly.append((sx + dx * t_min, sy + dy * t_min))
    return poly


class Light:
    """A multiply-blended lighting overlay with optional shadow-casting sources.

    Usage:
        tlight = Light(ambient=(40, 40, 60), radius=180)
        tlight.add_obstacles(level.all_tiles("wall"))
        tlight.add_source(torch)
        tlight.shade("warm").flicker(True)
        # In main(): call tlight.draw() last so it composites over all drawing.
    """

    _seed_counter = 0

    def __init__(self, ambient=(40, 40, 60), radius=200):
        self._ambient = tuple(int(c) for c in ambient)
        self._radius = float(radius)
        self._shade_rgb = (255, 255, 255)
        self._obstacles = []
        self._sources = []   # list of ("actor", Actor) | ("pos", (x, y))
        self._flicker = False
        Light._seed_counter += 1
        self._seed = Light._seed_counter
        # Polygon cache. Visibility polygons depend only on (source position,
        # radius, obstacle AABBs) — none of which usually change per frame.
        # We snapshot the obstacle AABBs once and the per-source key on each
        # draw(); polygons are only recomputed when their inputs differ.
        # _cache_counters is exposed for tests.
        self._obstacle_fp = None     # tuple of obstacle AABBs from last draw
        self._source_polys = []      # parallel to _sources: (sx, sy, radius, poly, poly_flat)
        self._cache_counters = {"recomputed": 0, "reused": 0}

    def _invalidate_polys(self):
        """Drop all cached visibility polygons; next draw() rebuilds them."""
        self._obstacle_fp = None
        self._source_polys = []

    def _add_one_obstacle(self, obs):
        if obs is not None:
            self._obstacles.append(obs)
            self._invalidate_polys()

    def add_obstacles(self, src):
        """Add an iterable (Group, list, all_tiles result) or a single Actor."""
        if isinstance(src, Actor):
            self._add_one_obstacle(src)
        elif hasattr(src, "__iter__"):
            for a in src:
                self._add_one_obstacle(a)
        else:
            self._add_one_obstacle(src)
        return self

    # Alias matching the spec naming.
    def add_obst(self, src):
        return self.add_obstacles(src)

    def add_source(self, src):
        """Add an Actor, Group, position tuple, or Vector2 as a light source."""
        if isinstance(src, Vector2):
            self._sources.append(("pos", (float(src.x), float(src.y))))
        elif isinstance(src, (tuple, list)) and len(src) == 2 and not isinstance(src, Actor):
            self._sources.append(("pos", (float(src[0]), float(src[1]))))
        elif isinstance(src, Actor):
            self._sources.append(("actor", src))
        elif hasattr(src, "__iter__"):
            for a in src:
                if isinstance(a, Actor):
                    self._sources.append(("actor", a))
        else:
            self._sources.append(("actor", src))
        # Truncate the parallel poly cache; per-source comparison handles
        # mismatched lengths gracefully but explicit is clearer.
        self._source_polys = self._source_polys[: len(self._sources)]
        return self

    def shade(self, name):
        if name not in SHADES:
            raise ValueError(
                f"Unknown shade '{name}'. Available: {sorted(SHADES.keys())}"
            )
        self._shade_rgb = SHADES[name]
        return self

    def flicker(self, enabled=True):
        self._flicker = bool(enabled)
        return self

    def radius(self, r):
        self._radius = float(r)
        return self

    def style(self, theme):
        """Set ambient + shade RGB from a theme (object or name string)."""
        if isinstance(theme, str):
            if theme not in THEMES_DATA:
                raise ValueError(
                    f"Unknown theme '{theme}'. Available: {sorted(THEMES_DATA.keys())}"
                )
            theme = getattr(Themes, theme)
        self._ambient = tuple(int(c) for c in theme.ambient)
        self._shade_rgb = tuple(int(c) for c in theme.light_shade)
        return self

    def _source_position(self, src):
        kind, val = src
        if kind == "actor":
            return (float(val._x), float(val._y))
        return val  # already (x, y)

    def _intensity(self):
        if self._flicker:
            return _flicker_value(self._seed, frame_count)
        return 1.0

    def _obstacle_fingerprint(self):
        """Tuple of obstacle AABBs — cheap to compare; changes when any
        obstacle moves or resizes."""
        return tuple(
            r for r in (_obstacle_rect(o) for o in self._obstacles) if r is not None
        )

    def draw(self):
        """Emit light_begin / light_poly* / light_end into the draw stream.

        Visibility polygons are cached and only recomputed when their inputs
        change (source moved, radius changed, or any obstacle moved/resized).
        For a fully static scene the per-frame cost drops to O(sources +
        obstacles) — just the fingerprint comparison.
        """
        _draw_commands.append(("light_begin", self._ambient, {}))

        obstacle_fp = self._obstacle_fingerprint()
        obstacles_changed = obstacle_fp != self._obstacle_fp
        radius = self._radius

        for i, src in enumerate(self._sources):
            sx, sy = self._source_position(src)
            cached = self._source_polys[i] if i < len(self._source_polys) else None
            if (cached is not None
                    and not obstacles_changed
                    and cached[0] == sx
                    and cached[1] == sy
                    and cached[2] == radius):
                _, _, _, poly, poly_flat = cached
                self._cache_counters["reused"] += 1
            else:
                poly = _compute_visibility_polygon(sx, sy, radius, self._obstacles)
                poly_flat = [float(c) for p in poly for c in p]
                entry = (sx, sy, radius, poly, poly_flat)
                if i < len(self._source_polys):
                    self._source_polys[i] = entry
                else:
                    self._source_polys.append(entry)
                self._cache_counters["recomputed"] += 1

            intensity = self._intensity()
            _draw_commands.append((
                "light_poly",
                (poly_flat, float(sx), float(sy), float(radius),
                 tuple(self._shade_rgb), float(intensity)),
                {},
            ))

        if obstacles_changed:
            self._obstacle_fp = obstacle_fp

        _draw_commands.append(("light_end", (), {}))


__all__ = [
    "_version",
    "size", "width", "height",
    "circle", "rect", "ellipse", "line", "point",
    "text", "text_size", "text_align",
    "say",
    "fill", "no_fill", "stroke", "no_stroke", "stroke_width",
    "background",
    "push", "pop", "translate", "rotate", "scale",
    "image",
    "frame_rate", "frame_count",
    "random", "random_color",
    "Colors", "AnchorPoint",
    "Vector2", "Point", "Polar",
    "Mouse", "Keyboard", "Window",
    "Actor", "Rect", "Circle", "Group", "Collider",
    "Camera",
    "TilemapLayer", "TileMap", "TileRef",
    "Themes", "Light",
    "Animation",
    "run", "stop",
    "assets",
]
