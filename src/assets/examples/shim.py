import math
import traceback

_ctx = None
_canvas = None
_loop_running = False
_proxy_keepalive = []
_image_cache = {}
_keys_down: set = set()
_target_fps = 60
_image_mode = "corner"  # Default image mode
_rect_mode = "corner"  # Default rect mode

width = 300
height = 300
mouseX = 0.0
mouseY = 0.0
pmouseX = 0.0
pmouseY = 0.0
mouseButton = None
key = ""
keyCode = 0
keyIsPressed = False
frameCount = 0

CENTER = "center"
CORNER = "corner"
CORNERS = "corners"
RADIUS = "radius"
LEFT = "left"
RIGHT = "right"
UP = 38
DOWN = 40
ENTER = 13
ESCAPE = 27
BACKSPACE = 8

PI = math.pi
TWO_PI = math.pi * 2
HALF_PI = math.pi / 2

# --- Init ---


def _init(offscreen_canvas):
    global _ctx, _canvas
    _canvas = offscreen_canvas
    _ctx = _canvas.getContext("2d")


def _run_sketch(user_globals: dict):
    """Called after user code is exec'd. Starts setup + draw loop."""
    _setup = user_globals.get("setup")
    _draw = user_globals.get("draw")

    if _setup:
        try:
            _setup()
        except Exception:
            traceback.print_exc()

    if not _draw:
        return

    _start_loop(_draw, user_globals)


def _sync_globals(user_globals: dict):
    """Push all mutable shim state into user globals so draw() sees current values."""
    user_globals.update(
        {
            "mouseX": mouseX,
            "mouseY": mouseY,
            "pmouseX": pmouseX,
            "pmouseY": pmouseY,
            "mouseButton": mouseButton,
            "key": key,
            "keyCode": keyCode,
            "keyIsPressed": keyIsPressed,
            "frameCount": frameCount,
            "width": width,
            "height": height,
        }
    )


_loop_generation = 0


def _start_loop(draw_fn, user_globals: dict):
    global _loop_running, frameCount, _loop_generation
    _loop_running = True
    _loop_generation += 1
    my_generation = _loop_generation

    from js import Date, setTimeout  # type: ignore
    from pyodide.ffi import create_proxy  # type: ignore

    def tick():
        global frameCount
        if not _loop_running or _loop_generation != my_generation:
            return  # stale loop — a newer run has started
        start = Date.now()
        try:
            _sync_globals(user_globals)
            draw_fn()
            frameCount += 1
        except Exception:
            traceback.print_exc()
            return
        elapsed = Date.now() - start
        delay = max(0, 1000 / _target_fps - elapsed)
        setTimeout(tick_proxy, int(delay))

    tick_proxy = create_proxy(tick)
    _proxy_keepalive.append(tick_proxy)
    tick()


# --- Input injection (called by worker on message) ---

_current_user_globals: dict = {}


def _make_event(kind: str, data: dict):
    """Synthetic event object matching browser event shape."""
    from types import SimpleNamespace

    return SimpleNamespace(
        type=kind,
        clientX=data.get("x", 0),
        clientY=data.get("y", 0),
        button=data.get("button", 0),
        key=data.get("key", ""),
        keyCode=data.get("keyCode", 0),
    )


def _call_handler(name: str, user_globals: dict, kind: str = "", data: dict = {}):
    fn = user_globals.get(name)
    if not fn:
        return
    try:
        import inspect

        params = [
            p
            for p in inspect.signature(fn).parameters.values()
            if p.kind
            in (
                inspect.Parameter.POSITIONAL_ONLY,
                inspect.Parameter.POSITIONAL_OR_KEYWORD,
            )
        ]
        if params:
            fn(_make_event(kind, data))
        else:
            fn()
    except Exception:
        traceback.print_exc()


