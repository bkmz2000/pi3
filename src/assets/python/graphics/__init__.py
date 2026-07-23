"""
graphics module

Provides a simple graphics API for creating games and visualizations.
Import as: import graphics as g
from graphics.actors import Actor, Rect, Circle, Group
"""

import math
from types import SimpleNamespace
from typing import Any, Callable, Optional, Union

from graphics._errors import FriendlyError, FriendlyAttrError
from graphics._state_ns import State
from graphics import _state
from graphics._color import (
    COLOR_NAMES, _Colors, Colors, _SHADE_STEP,
    _is_number, _to_rgb, _resolve_color,
    _rgb_to_hsl, _hsl_to_rgb,
)
from graphics._vec import Vector2, _vec_pair, Point, Polar, AnchorPoint
from graphics.shapes import Line, Polygon, Spline
from graphics._sheet import SheetAnimation, SpriteEntry, SheetNamespace, AnimationController
from graphics._utils import clamp, randint, pick, Sound, Timer
from graphics._sprites import PixelView, _TRANSPARENT
from graphics._lighting_helpers import (
    _flicker_value, _ray_rect, _ray_circle, _obstacle_rect, _compute_visibility_polygon,
)

_version = "1.0"


def __getattr__(name):
    """Forward module-level attribute reads to _state for backward compatibility."""
    try:
        return getattr(_state, name)
    except AttributeError:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


# Public-API counter kept here so static analysis and __all__ see it.
# Maintained by _tick/_run/_reset_run_state/_clear in this module.
frame_count = 0


# === COLOR PUBLIC API ===
# Helpers (_to_rgb, _rgb_to_hsl, _hsl_to_rgb) live in _color.py.
# These functions must be def'd here so the static validator can find them.

def lerp(a, b, t):
    """Linear interpolation. Works on numbers OR colors.

    The single foundational primitive — kids learn it once for colors and
    it transfers directly to position, audio, time-of-day, etc.

        lerp(0, 10, 0.5)                     -> 5.0
        lerp(Colors.black, Colors.white, .5) -> (127, 127, 127)
        lerp((255,0,0), (0,0,255), 0.5)      -> (127, 0, 127)
    """
    if _is_number(a) and _is_number(b):
        return a + (b - a) * t
    ar, ag, ab = _to_rgb(a)
    br, bg, bb = _to_rgb(b)
    return (
        int(ar + (br - ar) * t),
        int(ag + (bg - ag) * t),
        int(ab + (bb - ab) * t),
    )


def darker(c, steps=1):
    """A darker shade of `c` — RGB lerp toward black.

    `steps` matches one editor darken-brush stroke per step.
    """
    return lerp(c, COLOR_NAMES["black"], min(1.0, max(0.0, steps * _SHADE_STEP)))


def lighter(c, steps=1):
    """A lighter shade of `c` — RGB lerp toward white."""
    return lerp(c, COLOR_NAMES["white"], min(1.0, max(0.0, steps * _SHADE_STEP)))


def saturated(c, steps=1):
    """A more-saturated version of `c` (HSL saturation shift, clamped at 1)."""
    r, g, b = _to_rgb(c)
    h, s, l = _rgb_to_hsl(r, g, b)
    s = max(0.0, min(1.0, s + steps * _SHADE_STEP))
    return _hsl_to_rgb(h, s, l)


def desaturated(c, steps=1):
    """A less-saturated version of `c` (HSL saturation shift, clamped at 0)."""
    r, g, b = _to_rgb(c)
    h, s, l = _rgb_to_hsl(r, g, b)
    s = max(0.0, min(1.0, s - steps * _SHADE_STEP))
    return _hsl_to_rgb(h, s, l)


# === SPRITES (PIXEL DATA) ===
#
# A Sprite is a rectangular RGBA pixel buffer that Python code can read and
# write. Substage 1a ships the data API only; the asset pipeline that exposes
# editor-drawn sprites and the canvas render path land in substage 1b.

class Sprite:
    """Mutable RGBA pixel buffer addressable by (x, y).

    Stored as a `bytearray` of length `width * height * 4`. Out-of-bounds
    reads return `None`; out-of-bounds writes are silently ignored — kids
    drawing with `set_pixel` in a loop should not have to bounds-check
    everywhere.
    """

    def __init__(self, width, height, pixels=None):
        self.width = int(width)
        self.height = int(height)
        n = self.width * self.height * 4
        if pixels is None:
            self.pixels = bytearray(n)
        else:
            buf = bytearray(pixels)
            if len(buf) != n:
                raise ValueError(
                    f"pixel buffer length {len(buf)} does not match {self.width}x{self.height}x4 = {n}"
                )
            self.pixels = buf
        self._original = bytearray(self.pixels)

    def _idx(self, x, y):
        if x < 0 or y < 0 or x >= self.width or y >= self.height:
            return -1
        return (y * self.width + x) * 4

    def reset(self):
        """Restore pixels to their original state (as loaded from the sheet or at creation time)."""
        self.pixels[:] = self._original

    def __iter__(self):
        """Yield a PixelView for every pixel, left-to-right, top-to-bottom."""
        for y in range(self.height):
            for x in range(self.width):
                yield PixelView(self, x, y)

    def __repr__(self):
        return f"Sprite({self.width}x{self.height})"


