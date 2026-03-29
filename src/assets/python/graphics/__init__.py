"""
graphics module - g

Provides a simple graphics API for creating games and visualizations.
Import as: import graphics as g
"""

import math
import traceback

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

_setup_func = None
_loop_generation = 0

_key_handlers = {}
_mouse_handlers = []
_every_handlers = {}
_collision_handlers = []

_mouse_x = 0
_mouse_y = 0
_keys_down = set()

_frame_count = 0
_target_fps = 60
_pending_timer_id = None
_show_hitboxes = False

# === COLOR NAMES ===

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
    "a": 65,
    "b": 66,
    "c": 67,
    "d": 68,
    "e": 69,
    "f": 70,
    "g": 71,
    "h": 72,
    "i": 73,
    "j": 74,
    "k": 75,
    "l": 76,
    "m": 77,
    "n": 78,
    "o": 79,
    "p": 80,
    "q": 81,
    "r": 82,
    "s": 83,
    "t": 84,
    "u": 85,
    "v": 86,
    "w": 87,
    "x": 88,
    "y": 89,
    "z": 90,
    "0": 48,
    "1": 49,
    "2": 50,
    "3": 51,
    "4": 52,
    "5": 53,
    "6": 54,
    "7": 55,
    "8": 56,
    "9": 57,
}

assets = None

# === LOW-LEVEL HELPERS ===


def _color_str(r, g=None, b=None):
    if g is None:
        return f"rgb({int(r)},{int(r)},{int(r)})"
    return f"rgb({int(r)},{int(g)},{int(b)})"


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
            _ctx.fillStyle = _color_str(*args)
        elif cmd == "no_fill":
            _ctx.fillStyle = "rgba(0,0,0,0)"
        elif cmd == "stroke":
            _ctx.strokeStyle = _color_str(*args)
        elif cmd == "no_stroke":
            _ctx.strokeStyle = "rgba(0,0,0,0)"
        elif cmd == "stroke_width":
            _ctx.lineWidth = args[0]
        elif cmd == "background":
            _ctx.fillStyle = _color_str(*args)
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
        elif cmd == "image_mode":
            pass
        elif cmd == "rect_mode":
            pass


# === SIZE ===


def size(w, h):
    global _pending_size, _width, _height
    _pending_size = (int(w), int(h))
    _width = int(w)
    _height = int(h)


def width():
    return _width


def height():
    return _height


# === DRAWING ===


def circle(x, y, r):
    _draw_commands.append(("circle", (float(x), float(y), float(r)), {}))


def rect(x, y, w, h):
    _draw_commands.append(("rect", (float(x), float(y), float(w), float(h)), {}))


def ellipse(x, y, w, h=None):
    if h is None:
        h = w
    _draw_commands.append(("ellipse", (float(x), float(y), float(w), float(h)), {}))


def line(x1, y1, x2, y2):
    _draw_commands.append(("line", (float(x1), float(y1), float(x2), float(y2)), {}))


def point(x, y):
    _draw_commands.append(("point", (float(x), float(y)), {}))


def text(s, x, y):
    _draw_commands.append(("text", (str(s), float(x), float(y)), {}))


def text_size(n):
    _draw_commands.append(("text_size", (int(n),), {}))


def text_align(horizontal, vertical=None):
    h = horizontal.lower() if isinstance(horizontal, str) else horizontal
    v = vertical.lower() if vertical and isinstance(vertical, str) else vertical
    _draw_commands.append(("text_align", (h, v), {}))


# === COLOR ===


def fill(r=None, g=None, b=None):
    global _fill_color, _current_fill
    if r is None:
        _current_fill = False
        _draw_commands.append(("no_fill", (), {}))
        return
    if isinstance(r, str):
        color = COLOR_NAMES.get(r.lower(), (255, 255, 255))
        _fill_color = color
    elif g is None:
        _fill_color = (int(r), int(r), int(r))
    else:
        _fill_color = (int(r), int(g), int(b))
    _current_fill = True
    _draw_commands.append(("fill", _fill_color, {}))


def no_fill():
    global _current_fill
    _current_fill = False
    _draw_commands.append(("no_fill", (), {}))


def stroke(r=None, g=None, b=None):
    global _stroke_color, _current_stroke
    if r is None:
        _current_stroke = False
        _draw_commands.append(("no_stroke", (), {}))
        return
    if isinstance(r, str):
        color = COLOR_NAMES.get(r.lower(), (255, 255, 255))
        _stroke_color = color
    elif g is None:
        _stroke_color = (int(r), int(r), int(r))
    else:
        _stroke_color = (int(r), int(g), int(b))
    _current_stroke = True
    _draw_commands.append(("stroke", _stroke_color, {}))


