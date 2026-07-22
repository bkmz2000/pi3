"""Geometry shapes: the Shape base, Line, and the Segment primitive.

A Shape is a piece of level geometry that students can draw and bounce
velocities off of::

    wall = Line((0, 400), (600, 400))       # a floor
    ...
    ball.vel = ball.vel.bounce_of(wall)     # reflect off it
    wall.draw()

Subclasses (Line here; Polygon and Spline arrive in later stages) share this
base's dirty-tracking, its cached `segments`/`bounds`, and its `draw()` path.
Rebuild work is lazy — it happens the first time `segments`, `bounds`, or
`draw()` is used after the shape changes, never on construction alone.
"""

from collections import namedtuple

from graphics._vec import Vector2
from graphics import _state


# One straight piece of a shape's outline, running from `a` to `b`.
# Both endpoints are Vector2. Used by normal_at / collision lookups.
Segment = namedtuple("Segment", ["a", "b"])


class Shape:
    """Base class for Line / Polygon / Spline. Not instantiated directly.

    Owns the lazy-rebuild machinery. A subclass implements `_rebuild()` to fill
    `self._segments` (list of Segment) and `self._draw_points` (a flat
    ``[x1, y1, x2, y2, ...]`` list); the base derives `bounds` from those points
    and renders `draw()` from them.
    """

    def __init__(self, thickness=2):
        self._dirty = True
        self._segments = []
        self._draw_points = []
        self._bounds = None
        self._thickness = int(thickness)

    # --- lazy rebuild ---

    def _rebuild(self):
        """Populate self._segments and self._draw_points. Subclass responsibility."""
        raise NotImplementedError

    def _ensure_built(self):
        if self._dirty:
            self._rebuild()
            self._compute_bounds()
            self._dirty = False

    def _compute_bounds(self):
        pts = self._draw_points
        if not pts:
            self._bounds = None
            return
        xs = pts[0::2]
        ys = pts[1::2]
        self._bounds = (min(xs), min(ys), max(xs), max(ys))

    # --- read-only public surface ---

    @property
    def thickness(self):
        """Stroke width in pixels. Set once in the constructor; read-only after."""
        return self._thickness

    @property
    def segments(self):
        """The Segment(a, b) pieces making up the outline (rebuilt lazily)."""
        self._ensure_built()
        return self._segments

    @property
    def bounds(self):
        """Axis-aligned bounding box as (min_x, min_y, max_x, max_y), or None if empty."""
        self._ensure_built()
        return self._bounds

    def normal_at(self, point=None):
        """Unit surface normal used by Vector2.bounce_of. Subclass responsibility."""
        raise NotImplementedError

    # --- rendering ---

    def draw(self):
        """Queue this shape to be drawn this frame, using the current stroke color."""
        self._ensure_built()
        pts = self._draw_points
        if len(pts) < 4:
            return
        # Wrap in push/pop so this shape's own thickness restores afterward and
        # does not leak into the global stroke width used by line()/rect()/etc.
        _state._draw_commands.append(("push", (), {}))
        _state._draw_commands.append(("stroke_width", (self._thickness,), {}))
        _state._draw_commands.append(("polyline", (list(pts),), {}))
        _state._draw_commands.append(("pop", (), {}))


class Line(Shape):
    """A straight wall between two points.

        wall = Line((0, 400), (600, 400))       # a floor
        ball.vel = ball.vel.bounce_of(wall)     # reflect off it
        wall.draw()

    `thickness` is the stroke width and is fixed at construction time.
    """

    def __init__(self, a, b, thickness=2):
        super().__init__(thickness=thickness)
        self._a = Vector2(a)
        self._b = Vector2(b)

    @property
    def a(self):
        """First endpoint (Vector2)."""
        return self._a

    @property
    def b(self):
        """Second endpoint (Vector2)."""
        return self._b

    def _rebuild(self):
        a, b = self._a, self._b
        self._segments = [Segment(a, b)]
        self._draw_points = [a.x, a.y, b.x, b.y]

    def normal_at(self, point=None):
        """Unit normal to the line. `point` is ignored — a line has one normal.

        The sign is left unspecified (it points to one side or the other);
        Vector2.bounce_of is invariant to it, so callers never have to care which.
        """
        self._ensure_built()
        a, b = self._a, self._b
        d = Vector2(b.x - a.x, b.y - a.y)
        return Vector2(-d.y, d.x).normalized()