def create_sprite(width, height, fill=None):
    """Create a new blank Sprite. Optional `fill` paints every pixel.

        s = create_sprite(16, 16)
        s = create_sprite(16, 16, fill=Colors.sky)
    """
    sprite = Sprite(width, height)
    if fill is not None:
        r, g, b = _to_rgb(fill)
        buf = sprite.pixels
        for i in range(0, len(buf), 4):
            buf[i] = r
            buf[i + 1] = g
            buf[i + 2] = b
            buf[i + 3] = 255
    return sprite


def get_pixel(sprite, x, y):
    """Read a pixel as an (r, g, b) tuple. Returns `None` for fully
    transparent pixels (alpha = 0) and for out-of-bounds coords.
    """
    i = sprite._idx(int(x), int(y))
    if i < 0:
        return None
    p = sprite.pixels
    if p[i + 3] == 0:
        return None
    return (p[i], p[i + 1], p[i + 2])


def set_pixel(sprite, x, y, color):
    """Write a pixel. `color` accepts tuple, hex string, or palette name.
    Pass `None` to erase (fully transparent).

    Silently ignores out-of-bounds coords — no need to bounds-check inside
    a drawing loop.
    """
    i = sprite._idx(int(x), int(y))
    if i < 0:
        return
    p = sprite.pixels
    if color is None:
        p[i] = p[i + 1] = p[i + 2] = p[i + 3] = 0
        return
    r, g, b = _to_rgb(color)
    p[i] = r
    p[i + 1] = g
    p[i + 2] = b
    p[i + 3] = 255




def palette_swap(sprite, old_color, new_color):
    """Replace every pixel that exactly matches `old_color` with `new_color`.

    Exact RGB match — does not consider partial color similarity. Pass
    `new_color=None` to erase matching pixels.
    """
    o_r, o_g, o_b = _to_rgb(old_color)
    if new_color is None:
        n_r = n_g = n_b = 0
        n_a = 0
    else:
        n_r, n_g, n_b = _to_rgb(new_color)
        n_a = 255
    p = sprite.pixels
    for i in range(0, len(p), 4):
        if p[i + 3] != 0 and p[i] == o_r and p[i + 1] == o_g and p[i + 2] == o_b:
            p[i] = n_r
            p[i + 1] = n_g
            p[i + 2] = n_b
            p[i + 3] = n_a


def flood_fill(sprite, x, y, color):
    """Bucket-fill connected pixels of the same color, starting at (x, y).

    4-connected (orthogonal only). Stops at any color change, including
    transparency boundaries.
    """
    x, y = int(x), int(y)
    if x < 0 or y < 0 or x >= sprite.width or y >= sprite.height:
        return
    p = sprite.pixels
    w, h = sprite.width, sprite.height
    i0 = (y * w + x) * 4
    or_, og, ob, oa = p[i0], p[i0 + 1], p[i0 + 2], p[i0 + 3]
    if color is None:
        nr = ng = nb = 0
        na = 0
    else:
        nr, ng, nb = _to_rgb(color)
        na = 255
    if or_ == nr and og == ng and ob == nb and oa == na:
        return

    stack = [(x, y)]
    while stack:
        cx, cy = stack.pop()
        if cx < 0 or cy < 0 or cx >= w or cy >= h:
            continue
        ci = (cy * w + cx) * 4
        if (
            p[ci] != or_
            or p[ci + 1] != og
            or p[ci + 2] != ob
            or p[ci + 3] != oa
        ):
            continue
        p[ci] = nr
        p[ci + 1] = ng
        p[ci + 2] = nb
        p[ci + 3] = na
        stack.append((cx + 1, cy))
        stack.append((cx - 1, cy))
        stack.append((cx, cy + 1))
        stack.append((cx, cy - 1))


def darken(sprite, x, y, steps=1):
    """Mutating shade: replace pixel (x, y) with `darker(pixel, steps)`."""
    c = get_pixel(sprite, x, y)
    if c is None:
        return
    set_pixel(sprite, x, y, darker(c, steps))


def lighten(sprite, x, y, steps=1):
    """Mutating shade: replace pixel (x, y) with `lighter(pixel, steps)`."""
    c = get_pixel(sprite, x, y)
    if c is None:
        return
    set_pixel(sprite, x, y, lighter(c, steps))


def saturate(sprite, x, y, steps=1):
    """Mutating shade: replace pixel (x, y) with `saturated(pixel, steps)`."""
    c = get_pixel(sprite, x, y)
    if c is None:
        return
    set_pixel(sprite, x, y, saturated(c, steps))


def desaturate(sprite, x, y, steps=1):
    """Mutating shade: replace pixel (x, y) with `desaturated(pixel, steps)`."""
    c = get_pixel(sprite, x, y)
    if c is None:
        return
    set_pixel(sprite, x, y, desaturated(c, steps))




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

# Dict of name -> Sprite, populated by the worker at run time from
# editor-authored pixel assets. Empty until a run starts.
sheet = {}


from graphics.actors import Actor, Rect, Circle, Group, Collider  # noqa: E402


# === MOUSE SINGLETON ===


class _Mouse:
    @property
    def x(self):
        return _state._mouse_x

    @property
    def y(self):
        return _state._mouse_y

    @property
    def pos(self):
        return Vector2(_state._mouse_x, _state._mouse_y)

    @property
    def pressed(self):
        return _state._mouse_clicked

    @property
    def down(self):
        return _state._mouse_down

    @property
    def released(self):
        return _state._mouse_released


Mouse = _Mouse()


# === KEYBOARD SINGLETON ===


class _Key:
    def __init__(self, code):
        self._code = code

    @property
    def pressed(self):
        return self._code in _state._keys_pressed

    @property
    def down(self):
        return self._code in _state._keys_down

    @property
    def released(self):
        return self._code in _state._keys_released