def _inject_event(kind: str, data):
    global mouseX, mouseY, pmouseX, pmouseY, mouseButton
    global key, keyCode, keyIsPressed

    if not isinstance(data, dict):
        data = data.to_py()

    _user_globals = _current_user_globals

    if kind == "mousemove":
        pmouseX, pmouseY = mouseX, mouseY
        mouseX = float(data.get("x", 0))
        mouseY = float(data.get("y", 0))
        _sync_globals(_user_globals)
        _call_handler("mouseMoved", _user_globals, kind, data)

    elif kind == "mousedown":
        btn = data.get("button", 0)
        mouseButton = ["left", "center", "right"][btn] if btn < 3 else "other"
        _sync_globals(_user_globals)
        _call_handler("mousePressed", _user_globals, kind, data)

    elif kind == "mouseup":
        _sync_globals(_user_globals)
        _call_handler("mouseReleased", _user_globals, kind, data)

    elif kind == "keydown":
        key = data.get("key", "")
        keyCode = int(data.get("keyCode", 0))
        keyIsPressed = True
        _keys_down.add(keyCode)
        _sync_globals(_user_globals)  # key is now updated before handler sees it
        _call_handler("keyPressed", _user_globals, kind, data)

    elif kind == "keyup":
        _keys_down.discard(int(data.get("keyCode", 0)))
        keyIsPressed = bool(_keys_down)
        key = data.get("key", "")
        keyCode = int(data.get("keyCode", 0))
        _sync_globals(_user_globals)
        _call_handler("keyReleased", _user_globals, kind, data)


# --- Canvas API ---


def createCanvas(w, h):
    global width, height
    width = w
    height = h
    if _canvas:
        _canvas.width = int(w)
        _canvas.height = int(h)


def background(r, g=None, b=None):
    _ctx.fillStyle = _color(r, g, b)
    _ctx.fillRect(0, 0, width, height)


def fill(r, g=None, b=None, a=None):
    _ctx.fillStyle = _color(r, g, b, a)


def noFill():
    _ctx.fillStyle = "rgba(0,0,0,0)"


def stroke(r, g=None, b=None, a=None):
    _ctx.strokeStyle = _color(r, g, b, a)


def noStroke():
    _ctx.strokeStyle = "rgba(0,0,0,0)"


def strokeWeight(w):
    _ctx.lineWidth = w


def rect(x, y, w, h, r=None):
    # Handle different rect modes
    if _rect_mode == "center":
        # CENTER mode: x, y is the center, w and h are width and height
        draw_x = x - w / 2
        draw_y = y - h / 2
        draw_w = w
        draw_h = h
    elif _rect_mode == "corners":
        # CORNERS mode: x, y is one corner, w and h are opposite corner
        draw_x = x
        draw_y = y
        draw_w = w - x
        draw_h = h - y
    elif _rect_mode == "radius":
        # RADIUS mode: x, y is the center, w and h are 2x the radius
        draw_x = x - w
        draw_y = y - h
        draw_w = w * 2
        draw_h = h * 2
    else:  # "corner" mode (default)
        # CORNER mode: x, y is top-left corner, w and h are width and height
        draw_x = x
        draw_y = y
        draw_w = w
        draw_h = h

    _ctx.beginPath()
    if r is not None:
        _ctx.roundRect(draw_x, draw_y, draw_w, draw_h, r)
    else:
        _ctx.rect(draw_x, draw_y, draw_w, draw_h)
    _ctx.fill()
    _ctx.stroke()


def ellipse(x, y, w, h=None):
    if h is None:
        h = w
    _ctx.beginPath()
    _ctx.ellipse(x, y, w / 2, h / 2, 0, 0, math.pi * 2)
    _ctx.fill()
    _ctx.stroke()


def circle(x, y, d):
    ellipse(x, y, d, d)


def line(x1, y1, x2, y2):
    _ctx.beginPath()
    _ctx.moveTo(x1, y1)
    _ctx.lineTo(x2, y2)
    _ctx.stroke()


