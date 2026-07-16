"""Minimal turtle graphics shim over the `graphics` module.

Standard turtle conventions:
  - Origin at canvas center, +x right, +y up.
  - Heading in degrees, counter-clockwise from east (0 = right, 90 = up).
  - Angles for `left`/`right` in degrees.

Draw commands are accumulated in the graphics module and painted when
`done()` / `mainloop()` (or `graphics.show()`) is called.
"""

import math as _math
import graphics as _g


_DEFAULT_W = 400
_DEFAULT_H = 400
_initialized = False


def _ensure_setup():
    global _initialized
    if _initialized:
        return
    if _g.width() <= 0 or _g.height() <= 0:
        _g.size(_DEFAULT_W, _DEFAULT_H)
    _g.background((255, 255, 255))
    _initialized = True


def _to_screen(x, y):
    return (_g.width() / 2 + x, _g.height() / 2 - y)


class Turtle:
    def __init__(self):
        _ensure_setup()
        self._x = 0.0
        self._y = 0.0
        self._heading = 0.0        # degrees, CCW from +x
        self._pen_down = True
        self._pen_size = 1
        self._pen_color = (0, 0, 0)
        self._fill_color = (0, 0, 0)
        self._filling = False
        self._fill_points = []
        self._visible = True

    # --- movement ---

    def forward(self, distance):
        rad = _math.radians(self._heading)
        nx = self._x + distance * _math.cos(rad)
        ny = self._y + distance * _math.sin(rad)
        self._goto(nx, ny)
    fd = forward

    def backward(self, distance):
        self.forward(-distance)
    back = backward
    bk = backward

    def right(self, angle):
        self._heading = (self._heading - angle) % 360
    rt = right

    def left(self, angle):
        self._heading = (self._heading + angle) % 360
    lt = left

    def setheading(self, angle):
        self._heading = float(angle) % 360
    seth = setheading

    def goto(self, x, y=None):
        if y is None:
            x, y = x
        self._goto(float(x), float(y))
    setpos = goto
    setposition = goto

    def setx(self, x):
        self._goto(float(x), self._y)

    def sety(self, y):
        self._goto(self._x, float(y))

    def home(self):
        self._goto(0.0, 0.0)
        self._heading = 0.0

    def _goto(self, nx, ny):
        if self._pen_down:
            sx1, sy1 = _to_screen(self._x, self._y)
            sx2, sy2 = _to_screen(nx, ny)
            _g.stroke(*self._pen_color)
            _g.stroke_width(self._pen_size)
            _g.line(sx1, sy1, sx2, sy2)
        if self._filling:
            self._fill_points.append(_to_screen(nx, ny))
        self._x = nx
        self._y = ny

    # --- pen state ---

    def penup(self):
        self._pen_down = False
    pu = penup
    up = penup

    def pendown(self):
        self._pen_down = True
    pd = pendown
    down = pendown

    def isdown(self):
        return self._pen_down

    def pensize(self, width=None):
        if width is None:
            return self._pen_size
        self._pen_size = int(width)
    width = pensize

    def pencolor(self, *args):
        if not args:
            return self._pen_color
        self._pen_color = _parse_color(args)

    def fillcolor(self, *args):
        if not args:
            return self._fill_color
        self._fill_color = _parse_color(args)

    def color(self, *args):
        if not args:
            return (self._pen_color, self._fill_color)
        if len(args) == 1:
            c = _parse_color(args)
            self._pen_color = c
            self._fill_color = c
        elif len(args) == 2:
            self._pen_color = _parse_color((args[0],))
            self._fill_color = _parse_color((args[1],))
        else:
            c = _parse_color(args)
            self._pen_color = c
            self._fill_color = c

    def begin_fill(self):
        self._filling = True
        self._fill_points = [_to_screen(self._x, self._y)]

    def end_fill(self):
        if self._filling and len(self._fill_points) >= 3:
            _g.fill(*self._fill_color)
            if self._pen_down:
                _g.stroke(*self._pen_color)
                _g.stroke_width(self._pen_size)
            else:
                _g.no_stroke()
            _g.polygon(list(self._fill_points))
        self._filling = False
        self._fill_points = []

    # --- shapes ---

    def circle(self, radius, extent=None, steps=None):
        if extent is None:
            extent = 360
        if steps is None:
            steps = max(12, int(abs(extent) / 6))
        # Turtle circle: arc to the LEFT of heading, tangent to current pos.
        # Center is 90° left of heading, at distance |radius|.
        sign = 1 if radius >= 0 else -1
        r = abs(radius)
        theta0 = _math.radians(self._heading + sign * 90)
        cx = self._x - r * _math.cos(theta0) * sign * -1 + r * _math.cos(theta0) * 0
        # Simpler: center = pos + r * (unit vector 90° left of heading)
        cx = self._x + r * _math.cos(_math.radians(self._heading + 90 * sign))
        cy = self._y + r * _math.sin(_math.radians(self._heading + 90 * sign))
        # Starting angle from center to turtle:
        start_ang = _math.degrees(_math.atan2(self._y - cy, self._x - cx))
        step_ang = extent / steps * sign
        for i in range(1, steps + 1):
            a = _math.radians(start_ang + step_ang * i)
            nx = cx + r * _math.cos(a)
            ny = cy + r * _math.sin(a)
            self._goto(nx, ny)
        self._heading = (self._heading + extent * sign) % 360

    def dot(self, size=None, *color):
        d = int(size) if size else max(self._pen_size + 4, 5)
        c = _parse_color(color) if color else self._pen_color
        _g.fill(*c)
        _g.no_stroke()
        sx, sy = _to_screen(self._x, self._y)
        _g.circle(sx, sy, d / 2)

    def stamp(self):
        self.dot()

    # --- queries ---

    def position(self):
        return (self._x, self._y)
    pos = position

    def xcor(self):
        return self._x

    def ycor(self):
        return self._y

    def heading(self):
        return self._heading

    def distance(self, x, y=None):
        if y is None:
            x, y = x
        return _math.hypot(x - self._x, y - self._y)

    def towards(self, x, y=None):
        if y is None:
            x, y = x
        return _math.degrees(_math.atan2(y - self._y, x - self._x)) % 360

    # --- visibility (visual turtle marker not drawn; no-ops kept for compat) ---

    def hideturtle(self):
        self._visible = False
    ht = hideturtle

    def showturtle(self):
        self._visible = True
    st = showturtle

    def isvisible(self):
        return self._visible

    def speed(self, s=None):
        return s  # no-op in this shim

    def clear(self):
        pass  # clearing individual turtle strokes not supported

    def reset(self):
        self.__init__()

    def write(self, arg, move=False, align="left", font=None):
        sx, sy = _to_screen(self._x, self._y)
        if font and isinstance(font, (list, tuple)) and len(font) >= 2:
            _g.text_size(int(font[1]))
        _g.fill(*self._pen_color)
        _g.text_align(align)
        _g.text(str(arg), sx, sy)