class _Keyboard:
    def __getattr__(self, name):
        code = _KEY_CODES.get(name.lower(), 0)
        if code == 0:
            raise FriendlyAttrError(
                "friendlyError.naming.unknownKey",
                {"name": name},
                raw=f"Unknown key: {name!r}. Try Keyboard.arrow_left, Keyboard.space, Keyboard.a, Keyboard.key_1, etc.",
            )
        return _Key(code)

    def __getitem__(self, name: str) -> _Key:
        code = _KEY_CODES.get(str(name).lower(), 0)
        if code == 0:
            raise KeyError(f"Unknown key: {name!r}")
        return _Key(code)


Keyboard = _Keyboard()


# === WINDOW SINGLETON ===


class _Window:
    """Canvas window singleton. Access canvas size and anchor points."""

    @property
    def width(self):
        return _state._width

    @property
    def height(self):
        return _state._height

    # --- anchor points ---

    @property
    def top_left(self):
        return AnchorPoint(0, 0, "left", "top")

    @property
    def top_right(self):
        return AnchorPoint(lambda: _state._width, 0, "right", "top")

    @property
    def bottom_left(self):
        return AnchorPoint(0, lambda: _state._height, "left", "bottom")

    @property
    def bottom_right(self):
        return AnchorPoint(lambda: _state._width, lambda: _state._height, "right", "bottom")

    @property
    def center(self):
        return AnchorPoint(lambda: _state._width / 2, lambda: _state._height / 2, "center", "middle")

    @property
    def top(self):
        return AnchorPoint(lambda: _state._width / 2, 0, "center", "top")

    @property
    def bottom(self):
        return AnchorPoint(lambda: _state._width / 2, lambda: _state._height, "center", "bottom")

    @property
    def left(self):
        return AnchorPoint(0, lambda: _state._height / 2, "left", "middle")

    @property
    def right(self):
        return AnchorPoint(lambda: _state._width, lambda: _state._height / 2, "right", "middle")


Window = _Window()


# === LOW-LEVEL HELPERS ===


def _color_str(r, g=None, b=None):
    if g is None:
        return f"rgb({int(r)},{int(r)},{int(r)})"
    return f"rgb({int(r)},{int(g)},{int(b)})"



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
    _state._pending_size = (int(w), int(h))
    _state._width = int(w)
    _state._height = int(h)


def size(w: Union[int, float], h: Union[int, float]) -> None:
    _size(w, h)


def width() -> int:
    return _state._width


def height() -> int:
    return _state._height


# === DRAWING ===


def circle(x, y, r) -> None:
    _state._draw_commands.append(("circle", (float(x), float(y), float(r))))


def rect(x, y, w, h) -> None:
    _state._draw_commands.append(("rect", (float(x), float(y), float(w), float(h))))


def ellipse(x, y, w, h=None) -> None:
    if h is None:
        h = w
    _state._draw_commands.append(("ellipse", (float(x), float(y), float(w), float(h))))


def line(x1, y1, x2, y2) -> None:
    _state._draw_commands.append(("line", (float(x1), float(y1), float(x2), float(y2))))


def _flatten_points(points, name):
    if not hasattr(points, "__iter__"):
        raise FriendlyError(
            "friendlyError.apiMisuse.polylineNotIterable",
            {"name": name, "type": type(points).__name__},
        )
    out = []
    for i, p in enumerate(points):
        try:
            x, y = p
        except (TypeError, ValueError):
            raise FriendlyError(
                "friendlyError.apiMisuse.polylineBadPoint",
                {"name": name, "index": i, "value": repr(p)},
            )
        out.append(float(x))
        out.append(float(y))
    return out


def polyline(points) -> None:
    flat = _flatten_points(points, "polyline")
    if len(flat) < 4:
        return
    _state._draw_commands.append(("polyline", (flat,)))


def polygon(points) -> None:
    flat = _flatten_points(points, "polygon")
    if len(flat) < 6:
        return
    _state._draw_commands.append(("polygon", (flat,)))


def spline(points, tension: float = 0.5) -> None:
    flat = _flatten_points(points, "spline")
    if len(flat) < 4:
        return
    t = float(tension)
    if t < 0.0:
        t = 0.0
    elif t > 1.0:
        t = 1.0
    _state._draw_commands.append(("spline", (flat, t)))


def point(x, y) -> None:
    _state._draw_commands.append(("point", (float(x), float(y))))


def text(s: Any, x_or_anchor, y=None, *, padding: int = 6) -> None:
    if isinstance(x_or_anchor, AnchorPoint):
        a = x_or_anchor
        _state._draw_commands.append(("text_align", (a.h_align, a.v_align)))
        px = _anchor_pad_x(a, padding)
        py = _anchor_pad_y(a, padding)
        _state._draw_commands.append(("text", (str(s), px, py)))
    else:
        _state._draw_commands.append(("text", (str(s), float(x_or_anchor), float(y))))


def say(s: Any, anchor, *, padding: int = 8) -> None:
    """Draw a speech bubble with a tail pointing at anchor."""
    _state._draw_commands.append(("say", (str(s), float(anchor.x), float(anchor.y), anchor.h_align, anchor.v_align, int(padding))))


def text_size(n) -> None:
    _state._draw_commands.append(("text_size", (int(n),)))


def text_align(horizontal: str, vertical: Optional[str] = None) -> None:
    h = horizontal.lower() if isinstance(horizontal, str) else horizontal
    v = vertical.lower() if vertical and isinstance(vertical, str) else vertical
    _state._draw_commands.append(("text_align", (h, v)))