def point(x, y):
    _ctx.beginPath()
    _ctx.arc(x, y, max(_ctx.lineWidth / 2, 1), 0, math.pi * 2)
    _ctx.fill()


def text(s, x, y):
    _ctx.fillText(str(s), x, y)


def textSize(n):
    _ctx.font = f"{n}px sans-serif"


def textAlign(h, v=None):
    _ctx.textAlign = h.lower()
    if v:
        _ctx.textBaseline = v.lower()


def push():
    _ctx.save()


def pop():
    _ctx.restore()


def translate(x, y):
    _ctx.translate(x, y)


def rotate(angle):
    _ctx.rotate(angle)


def scale(x, y=None):
    _ctx.scale(x, y if y is not None else x)


def noLoop():
    global _loop_running
    _loop_running = False


def frameRate(fps):
    global _target_fps

    _target_fps = fps


def rectMode(mode):
    global _rect_mode
    _rect_mode = mode.lower() if isinstance(mode, str) else mode


def imageMode(mode):
    global _image_mode
    _image_mode = mode.lower() if isinstance(mode, str) else mode


def keyIsDown(code):
    return int(code) in _keys_down


def random(low, high=None):
    import random as _random

    if high is None:
        return _random.uniform(0, low)
    return _random.uniform(low, high)


def map(value, start1, stop1, start2, stop2):
    return start2 + (stop2 - start2) * ((value - start1) / (stop1 - start1))


def constrain(value, low, high):
    return max(low, min(high, value))


def dist(x1, y1, x2, y2):
    return math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)


def sin(a):
    return math.sin(a)


def cos(a):
    return math.cos(a)


def atan2(y, x):
    return math.atan2(y, x)


def sqrt(n):
    return math.sqrt(n)


def abs(n):
    return (
        __builtins__["abs"](n)
        if isinstance(__builtins__, dict)
        else __builtins__.abs(n)
    )


def floor(n):
    return math.floor(n)


def ceil(n):
    return math.ceil(n)


# --- Images ---


def loadImage(path, success=None, failure=None):
    from js import window  # type: ignore
    from pyodide.ffi import create_proxy  # type: ignore

    result = {"img": None, "done": False, "error": None}

    def _onload(_ev=None):
        result["done"] = True
        result["img"] = img
        if success:
            success(img)

    def _onerror(_ev=None):
        result["done"] = True
        result["error"] = f"Failed to load: {path}"
        if failure:
            failure(result["error"])

    img = window.Image.new()
    ok = create_proxy(_onload)
    err = create_proxy(_onerror)
    _proxy_keepalive.extend([ok, err])
    img.onload = ok
    img.onerror = err
    img.src = path
    return result


def image(img_result, x, y, w=None, h=None):
    from pyodide.ffi import to_js  # type: ignore

    if isinstance(img_result, dict):
        if not img_result["done"] or img_result["img"] is None:
            return
        raw = img_result["img"]
    else:
        raw = img_result

    js_img = to_js(raw)

    # Handle different image modes
    if w is not None:
        # We have width and possibly height parameters
        if _image_mode == "center":
            # CENTER mode: x, y is the center, w and h are width and height
            draw_x = x - w / 2
            draw_y = y - (h if h is not None else w) / 2
            draw_w = w
            draw_h = h if h is not None else w
        elif _image_mode == "corners" and h is not None:
            # CORNERS mode: x, y is one corner, w and h are opposite corner
            # Only applies when we have all 4 parameters (x, y, w, h)
            draw_x = x
            draw_y = y
            draw_w = w - x
            draw_h = h - y
        else:  # "corner" mode (default) or "corners" mode with only 3 parameters
            # CORNER mode: x, y is top-left corner, w and h are width and height
            # Also fallback for CORNERS mode with missing 4th parameter
            draw_x = x
            draw_y = y
            draw_w = w
            draw_h = h if h is not None else w

        _ctx.drawImage(js_img, draw_x, draw_y, draw_w, draw_h)
    else:
        # No width/height specified - draw at natural size
        if _image_mode == "center":
            # For CENTER mode with no dimensions, we need image dimensions
            # Try to get dimensions from the image object
            try:
                # Check if we can access width/height properties
                img_width = raw.width if hasattr(raw, "width") else None
                img_height = raw.height if hasattr(raw, "height") else None

                if img_width is not None and img_height is not None:
                    # Draw centered at x, y
                    draw_x = x - img_width / 2
                    draw_y = y - img_height / 2
                    _ctx.drawImage(js_img, draw_x, draw_y)
                else:
                    # Can't get dimensions, draw at corner
                    _ctx.drawImage(js_img, x, y)
            except Exception:
                # Any error, fall back to corner drawing
                _ctx.drawImage(js_img, x, y)
        else:
            # CORNER mode with no dimensions - draw at top-left corner
            # CORNERS mode requires 4 parameters, so with only 2 it falls back to CORNER behavior
            _ctx.drawImage(js_img, x, y)


