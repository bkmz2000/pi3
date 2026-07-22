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

# A point within this squared-distance of an edge counts as "on the boundary"
# — and on-boundary counts as inside (documented contains() behavior).
_ON_EDGE_EPS_SQ = 1e-6


class Shape:
    """Base class for Line / Polygon / Spline. Not instantiated directly.

    Owns the lazy-rebuild machinery. A subclass implements `_rebuild()` to fill
    `self._segments` (list of Segment) and `self._draw_points` (a flat
    ``[x1, y1, x2, y2, ...]`` list); the base derives `bounds` from those points
    and renders `draw()` from them.
    """

    # Draw-command name emitted by draw(); subclasses that form a closed region
    # (Polygon) override this to "polygon" so the renderer fills and closes it.
    _draw_cmd = "polyline"

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

    # --- shared geometry helpers (used by Polygon now; Spline in Phase 3) ---

    @staticmethod
    def _point_seg_dist_sq(p, a, b):
        """Squared distance from point `p` to the segment a->b (endpoints clamped)."""
        abx = b.x - a.x
        aby = b.y - a.y
        denom = abx * abx + aby * aby
        if denom == 0.0:
            dx = p.x - a.x
            dy = p.y - a.y
            return dx * dx + dy * dy
        t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / denom
        if t < 0.0:
            t = 0.0
        elif t > 1.0:
            t = 1.0
        dx = p.x - (a.x + t * abx)
        dy = p.y - (a.y + t * aby)
        return dx * dx + dy * dy

    def _closest_segment(self, p):
        """Return the Segment nearest to point `p` (O(edges) scan)."""
        best = None
        best_d = None
        for seg in self._segments:
            d = self._point_seg_dist_sq(p, seg.a, seg.b)
            if best_d is None or d < best_d:
                best_d = d
                best = seg
        return best

    def _point_in_polygon(self, p, points):
        """Even-odd ray-cast test. On-boundary (within eps of an edge) is inside."""
        n = len(points)
        if n < 3:
            return False
        # Boundary first: sitting on an edge counts as inside.
        for i in range(n):
            if self._point_seg_dist_sq(p, points[i], points[(i + 1) % n]) <= _ON_EDGE_EPS_SQ:
                return True
        inside = False
        j = n - 1
        for i in range(n):
            xi, yi = points[i].x, points[i].y
            xj, yj = points[j].x, points[j].y
            if ((yi > p.y) != (yj > p.y)) and \
                    (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi):
                inside = not inside
            j = i
        return inside

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
        _state._draw_commands.append((self._draw_cmd, (list(pts),), {}))
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


class Polygon(Shape):
    """A closed region defined by a ring of points.

        level = Polygon([(0, 0), (200, 0), (200, 150), (0, 150)])
        if level.contains(ball.pos):
            ball.vel = ball.vel.bounce_of(level, at=ball.pos)
        level.draw()

    The points form a closed loop — the last point connects back to the first,
    so you do not repeat the starting point. Being a region, draw() fills it
    with the current fill color and outlines it with the current stroke.
    """

    _draw_cmd = "polygon"

    def __init__(self, points, thickness=2):
        super().__init__(thickness=thickness)
        self._points = [Vector2(p) for p in points]

    @property
    def points(self):
        """The corner points (list of Vector2), in order."""
        return self._points

    def _rebuild(self):
        pts = self._points
        n = len(pts)
        segs = []
        draw = []
        for i in range(n):
            a = pts[i]
            b = pts[(i + 1) % n]   # closed loop: last edge wraps to the first point
            segs.append(Segment(a, b))
            draw.append(a.x)
            draw.append(a.y)
        self._segments = segs
        self._draw_points = draw

    def normal_at(self, point=None):
        """Unit normal of the edge nearest `point`.

        Pass the contact point (e.g. `at=ball.pos`) so the bounce uses the side
        the ball actually hit. With no point, falls back to the first edge. The
        sign is unspecified; Vector2.bounce_of is invariant to it.
        """
        self._ensure_built()
        if point is None:
            seg = self._segments[0]
        else:
            seg = self._closest_segment(Vector2(point))
        d = Vector2(seg.b.x - seg.a.x, seg.b.y - seg.a.y)
        return Vector2(-d.y, d.x).normalized()

    def contains(self, point):
        """True if `point` is inside the polygon. A point on an edge counts as inside."""
        self._ensure_built()
        return self._point_in_polygon(Vector2(point), self._points)