# === COLOR ===


def fill(r=None, g=None, b=None) -> None:
    if r is None:
        _state._current_fill = False
        _state._draw_commands.append(("no_fill", ()))
        return
    color = _resolve_color(r, g, b)
    _state._fill_color = color
    _state._current_fill = True
    _state._draw_commands.append(("fill", color))


def no_fill() -> None:
    _state._current_fill = False
    _state._draw_commands.append(("no_fill", ()))


def stroke(r=None, g=None, b=None) -> None:
    if r is None:
        _state._current_stroke = False
        _state._draw_commands.append(("no_stroke", ()))
        return
    color = _resolve_color(r, g, b)
    _state._stroke_color = color
    _state._current_stroke = True
    _state._draw_commands.append(("stroke", color))


def no_stroke() -> None:
    _state._current_stroke = False
    _state._draw_commands.append(("no_stroke", ()))


def stroke_width(w) -> None:
    _state._stroke_width = int(w)
    _state._draw_commands.append(("stroke_width", (int(w),)))


def background(r, g=None, b=None) -> None:
    # Accept an asset dict (sprite reference) → draw stretched to fill canvas.
    if isinstance(r, dict) and r.get("done") and "name" in r:
        _state._draw_commands.append(("background_image", (r["name"],)))
        return
    color = _resolve_color(r, g, b)
    _state._draw_commands.append(("background", color))


# === TRANSFORM ===


def push() -> None:
    _state._draw_commands.append(("push", ()))


def pop() -> None:
    _state._draw_commands.append(("pop", ()))


def translate(x, y) -> None:
    _state._draw_commands.append(("translate", (float(x), float(y))))


def rotate(angle) -> None:
    _state._draw_commands.append(("rotate", (float(angle),)))


def scale(x, y=None) -> None:
    if y is None:
        y = x
    _state._draw_commands.append(("scale", (float(x), float(y))))


# === IMAGE ===


def image(img_result: Any, x, y, w=None, h=None) -> None:
    if isinstance(img_result, Sprite):
        # Ship the RGBA bytes across the worker boundary — Pyodide's to_js
        # converts `bytes` to a Uint8Array. The renderer wraps it in an
        # ImageData and draws via a temp OffscreenCanvas so canvas transforms
        # (Camera, push/pop, scale) still apply.
        _state._draw_commands.append((
            "sprite",
            (bytes(img_result.pixels), int(img_result.width), int(img_result.height),
             float(x), float(y), w, h),
        ))
        return
    if isinstance(img_result, SpriteEntry):
        sprite = img_result._default_sprite()
        if sprite is not None:
            _state._draw_commands.append((
                "sprite",
                (bytes(sprite.pixels), int(sprite.width), int(sprite.height),
                 float(x), float(y), w, h),
            ))
        return
    if isinstance(img_result, SheetAnimation):
        sprite = img_result._default_sprite()
        if sprite is not None:
            _state._draw_commands.append((
                "sprite",
                (bytes(sprite.pixels), int(sprite.width), int(sprite.height),
                 float(x), float(y), w, h),
            ))
        return
    if isinstance(img_result, dict):
        if not img_result.get("done"):
            return
        if "anim_name" in img_result:
            anim_name = img_result["anim_name"]
            frame_idx = img_result.get("frame_idx", 0)
            _state._draw_commands.append(("animation_frame", (anim_name, frame_idx, float(x), float(y), w, h)))
        elif "name" in img_result:
            name = img_result["name"]
            _state._draw_commands.append(("image", (name, float(x), float(y), w, h)))
    else:
        _state._draw_commands.append(("image", (str(img_result), float(x), float(y), w, h)))


# === RANDOM HELPERS ===


def random(low, high=None) -> float:
    import random as _random
    if high is None:
        return _random.uniform(0, low)
    return _random.uniform(low, high)