# --- Color ---


def _color(r, g=None, b=None, a=None):
    if g is None:
        if isinstance(r, str):
            return r
        v = int(r)
        return f"rgb({v},{v},{v})"
    if a is None:
        return f"rgb({int(r)},{int(g)},{int(b)})"
    return f"rgba({int(r)},{int(g)},{int(b)},{a / 255:.3f})"


def color(r, g=None, b=None, a=None):
    return _color(r, g, b, a)


# --- IDE Runtime ---

_ide_console = None  # set by _ide_init, accessed by worker for input_response


def _ide_init(post_output, post_input):
    """Called once after Pyodide loads. Sets up I/O and imports transform."""
    global _ide_console
    import asyncio
    import builtins as _builtins
    import sys
    import traceback as _traceback

    post_output("stdout", "shim.py: _ide_init starting...")

    class _LineWriter:
        def __init__(self, kind):
            self.kind = kind
            self._buf = ""

        def write(self, s):
            self._buf += s
            while "\n" in self._buf:
                line, self._buf = self._buf.split("\n", 1)
                post_output(self.kind, line)

        def flush(self):
            if self._buf:
                post_output(self.kind, self._buf)
                self._buf = ""

        def fileno(self):
            raise OSError("not a real file")

    sys.stdout = _LineWriter("stdout")
    sys.stderr = _LineWriter("stderr")

    def _excepthook(exc_type, value, tb):
        lines = _traceback.format_exception(exc_type, value, tb)
        filtered = [
            l
            for l in lines
            if "_pyodide" not in l and "pyodide.py" not in l and "eval_code" not in l
        ]
        sys.stderr.write("".join(filtered))
        sys.stderr.flush()

    sys.excepthook = _excepthook

    class _Console:
        def __init__(self):
            self._future = None

        async def ainput(self, prompt=""):
            post_input(prompt)
            loop = asyncio.get_event_loop()
            self._future = loop.create_future()
            return await self._future

        def resolve(self, value: str):
            if self._future and not self._future.done():
                self._future.set_result(value)
            self._future = None

    _ide_console = _Console()
    sys.modules["console"] = _ide_console

    sys.path.insert(0, "/")
    post_output("stdout", "shim.py: Python path configured")

    # Define use function for @use decorator (processed by transform module)
    # This must be defined BEFORE importing actors, in case actors module has issues
    post_output("stdout", "shim.py: Defining use function...")

    def use(state_var):
        """Decorator for state variable access. Processed by transform module."""

        def decorator(func):
            return func

        return decorator

    _builtins.use = use
    post_output("stdout", "shim.py: use function added to builtins")

    post_output("stdout", "shim.py: Importing transform module...")
    import transform as _transform_mod

    _builtins.transform = _transform_mod.transform
    post_output("stdout", "shim.py: transform function added to builtins")

    # Try to import actors module, but don't fail if it has issues
    post_output("stdout", "shim.py: Attempting to import actors module...")
    try:
        import actors as _actors_mod

        post_output("stdout", "shim.py: Actors module imported successfully")

        # Only export actors if import succeeded
        post_output("stdout", "shim.py: Adding Actor functions to builtins...")
        _builtins.Actor = _actors_mod.Actor
        _builtins.collides = _actors_mod.collides
        _builtins.point_in = _actors_mod.point_in
        _builtins.bounce_off_edges = _actors_mod.bounce_off_edges
        _builtins.wrap_around_edges = _actors_mod.wrap_around_edges
        _builtins.move_towards = _actors_mod.move_towards
        _builtins.keep_on_screen = _actors_mod.keep_on_screen

        # Export constants
        _builtins.CIRCLE = _actors_mod.CIRCLE
        _builtins.RECT = _actors_mod.RECT
        _builtins.AUTO = _actors_mod.AUTO
        _builtins.CENTER = _actors_mod.CENTER
        _builtins.TOPLEFT = _actors_mod.TOPLEFT
        post_output("stdout", "shim.py: Actor system fully initialized")

    except Exception as e:
        # If actors import fails, log error but continue
        import sys

        post_output("stderr", f"shim.py: WARNING - Actors module import failed: {e}")
        post_output("stdout", "shim.py: Using dummy Actor functions instead")

        sys.stderr.write(f"Warning: Could not import actors module: {e}\n")
        sys.stderr.write("Actor system will not be available.\n")
        sys.stderr.flush()

        # Define dummy functions so code doesn't crash
        def dummy_actor(*args, **kwargs):
            raise ImportError("Actor module failed to load. Check console for errors.")

        _builtins.Actor = dummy_actor
        _builtins.collides = lambda a, b: False
        _builtins.point_in = lambda actor, x, y: False
        _builtins.bounce_off_edges = lambda actor, w, h: actor
        _builtins.wrap_around_edges = lambda actor, w, h: actor
        _builtins.move_towards = lambda actor, tx, ty, speed: actor
        _builtins.keep_on_screen = lambda actor, w, h: actor

        # Define dummy constants
        _builtins.CIRCLE = "circle"
        _builtins.RECT = "rect"
        _builtins.AUTO = "auto"
        _builtins.CENTER = "center"
        _builtins.TOPLEFT = "topleft"
        post_output("stdout", "shim.py: Dummy Actor functions configured")

    post_output("stdout", "shim.py: _ide_init completed successfully")