def no_stroke():
    global _current_stroke
    _current_stroke = False
    _draw_commands.append(("no_stroke", (), {}))


def stroke_width(w):
    global _stroke_width
    _stroke_width = int(w)
    _draw_commands.append(("stroke_width", (int(w),), {}))


def background(r, g=None, b=None):
    if isinstance(r, str):
        color = COLOR_NAMES.get(r.lower(), (0, 0, 0))
        _draw_commands.append(("background", color, {}))
    elif g is None:
        _draw_commands.append(("background", (int(r), int(r), int(r)), {}))
    else:
        _draw_commands.append(("background", (int(r), int(g), int(b)), {}))


# === TRANSFORM ===


def push():
    _draw_commands.append(("push", (), {}))


def pop():
    _draw_commands.append(("pop", (), {}))


def translate(x, y):
    _draw_commands.append(("translate", (float(x), float(y)), {}))


def rotate(angle):
    _draw_commands.append(("rotate", (float(angle),), {}))


def scale(x, y=None):
    if y is None:
        y = x
    _draw_commands.append(("scale", (float(x), float(y)), {}))


# === IMAGE ===


def image(img_result, x, y, w=None, h=None):
    _draw_commands.append(("image", (img_result, float(x), float(y), w, h), {}))


def image_mode(mode):
    _draw_commands.append(("image_mode", (mode,), {}))


def rect_mode(mode):
    _draw_commands.append(("rect_mode", (mode,), {}))


# === INPUT ===


def key_pressed(key):
    code = _KEY_CODES.get(key.lower(), 0)
    return code in _keys_down


def mouse_x():
    return _mouse_x


def mouse_y():
    return _mouse_y


def frame_rate(fps):
    global _target_fps
    _target_fps = int(fps)


def random(low, high=None):
    import random as _random

    if high is None:
        return _random.uniform(0, low)
    return _random.uniform(low, high)


def random_color():
    import random as _random

    colors = list(COLOR_NAMES.keys())
    return _random.choice(colors)


# === EVENTS ===


def every(frames):
    def decorator(func):
        if frames not in _every_handlers:
            _every_handlers[frames] = []
        _every_handlers[frames].append([0, func])
        return func

    return decorator


def on_key_press(*keys):
    def decorator(func):
        for key in keys:
            if key not in _key_handlers:
                _key_handlers[key] = []
            _key_handlers[key].append(func)
        return func

    return decorator


def on_mouse_move(func):
    _mouse_handlers.append(("move", func))
    return func


def on_mouse_click(func):
    _mouse_handlers.append(("click", func))
    return func


def setup(func):
    global _setup_func
    _setup_func = func
    return func


# === COLLISION ===


def on_collide(other_actor_class):
    def decorator(func):
        _collision_handlers.append((other_actor_class, func))
        return func

    return decorator


def on_collide_any(*actor_classes):
    def decorator(func):
        for cls in actor_classes:
            _collision_handlers.append((cls, func))
        return func

    return decorator


def _check_collisions():
    from graphics.actors import Actor

    all_actors = Actor.all_actors()
    for actor_cls, handler in _collision_handlers:
        for actor in all_actors:
            if not actor.is_alive() or not actor._collidable:
                continue
            if not isinstance(actor, actor_cls):
                continue
            for other in all_actors:
                if not other.is_alive() or not other._collidable:
                    continue
                if actor is other:
                    continue
                if actor.collides_with(other):
                    try:
                        handler(actor, other)
                    except Exception:
                        traceback.print_exc()


# === LOOP ===


def _run_loop():
    global _pending_timer_id
    global _running, _stop_requested, _loop_generation, _frame_count
    from js import Date, clearTimeout, setTimeout
    from pyodide.ffi import create_proxy
    from graphics.actors import Actor

    if _pending_timer_id is not None:
        clearTimeout(_pending_timer_id)

    _running = True
    _stop_requested = False
    _loop_generation += 1
    my_generation = _loop_generation
    _frame_count = 0

    def tick():
        global _pending_timer_id
        global _running, _stop_requested, _loop_generation, _frame_count
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
            _check_collisions()

            for frames, handlers in _every_handlers.items():
                for item in handlers:
                    counter = item[0]
                    func = item[1]
                    counter += 1
                    if counter >= frames:
                        try:
                            func()
                        except Exception:
                            traceback.print_exc()
                            _running = False
                            return
                        counter = 0
                    item[0] = counter

            _execute_draw_commands()
            _draw_commands.clear()
            _frame_count += 1
        except Exception:
            traceback.print_exc()
            _running = False
            return

        elapsed = 1000 / _target_fps
        _pending_timer_id = setTimeout(tick_proxy, int(elapsed))

    tick_proxy = create_proxy(tick)
    tick()


