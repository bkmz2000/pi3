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

_canvas = None
_ctx = None
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

from graphics.actors import Actor, Rect, Circle, Group, Collider  # noqa: E402


# === ANCHOR POINT ===


class AnchorPoint:
    """A resolved position with alignment hints for text() and say()."""

    def __init__(self, x, y, h_align="left", v_align="top"):
        self._x = x        # callable or number
        self._y = y
        self.h_align = h_align   # "left" | "center" | "right"
        self.v_align = v_align   # "top" | "middle" | "bottom"

    @property
    def x(self):
        return self._x() if callable(self._x) else self._x

    @property
    def y(self):
        return self._y() if callable(self._y) else self._y


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


def _init(canvas):
    global _canvas, _ctx
    _canvas = canvas
    if canvas:
        _ctx = canvas.getContext("2d")


def _execute_draw_commands():
    global _ctx
    for cmd, args, kwargs in _draw_commands:
        if cmd == "circle":
            x, y, r = args
            _ctx.beginPath()
            _ctx.arc(x, y, r, 0, math.pi * 2)
            if _current_fill:
                _ctx.fill()
            if _current_stroke:
                _ctx.stroke()
        elif cmd == "ellipse":
            x, y, w, h = args
            _ctx.beginPath()
            _ctx.ellipse(x, y, w / 2, h / 2, 0, 0, math.pi * 2)
            if _current_fill:
                _ctx.fill()
            if _current_stroke:
                _ctx.stroke()
        elif cmd == "rect":
            x, y, w, h = args
            _ctx.beginPath()
            _ctx.rect(x, y, w, h)
            if _current_fill:
                _ctx.fill()
            if _current_stroke:
                _ctx.stroke()
        elif cmd == "line":
            x1, y1, x2, y2 = args
            _ctx.beginPath()
            _ctx.moveTo(x1, y1)
            _ctx.lineTo(x2, y2)
            _ctx.stroke()
        elif cmd == "point":
            x, y = args
            _ctx.beginPath()
            _ctx.arc(x, y, max(_stroke_width / 2, 1), 0, math.pi * 2)
            _ctx.fill()
        elif cmd == "text":
            s, x, y = args
            _ctx.fillText(str(s), x, y)
        elif cmd == "text_size":
            n = args[0]
            _ctx.font = f"{n}px sans-serif"
        elif cmd == "text_align":
            h, v = args
            _ctx.textAlign = h
            if v:
                _ctx.textBaseline = v
        elif cmd == "fill":
            r, g, b = args
            _ctx.fillStyle = _color_str(r, g, b)
        elif cmd == "no_fill":
            _ctx.fillStyle = "rgba(0,0,0,0)"
        elif cmd == "stroke":
            r, g, b = args
            _ctx.strokeStyle = _color_str(r, g, b)
        elif cmd == "no_stroke":
            _ctx.strokeStyle = "rgba(0,0,0,0)"
        elif cmd == "stroke_width":
            _ctx.lineWidth = args[0]
        elif cmd == "background":
            r, g, b = args
            _ctx.fillStyle = _color_str(r, g, b)
            _ctx.fillRect(0, 0, _width, _height)
        elif cmd == "push":
            _ctx.save()
        elif cmd == "pop":
            _ctx.restore()
        elif cmd == "translate":
            _ctx.translate(*args)
        elif cmd == "rotate":
            _ctx.rotate(args[0] * math.pi / 180)
        elif cmd == "scale":
            _ctx.scale(*args)
        elif cmd == "image":
            img_result, x, y, w, h = args
            if isinstance(img_result, dict):
                if not img_result.get("done") or img_result.get("img") is None:
                    continue
                raw = img_result["img"]
            else:
                raw = img_result
            from pyodide.ffi import to_js
            js_img = to_js(raw)
            if w is not None:
                _ctx.drawImage(js_img, x, y, w, h if h is not None else w)
            else:
                _ctx.drawImage(js_img, x, y)
        elif cmd == "tilemap_layer":
            from pyodide.ffi import to_js
            layer, ox, oy = args
            ts = layer.tile_size
            cw = float(_canvas.width)
            ch = float(_canvas.height)
            for col, rows in layer._cells.items():
                sx = ox + col * ts
                if sx + ts <= 0 or sx >= cw:
                    continue
                for row, name in rows.items():
                    sy = oy + row * ts
                    if sy + ts <= 0 or sy >= ch:
                        continue
                    bmp = layer._bitmaps.get(name)
                    if bmp is not None:
                        _ctx.drawImage(to_js(bmp), sx, sy, ts, ts)
        elif cmd == "say":
            _draw_say(*args)


