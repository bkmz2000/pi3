"""
graphics module

Provides a simple graphics API for creating games and visualizations.
Import as: import graphics as g
from graphics.actors import Actor, Rect, Circle, Group
"""

import math
import traceback
from types import SimpleNamespace
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

# Sweetie 16 palette by GrafxKid (https://lospec.com/palette-list/sweetie-16).
# Locked color palette — used by both Colors.<name> and fill("<name>") lookups.
COLOR_NAMES = {
    "black":  ( 26,  28,  44),
    "wine":   ( 93,  39,  93),
    "red":    (177,  62,  83),
    "orange": (239, 125,  87),
    "yellow": (255, 205, 117),
    "lime":   (167, 240, 112),
    "green":  ( 56, 183, 100),
    "teal":   ( 37, 113, 121),
    "navy":   ( 41,  54, 111),
    "blue":   ( 59,  93, 201),
    "sky":    ( 65, 166, 246),
    "cyan":   (115, 239, 247),
    "white":  (244, 244, 244),
    "silver": (148, 176, 194),
    "gray":   ( 86, 108, 134),
    "slate":  ( 51,  60,  87),
}


class _Colors:
    """Named color palette. Locked to Sweetie 16."""
    black  = COLOR_NAMES["black"]
    wine   = COLOR_NAMES["wine"]
    red    = COLOR_NAMES["red"]
    orange = COLOR_NAMES["orange"]
    yellow = COLOR_NAMES["yellow"]
    lime   = COLOR_NAMES["lime"]
    green  = COLOR_NAMES["green"]
    teal   = COLOR_NAMES["teal"]
    navy   = COLOR_NAMES["navy"]
    blue   = COLOR_NAMES["blue"]
    sky    = COLOR_NAMES["sky"]
    cyan   = COLOR_NAMES["cyan"]
    white  = COLOR_NAMES["white"]
    silver = COLOR_NAMES["silver"]
    gray   = COLOR_NAMES["gray"]
    slate  = COLOR_NAMES["slate"]


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
    # Accept an asset dict (sprite reference) → draw stretched to fill canvas.
    if isinstance(r, dict) and r.get("done") and "name" in r:
        _draw_commands.append(("background_image", (r["name"],), {}))
        return
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


import time as _time


class Sound:
    """Audio clip controlled from Python. Audio playback lives on the main
    thread; this class just sends messages.

    Usage:
        assets.sounds.pop.play()
        assets.sounds.music.loop()
        assets.sounds.music.stop()
    """

    def __init__(self, name):
        self.name = name

    def _post(self, action):
        try:
            import js
            js._ide_post_sound(action, self.name)
        except Exception:
            pass

    def play(self):
        self._post("play")

    def loop(self):
        self._post("loop")

    def pause(self):
        self._post("pause")

    def stop(self):
        self._post("stop")


class Timer:
    """Poll-based countdown timer in seconds.

    Usage:
        t = Timer(s=2)
        # in update():
        if t.done():
            spawn_enemy()
            t.restart()
    """

    def __init__(self, s=None, ms=None):
        if s is None and ms is None:
            self._duration = 0.0
        elif s is not None:
            self._duration = float(s)
        else:
            self._duration = float(ms) / 1000.0
        self._start = _time.monotonic()

    def left(self) -> float:
        return self._duration - (_time.monotonic() - self._start)

    def elapsed(self) -> float:
        return _time.monotonic() - self._start

    def done(self) -> bool:
        return self.left() <= 0

    def restart(self, s=None, ms=None) -> None:
        if s is not None:
            self._duration = float(s)
        elif ms is not None:
            self._duration = float(ms) / 1000.0
        self._start = _time.monotonic()


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
    """Lightweight tile collider produced by tilemap areas.

    Subclass of Rect that removes itself from the global Actor registry so the
    game loop does not tick or auto-draw it. The TilemapLayer renders its tiles
    via `tilemap_layer` draw commands; TileRefs exist purely as colliders for
    `collides_any`.

    `size` is a shortcut for square cells; pass `width`/`height` instead for
    multi-cell rectangles produced by the area merger.
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
    """A collection of named TilemapLayers, drawn bottom-to-top.

    Named regions (cell-set zones brushed in the Tile Editor) are exposed as
    `tilemap.areas.<name>` — each is a Group of merged-rect colliders ready
    for `collides_any`. Areas span the whole tilemap; they do not belong to
    a specific layer.
    """

    def __init__(self, layers: list, layer_by_name: dict, areas: dict = None):
        self._layers = layers
        self.layers = layer_by_name
        self.areas = _build_areas_namespace(areas or {}, layers)

    def __getattr__(self, name):
        # Only reached when normal lookup fails; `layers`/`areas` are real
        # attributes so this is purely a layer-name shortcut.
        try:
            return self.layers[name]
        except KeyError:
            raise AttributeError(f"TileMap has no layer '{name}'")

    def draw(self, x=0, y=0):
        for layer in self._layers:
            layer.draw(x, y)


def _build_areas_namespace(areas: dict, layers: list):
    """Build a SimpleNamespace of `name → Group of merged-rect TileRefs`.

    Cell coordinates are interpreted in the tile grid; pixel size comes from
    the first layer's `tile_size` (all layers in a tilemap share size today).
    """
    tile_size = layers[0].tile_size if layers else 32
    built = {}
    for name, area in areas.items():
        cells = area.get("cells", []) if isinstance(area, dict) else area
        cell_set = {(int(c[0]), int(c[1])) for c in cells}
        group = Group()
        for cx, cy, w, h in _merge_tile_rects(cell_set, tile_size):
            group.add(TileRef(cx, cy, width=w, height=h))
        built[name] = group
    return SimpleNamespace(**built)


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

    def __init__(self, target=None, x=0.0, y=0.0):
        # Camera(actor)  → follow that actor from the start
        # Camera(x, y)   → fixed position (legacy)
        if isinstance(target, Actor):
            self.pos = Vector2(float(target.x), float(target.y))
            self._target = target
            self._lerp = 1.0
        else:
            self.pos = Vector2(x if target is None else target, y)
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
        tlight.add_obstacles(level.areas.walls)
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
        """Add an iterable (Group, list, tilemap area) or a single Actor."""
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
    "Light",
    "Animation",
    "run", "stop",
    "assets",
]