def run():
    global _running, _ctx, _canvas, _width, _height, _setup_func

    if _canvas is None:
        raise RuntimeError("No canvas attached. Call attach_canvas first.")

    _ctx = _canvas.getContext("2d")

    if _setup_func:
        try:
            _setup_func()
        except Exception:
            traceback.print_exc()

    if _pending_size:
        _width, _height = _pending_size
        _canvas.width = _width
        _canvas.height = _height

    _run_loop()


# === STOP ===


def stop():
    global _stop_requested, _pending_timer_id
    from js import clearTimeout

    if _pending_timer_id is not None:
        clearTimeout(_pending_timer_id)
        _pending_timer_id = None
    _stop_requested = True


# === EVENT INJECTION ===


def _inject_event(kind, data):
    global _mouse_x, _mouse_y, _keys_down

    if not isinstance(data, dict):
        data = data.to_py() if hasattr(data, "to_py") else {}

    if kind == "mousemove":
        _mouse_x = float(data.get("x", 0))
        _mouse_y = float(data.get("y", 0))
        for typ, handler in _mouse_handlers:
            if typ == "move":
                try:
                    handler(_mouse_x, _mouse_y)
                except Exception:
                    traceback.print_exc()

    elif kind == "mousedown":
        for typ, handler in _mouse_handlers:
            if typ == "click":
                try:
                    handler(_mouse_x, _mouse_y)
                except Exception:
                    traceback.print_exc()

    elif kind == "keydown":
        key = data.get("key", "")
        key_code = int(data.get("keyCode", 0))
        _keys_down.add(key_code)
        for k, handlers in _key_handlers.items():
            if k.lower() == key.lower() or str(key_code) == k:
                for handler in handlers:
                    try:
                        handler()
                    except Exception:
                        traceback.print_exc()

    elif kind == "keyup":
        key_code = int(data.get("keyCode", 0))
        _keys_down.discard(key_code)


# === CLEAR ===


def _clear():
    global _draw_commands, _pending_size, _setup_func
    global _key_handlers, _mouse_handlers, _every_handlers, _collision_handlers
    global _frame_count, _stop_requested, _running, _loop_generation
    global _mouse_x, _mouse_y, _keys_down
    global _fill_color, _stroke_color, _stroke_width
    global _current_fill, _current_stroke, _pending_timer_id
    from js import clearTimeout
    from graphics.actors import Actor

    if _pending_timer_id is not None:
        clearTimeout(_pending_timer_id)
        _pending_timer_id = None

    _draw_commands = []
    _pending_size = None
    _setup_func = None
    _key_handlers = {}
    _mouse_handlers = []
    _every_handlers = {}
    _collision_handlers = []
    _frame_count = 0
    _stop_requested = False
    _running = False
    _loop_generation = 0
    _mouse_x = 0
    _mouse_y = 0
    _keys_down = set()
    _fill_color = (255, 255, 255)
    _stroke_color = (0, 0, 0)
    _stroke_width = 1
    _current_fill = True
    _current_stroke = True
    Actor._registry.clear()
    Actor._id_counter = 0


__all__ = [
    "_version",
    "size",
    "width",
    "height",
    "circle",
    "rect",
    "ellipse",
    "line",
    "point",
    "text",
    "text_size",
    "text_align",
    "fill",
    "no_fill",
    "stroke",
    "no_stroke",
    "stroke_width",
    "background",
    "push",
    "pop",
    "translate",
    "rotate",
    "scale",
    "image",
    "image_mode",
    "rect_mode",
    "key_pressed",
    "mouse_x",
    "mouse_y",
    "frame_rate",
    "random",
    "random_color",
    "every",
    "on_key_press",
    "on_mouse_move",
    "on_mouse_click",
    "setup",
    "run",
    "on_collide",
    "on_collide_any",
    "assets",
    "_init",
    "_inject_event",
    "_clear",
    "stop",
]