def _ide_run_p5(canvas, code_str: str, entry: str, assets=None):
    global _loop_running, frameCount, _target_fps, _keys_down
    global mouseX, mouseY, pmouseX, pmouseY, mouseButton
    global key, keyCode, keyIsPressed
    global _current_user_globals

    _loop_running = False
    frameCount = 0
    _target_fps = 60
    _keys_down = set()
    mouseX = mouseY = pmouseX = pmouseY = 0.0
    mouseButton = None
    key = ""
    keyCode = 0
    keyIsPressed = False

    _init(canvas)
    ns = {k: v for k, v in globals().items() if not k.startswith("_ide_")}
    if assets is not None:
        ns["assets"] = assets

    exec(compile(code_str, entry, "exec"), ns)
    _current_user_globals = ns
    _run_sketch(ns)


def _ide_build_assets(bitmap_list: list) -> object:
    """
    bitmap_list: Python list of (name, ImageBitmap) pairs from JS Object.entries()
    Returns assets namespace usable as assets.sprites.name
    """
    from types import SimpleNamespace

    def strip_ext(name):
        return name.rsplit(".", 1)[0] if "." in name else name

    sprites = SimpleNamespace(
        **{
            strip_ext(name): {"done": True, "img": bitmap}
            for name, bitmap in bitmap_list
        }
    )
    return SimpleNamespace(sprites=sprites)