def _draw_say(s, anchor, padding):
    """Render a speech bubble at anchor point with a tail."""
    ax = float(anchor.x)
    ay = float(anchor.y)
    h_align = anchor.h_align
    v_align = anchor.v_align

    # Measure text width; estimate from char count if measureText unavailable
    try:
        metrics = _ctx.measureText(s)
        text_w = float(metrics.width)
    except Exception:
        text_w = len(s) * 9.0  # rough fallback

    # Estimate font size from canvas font string (e.g. "16px sans-serif")
    font_size = 16.0
    try:
        font_part = _ctx.font.strip().split("px")[0].strip().split()[-1]
        font_size = float(font_part)
    except Exception:
        pass

    text_h = font_size
    bubble_w = text_w + 2 * padding
    bubble_h = text_h + 2 * padding
    tail = min(10, padding + 2)
    corner_r = 6

    # Compute bubble top-left corner and tail triangle points
    bx_map = {"left": ax, "right": ax - bubble_w, "center": ax - bubble_w / 2}
    bx = bx_map.get(h_align, ax - bubble_w / 2)

    if v_align == "bottom":      # anchor is at the top of the actor → bubble above
        by = ay - bubble_h - tail
        mid_bx = bx + bubble_w / 2
        tail_pts = [(mid_bx, ay), (mid_bx - tail / 2, by + bubble_h), (mid_bx + tail / 2, by + bubble_h)]
    elif v_align == "top":       # anchor at bottom of actor → bubble below
        by = ay + tail
        mid_bx = bx + bubble_w / 2
        tail_pts = [(mid_bx, ay), (mid_bx - tail / 2, by), (mid_bx + tail / 2, by)]
    else:                        # middle → bubble to the side
        by = ay - bubble_h / 2
        if h_align == "left":
            bx = ax + tail
            tail_pts = [(ax, ay), (bx, ay - tail / 2), (bx, ay + tail / 2)]
        else:
            bx = ax - bubble_w - tail
            tail_pts = [(ax, ay), (ax - tail, ay - tail / 2), (ax - tail, ay + tail / 2)]

    _ctx.save()
    _ctx.fillStyle = "rgba(0,0,0,0.78)"
    _ctx.strokeStyle = "rgba(0,0,0,0)"

    # Tail triangle
    _ctx.beginPath()
    _ctx.moveTo(tail_pts[0][0], tail_pts[0][1])
    _ctx.lineTo(tail_pts[1][0], tail_pts[1][1])
    _ctx.lineTo(tail_pts[2][0], tail_pts[2][1])
    _ctx.closePath()
    _ctx.fill()

    # Rounded bubble
    _ctx.beginPath()
    try:
        _ctx.roundRect(bx, by, bubble_w, bubble_h, corner_r)
    except Exception:
        _ctx.rect(bx, by, bubble_w, bubble_h)
    _ctx.fill()

    # Text
    _ctx.fillStyle = "white"
    _ctx.textAlign = "left"
    _ctx.textBaseline = "middle"
    _ctx.fillText(s, bx + padding, by + bubble_h / 2)

    _ctx.restore()


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
    _draw_commands.append(("say", (str(s), anchor, int(padding)), {}))


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
    _draw_commands.append(("image", (img_result, float(x), float(y), w, h), {}))


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
    from js import clearTimeout, setTimeout
    from pyodide.ffi import create_proxy
    from graphics.actors import Actor

    if _loop_generation != my_generation:
        return
    if not _running:
        return
    if _stop_requested:
        _running = False
        return

    try:
        _execute_draw_commands()
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

        _execute_draw_commands()
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
    from js import setTimeout
    from pyodide.ffi import create_proxy

    global _running, _stop_requested, _loop_generation, frame_count, _target_fps
    global _pending_timer_id, tick_proxy, _ctx, _canvas, _width, _height

    if _canvas is None:
        raise RuntimeError("No canvas attached. Call attach_canvas first.")

    _ctx = _canvas.getContext("2d")
    _target_fps = int(fps)

    if _pending_timer_id is not None:
        from js import clearTimeout
        clearTimeout(_pending_timer_id)

    if _pending_size:
        _width, _height = _pending_size
        _canvas.width = _width
        _canvas.height = _height

    from js import _ide_canvas_resize  # type: ignore
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
    global _fill_color, _stroke_color, _stroke_width
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


class TilemapLayer:
    """A single named layer in a tilemap. Cells addressed by (col, row) integers."""

    def __init__(self, name: str, tile_size: int, cells: dict, bitmaps: dict):
        self.name = name
        self.tile_size = tile_size
        self._cells = cells    # dict[int, dict[int, str]]
        self._bitmaps = bitmaps  # dict[str, ImageBitmap]

    def draw(self, x=0, y=0):
        _draw_commands.append(("tilemap_layer", (self, float(x), float(y)), {}))

    def tile_at(self, px, py):
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

    def draw(self, x=0, y=0):
        for layer in self._layers:
            layer.draw(x, y)


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
    "Mouse", "Keyboard", "Window",
    "Actor", "Rect", "Circle", "Group", "Collider",
    "TilemapLayer", "TileMap",
    "run", "stop",
    "assets",
]