def _parse_color(args):
    if len(args) == 1:
        c = args[0]
        if isinstance(c, str):
            from graphics._color import _resolve_color
            return _resolve_color(c)
        if isinstance(c, (tuple, list)) and len(c) == 3:
            return (int(c[0]), int(c[1]), int(c[2]))
    if len(args) == 3:
        return (int(args[0]), int(args[1]), int(args[2]))
    return (0, 0, 0)


# === Module-level default turtle (classic turtle API) ===

_default = None


def _t():
    global _default
    if _default is None:
        _default = Turtle()
    return _default


def _make_proxy(name):
    def _fn(*a, **kw):
        return getattr(_t(), name)(*a, **kw)
    _fn.__name__ = name
    return _fn


for _name in (
    "forward", "fd", "backward", "back", "bk",
    "right", "rt", "left", "lt",
    "setheading", "seth",
    "goto", "setpos", "setposition", "setx", "sety",
    "home",
    "penup", "pu", "up", "pendown", "pd", "down", "isdown",
    "pensize", "width",
    "pencolor", "fillcolor", "color",
    "begin_fill", "end_fill",
    "circle", "dot", "stamp",
    "position", "pos", "xcor", "ycor", "heading",
    "distance", "towards",
    "hideturtle", "ht", "showturtle", "st", "isvisible",
    "speed", "clear", "reset", "write",
):
    globals()[_name] = _make_proxy(_name)


def bgcolor(*args):
    _ensure_setup()
    _g.background(*_parse_color(args))


def setup(width=_DEFAULT_W, height=_DEFAULT_H, startx=None, starty=None):
    global _initialized
    _g.size(int(width), int(height))
    _g.background((255, 255, 255))
    _initialized = True


def screensize(w=None, h=None, bg=None):
    if w and h:
        _g.size(int(w), int(h))
    if bg is not None:
        _g.background(*_parse_color((bg,)))


def title(_s):
    pass


class Screen:
    def setup(self, width=_DEFAULT_W, height=_DEFAULT_H, startx=None, starty=None):
        setup(width, height, startx, starty)

    def bgcolor(self, *args):
        bgcolor(*args)

    def title(self, s):
        title(s)

    def tracer(self, *a, **kw):
        pass

    def update(self):
        _g.show()

    def exitonclick(self):
        done()

    def mainloop(self):
        done()


def getscreen():
    return Screen()


def done():
    _g.show()
mainloop = done