def _noise_hash(ix, iy, seed):
    # Deterministic 32-bit-ish integer hash for value noise grid points.
    h = (ix * 374761393 + iy * 668265263 + seed * 1442695040888963407) & 0xFFFFFFFF
    h = (h ^ (h >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFFFFFF) / 4294967295.0


def noise(x, y, scale=0.1, seed=0) -> float:
    """Smooth value noise in [0, 1]. Deterministic per (x, y, scale, seed)."""
    sx = float(x) * float(scale)
    sy = float(y) * float(scale)
    ix = math.floor(sx); iy = math.floor(sy)
    fx = sx - ix;        fy = sy - iy
    # Smoothstep for fade.
    u = fx * fx * (3 - 2 * fx)
    v = fy * fy * (3 - 2 * fy)
    s = int(seed)
    a = _noise_hash(ix,     iy,     s)
    b = _noise_hash(ix + 1, iy,     s)
    c = _noise_hash(ix,     iy + 1, s)
    d = _noise_hash(ix + 1, iy + 1, s)
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v


def random_color() -> tuple:
    import random as _random
    names = [n for n in dir(Colors) if not n.startswith("_") and isinstance(getattr(Colors, n), tuple)]
    if names:
        return getattr(Colors, _random.choice(names))
    return _random.choice(list(COLOR_NAMES.values()))


def frame_rate(fps) -> None:
    _state._target_fps = int(fps)


def inspect(x) -> None:
    """Print a readable description of an Actor, Vector2, or any value."""
    print(repr(x))


_WATCH_SENTINEL = object()


def watch(label, value=_WATCH_SENTINEL) -> None:
    """Pin a live value to the Watch panel (updated every frame, no console flood).

    watch('score', score)  — shows 'score  5'
    watch(player.x)        — shows '100.0'
    """
    if value is _WATCH_SENTINEL:
        _state._watches[repr(label)] = ""
    else:
        _state._watches[str(label)] = repr(value)


# === RUN ===


def _tick(main, my_generation):
    global frame_count
    from js import clearTimeout, setTimeout, _ide_flush_draw_commands
    from pyodide.ffi import create_proxy, to_js
    from graphics.actors import Actor

    if _state._loop_generation != my_generation:
        return
    if not _state._running:
        return
    if _state._stop_requested:
        _state._running = False
        try:
            from js import _ide_notify_loop_ended
            _ide_notify_loop_ended()
        except Exception:
            pass
        return

    try:
        _ide_flush_draw_commands(to_js(_state._draw_commands))
        _state._draw_commands.clear()

        for actor in Actor.all_actors():
            if actor.is_alive():
                actor.update()

        import sys as _sys
        _main = _sys.modules.get('__main__')
        if _main is not None and 'frame_count' in _main.__dict__:
            _main.__dict__['frame_count'] = frame_count

        if main is not None:
            main()

        _state._mouse_clicked = False
        _state._mouse_released = False
        _state._keys_pressed.clear()
        _state._keys_released.clear()

        if _state._show_actor_info:
            from graphics.actors import _draw_actor_info_overlay
            _draw_actor_info_overlay()

        _ide_flush_draw_commands(to_js(_state._draw_commands), frame_count)
        _state._draw_commands.clear()

        if _state._watches:
            try:
                import js as _js
                _now = _js.Date.now()
                if _now - _state._watch_last_sent >= 100:
                    import json as _json
                    from js import _ide_post_watch_values
                    _ide_post_watch_values(_json.dumps({
                        "values": [{"label": k, "value": v}
                                   for k, v in _state._watches.items()],
                        "frame": frame_count,
                    }))
                    _state._watch_last_sent = _now
            except Exception:
                pass
        _state._watches.clear()

        frame_count += 1

    except KeyboardInterrupt:
        # forceful stop via interrupt buffer — no error output
        _state._running = False
        return
    except Exception as _exc:
        # A8: drain any partial draw commands so the next run doesn't inherit them
        # if the user code catches this exception in main() and continues.
        _state._draw_commands.clear()
        try:
            import json as _json
            import error_hook as _eh
            from js import _ide_post_runtime_error
            _structured = _eh.classify_error(_exc, _state._user_code, _state._user_filename)
            _structured["frame"] = frame_count
            if _state._watches:
                _structured["watches"] = [{"label": k, "value": v} for k, v in _state._watches.items()]
            _ide_post_runtime_error(_json.dumps(_structured))
        except Exception:
            # Hand-written JSON — intentionally avoids json.dumps which may have just failed.
            # Keep field names in sync with RuntimeError in WorkerInterface.ts.
            try:
                from js import _ide_post_runtime_error as _post
                _post('{"category":"internal",'
                      '"titleKey":"friendlyError.internal.title",'
                      '"messageKey":"friendlyError.internal.classifierFailed",'
                      '"messageArgs":{},"raw":"tick-handler emit failed",'
                      '"suggestions":[],"isBlocking":false}')
            except Exception:
                pass  # nothing safe left to do; worker error channel will surface stalls
        _state._running = False
        return

    if _state._step_once:
        _state._step_once = False
        _state._paused = True
    elif _state._paused:
        pass  # loop suspended; _resume() will reschedule
    else:
        elapsed = (1000 / _state._target_fps) * _state._speed_divisor
        _state._pending_timer_id = setTimeout(_state.tick_proxy, int(elapsed))


def _pause() -> None:
    _state._paused = True


def _resume() -> None:
    if not _state._paused or not _state._running:
        return
    _state._paused = False
    from js import setTimeout, clearTimeout
    if _state._pending_timer_id is not None:
        clearTimeout(_state._pending_timer_id)
        _state._pending_timer_id = None
    elapsed = (1000 / _state._target_fps) * _state._speed_divisor
    _state._pending_timer_id = setTimeout(_state.tick_proxy, int(elapsed))


def _step() -> None:
    if not _state._paused or not _state._running:
        return
    _state._step_once = True
    _state._paused = False
    from js import setTimeout, clearTimeout
    if _state._pending_timer_id is not None:
        clearTimeout(_state._pending_timer_id)
        _state._pending_timer_id = None
    _state._pending_timer_id = setTimeout(_state.tick_proxy, 0)


def _set_speed(divisor: int) -> None:
    _state._speed_divisor = int(divisor)


def _run(main=None, fps=60) -> None:
    global frame_count
    from js import setTimeout, _ide_canvas_resize  # type: ignore
    from pyodide.ffi import create_proxy

    _state._target_fps = int(fps)

    if _state._pending_timer_id is not None:
        from js import clearTimeout
        clearTimeout(_state._pending_timer_id)

    if _state._pending_size:
        _state._width, _state._height = _state._pending_size

    _ide_canvas_resize(_state._width, _state._height)

    _state._running = True
    _state._stop_requested = False
    _state._paused = False
    _state._step_once = False
    _state._speed_divisor = 1
    _state._loop_generation += 1
    my_generation = _state._loop_generation
    frame_count = 0

    _state.tick_proxy = create_proxy(lambda: _tick(main, my_generation))
    _state._pending_timer_id = setTimeout(_state.tick_proxy, 0)


def run(main=None, fps=60) -> None:
    _run(main, fps)


# === STOP ===


def _stop() -> None:
    from js import clearTimeout
    if _state._pending_timer_id is not None:
        clearTimeout(_state._pending_timer_id)
        _state._pending_timer_id = None
    _state._stop_requested = True


def stop() -> None:
    _stop()


# === EVENT INJECTION ===


def _inject_event(kind, data):
    if not isinstance(data, dict):
        data = data.to_py() if hasattr(data, "to_py") else {}

    if kind == "mousemove":
        _state._mouse_x = float(data.get("x", 0))
        _state._mouse_y = float(data.get("y", 0))
    elif kind == "mousedown":
        _state._mouse_down = True
        _state._mouse_clicked = True
    elif kind == "mouseup":
        _state._mouse_down = False
        _state._mouse_released = True
    elif kind == "keydown":
        key_code = int(data.get("keyCode", 0))
        if key_code not in _state._keys_down:
            _state._keys_down.add(key_code)
            _state._keys_pressed.add(key_code)
    elif kind == "keyup":
        key_code = int(data.get("keyCode", 0))
        _state._keys_down.discard(key_code)
        _state._keys_released.add(key_code)


# === CLEAR ===


def _reset_run_state():
    """Reset state between program runs while maintaining monotonic loop generation."""
    global frame_count
    frame_count = 0
    # A2: _loop_generation is bumped exactly once inside _run(); do NOT bump
    # here — a triple-increment weakened the stale-tick guard.
    _state._mouse_x = 0
    _state._mouse_y = 0
    _state._mouse_down = False
    _state._mouse_clicked = False
    _state._mouse_released = False
    _state._keys_down = set()
    _state._keys_pressed = set()
    _state._keys_released = set()


def _clear():
    from js import clearTimeout
    from graphics.actors import Actor

    if _state._pending_timer_id is not None:
        clearTimeout(_state._pending_timer_id)
        _state._pending_timer_id = None

    global frame_count
    _state._draw_commands = []
    _state._pending_size = None
    frame_count = 0
    _state._stop_requested = False
    _state._running = False
    _state._loop_generation = 0
    _state._mouse_x = 0
    _state._mouse_y = 0
    _state._mouse_down = False
    _state._mouse_clicked = False
    _state._mouse_released = False
    _state._keys_down = set()
    _state._keys_pressed = set()
    _state._keys_released = set()
    _state._fill_color = (255, 255, 255)
    _state._stroke_color = (0, 0, 0)
    _state._stroke_width = 1
    _state._current_fill = True
    _state._current_stroke = True
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
    """A single named layer in a tilemap. Cells addressed by (col, row) integers.

    Each cell holds a tile name and a rotation in {0, 90, 180, 270}. The editor
    only writes names (rotation 0); rotation is set from code via `set(...)`.
    """

    def __init__(self, name: str, tile_size: int, cells: dict, bitmaps: dict = {}):
        self.name = name
        self.tile_size = tile_size
        # Names map: dict[col][row] -> str. Rotations map: dict[col][row] -> int.
        # Stored separately so the legacy str-only API (tile_at/get_tile/tiles)
        # stays a string lookup with no tuple unpacking.
        self._cells = {}
        self._rotations = {}
        for col, rows in (cells or {}).items():
            cmap = {}
            rmap = {}
            for row, payload in rows.items():
                if isinstance(payload, (tuple, list)) and len(payload) == 2:
                    cmap[row] = payload[0]
                    rmap[row] = int(payload[1]) % 360
                else:
                    cmap[row] = payload
                    rmap[row] = 0
            self._cells[col] = cmap
            self._rotations[col] = rmap
        self._areas = {}    # filled by TileMap if this layer is its primary

    def draw(self, x=0, y=0):
        cells_flat = []
        for col, rows in self._cells.items():
            rrows = self._rotations.get(col, {})
            for row, name in rows.items():
                cells_flat.append([col, row, name, rrows.get(row, 0)])
        _state._draw_commands.append(("tilemap_layer", (cells_flat, self.tile_size, float(x), float(y))))

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

    # === Tier-3 mutation API ===

    def set(self, col, row, name, rotation=0):
        """Write a cell. Pass `name=None` to clear."""
        col = int(col); row = int(row)
        if name is None:
            if col in self._cells:
                self._cells[col].pop(row, None)
                self._rotations.get(col, {}).pop(row, None)
            return
        self._cells.setdefault(col, {})[row] = name
        self._rotations.setdefault(col, {})[row] = int(rotation) % 360

    def get(self, col, row):
        """Return (name, rotation) for the cell, or None if empty."""
        col = int(col); row = int(row)
        name = self._cells.get(col, {}).get(row)
        if name is None:
            return None
        return (name, self._rotations.get(col, {}).get(row, 0))

    def count_neighbors(self, col, row, name):
        """Count the 8-neighborhood cells whose tile name equals `name`. Out-of-map cells count as 0."""
        col = int(col); row = int(row)
        count = 0
        for dc in (-1, 0, 1):
            for dr in (-1, 0, 1):
                if dc == 0 and dr == 0:
                    continue
                if self._cells.get(col + dc, {}).get(row + dr) == name:
                    count += 1
        return count

    def group(self, name):
        """Return a TileGroup over the named area's cells, bound to this layer for mutation."""
        cells = self._areas.get(name)
        if cells is None:
            raise KeyError(f"No area named '{name}' on layer '{self.name}'")
        return TileGroup(self, set(cells))


class TileCollision:
    """Result of a tilemap collision check.

    Truthy if a collision occurred; falsy (or None) otherwise.
    Carries metadata about which area, tile, and grid cell was hit.
    """

    def __init__(self, rect, area_name, tile_name, col, row):
        """
        rect: The TileRef (collision object) that was hit
        area_name: Name of the area ("ground", "spikes", etc.)
        tile_name: Name of the tile at that position ("grass", "stone", etc.)
        col, row: Grid coordinates of the hit cell
        """
        self.rect = rect
        self.area = area_name
        self.tile = tile_name
        self.col = col
        self.row = row

    def __bool__(self):
        """Truthy when a collision occurred."""
        return self.rect is not None

    def __repr__(self):
        return f"TileCollision(area={self.area!r}, tile={self.tile!r}, grid=({self.col}, {self.row}))"


class TileMap:
    """A collection of named TilemapLayers, drawn bottom-to-top.

    Named regions (cell-set zones brushed in the Tile Editor) are exposed as
    `tilemap.areas.<name>` — each is a Group of merged-rect colliders ready
    for collision checks. Areas span the whole tilemap; they do not belong to
    a specific layer.
    """

    def __init__(self, layers: list, layer_by_name: dict, areas: dict = None):
        self._layers = layers
        self.layers = layer_by_name
        areas = areas or {}
        self.areas = _build_areas_namespace(areas, layers)
        # Stash raw cell sets per area name so level.group(name) can return a
        # TileGroup. Bound to the first (primary) layer for mutation ops; users
        # with multiple layers can call layer.group(name) explicitly.
        primary = layers[0] if layers else None
        self._area_cells = {}
        for aname, area in areas.items():
            cells = area.get("cells", []) if isinstance(area, dict) else area
            cell_set = {(int(c[0]), int(c[1])) for c in cells}
            self._area_cells[aname] = cell_set
            if primary is not None:
                primary._areas[aname] = cell_set

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

    def group(self, name):
        """Return a TileGroup over the named area, bound to the primary (first) layer."""
        if not self._layers:
            raise RuntimeError("TileMap has no layers")
        cells = self._area_cells.get(name)
        if cells is None:
            raise KeyError(f"No area named '{name}'")
        return TileGroup(self._layers[0], set(cells))

    def collides_with(self, actor, area_name):
        """Check if actor collides with a named area. Returns TileCollision or None.

        If a collision occurs, the result carries rich metadata:
          - result.area: The area name ("ground", "spikes", etc.)
          - result.tile: The tile name at collision point ("grass", "stone", etc.)
          - result.col, result.row: Grid coordinates of the hit cell
          - result.rect: The underlying TileRef (collision object)

        Usage:
          hit = level.collides_with(hero, "ground")
          if hit:
              print(f"Touched {hit.tile} at grid ({hit.col}, {hit.row})")
              hero.vy = 0
        """
        if not self._layers:
            return None
        try:
            area_group = self.areas.__dict__[area_name]
        except (KeyError, AttributeError):
            raise KeyError(f"No area named '{area_name}'")

        hit_rect = actor.collides_any(area_group)
        if not hit_rect:
            return None

        # Resolve the grid cell and tile name from the collision rect.
        # hit_rect.x/y are the merged rect's CENTER (Rect draws centered);
        # convert to top-left before dividing by tile_size so multi-tile
        # merges report the leftmost/topmost cell they cover.
        primary_layer = self._layers[0]
        tile_size = primary_layer.tile_size
        left = hit_rect.x - hit_rect.width / 2
        top = hit_rect.y - hit_rect.height / 2
        col = int(left / tile_size)
        row = int(top / tile_size)
        tile_name = primary_layer.get_tile(col, row)

        return TileCollision(hit_rect, area_name, tile_name, col, row)

    def collides_with_any(self, actor, area_names):
        """Check actor against multiple areas. Returns first TileCollision found or None.

        Useful for checking "collide with ground OR walls OR platform":
          hit = level.collides_with_any(hero, ["ground", "walls", "platform"])
          if hit:
              # blocked by something solid
        """
        for area_name in area_names:
            hit = self.collides_with(actor, area_name)
            if hit:
                return hit
        return None


from collections import namedtuple as _namedtuple

Cell = _namedtuple("Cell", ["x", "y"])
Bounds = _namedtuple("Bounds", ["min", "max", "width", "height"])


class TileGroup:
    """A set of (col, row) cells with transforms and convenience mutations.

    Transforms (`shrink`, `border`) return a new TileGroup.
    Mutations (`fill`, `scatter`, `fill_random`) write through the bound layer.
    """

    def __init__(self, layer, cells):
        self._layer = layer
        self._cells = set(cells)    # set of (col, row)

    def __len__(self):
        return len(self._cells)

    def __iter__(self):
        return self.cells()

    def cells(self):
        for c, r in self._cells:
            yield Cell(c, r)

    def bounds(self):
        if not self._cells:
            return Bounds(Cell(0, 0), Cell(0, 0), 0, 0)
        cs = [c for c, _ in self._cells]
        rs = [r for _, r in self._cells]
        mn = Cell(min(cs), min(rs))
        mx = Cell(max(cs), max(rs))
        return Bounds(mn, mx, mx.x - mn.x + 1, mx.y - mn.y + 1)

    def random_cell(self):
        import random as _r
        if not self._cells:
            return None
        c, r = _r.choice(list(self._cells))
        return Cell(c, r)

    def shrink(self, n=1):
        """Erode by `n` 4-connected steps; cells whose orthogonal neighbors are all in the group survive."""
        cells = self._cells
        for _ in range(int(n)):
            cells = {(c, r) for (c, r) in cells
                     if (c - 1, r) in cells and (c + 1, r) in cells
                     and (c, r - 1) in cells and (c, r + 1) in cells}
        return TileGroup(self._layer, cells)

    def border(self):
        """Cells in this group with at least one 4-neighbor NOT in the group."""
        out = set()
        for (c, r) in self._cells:
            if ((c - 1, r) not in self._cells
                or (c + 1, r) not in self._cells
                or (c, r - 1) not in self._cells
                or (c, r + 1) not in self._cells):
                out.add((c, r))
        return TileGroup(self._layer, out)

    def fill(self, name, rotation=0):
        """Write `name` to every cell in the group."""
        for (c, r) in self._cells:
            self._layer.set(c, r, name, rotation)
        return self

    def scatter(self, name, count=1):
        """Write `name` to `count` random cells (without replacement)."""
        import random as _r
        cells = list(self._cells)
        n = min(int(count), len(cells))
        for c, r in _r.sample(cells, n) if n > 0 else []:
            self._layer.set(c, r, name)
        return self

    def fill_random(self, choices, rotate=False):
        """Write a random tile to every cell.

        `choices` is either a list (uniform) or a dict `{name: weight}`.
        If `rotate=True`, each cell also gets a random rotation in {0, 90, 180, 270}.
        """
        import random as _r
        if isinstance(choices, dict):
            names = list(choices.keys())
            weights = [float(choices[k]) for k in names]
            def pick():
                return _r.choices(names, weights=weights, k=1)[0]
        else:
            seq = list(choices)
            def pick():
                return _r.choice(seq)
        rotations = (0, 90, 180, 270)
        for (c, r) in self._cells:
            rot = _r.choice(rotations) if rotate else 0
            self._layer.set(c, r, pick(), rot)
        return self


def _build_areas_namespace(areas: dict, layers: list):
    """Build a SimpleNamespace of `name → Group of merged-rect TileRefs`.

    Cell coordinates are interpreted in the tile grid; pixel size comes from
    the first layer's `tile_size` (all layers in a tilemap share size today).
    """
    tile_size = layers[0].tile_size if layers else 32
    # A9: assert every layer uses the same tile_size — mixed sizes would
    # silently break the collision geometry derived from layer[0].
    for _l in layers[1:]:
        if _l.tile_size != tile_size:
            raise ValueError(
                f"TileMap: layer '{_l.name}' tile_size={_l.tile_size} "
                f"differs from primary layer tile_size={tile_size}. "
                "All layers must share the same tile size."
            )
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
        translate(_state._width / 2 - self.pos.x, _state._height / 2 - self.pos.y)
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

    def __init__(self, ambient=(40, 40, 60), radius=200, mode="hsl"):
        # mode="hsl" composites the lightmap with `soft-light` — perceptually
        # closer to per-pixel HSL lightness modulation, less of a flat color
        # filter than the old multiply path. mode="overlay" keeps the legacy
        # alpha-blend look for projects that depend on it.
        if mode not in ("hsl", "overlay"):
            raise ValueError(
                f"Light mode must be 'hsl' or 'overlay', got {mode!r}"
            )
        self._ambient = tuple(int(c) for c in ambient)
        self._radius = float(radius)
        self._mode = mode
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
        _state._draw_commands.append(("light_begin", self._ambient))

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
            _state._draw_commands.append((
                "light_poly",
                (poly_flat, float(sx), float(sy), float(radius),
                 tuple(self._shade_rgb), float(intensity)),
            ))

        if obstacles_changed:
            self._obstacle_fp = obstacle_fp

        _state._draw_commands.append(("light_end", (self._mode,)))


# Enable module-level __setattr__ so that external writes like
# `graphics._width = 500` (used by tests and worker.ts) forward to _state,
# keeping _state as the single source of truth for all mutable module globals.
import sys as _sys

class _Module(_sys.modules[__name__].__class__):
    def __setattr__(self, name, value):
        if name in _state.__dict__:
            setattr(_state, name, value)
        else:
            super().__setattr__(name, value)

_sys.modules[__name__].__class__ = _Module


__all__ = [
    "_version",
    "size", "width", "height",
    "circle", "rect", "ellipse", "line", "point",
    "polyline", "polygon", "spline",
    "text", "text_size", "text_align",
    "say",
    "fill", "no_fill", "stroke", "no_stroke", "stroke_width",
    "background",
    "push", "pop", "translate", "rotate",
    "image",
    "frame_rate", "frame_count",
    "random", "random_color",
    "clamp", "randint", "pick",
    "Colors", "AnchorPoint",
    "lerp", "darker", "lighter", "saturated", "desaturated",
    "Sprite", "PixelView", "create_sprite", "get_pixel", "set_pixel",
    "palette_swap", "flood_fill",
    "darken", "lighten", "saturate", "desaturate",
    "Vector2", "Point", "Polar",
    "Line", "Polygon", "Spline",
    "Mouse", "Keyboard", "Window",
    "Actor", "Rect", "Circle", "Group", "Collider",
    "Camera",
    "TilemapLayer", "TileMap", "TileRef",
    "TileGroup", "Cell", "Bounds", "noise",
    "Light",
    "Animation",
    "SheetAnimation", "SpriteEntry", "SheetNamespace", "AnimationController",
    "Timer",
    "State",
    "run", "stop",
    "assets",
    "sheet",
    "inspect",
    "watch",
]
